import { fileURLToPath } from "node:url";
import { db } from "./index.js";
import {
	users,
	pages,
	notifications,
	appSettings,
	sessions,
	passwordResetTokens,
	cameras,
	publicReports,
} from "./schema.js";
import { hashPassword } from "../password.js";
import { generateId } from "../id.js";
import { createUser } from "./users.js";

function daysAgo(n: number): Date {
	return new Date(Date.now() - n * 86400000);
}

function randomItem<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function seedDemo() {
	console.log("Clearing existing data...");
	// Delete children before parents — users is referenced by every other table.
	// password_reset_tokens must be cleared too or the users delete below fails
	// with a foreign-key violation.
	await db.delete(notifications);
	await db.delete(pages);
	await db.delete(cameras);
	await db.delete(publicReports);
	await db.delete(sessions);
	await db.delete(passwordResetTokens);
	await db.delete(appSettings);
	await db.delete(users);

	// --- USERS ---
	// ~50 users with accelerating signups over 12 months (realistic growth curve)
	console.log("Creating users...");
	const passwordHash = await hashPassword("password123");

	const userData = [
		// Demo account — what the login page pre-fills. Restricted to the
		// operator role so public visitors can explore without admin powers.
		// Protected from self-modification by the (app) settings actions (see
		// updateProfile / changePassword).
		{
			name: "Demo User",
			email: "demo@novira.dev",
			username: "demo",
			password: "NoviraDemo2026!",
			role: "operator" as const,
			daysAgo: 365,
		},
		// Executive demo accounts — login redirects these to /eksekutif.
		{
			name: "Dr. H. Bambang Tirto",
			email: "walikota@bandung.go.id",
			username: "walikota",
			password: "password123",
			role: "walikota" as const,
			daysAgo: 365,
		},
		{
			name: "Ir. Dedi Kusnadi, M.Si",
			email: "kepala.dinas@bandung.go.id",
			username: "kepala_dinas",
			password: "password123",
			role: "kepala_dinas" as const,
			daysAgo: 365,
		},
		// Operational demo accounts — control room & reports.
		{
			name: "Sari Wulandari",
			email: "operator@bandung.go.id",
			username: "operator",
			password: "password123",
			role: "operator" as const,
			daysAgo: 365,
		},
		{
			name: "H. Agus Salim, S.Sos",
			email: "kepala.seksi@bandung.go.id",
			username: "kepala_seksi",
			password: "password123",
			role: "kepala_seksi" as const,
			daysAgo: 365,
		},
		{
			name: "Budi Santoso",
			email: "petugas@bandung.go.id",
			username: "petugas",
			password: "password123",
			role: "petugas_lapangan" as const,
			daysAgo: 365,
		},
		// 12 months ago (2 users)
		{
			name: "Admin User",
			email: "admin@novira.dev",
			username: "admin",
			role: "admin" as const,
			daysAgo: 365,
		},
		{
			name: "Sarah Chen",
			email: "sarah@novira.dev",
			username: "sarah",
			role: "admin" as const,
			daysAgo: 358,
		},
		// 11 months ago (2 users)
		{
			name: "Marcus Johnson",
			email: "marcus@novira.dev",
			username: "marcus",
			role: "operator" as const,
			daysAgo: 340,
		},
		{
			name: "Elena Rodriguez",
			email: "elena@novira.dev",
			username: "elena",
			role: "operator" as const,
			daysAgo: 332,
		},
		// 10 months ago (3 users)
		{
			name: "James Park",
			email: "james@novira.dev",
			username: "james",
			role: "operator" as const,
			daysAgo: 310,
		},
		{
			name: "Priya Sharma",
			email: "priya@novira.dev",
			username: "priya",
			role: "admin" as const,
			daysAgo: 305,
		},
		{
			name: "Alex Turner",
			email: "alex@novira.dev",
			username: "alex",
			role: "petugas_lapangan" as const,
			daysAgo: 298,
		},
		// 9 months ago (3 users)
		{
			name: "Mei Lin",
			email: "mei@novira.dev",
			username: "mei",
			role: "operator" as const,
			daysAgo: 278,
		},
		{
			name: "David Kim",
			email: "david@novira.dev",
			username: "david",
			role: "petugas_lapangan" as const,
			daysAgo: 270,
		},
		{
			name: "Rachel Foster",
			email: "rachel@novira.dev",
			username: "rachel",
			role: "petugas_lapangan" as const,
			daysAgo: 265,
		},
		// 8 months ago (3 users)
		{
			name: "Olivia Brown",
			email: "olivia@novira.dev",
			username: "olivia",
			role: "operator" as const,
			daysAgo: 248,
		},
		{
			name: "Lucas Miller",
			email: "lucas@novira.dev",
			username: "lucas",
			role: "petugas_lapangan" as const,
			daysAgo: 242,
		},
		{
			name: "Anya Petrov",
			email: "anya@novira.dev",
			username: "anya",
			role: "petugas_lapangan" as const,
			daysAgo: 235,
		},
		// 7 months ago (4 users)
		{
			name: "Noah Williams",
			email: "noah@novira.dev",
			username: "noah",
			role: "operator" as const,
			daysAgo: 218,
		},
		{
			name: "Zara Ahmed",
			email: "zara@novira.dev",
			username: "zara",
			role: "petugas_lapangan" as const,
			daysAgo: 212,
		},
		{
			name: "Carlos Diaz",
			email: "carlos@novira.dev",
			username: "carlos",
			role: "petugas_lapangan" as const,
			daysAgo: 208,
		},
		{
			name: "Sophie Martin",
			email: "sophie@novira.dev",
			username: "sophie",
			role: "admin" as const,
			daysAgo: 202,
		},
		// 6 months ago (4 users)
		{
			name: "Raj Patel",
			email: "raj@novira.dev",
			username: "raj",
			role: "operator" as const,
			daysAgo: 188,
		},
		{
			name: "Emma Davis",
			email: "emma@novira.dev",
			username: "emma",
			role: "petugas_lapangan" as const,
			daysAgo: 182,
		},
		{
			name: "Felix Larsson",
			email: "felix@novira.dev",
			username: "felix",
			role: "petugas_lapangan" as const,
			daysAgo: 178,
		},
		{
			name: "Leila Hassan",
			email: "leila@novira.dev",
			username: "leila",
			role: "operator" as const,
			daysAgo: 172,
		},
		// 5 months ago (5 users)
		{
			name: "Tyler Brooks",
			email: "tyler@novira.dev",
			username: "tyler",
			role: "petugas_lapangan" as const,
			daysAgo: 158,
		},
		{
			name: "Yuki Tanaka",
			email: "yuki@novira.dev",
			username: "yuki",
			role: "operator" as const,
			daysAgo: 152,
		},
		{
			name: "Grace Wong",
			email: "grace@novira.dev",
			username: "grace",
			role: "petugas_lapangan" as const,
			daysAgo: 148,
		},
		{
			name: "Liam O'Brien",
			email: "liam@novira.dev",
			username: "liam",
			role: "petugas_lapangan" as const,
			daysAgo: 142,
		},
		{
			name: "Nina Volkov",
			email: "nina@novira.dev",
			username: "nina",
			role: "admin" as const,
			daysAgo: 138,
		},
		// 4 months ago (5 users)
		{
			name: "Oscar Reyes",
			email: "oscar@novira.dev",
			username: "oscar",
			role: "operator" as const,
			daysAgo: 125,
		},
		{
			name: "Hannah Lee",
			email: "hannah@novira.dev",
			username: "hannah",
			role: "petugas_lapangan" as const,
			daysAgo: 118,
		},
		{
			name: "Ben Carter",
			email: "ben@novira.dev",
			username: "ben",
			role: "petugas_lapangan" as const,
			daysAgo: 112,
		},
		{
			name: "Amara Johnson",
			email: "amara@novira.dev",
			username: "amara",
			role: "petugas_lapangan" as const,
			daysAgo: 108,
		},
		{
			name: "Kai Nakamura",
			email: "kai@novira.dev",
			username: "kai",
			role: "operator" as const,
			daysAgo: 102,
		},
		// 3 months ago (6 users)
		{
			name: "Clara Fischer",
			email: "clara@novira.dev",
			username: "clara",
			role: "petugas_lapangan" as const,
			daysAgo: 92,
		},
		{
			name: "Derek Stone",
			email: "derek@novira.dev",
			username: "derek",
			role: "petugas_lapangan" as const,
			daysAgo: 88,
		},
		{
			name: "Fatima Al-Rashid",
			email: "fatima@novira.dev",
			username: "fatima",
			role: "operator" as const,
			daysAgo: 82,
		},
		{
			name: "George Papadopoulos",
			email: "george@novira.dev",
			username: "george",
			role: "petugas_lapangan" as const,
			daysAgo: 78,
		},
		{
			name: "Ingrid Bergstrom",
			email: "ingrid@novira.dev",
			username: "ingrid",
			role: "petugas_lapangan" as const,
			daysAgo: 72,
		},
		{
			name: "Jordan Rivers",
			email: "jordan@novira.dev",
			username: "jordan",
			role: "petugas_lapangan" as const,
			daysAgo: 68,
		},
		// 2 months ago (6 users)
		{
			name: "Kenji Watanabe",
			email: "kenji@novira.dev",
			username: "kenji",
			role: "operator" as const,
			daysAgo: 55,
		},
		{
			name: "Laura Bianchi",
			email: "laura@novira.dev",
			username: "laura",
			role: "petugas_lapangan" as const,
			daysAgo: 52,
		},
		{
			name: "Michael Chen",
			email: "michael@novira.dev",
			username: "michael",
			role: "petugas_lapangan" as const,
			daysAgo: 48,
		},
		{
			name: "Nadia Kowalski",
			email: "nadia@novira.dev",
			username: "nadia",
			role: "petugas_lapangan" as const,
			daysAgo: 44,
		},
		{
			name: "Pablo Ruiz",
			email: "pablo@novira.dev",
			username: "pablo",
			role: "operator" as const,
			daysAgo: 40,
		},
		{
			name: "Quinn Taylor",
			email: "quinn@novira.dev",
			username: "quinn",
			role: "petugas_lapangan" as const,
			daysAgo: 38,
		},
		// Last month (7 users)
		{
			name: "Ruby Anderson",
			email: "ruby@novira.dev",
			username: "ruby",
			role: "petugas_lapangan" as const,
			daysAgo: 28,
		},
		{
			name: "Samuel Okonkwo",
			email: "samuel@novira.dev",
			username: "samuel",
			role: "operator" as const,
			daysAgo: 24,
		},
		{
			name: "Tara Singh",
			email: "tara@novira.dev",
			username: "tara",
			role: "petugas_lapangan" as const,
			daysAgo: 20,
		},
		{
			name: "Ulrich Weber",
			email: "ulrich@novira.dev",
			username: "ulrich",
			role: "petugas_lapangan" as const,
			daysAgo: 16,
		},
		{
			name: "Valentina Costa",
			email: "valentina@novira.dev",
			username: "valentina",
			role: "petugas_lapangan" as const,
			daysAgo: 12,
		},
		{
			name: "Wesley Morgan",
			email: "wesley@novira.dev",
			username: "wesley",
			role: "petugas_lapangan" as const,
			daysAgo: 6,
		},
		{
			name: "Xia Zhang",
			email: "xia@novira.dev",
			username: "xia",
			role: "petugas_lapangan" as const,
			daysAgo: 2,
		},
	];

	const userIds: string[] = [];
	const editorIds: string[] = [];

	for (const u of userData) {
		const userPasswordHash =
			"password" in u && u.password ? await hashPassword(u.password) : passwordHash;
		const id = await createUser({
			name: u.name,
			email: u.email,
			username: u.username,
			passwordHash: userPasswordHash,
			role: u.role,
			createdAt: daysAgo(u.daysAgo),
			updatedAt: daysAgo(u.daysAgo),
		});
		userIds.push(id);
		if (u.role === "operator" || u.role === "admin") {
			editorIds.push(id);
		}
	}
	console.log(`  Created ${userData.length} users (default password: password123)`);

	// --- PAGES ---
	// ~65 pages with realistic distribution across months and statuses
	// Earlier months: mostly published. Recent months: more drafts. Some archived throughout.
	console.log("Creating pages...");
	const pageData = [
		// 12 months ago — foundation content (all published)
		{
			title: "Getting Started Guide",
			slug: "getting-started",
			template: "default" as const,
			status: "published" as const,
			days: 362,
		},
		{
			title: "About Our Platform",
			slug: "about",
			template: "landing" as const,
			status: "published" as const,
			days: 358,
		},
		{
			title: "Privacy Policy",
			slug: "privacy-policy",
			template: "default" as const,
			status: "published" as const,
			days: 355,
		},
		// 11 months ago
		{
			title: "Terms of Service",
			slug: "terms-of-service",
			template: "default" as const,
			status: "published" as const,
			days: 338,
		},
		{
			title: "Blog: Welcome Post",
			slug: "blog-welcome",
			template: "blog" as const,
			status: "published" as const,
			days: 335,
		},
		{
			title: "Contact Page",
			slug: "contact",
			template: "default" as const,
			status: "published" as const,
			days: 330,
		},
		{
			title: "FAQ",
			slug: "faq",
			template: "default" as const,
			status: "published" as const,
			days: 325,
		},
		// 10 months ago
		{
			title: "Blog: Monthly Roundup January",
			slug: "blog-monthly-jan",
			template: "blog" as const,
			status: "published" as const,
			days: 308,
		},
		{
			title: "Documentation: API Reference",
			slug: "docs-api-reference",
			template: "default" as const,
			status: "published" as const,
			days: 302,
		},
		{
			title: "Blog: Feature Spotlight",
			slug: "blog-feature-spotlight",
			template: "blog" as const,
			status: "published" as const,
			days: 296,
		},
		{
			title: "Pricing Page",
			slug: "pricing",
			template: "landing" as const,
			status: "published" as const,
			days: 292,
		},
		{
			title: "Old Landing Variant A",
			slug: "old-landing-a",
			template: "landing" as const,
			status: "archived" as const,
			days: 290,
		},
		// 9 months ago
		{
			title: "Blog: Team Spotlight",
			slug: "blog-team-spotlight",
			template: "blog" as const,
			status: "published" as const,
			days: 275,
		},
		{
			title: "Landing: Product Launch",
			slug: "product-launch",
			template: "landing" as const,
			status: "published" as const,
			days: 270,
		},
		{
			title: "Documentation: Quick Start",
			slug: "docs-quick-start",
			template: "default" as const,
			status: "published" as const,
			days: 268,
		},
		{
			title: "Blog: February Roundup",
			slug: "blog-monthly-feb",
			template: "blog" as const,
			status: "published" as const,
			days: 262,
		},
		{
			title: "Deprecated: V1 Docs",
			slug: "v1-docs",
			template: "default" as const,
			status: "archived" as const,
			days: 260,
		},
		// 8 months ago
		{
			title: "Blog: Performance Tips",
			slug: "blog-performance-tips",
			template: "blog" as const,
			status: "published" as const,
			days: 245,
		},
		{
			title: "Documentation: CLI Reference",
			slug: "docs-cli-reference",
			template: "default" as const,
			status: "published" as const,
			days: 240,
		},
		{
			title: "Blog: March Roundup",
			slug: "blog-monthly-mar",
			template: "blog" as const,
			status: "published" as const,
			days: 235,
		},
		{
			title: "Careers Page",
			slug: "careers",
			template: "landing" as const,
			status: "published" as const,
			days: 232,
		},
		{
			title: "Retired Blog Post",
			slug: "retired-blog-post",
			template: "blog" as const,
			status: "archived" as const,
			days: 230,
		},
		{
			title: "Legacy Pricing Page",
			slug: "legacy-pricing",
			template: "landing" as const,
			status: "archived" as const,
			days: 228,
		},
		// 7 months ago
		{
			title: "Blog: Community Highlights",
			slug: "blog-community",
			template: "blog" as const,
			status: "published" as const,
			days: 215,
		},
		{
			title: "Blog: April Roundup",
			slug: "blog-monthly-apr",
			template: "blog" as const,
			status: "published" as const,
			days: 210,
		},
		{
			title: "Support Center",
			slug: "support-center",
			template: "default" as const,
			status: "published" as const,
			days: 205,
		},
		{
			title: "Documentation: Authentication",
			slug: "docs-auth",
			template: "default" as const,
			status: "published" as const,
			days: 200,
		},
		{
			title: "Landing: Partner Program",
			slug: "partner-program",
			template: "landing" as const,
			status: "published" as const,
			days: 198,
		},
		{
			title: "Archived: Beta Features",
			slug: "beta-features",
			template: "default" as const,
			status: "archived" as const,
			days: 195,
		},
		// 6 months ago — content production picks up
		{
			title: "Blog: Tech Stack Deep Dive",
			slug: "blog-tech-stack",
			template: "blog" as const,
			status: "published" as const,
			days: 185,
		},
		{
			title: "Blog: May Roundup",
			slug: "blog-monthly-may",
			template: "blog" as const,
			status: "published" as const,
			days: 180,
		},
		{
			title: "Documentation: Webhooks",
			slug: "docs-webhooks",
			template: "default" as const,
			status: "published" as const,
			days: 175,
		},
		{
			title: "Case Study: Acme Corp",
			slug: "case-study-acme",
			template: "landing" as const,
			status: "published" as const,
			days: 172,
		},
		{
			title: "Blog: Developer Guide",
			slug: "blog-dev-guide",
			template: "blog" as const,
			status: "published" as const,
			days: 168,
		},
		{
			title: "Feature Comparison",
			slug: "feature-comparison",
			template: "default" as const,
			status: "draft" as const,
			days: 165,
		},
		// 5 months ago
		{
			title: "Blog: June Roundup",
			slug: "blog-monthly-jun",
			template: "blog" as const,
			status: "published" as const,
			days: 155,
		},
		{
			title: "Documentation: SDKs",
			slug: "docs-sdks",
			template: "default" as const,
			status: "published" as const,
			days: 150,
		},
		{
			title: "Blog: Security Best Practices",
			slug: "blog-security",
			template: "blog" as const,
			status: "published" as const,
			days: 145,
		},
		{
			title: "Landing: Summer Campaign",
			slug: "summer-campaign",
			template: "landing" as const,
			status: "published" as const,
			days: 140,
		},
		{
			title: "Blog: Open Source Contributions",
			slug: "blog-open-source",
			template: "blog" as const,
			status: "published" as const,
			days: 135,
		},
		{
			title: "Documentation: Migration Guide",
			slug: "docs-migration",
			template: "default" as const,
			status: "draft" as const,
			days: 132,
		},
		{
			title: "Old Summer Campaign",
			slug: "old-summer-campaign",
			template: "landing" as const,
			status: "archived" as const,
			days: 130,
		},
		// 4 months ago
		{
			title: "Blog: July Roundup",
			slug: "blog-monthly-jul",
			template: "blog" as const,
			status: "published" as const,
			days: 122,
		},
		{
			title: "Blog: Team Updates",
			slug: "blog-team-updates",
			template: "blog" as const,
			status: "published" as const,
			days: 118,
		},
		{
			title: "Documentation: REST API v2",
			slug: "docs-api-v2",
			template: "default" as const,
			status: "published" as const,
			days: 115,
		},
		{
			title: "Case Study: TechStart",
			slug: "case-study-techstart",
			template: "landing" as const,
			status: "published" as const,
			days: 110,
		},
		{
			title: "Blog: Infrastructure Update",
			slug: "blog-infra-update",
			template: "blog" as const,
			status: "published" as const,
			days: 105,
		},
		{
			title: "Pricing Page Redesign",
			slug: "pricing-redesign",
			template: "landing" as const,
			status: "draft" as const,
			days: 100,
		},
		{
			title: "Internal: Meeting Notes Q2",
			slug: "meeting-notes-q2",
			template: "default" as const,
			status: "draft" as const,
			days: 98,
		},
		// 3 months ago — more content, more drafts in flight
		{
			title: "Blog: August Roundup",
			slug: "blog-monthly-aug",
			template: "blog" as const,
			status: "published" as const,
			days: 88,
		},
		{
			title: "Documentation: GraphQL",
			slug: "docs-graphql",
			template: "default" as const,
			status: "published" as const,
			days: 85,
		},
		{
			title: "Blog: Design System Launch",
			slug: "blog-design-system",
			template: "blog" as const,
			status: "published" as const,
			days: 80,
		},
		{
			title: "Landing: Fall Conference",
			slug: "fall-conference",
			template: "landing" as const,
			status: "published" as const,
			days: 75,
		},
		{
			title: "Blog: Engineering Culture",
			slug: "blog-eng-culture",
			template: "blog" as const,
			status: "draft" as const,
			days: 72,
		},
		{
			title: "Documentation: Testing Guide",
			slug: "docs-testing",
			template: "default" as const,
			status: "draft" as const,
			days: 70,
		},
		{
			title: "Case Study: GlobalReach",
			slug: "case-study-globalreach",
			template: "landing" as const,
			status: "draft" as const,
			days: 68,
		},
		// 2 months ago
		{
			title: "Blog: September Roundup",
			slug: "blog-monthly-sep",
			template: "blog" as const,
			status: "published" as const,
			days: 52,
		},
		{
			title: "Blog: Roadmap 2025",
			slug: "blog-roadmap-2025",
			template: "blog" as const,
			status: "published" as const,
			days: 48,
		},
		{
			title: "Documentation: Deployment",
			slug: "docs-deployment",
			template: "default" as const,
			status: "published" as const,
			days: 45,
		},
		{
			title: "Blog: Customer Stories",
			slug: "blog-customer-stories",
			template: "blog" as const,
			status: "draft" as const,
			days: 42,
		},
		{
			title: "Landing: Year End Sale",
			slug: "year-end-sale",
			template: "landing" as const,
			status: "draft" as const,
			days: 40,
		},
		{
			title: "Documentation: Integrations",
			slug: "docs-integrations",
			template: "default" as const,
			status: "draft" as const,
			days: 38,
		},
		{
			title: "Internal: Meeting Notes Q3",
			slug: "meeting-notes-q3",
			template: "default" as const,
			status: "draft" as const,
			days: 35,
		},
		// Last month — highest content output, many drafts
		{
			title: "Blog: October Roundup",
			slug: "blog-monthly-oct",
			template: "blog" as const,
			status: "published" as const,
			days: 25,
		},
		{
			title: "Blog: Year in Review",
			slug: "blog-year-review",
			template: "blog" as const,
			status: "published" as const,
			days: 22,
		},
		{
			title: "Documentation: Performance",
			slug: "docs-performance",
			template: "default" as const,
			status: "published" as const,
			days: 18,
		},
		{
			title: "Blog: AI Features Preview",
			slug: "blog-ai-features",
			template: "blog" as const,
			status: "draft" as const,
			days: 15,
		},
		{
			title: "Landing: New Year Campaign",
			slug: "new-year-campaign",
			template: "landing" as const,
			status: "draft" as const,
			days: 12,
		},
		{
			title: "Documentation: Analytics",
			slug: "docs-analytics",
			template: "default" as const,
			status: "draft" as const,
			days: 8,
		},
		{
			title: "Blog: What's Next in 2025",
			slug: "blog-whats-next",
			template: "blog" as const,
			status: "draft" as const,
			days: 5,
		},
		{
			title: "Case Study: Enterprise Co",
			slug: "case-study-enterprise",
			template: "landing" as const,
			status: "draft" as const,
			days: 3,
		},
	];

	for (const p of pageData) {
		const createdAt = daysAgo(p.days);
		await db.insert(pages).values({
			id: generateId(10),
			title: p.title,
			slug: p.slug,
			content: `This is the content for "${p.title}". Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`,
			template: p.template,
			status: p.status,
			authorId: randomItem(editorIds),
			createdAt,
			updatedAt: daysAgo(Math.max(0, p.days - randomInt(0, 15))),
			publishedAt: p.status === "published" ? createdAt : null,
		});
	}
	console.log(`  Created ${pageData.length} pages`);

	// --- NOTIFICATIONS ---
	console.log("Creating notifications...");
	const notificationData = [
		{
			title: "Welcome to Novira",
			message: "Your admin dashboard is ready to use.",
			type: "success" as const,
			days: 365,
			read: true,
			global: true,
		},
		{
			title: "New user registered",
			message: "Marcus Johnson has joined as an editor.",
			type: "info" as const,
			days: 340,
			read: true,
			global: false,
		},
		{
			title: "Content published",
			message: '"Getting Started Guide" is now live.',
			type: "success" as const,
			days: 335,
			read: true,
			global: false,
		},
		{
			title: "Server maintenance scheduled",
			message: "Planned downtime on Saturday 2AM-4AM UTC.",
			type: "warning" as const,
			days: 320,
			read: true,
			global: true,
		},
		{
			title: "New user registered",
			message: "Alex Turner has joined as a viewer.",
			type: "info" as const,
			days: 298,
			read: true,
			global: false,
		},
		{
			title: "Database backup completed",
			message: "Automatic backup ran successfully.",
			type: "success" as const,
			days: 280,
			read: true,
			global: true,
		},
		{
			title: "Security scan passed",
			message: "No vulnerabilities detected in latest scan.",
			type: "success" as const,
			days: 260,
			read: true,
			global: true,
		},
		{
			title: "Content published",
			message: '"API Reference" documentation is now live.',
			type: "success" as const,
			days: 245,
			read: true,
			global: false,
		},
		{
			title: "Disk space warning",
			message: "Server disk usage at 72%. Consider cleanup.",
			type: "warning" as const,
			days: 230,
			read: true,
			global: true,
		},
		{
			title: "New user registered",
			message: "Sophie Martin has joined as an admin.",
			type: "info" as const,
			days: 202,
			read: true,
			global: false,
		},
		{
			title: "SSL certificate renewed",
			message: "Certificate auto-renewed successfully.",
			type: "success" as const,
			days: 190,
			read: true,
			global: true,
		},
		{
			title: "Failed login attempt",
			message: "5 failed login attempts from IP 203.0.113.42.",
			type: "error" as const,
			days: 175,
			read: true,
			global: false,
		},
		{
			title: "System update applied",
			message: "SvelteKit updated to 2.50. All tests passing.",
			type: "success" as const,
			days: 160,
			read: true,
			global: true,
		},
		{
			title: "Content milestone",
			message: "Platform reached 30 published pages!",
			type: "success" as const,
			days: 145,
			read: true,
			global: true,
		},
		{
			title: "Database backup completed",
			message: "Weekly backup completed successfully.",
			type: "success" as const,
			days: 130,
			read: true,
			global: true,
		},
		{
			title: "New editor onboarded",
			message: "Kai Nakamura has been promoted to editor.",
			type: "info" as const,
			days: 102,
			read: true,
			global: false,
		},
		{
			title: "Performance alert",
			message: "API response time increased by 15%. Investigating.",
			type: "warning" as const,
			days: 95,
			read: true,
			global: true,
		},
		{
			title: "Content published",
			message: '"Design System Launch" blog post is live.',
			type: "success" as const,
			days: 80,
			read: true,
			global: false,
		},
		{
			title: "User milestone",
			message: "Platform reached 40 registered users!",
			type: "success" as const,
			days: 72,
			read: true,
			global: true,
		},
		{
			title: "New user registered",
			message: "Kenji Watanabe has joined as an editor.",
			type: "info" as const,
			days: 55,
			read: true,
			global: false,
		},
		{
			title: "Database optimization",
			message: "VACUUM completed. Reclaimed 18MB.",
			type: "success" as const,
			days: 48,
			read: true,
			global: true,
		},
		{
			title: "Disk space warning",
			message: "Server disk usage at 78%. Consider cleanup.",
			type: "warning" as const,
			days: 42,
			read: false,
			global: true,
		},
		{
			title: "Failed API call",
			message: "External API timeout on analytics endpoint.",
			type: "error" as const,
			days: 35,
			read: false,
			global: true,
		},
		{
			title: "Content published",
			message: '"Roadmap 2025" blog post is now live.',
			type: "success" as const,
			days: 30,
			read: false,
			global: false,
		},
		{
			title: "New user registered",
			message: "Ruby Anderson has joined as a viewer.",
			type: "info" as const,
			days: 28,
			read: false,
			global: false,
		},
		{
			title: "Backup storage warning",
			message: "Backup volume at 90%. Rotate old backups.",
			type: "warning" as const,
			days: 22,
			read: false,
			global: true,
		},
		{
			title: "High memory usage",
			message: "Server memory at 88%. Monitor closely.",
			type: "error" as const,
			days: 18,
			read: false,
			global: true,
		},
		{
			title: "Scheduled task failed",
			message: "Email digest cron job failed. Check logs.",
			type: "error" as const,
			days: 14,
			read: false,
			global: true,
		},
		{
			title: "Content update",
			message: '"Blog: Year in Review" was edited by Elena.',
			type: "info" as const,
			days: 10,
			read: false,
			global: false,
		},
		{
			title: "New user registered",
			message: "Wesley Morgan has joined as a viewer.",
			type: "info" as const,
			days: 6,
			read: false,
			global: false,
		},
		{
			title: "System health check",
			message: "All services operational. Uptime: 99.97%.",
			type: "success" as const,
			days: 3,
			read: false,
			global: true,
		},
		{
			title: "New user registered",
			message: "Xia Zhang has joined as a viewer.",
			type: "info" as const,
			days: 2,
			read: false,
			global: false,
		},
		{
			title: "Security update available",
			message: "Critical patch for Node.js 22. Update recommended.",
			type: "warning" as const,
			days: 0,
			read: false,
			global: true,
		},
	];

	for (const n of notificationData) {
		await db.insert(notifications).values({
			id: generateId(10),
			userId: n.global ? null : randomItem(userIds),
			title: n.title,
			message: n.message,
			type: n.type,
			read: n.read,
			createdAt: daysAgo(n.days),
		});
	}
	console.log(`  Created ${notificationData.length} notifications`);

	// --- APP SETTINGS ---
	console.log("Creating app settings...");
	const settingsData = [
		{ key: "siteName", value: "Novira" },
		{ key: "timezone", value: "America/New_York" },
		{ key: "defaultRole", value: "operator" },
		{ key: "maintenanceMode", value: "false" },
	];

	for (const s of settingsData) {
		await db.insert(appSettings).values({
			key: s.key,
			value: s.value,
			updatedAt: new Date(),
		});
	}

	// --- CAMERAS ---
	// Umpan asli dari ATCS/dukcapil-CCTV publik (streaming HLS publik, hanya
	// tautan — bukan rekaman). Berlaku sementara: kamera tambahan bisa
	// ditambah lewat halaman /dashboard/cameras.
	console.log("Creating cameras...");
	const cameraData = [
		{
			nama: "Simpang Pasar Sumber 1",
			kota: "Kabupaten Cirebon",
			kecamatan: "Sumber",
			latitude: "-6.758906",
			longitude: "108.487653",
			urlStream:
				"https://cctv-backend.cirebonkab.go.id:6969/memfs/9e5cb528-a433-468d-9570-be0ec1316120.m3u8",
		},
		{
			nama: "Bundaran Kedawung 2",
			kota: "Kabupaten Cirebon",
			kecamatan: "Kedawung",
			latitude: "-6.7095371583598",
			longitude: "108.53217478208",
			urlStream:
				"https://cctv-backend.cirebonkab.go.id:6969/memfs/a71f2a04-c4c0-4280-9d71-d572d01fe1e6.m3u8",
		},
		{
			nama: "Tagog Padalarang (Arah Purwakarta)",
			kota: "Kabupaten Bandung Barat",
			kecamatan: "Padalarang",
			latitude: "-6.8422437545735795",
			longitude: "107.4852254184576",
			urlStream:
				"https://atcs-dishubkbb.urbanaccess.net/memfs/02e59fd8-d67a-40b3-bb2c-5f54c7bcadf9.m3u8",
		},
		{
			nama: "SP 5 DPRD Provinsi",
			kota: "Kota Palembang",
			kecamatan: null,
			latitude: "-2.980102",
			longitude: "104.745707",
			urlStream: "https://stream.palembang.go.id/cam7/index.m3u8",
		},
		{
			nama: "Jembatan Dadap",
			kota: "Kabupaten Tangerang",
			kecamatan: "Kosambi",
			latitude: "-6.092136145427569",
			longitude: "106.71870867037522",
			urlStream:
				"https://cctv-dishub.tangerangkab.go.id/storage/video/01jsrctg4pc3xdf5vkjjg4pcfd/01jsrctg4pc3xdf5vkjjg4pcfd.m3u8",
		},
		{
			nama: "Jl. Pantura Bitung 2",
			kota: "Kabupaten Tangerang",
			kecamatan: "Kelapa Dua",
			latitude: "-6.2230346323921495",
			longitude: "106.5599518345196",
			urlStream:
				"https://cctv-dishub.tangerangkab.go.id/storage/video/01jzvr0hphd8c104283f8g1d9n/01jzvr0hphd8c104283f8g1d9n.m3u8",
		},
		{
			nama: "Simpang Rajeg Kukun 2",
			kota: "Kabupaten Tangerang",
			kecamatan: "Rajeg",
			latitude: "-6.130006908709916",
			longitude: "106.52675509902808",
			urlStream:
				"https://cctv-dishub.tangerangkab.go.id/storage/video/01jsr0j5nwjcbthcb6aypa6dcr/01jsr0j5nwjcbthcb6aypa6dcr.m3u8",
		},
		{
			nama: "Simpang Sepatan 1",
			kota: "Kabupaten Tangerang",
			kecamatan: "Sepatan",
			latitude: "-6.118874199737398",
			longitude: "106.57561217365658",
			urlStream:
				"https://cctv-dishub.tangerangkab.go.id/storage/video/01jsr485tfw1cwwa1v6c3jpgfd/01jsr485tfw1cwwa1v6c3jpgfd.m3u8",
		},
		{
			nama: "Thamrin Pandanaran 360",
			kota: "Kota Semarang",
			kecamatan: "Semarang Tengah",
			latitude: "-6.9874484",
			longitude: "110.417212",
			urlStream:
				"https://livepantau.semarangkota.go.id/e910f4f2-a77d-4cf8-8341-aa2e6c6b65c9/index.m3u8",
		},
		{
			nama: "Simpang Seririt",
			kota: "Kabupaten Buleleng",
			kecamatan: "Seririt",
			latitude: "-8.19305",
			longitude: "114.933679",
			urlStream:
				"https://shinobi.bulelengkab.go.id/Amk60KFacq87lQMvTCMHu17u00ONuC/mp4/admin/edROyIUx2v80/s.mp4",
		},
	];

	await db.insert(cameras).values(
		cameraData.map((c) => ({
			id: generateId(10),
			nama: c.nama,
			kota: c.kota,
			kecamatan: c.kecamatan,
			latitude: c.latitude,
			longitude: c.longitude,
			urlStream: c.urlStream,
			status: "ONLINE" as const,
		}))
	);
	console.log(`  Created ${cameraData.length} cameras`);

	console.log(`  Created ${settingsData.length} app settings`);

	console.log("\nSeed complete!");
	console.log(`  ${userData.length} users (password: password123)`);
	console.log(
		`  ${pageData.length} pages (${pageData.filter((p) => p.status === "published").length} published, ${pageData.filter((p) => p.status === "draft").length} draft, ${pageData.filter((p) => p.status === "archived").length} archived)`
	);
	console.log(`  ${notificationData.length} notifications`);
	console.log("Login: username 'demo' / password 'NoviraDemo2026!' (operator)");
	console.log(
		"       username 'admin' / password 'password123' (admin — use to access demo reset)"
	);
	console.log("       any other seeded username / 'password123'");
}

// Auto-run when invoked as a CLI (e.g. `tsx src/lib/server/db/seed.ts`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	seedDemo().catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});
}
