import type { RequestHandler } from "./$types.js";

const SITE_URL = "https://novira.id";

const staticRoutes = ["/login", "/register"];

export const GET: RequestHandler = async () => {
	const urls = staticRoutes.map((path) => ({
		loc: `${SITE_URL}${path}`,
		lastmod: new Date().toISOString().split("T")[0],
	}));

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>\n    <loc>${url.loc}</loc>\n    <lastmod>${url.lastmod}</lastmod>\n  </url>`).join("\n")}
</urlset>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "max-age=3600",
		},
	});
};
