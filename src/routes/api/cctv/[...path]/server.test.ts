import { describe, it, expect } from "vitest";

const { GET } = await import("./+server.js");

async function callGet(path: string): Promise<Response> {
	return GET({
		params: { path },
		request: new Request("http://localhost/api/cctv/" + path),
	} as any);
}

describe("CCTV proxy route", () => {
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
});
