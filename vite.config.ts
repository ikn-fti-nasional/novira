import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		noExternal: ["layerchart", "svelte-ux"],
	},
	test: {
		include: ["src/**/*.test.ts"],
		// PGlite (WASM Postgres) cold-start is ~8-10s per fresh instance;
		// defaults of 5s/10s cause spurious timeouts on the test DB hook.
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
