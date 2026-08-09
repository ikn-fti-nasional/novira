import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		noExternal: ["layerchart", "svelte-ux"],
	},
	optimizeDeps: {
		noDiscovery: true,
		exclude: ["better-sqlite3", "@node-rs/argon2"],
	},
	environments: {
		ssr: {
			optimizeDeps: {
				noDiscovery: true,
			},
		},
	},
	test: {
		include: ["src/**/*.test.ts"],
	},
});
