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

/**
 * CA chain yang menerbitkan cert `stream.klaten.go.id:8080` (Sectigo
 * intermediate R36 + root R46). Server tidak mengirim intermediate chain
 * sehingga verifikasi CA sistem gagal; CA chain ini dipakai sebagai trust
 * anchor (certificate pinning) — hanya cert yang benar-benar diterbitkan
 * Sectigo untuk domain ini yang diterima, bukan `rejectUnauthorized: false`
 * yang menerima cert apa pun.
 * ROTASI: intermediate cert berlaku s.d. 2036-03-21, root s.d. 2046-03-21.
 * Saat chain berubah (atau Klaten pindah issuer), ambil PEM baru via
 * `echo | openssl s_client -connect stream.klaten.go.id:8080 -showcerts`
 * dan ganti konstanta ini.
 */
const KLATEN_CA = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq
RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH
12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja
EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm
M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv
38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB
pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn
2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN
xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8
ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d
q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF
h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH
5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD
4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd
unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536
WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l
7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW
r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh
JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIFijCCA3KgAwIBAgIQdY39i658BwD6qSWn4cetFDANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNNDYwMzIxMjM1OTU5WjBfMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQDEy1TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCTvtU2UnXYASOgHEdCSe5jtrch/cSV1UgrJnwUUxDa
ef0rty2k1Cz66jLdScK5vQ9IPXtamFSvnl0xdE8H/FAh3aTPaE8bEmNtJZlMKpnz
SDBh+oF8HqcIStw+KxwfGExxqjWMrfhu6DtK2eWUAtaJhBOqbchPM8xQljeSM9xf
iOefVNlI8JhD1mb9nxc4Q8UBUQvX4yMPFF1bFOdLvt30yNoDN9HWOaEhUTCDsG3X
ME6WW5HwcCSrv0WBZEMNvSE6Lzzpng3LILVCJ8zab5vuZDCQOc2TZYEhMbUjUDM3
IuM47fgxMMxF/mL50V0yeUKH32rMVhlATc6qu/m1dkmU8Sf4kaWD5QazYw6A3OAS
VYCmO2a0OYctyPDQ0RTp5A1NDvZdV3LFOxxHVp3i1fuBYYzMTYCQNFu31xR13NgE
SJ/AwSiItOkcyqex8Va3e0lMWeUgFaiEAin6OJRpmkkGj80feRQXEgyDet4fsZfu
+Zd4KKTIRJLpfSYFplhym3kT2BFfrsU4YjRosoYwjviQYZ4ybPUHNs2iTG7sijbt
8uaZFURww3y8nDnAtOFr94MlI1fZEoDlSfB1D++N6xybVCi0ITz8fAr/73trdf+L
HaAZBav6+CuBQug4urv7qv094PPK306Xlynt8xhW6aWWrL3DkJiy4Pmi1KZHQ3xt
zwIDAQABo0IwQDAdBgNVHQ4EFgQUVnNYZJX5khqwEioEYnmhQBWIIUkwDgYDVR0P
AQH/BAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQEMBQADggIBAC9c
mTz8Bl6MlC5w6tIyMY208FHVvArzZJ8HXtXBc2hkeqK5Duj5XYUtqDdFqij0lgVQ
YKlJfp/imTYpE0RHap1VIDzYm/EDMrraQKFz6oOht0SmDpkBm+S8f74TlH7Kph52
gDY9hAaLMyZlbcp+nv4fjFg4exqDsQ+8FxG75gbMY/qB8oFM2gsQa6H61SilzwZA
Fv97fRheORKkU55+MkIQpiGRqRxOF3yEvJ+M0ejf5lG5Nkc/kLnHvALcWxxPDkjB
JYOcCj+esQMzEhonrPcibCTRAUH4WAP+JWgiH5paPHxsnnVI84HxZmduTILA7rpX
DhjvLpr3Etiga+kFpaHpaPi8TD8SHkXoUsCjvxInebnMMTzD9joiFgOgyY9mpFui
TdaBJQbpdqQACj7LzTWb4OE4y2BThihCQRxEV+ioratF4yUQvNs+ZUH7G6aXD+u5
dHn5HrwdVw1Hr8Mvn4dGp+smWg9WY7ViYG4A++MnESLn/pmPNPW56MORcr3Ywx65
LvKRRFHQV80MNNVIIb/bE/FmJUNS0nAiNs2fxBx1IK1jcmMGDw4nztJqDby1ORrp
0XZ60Vzk50lJLVU3aPAaOpg+VBeHVOmmJ1CJeyAvP/+/oYtKR5j/K3tJPsMpRmAY
QqszKbrAKbkTidOIijlBO8n9pu0f9GBj39ItVQGL
-----END CERTIFICATE-----`;

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
		// verifikasi CA normal gagal. Pakai node:https dengan cert upstream
		// sebagai trust anchor (certificate pinning) — bukan
		// rejectUnauthorized: false yang menerima cert apa pun.
		return new Promise((resolve, reject) => {
			const req = httpsRequest(
				url,
				{
					method: "GET",
					headers,
					ca: KLATEN_CA,
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

export const GET: RequestHandler = async ({ params, request, locals }) => {
	// Proxy CCTV adalah bandwidth & SSRF-sensitive — hanya user login yang boleh pakai.
	// Tanpa auth, siapa pun bisa crawl upstream ATCS lewat server kita.
	if (!locals.user) {
		error(401, "Unauthorized");
	}
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
