import { error } from "@sveltejs/kit";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
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
		// stream.klaten.go.id memakai sertifikat self-signed — Node fetch
		// (undici) tidak punya per-request TLS option, jadi pakai
		// node:https langsung dengan rejectUnauthorized: false.
		return new Promise((resolve, reject) => {
			const req = httpsRequest(
				url,
				{
					method: "GET",
					headers,
					rejectUnauthorized: false,
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
	for (const key of ["content-type", "content-length", "accept-ranges", "etag"]) {
		const value = upstream.headers[key];
		if (value) headers.set(key, value);
	}
	if (relPath.endsWith(".ts")) {
		headers.set("Cache-Control", "public, max-age=60");
	}

	return new Response(upstream.body, { status: upstream.status, headers });
};
