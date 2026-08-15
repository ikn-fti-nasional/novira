import { error } from "@sveltejs/kit";
import { request as httpsRequest } from "node:https";
import { createHash, createPublicKey } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { PeerCertificate } from "node:tls";
import { Readable } from "node:stream";
import type { RequestHandler } from "./$types.js";

/**
 * Proxy HLS publik yang menolak koneksi lintas-origin dari browser.
 * Upstream server CCTV (Bandung, Surabaya, Tangerang, Klaten) tidak
 * mengirim `Access-Control-Allow-Origin` yang cocok, sehingga hls.js
 * tidak bisa memuatnya langsung. Route ini mengambil stream di sisi
 * server (tidak terikat CORS) dan meneruskannya same-origin.
 */
const SOURCES: Record<string, { base: string; spoofOrigin?: boolean; tlsBypass?: boolean }> = {
	bandung: {
		base: "https://pelindung.bandung.go.id:3443/video/",
		spoofOrigin: true,
	},
	surabaya: { base: "http://36.66.208.101:5000/hls/" },
	tangerang: { base: "https://cctv-dishub.tangerangkab.go.id/storage/video/" },
	klaten: { base: "https://stream.klaten.go.id:8080/cctv/hls/", tlsBypass: true },
};

const VALID_PATH = /^[A-Za-z0-9_\-./]+$/;
const TIMEOUT_MS = 30_000;

/**
 * SPKI SHA-256 cert `stream.klaten.go.id:8080` (Sectigo wildcard
 * `*.klaten.go.id`, valid s.d. 2026-12-13). Server tidak mengirim
 * intermediate chain sehingga verifikasi CA normal gagal; pin public key
 * sebagai gantinya agar hanya cert asli yang diterima.
 * ROTASI: saat sertifikat upstream diperbarui, ganti nilai ini (ambil via
 * `openssl s_client -connect host:port | openssl x509 -pubkey | openssl
 * pkey -pubin -outform der | openssl dgst -sha256`).
 */
const KLATEN_SPKI_PIN = "839f57eb1c55d892a2ed0b358119181dece49266d7a8f992172967b281a67f27";

/** Cek SPKI cert upstream terhadap pin — tolak cert apa pun yang bukan milik Klaten. */
function verifyKlatenPin(hostname: string, cert: PeerCertificate): Error | undefined {
	if (!cert.pubkey) return new Error(`Certificate pin mismatch for ${hostname}`);
	const der = createPublicKey(cert.pubkey).export({ type: "spki", format: "der" });
	const digest = createHash("sha256").update(der).digest("hex");
	if (digest === KLATEN_SPKI_PIN) return undefined;
	return new Error(`Certificate pin mismatch for ${hostname}`);
}

async function fetchUpstream(
	url: string,
	source: (typeof SOURCES)[string],
	requestHeaders: Headers
): Promise<{ status: number; headers: Record<string, string>; body: ReadableStream }> {
	const headers: Record<string, string> = { "User-Agent": "Novira-CCTV-Proxy/1.0" };
	if (source.spoofOrigin) {
		headers["Origin"] = new URL(source.base).origin;
		headers["Referer"] = new URL(source.base).origin + "/";
	}
	const range = requestHeaders.get("range");
	if (range) headers["Range"] = range;

	if (source.tlsBypass) {
		// stream.klaten.go.id tidak mengirim intermediate chain cert, jadi
		// verifikasi CA normal gagal. Pakai node:https dengan pin SPKI
		// (bukan rejectUnauthorized: false yang menerima cert apa pun).
		return new Promise((resolve, reject) => {
			const req = httpsRequest(
				url,
				{
					method: "GET",
					headers,
					rejectUnauthorized: false,
					checkServerIdentity: verifyKlatenPin,
					timeout: TIMEOUT_MS,
				},
				(res: IncomingMessage) => {
					resolve({
						status: res.statusCode ?? 502,
						headers: res.headers as Record<string, string>,
						body: Readable.toWeb(res) as ReadableStream,
					});
				}
			);
			req.on("error", (err) => {
				const message = err instanceof Error ? err.message : "request failed";
				reject(new Error(message));
			});
			// `timeout` option hanya menandai event; abort manual agar
			// request beneran berhenti dan handler error di atas reject.
			req.on("timeout", () => {
				req.destroy(new Error("upstream request timed out"));
			});
			req.end();
		});
	}

	const res = await fetch(url, {
		method: "GET",
		headers,
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	return {
		status: res.status,
		headers: Object.fromEntries(res.headers.entries()),
		body: res.body as ReadableStream,
	};
}

export const GET: RequestHandler = async ({ params, request }) => {
	const [sourceName, ...rest] = (params.path ?? "").split("/");
	const source = SOURCES[sourceName];
	if (!source || rest.length === 0) {
		error(404, "Source not found");
	}

	const relPath = rest.join("/");
	if (!VALID_PATH.test(relPath) || relPath.includes("..")) {
		error(400, "Invalid path");
	}

	const upstream = await fetchUpstream(source.base + relPath, source, request.headers);

	const headers = new Headers();
	// `content-range` wajib diteruskan untuk respons 206 parsial agar
	// browser bisa memvalidasi byte range (MP4 & HLS EXT-X-BYTERANGE).
	for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
		const value = upstream.headers[key];
		if (value) headers.set(key, value);
	}
	if (relPath.endsWith(".ts")) {
		headers.set("Cache-Control", "public, max-age=60");
	}

	return new Response(upstream.body, { status: upstream.status, headers });
};
