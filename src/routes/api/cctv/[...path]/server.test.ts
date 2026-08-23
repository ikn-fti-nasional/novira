import { describe, it, expect, vi, afterEach } from "vitest";

const { GET } = await import("./+server.js");

const AUTHED_LOCALS = { user: { id: "u1", role: "operator" } };

async function callGet(path: string, headers: Record<string, string> = {}): Promise<Response> {
	return GET({
		params: { path },
		request: new Request("http://localhost/api/cctv/" + path, { headers }),
		locals: AUTHED_LOCALS,
	} as any);
}

describe("CCTV proxy route", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects unauthenticated requests with 401", async () => {
		await expect(
			GET({
				params: { path: "bandung/stream.m3u8" },
				request: new Request("http://localhost/api/cctv/bandung/stream.m3u8"),
				locals: { user: null },
			} as any)
		).rejects.toMatchObject({ status: 401 });
	});

	it("returns 404 for unknown source", async () => {
		await expect(callGet("narnia/stream.m3u8")).rejects.toMatchObject({
			status: 404,
		});
	});

	it("returns 404 when path is empty", async () => {
		await expect(callGet("bandung")).rejects.toMatchObject({ status: 404 });
	});

	it("returns 400 for path traversal", async () => {
		await expect(callGet("bandung/../etc/passwd")).rejects.toMatchObject({
			status: 400,
		});
	});

	it("returns 400 for invalid characters", async () => {
		await expect(callGet("surabaya/stream.m3u8?x=1")).rejects.toMatchObject({
			status: 400,
		});
	});

	it("forwards 206 partial responses with content-range", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response("first-chunk", {
					status: 206,
					headers: {
						"content-type": "video/mp2t",
						"content-length": "11",
						"content-range": "bytes 0-10/1000",
						"accept-ranges": "bytes",
					},
				})
			)
		);

		const res = await callGet("surabaya/cctv_337/stream.m3u8", {
			Range: "bytes=0-10",
		});

		expect(res.status).toBe(206);
		expect(res.headers.get("content-range")).toBe("bytes 0-10/1000");
		expect(res.headers.get("accept-ranges")).toBe("bytes");
		await expect(res.text()).resolves.toBe("first-chunk");
	});
});
