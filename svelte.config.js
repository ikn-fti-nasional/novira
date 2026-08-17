import adapterNode from "@sveltejs/adapter-node";
import adapterVercel from "@sveltejs/adapter-vercel";

// Vercel sets VERCEL=1 during its builds; self-host (Docker/VPS) builds run
// `pnpm build` without it and keep producing a build/ dir runnable via `node build`.
const adapter = process.env.VERCEL
	? adapterVercel({ runtime: "nodejs22.x" })
	: adapterNode({ out: "build" });

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter,
	},
};

export default config;
