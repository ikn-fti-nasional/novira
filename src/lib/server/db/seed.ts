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
	officers,
	incidents,
	auditLog,
	reporterTrust,
	areaSnapshots,
} from "./schema.js";
import { hashPassword } from "../password.js";
import { generateId } from "../id.js";
import { createUser } from "./users.js";
import { KAMERA_BANDUNG } from "./data/kamera-bandung.js";

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
	// with a foreign-key violation. incidents references cameras + officers, so
	// it must go before both.
	await db.delete(notifications);
	await db.delete(pages);
	await db.delete(auditLog);
	await db.delete(incidents);
	await db.delete(cameras);
	await db.delete(officers);
	await db.delete(publicReports);
	await db.delete(reporterTrust);
	await db.delete(areaSnapshots);
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
	// Dipakai seed laporan warga untuk mengisi `diprosesOleh` tanpa menebak
	// posisi di `userIds` (urutan array di atas sering berubah).
	const userIdByUsername = new Map<string, string>();

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
		userIdByUsername.set(u.username, id);
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
			title: "Selamat Datang di Novira",
			message: "Dasbor pengawasan sampah Anda siap digunakan.",
			type: "success" as const,
			days: 365,
			read: true,
			global: true,
		},
		{
			title: "Petugas baru bergabung",
			message: "Marcus Johnson telah bergabung sebagai Petugas Lapangan.",
			type: "info" as const,
			days: 340,
			read: true,
			global: false,
		},
		{
			title: "Insiden diselesaikan",
			message: "Insiden sampah di Kelurahan Sukajadi telah ditangani petugas lapangan.",
			type: "success" as const,
			days: 335,
			read: true,
			global: false,
		},
		{
			title: "Pemeliharaan sistem terjadwal",
			message: "Downtime terjadwal hari Sabtu pukul 02.00-04.00 WIB untuk pemeliharaan server.",
			type: "warning" as const,
			days: 320,
			read: true,
			global: true,
		},
		{
			title: "Pengguna baru terdaftar",
			message: "Alex Turner telah bergabung sebagai Petugas Lapangan.",
			type: "info" as const,
			days: 298,
			read: true,
			global: false,
		},
		{
			title: "Pencadangan basis data selesai",
			message: "Backup otomatis basis data berhasil dijalankan.",
			type: "success" as const,
			days: 280,
			read: true,
			global: true,
		},
		{
			title: "Pemindaian keamanan lolos",
			message: "Tidak ditemukan kerentanan pada pemindaian keamanan terbaru.",
			type: "success" as const,
			days: 260,
			read: true,
			global: true,
		},
		{
			title: "Kamera baru ditambahkan",
			message: "CCTV Pasar Ciroyom 02 berhasil ditambahkan ke jaringan pemantauan.",
			type: "success" as const,
			days: 245,
			read: true,
			global: false,
		},
		{
			title: "Peringatan ruang penyimpanan",
			message: "Penggunaan disk server mencapai 72%. Pertimbangkan pembersihan.",
			type: "warning" as const,
			days: 230,
			read: true,
			global: true,
		},
		{
			title: "Pengguna baru terdaftar",
			message: "Sophie Martin telah bergabung sebagai Admin.",
			type: "info" as const,
			days: 202,
			read: true,
			global: false,
		},
		{
			title: "Sertifikat SSL diperbarui",
			message: "Sertifikat domain berhasil diperbarui secara otomatis.",
			type: "success" as const,
			days: 190,
			read: true,
			global: true,
		},
		{
			title: "Percobaan login gagal",
			message: "5 percobaan login gagal terdeteksi dari alamat IP 203.0.113.42.",
			type: "error" as const,
			days: 175,
			read: true,
			global: false,
		},
		{
			title: "Insiden melanggar SLA",
			message: "Insiden di Kecamatan Malabar melewati batas waktu pengangkutan 24 jam.",
			type: "warning" as const,
			days: 160,
			read: true,
			global: true,
		},
		{
			title: "Pencapaian skor kebersihan",
			message: "Skor kebersihan rata-rata Kota Bandung mencapai 93/100.",
			type: "success" as const,
			days: 145,
			read: true,
			global: true,
		},
		{
			title: "Pencadangan basis data selesai",
			message: "Backup mingguan berhasil diselesaikan.",
			type: "success" as const,
			days: 130,
			read: true,
			global: true,
		},
		{
			title: "Petugas dipromosikan",
			message: "Kai Nakamura dipromosikan menjadi Koordinator Lapangan.",
			type: "info" as const,
			days: 102,
			read: true,
			global: false,
		},
		{
			title: "Peringatan performa",
			message: "Waktu respons sistem meningkat 15%. Sedang diselidiki.",
			type: "warning" as const,
			days: 95,
			read: true,
			global: true,
		},
		{
			title: "Insiden diselesaikan",
			message: "Insiden sampah di Kecamatan Andir telah ditangani petugas lapangan.",
			type: "success" as const,
			days: 80,
			read: true,
			global: false,
		},
		{
			title: "Pencapaian pengguna",
			message: "Platform mencapai 40 pengguna terdaftar.",
			type: "success" as const,
			days: 72,
			read: true,
			global: true,
		},
		{
			title: "Pengguna baru terdaftar",
			message: "Kenji Watanabe telah bergabung sebagai Operator.",
			type: "info" as const,
			days: 55,
			read: true,
			global: false,
		},
		{
			title: "Optimasi basis data",
			message: "VACUUM selesai dijalankan. 18MB ruang penyimpanan direklamasi.",
			type: "success" as const,
			days: 48,
			read: true,
			global: true,
		},
		{
			title: "Peringatan ruang penyimpanan",
			message: "Penggunaan disk server mencapai 78%. Pertimbangkan pembersihan.",
			type: "warning" as const,
			days: 42,
			read: false,
			global: true,
		},
		{
			title: "Kamera CCTV offline",
			message: "3 kamera CCTV di Kota Bandung tidak merespons pada siklus deteksi terakhir.",
			type: "error" as const,
			days: 35,
			read: false,
			global: true,
		},
		{
			title: "Laporan masyarakat baru",
			message: "Laporan sampah baru dari masyarakat masuk dan menunggu verifikasi.",
			type: "success" as const,
			days: 30,
			read: false,
			global: false,
		},
		{
			title: "Pengguna baru terdaftar",
			message: "Ruby Anderson telah bergabung sebagai Petugas Lapangan.",
			type: "info" as const,
			days: 28,
			read: false,
			global: false,
		},
		{
			title: "Peringatan ruang cadangan",
			message: "Volume backup mencapai 90%. Rotasi backup lama disarankan.",
			type: "warning" as const,
			days: 22,
			read: false,
			global: true,
		},
		{
			title: "Penggunaan memori tinggi",
			message: "Memori server pada 88%. Pantau secara berkala.",
			type: "error" as const,
			days: 18,
			read: false,
			global: true,
		},
		{
			title: "Tugas terjadwal gagal",
			message: "Cron job notifikasi harian gagal dijalankan. Periksa log sistem.",
			type: "error" as const,
			days: 14,
			read: false,
			global: true,
		},
		{
			title: "Insiden diperbarui",
			message: "Status insiden di Kelurahan Kiaracondong diperbarui oleh Elena.",
			type: "info" as const,
			days: 10,
			read: false,
			global: false,
		},
		{
			title: "Pengguna baru terdaftar",
			message: "Wesley Morgan telah bergabung sebagai Petugas Lapangan.",
			type: "info" as const,
			days: 6,
			read: false,
			global: false,
		},
		{
			title: "Pemeriksaan kesehatan sistem",
			message: "Seluruh layanan beroperasi normal. Uptime: 99.97%.",
			type: "success" as const,
			days: 3,
			read: false,
			global: true,
		},
		{
			title: "Pengguna baru terdaftar",
			message: "Xia Zhang telah bergabung sebagai Petugas Lapangan.",
			type: "info" as const,
			days: 2,
			read: false,
			global: false,
		},
		{
			title: "Pembaruan keamanan tersedia",
			message: "Patch kritis untuk Node.js 22 tersedia. Segera perbarui server.",
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
	// Satu-satunya pengaturan global yang benar-benar dipakai kode: guard
	// mode pemeliharaan di `(app)/+layout.server.ts`. Zona waktu tidak diseed —
	// seluruh jadwal cron memakai Asia/Jakarta (WIB) secara tetap.
	const settingsData = [{ key: "maintenanceMode", value: "false" }];

	for (const s of settingsData) {
		await db.insert(appSettings).values({
			key: s.key,
			value: s.value,
			updatedAt: new Date(),
		});
	}

	// --- CAMERAS ---
	// Registri kamera diambil dari feed ATCS publik Kota Bandung dan sudah
	// disaring: hanya stream yang benar-benar mengudara saat verifikasi yang
	// masuk (lihat catatan lengkap di data/kamera-bandung.ts). Kota lain
	// sengaja dihapus -- cakupan satu kota penuh jauh lebih berguna untuk
	// mengukur kebersihan wilayah daripada sebaran tipis di sembilan kota,
	// karena skor kebersihan dihitung per kecamatan dan butuh kepadatan
	// kamera yang memadai agar angkanya berarti.
	console.log("Creating cameras...");
	await db.insert(cameras).values(
		KAMERA_BANDUNG.map((c) => ({
			id: generateId(10),
			nama: c.nama,
			kota: "Kota Bandung",
			kecamatan: c.kecamatan,
			kelurahan: c.kelurahan,
			latitude: c.latitude,
			longitude: c.longitude,
			urlStream: c.urlStream,
			status: "ONLINE" as const,
		}))
	);
	console.log(`  Created ${KAMERA_BANDUNG.length} cameras`);

	// --- OFFICERS (petugas lapangan) ---
	// Roster is genuinely operational/HR data, not something the detection
	// pipeline can infer from CCTV -- seeded as a starter roster the same way
	// cameras/users are, editable later from /dashboard/officers.
	console.log("Creating officers...");
	const officerData = [
		{
			nama: "Asep Suryana",
			peran: "Petugas Kebersihan",
			telepon: "081234567801",
			wilayahTugas: "Andir",
			status: "SIAP_TUGAS" as const,
		},
		{
			nama: "Dedi Kurniawan",
			peran: "Petugas Kebersihan",
			telepon: "081234567802",
			wilayahTugas: "Kiaracondong",
			status: "SIAP_TUGAS" as const,
		},
		{
			nama: "Euis Rohaeni",
			peran: "Koordinator Lapangan",
			telepon: "081234567803",
			wilayahTugas: "Astanaanyar",
			status: "SEDANG_BERTUGAS" as const,
		},
		{
			nama: "Cecep Hidayat",
			peran: "Petugas Kebersihan",
			telepon: "081234567804",
			wilayahTugas: "Sukajadi",
			status: "SIAP_TUGAS" as const,
		},
		{
			nama: "Yayat Hidayat",
			peran: "Petugas Kebersihan",
			telepon: "081234567805",
			wilayahTugas: "Cibeunying Kidul",
			status: "SIAP_TUGAS" as const,
		},
		{
			nama: "Nia Kurnia",
			peran: "Koordinator Lapangan",
			telepon: "081234567806",
			wilayahTugas: "Regol",
			status: "OFFLINE" as const,
		},
	];
	await db.insert(officers).values(
		officerData.map((o) => ({
			id: generateId(10),
			...o,
		}))
	);
	console.log(`  Created ${officerData.length} officers`);

	// --- LAPORAN MASYARAKAT ---
	// Antrian triase kosong membuat fitur verifikasi laporan warga tidak bisa
	// didemokan sama sekali, jadi beberapa laporan contoh diseed di sini —
	// termasuk sepasang laporan yang sengaja berdekatan (±40 m) supaya deteksi
	// duplikat benar-benar terlihat bekerja.
	console.log("Creating public reports...");
	type LaporanSeed = {
		pelaporNama: string | null;
		pelaporTelepon: string | null;
		deskripsi: string | null;
		jenisSampah: string | null;
		latitude: string | null;
		longitude: string | null;
		kecamatan: string;
		status: "MENUNGGU" | "DIPROSES" | "SELESAI" | "DITOLAK" | "DUPLIKAT";
		catatanPetugas?: string;
		aiSkor: string | null;
		aiLabel: string | null;
		aiJumlahDeteksi: number | null;
		aiRekomendasi:
			| "SANGAT_MUNGKIN_VALID"
			| "PERLU_TINJAUAN"
			| "KEMUNGKINAN_SPAM"
			| "GAGAL_PINDAI"
			| null;
		/** Faktor rekomendasi AI — diserialisasi ke `aiRincian` supaya tabel triase punya baris alasan. */
		faktorAi?: { label: string; poin: number; keterangan: string }[];
		/** Username petugas/operator yang menangani (untuk status selain MENUNGGU). */
		ditanganiOleh?: string;
		/** Index laporan induk di array ini — dipetakan ke `duplikatDariId` setelah id digenerate. */
		duplikatDariIndex?: number;
		hariLalu: number;
	};
	const laporanData: LaporanSeed[] = [
		{
			pelaporNama: "Rina Wijaya",
			pelaporTelepon: "081234500001",
			deskripsi: "Tumpukan sampah menutup separuh trotoar depan sekolah, sudah dua hari.",
			jenisSampah: "tumpukan_sampah",
			latitude: "-6.92180",
			longitude: "107.60700",
			kecamatan: "Regol",
			status: "MENUNGGU" as const,
			aiSkor: "0.71",
			aiLabel: "Pile",
			aiJumlahDeteksi: 3,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			hariLalu: 0,
		},
		{
			// ±40 m dari laporan di atas → muncul sebagai kandidat duplikat.
			pelaporNama: "Dedi Kurniawan",
			pelaporTelepon: "081234500002",
			deskripsi: "Sampah menumpuk di pinggir jalan, bau menyengat.",
			jenisSampah: "tumpukan_sampah",
			latitude: "-6.92215",
			longitude: "107.60723",
			kecamatan: "Regol",
			status: "MENUNGGU" as const,
			aiSkor: "0.52",
			aiLabel: "Pile",
			aiJumlahDeteksi: 2,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			hariLalu: 0,
		},
		{
			pelaporNama: "Anonim",
			pelaporTelepon: null,
			deskripsi: null,
			jenisSampah: "kantong_plastik",
			latitude: null,
			longitude: null,
			kecamatan: "Andir",
			status: "MENUNGGU" as const,
			aiSkor: "0.08",
			aiLabel: null,
			aiJumlahDeteksi: 0,
			aiRekomendasi: "PERLU_TINJAUAN" as const,
			hariLalu: 1,
		},
		{
			pelaporNama: "Siti Aminah",
			pelaporTelepon: "081234500003",
			deskripsi: "Pembuangan liar di bantaran sungai, ada puing bangunan juga.",
			jenisSampah: "pembuangan_liar_besar",
			latitude: "-6.91500",
			longitude: "107.61200",
			kecamatan: "Coblong",
			status: "MENUNGGU" as const,
			aiSkor: "0.63",
			aiLabel: "Pile",
			aiJumlahDeteksi: 5,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			hariLalu: 2,
		},
		{
			pelaporNama: "Bambang S.",
			pelaporTelepon: "081234500004",
			deskripsi: "Cek lokasi.",
			jenisSampah: "botol_minuman",
			latitude: null,
			longitude: null,
			kecamatan: "Lengkong",
			status: "DITOLAK" as const,
			catatanPetugas: "Foto tidak menunjukkan tumpukan sampah.",
			aiSkor: "0.03",
			aiLabel: null,
			aiJumlahDeteksi: 0,
			aiRekomendasi: "KEMUNGKINAN_SPAM" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 0, keterangan: "0.03 — tidak ada objek sampah terdeteksi" },
				{ label: "Lokasi", poin: 0, keterangan: "Tanpa koordinat GPS" },
				{ label: "Reputasi pelapor", poin: -10, keterangan: "5 laporan sebelumnya ditolak" },
			],
			ditanganiOleh: "operator",
			hariLalu: 5,
		},
		{
			// Laporan ketiga di titik yang sama, sudah diputuskan sebagai duplikat
			// dari laporan Rina (index 0) — memberi contoh baris berstatus DUPLIKAT.
			pelaporNama: "Yusuf Maulana",
			pelaporTelepon: "081234500005",
			deskripsi: "Sampah depan sekolah masih belum diangkut.",
			jenisSampah: "tumpukan_sampah",
			latitude: "-6.92196",
			longitude: "107.60712",
			kecamatan: "Regol",
			status: "DUPLIKAT" as const,
			catatanPetugas: "Titik sama dengan laporan yang sudah masuk lebih dulu.",
			aiSkor: "0.66",
			aiLabel: "Pile",
			aiJumlahDeteksi: 3,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 30, keterangan: "0.66 — tumpukan terdeteksi" },
				{ label: "Duplikat", poin: -25, keterangan: "±18 m dari laporan LPR sebelumnya" },
			],
			ditanganiOleh: "operator",
			duplikatDariIndex: 0,
			hariLalu: 0,
		},
		{
			// Sudah diverifikasi operator → naik jadi insiden dan sedang dikerjakan.
			pelaporNama: "Nurul Hidayah",
			pelaporTelepon: "081234500006",
			deskripsi: "Sampah rumah tangga dibuang di lahan kosong dekat pasar, tiap pagi bertambah.",
			jenisSampah: "pembuangan_liar_besar",
			latitude: "-6.90340",
			longitude: "107.59480",
			kecamatan: "Andir",
			status: "DIPROSES" as const,
			catatanPetugas: "Diverifikasi, dijadwalkan pengangkutan oleh regu Andir.",
			aiSkor: "0.84",
			aiLabel: "Pile",
			aiJumlahDeteksi: 7,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 40, keterangan: "0.84 — 7 objek terdeteksi" },
				{ label: "Kelengkapan", poin: 15, keterangan: "Foto + GPS + deskripsi lengkap" },
				{ label: "Reputasi pelapor", poin: 10, keterangan: "Riwayat laporan valid" },
			],
			ditanganiOleh: "operator",
			hariLalu: 1,
		},
		{
			pelaporNama: "Komunitas Peduli Cikapundung",
			pelaporTelepon: "081234500007",
			deskripsi: "Sampah plastik menyangkut di jembatan, berpotensi menyumbat aliran air.",
			jenisSampah: "kantong_plastik",
			latitude: "-6.89620",
			longitude: "107.60890",
			kecamatan: "Cicendo",
			status: "DIPROSES" as const,
			catatanPetugas: "Perlu alat berat ringan, koordinasi dengan UPT kebersihan.",
			aiSkor: "0.77",
			aiLabel: "Litter",
			aiJumlahDeteksi: 12,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 35, keterangan: "0.77 — sebaran sampah luas" },
				{ label: "Risiko", poin: 20, keterangan: "Berpotensi menyumbat aliran sungai" },
			],
			ditanganiOleh: "kepala_seksi",
			hariLalu: 2,
		},
		{
			pelaporNama: "Hendra Gunawan",
			pelaporTelepon: "081234500008",
			deskripsi: "Tumpukan kardus dan sisa dagangan di bahu jalan setelah pasar tutup.",
			jenisSampah: "tumpukan_sampah",
			latitude: "-6.93110",
			longitude: "107.62480",
			kecamatan: "Batununggal",
			status: "SELESAI" as const,
			catatanPetugas: "Sudah diangkut pukul 06.10, lokasi bersih.",
			aiSkor: "0.69",
			aiLabel: "Pile",
			aiJumlahDeteksi: 4,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 30, keterangan: "0.69 — tumpukan terdeteksi" },
				{ label: "Kelengkapan", poin: 15, keterangan: "Foto + GPS + deskripsi lengkap" },
			],
			ditanganiOleh: "petugas",
			hariLalu: 4,
		},
		{
			pelaporNama: "Anonim",
			pelaporTelepon: null,
			deskripsi: "Sampah di gang sempit, mobil pengangkut tidak masuk.",
			jenisSampah: "tumpukan_sampah",
			latitude: "-6.94020",
			longitude: "107.63310",
			kecamatan: "Kiaracondong",
			status: "SELESAI" as const,
			catatanPetugas: "Diangkut manual dengan gerobak motor.",
			aiSkor: "0.58",
			aiLabel: "Pile",
			aiJumlahDeteksi: 2,
			aiRekomendasi: "PERLU_TINJAUAN" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 20, keterangan: "0.58 — tumpukan kecil" },
				{ label: "Pelapor anonim", poin: -5, keterangan: "Tidak ada nomor untuk verifikasi" },
			],
			ditanganiOleh: "petugas",
			hariLalu: 7,
		},
		{
			// Pindai AI gagal (layanan pLitter sempat mati) — memberi contoh baris
			// yang perlu tombol "Pindai ulang" di antrian triase.
			pelaporNama: "Wati Suryani",
			pelaporTelepon: "081234500009",
			deskripsi: "Sampah menumpuk di depan halte, tolong dicek.",
			jenisSampah: "tumpukan_sampah",
			latitude: "-6.91780",
			longitude: "107.61940",
			kecamatan: "Sumur Bandung",
			status: "MENUNGGU" as const,
			aiSkor: null,
			aiLabel: null,
			aiJumlahDeteksi: null,
			aiRekomendasi: "GAGAL_PINDAI" as const,
			faktorAi: [
				{ label: "Pindai AI", poin: 0, keterangan: "Layanan deteksi tidak merespons" },
			],
			hariLalu: 0,
		},
		{
			pelaporNama: "Asep Ridwan",
			pelaporTelepon: "081234500010",
			deskripsi:
				"Titik langganan pembuangan liar di bawah jembatan layang, tiap minggu muncul lagi.",
			jenisSampah: "pembuangan_liar_besar",
			latitude: "-6.94810",
			longitude: "107.63980",
			kecamatan: "Bandung Kidul",
			status: "MENUNGGU" as const,
			aiSkor: "0.91",
			aiLabel: "Pile",
			aiJumlahDeteksi: 9,
			aiRekomendasi: "SANGAT_MUNGKIN_VALID" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 45, keterangan: "0.91 — 9 objek terdeteksi" },
				{ label: "Titik kronis", poin: 20, keterangan: "4 laporan di radius 50 m bulan ini" },
				{ label: "Reputasi pelapor", poin: 10, keterangan: "Riwayat laporan valid" },
			],
			hariLalu: 0,
		},
		{
			pelaporNama: "Tini Marlina",
			pelaporTelepon: "081234500011",
			deskripsi: "Ada beberapa botol dan gelas plastik di taman, tidak banyak tapi mengganggu.",
			jenisSampah: "botol_minuman",
			latitude: "-6.90050",
			longitude: "107.61510",
			kecamatan: "Coblong",
			status: "MENUNGGU" as const,
			aiSkor: "0.34",
			aiLabel: "Litter",
			aiJumlahDeteksi: 2,
			aiRekomendasi: "PERLU_TINJAUAN" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 10, keterangan: "0.34 — sampah tersebar sedikit" },
				{ label: "Kelengkapan", poin: 15, keterangan: "Foto + GPS + deskripsi lengkap" },
			],
			hariLalu: 1,
		},
		{
			pelaporNama: "Tes Tes",
			pelaporTelepon: "081234500012",
			deskripsi: "asdf asdf",
			jenisSampah: null,
			latitude: null,
			longitude: null,
			kecamatan: "Astanaanyar",
			status: "DITOLAK" as const,
			catatanPetugas: "Laporan uji coba, tidak ada objek sampah pada foto.",
			aiSkor: "0.01",
			aiLabel: null,
			aiJumlahDeteksi: 0,
			aiRekomendasi: "KEMUNGKINAN_SPAM" as const,
			faktorAi: [
				{ label: "Skor AI", poin: 0, keterangan: "0.01 — tidak ada objek sampah terdeteksi" },
				{ label: "Deskripsi", poin: -10, keterangan: "Isi deskripsi tidak bermakna" },
			],
			ditanganiOleh: "operator",
			hariLalu: 9,
		},
	];

	// Id digenerate lebih dulu supaya laporan duplikat bisa menunjuk induknya
	// lewat `duplikatDariIndex` tanpa query balik setelah insert.
	const laporanIds = laporanData.map(() => generateId(16));

	await db.insert(publicReports).values(
		laporanData.map(({ hariLalu, faktorAi, ditanganiOleh, duplikatDariIndex, ...l }, i) => ({
			id: laporanIds[i],
			// Kode deterministik dari nomor urut supaya tidak bentrok antar-reset
			// demo, tapi tetap berbentuk seperti kode asli.
			kodeTracking: `LPR-${generateId(6)
				.toUpperCase()
				.replace(/[01OIL]/g, "X")}`,
			urlFoto: "/uploads/contoh-laporan.jpg",
			kota: "Kota Bandung",
			...l,
			aiRincian: faktorAi ? JSON.stringify(faktorAi) : null,
			diprosesOleh: ditanganiOleh ? (userIdByUsername.get(ditanganiOleh) ?? null) : null,
			duplikatDariId: duplikatDariIndex === undefined ? null : laporanIds[duplikatDariIndex],
			// Pindai gagal tidak punya waktu pindai yang berarti.
			aiDipindaiPada: l.aiRekomendasi === "GAGAL_PINDAI" ? null : daysAgo(hariLalu),
			createdAt: daysAgo(hariLalu),
			updatedAt: daysAgo(hariLalu),
		}))
	);
	console.log(`  Created ${laporanData.length} public reports`);

	// Reputasi pelapor yang konsisten dengan riwayat di atas, supaya kolom
	// "reputasi pelapor" di antrian triase tidak kosong saat demo.
	await db.insert(reporterTrust).values([
		{ telepon: "6281234500001", laporanTotal: 6, laporanValid: 5, laporanDitolak: 1, skor: 75 },
		{ telepon: "6281234500002", laporanTotal: 2, laporanValid: 1, laporanDitolak: 0, skor: 55 },
		{ telepon: "6281234500004", laporanTotal: 5, laporanValid: 0, laporanDitolak: 5, skor: 14 },
		{ telepon: "6281234500005", laporanTotal: 3, laporanValid: 1, laporanDitolak: 0, skor: 48 },
		{ telepon: "6281234500006", laporanTotal: 9, laporanValid: 8, laporanDitolak: 1, skor: 82 },
		// Komunitas warga — pelapor paling produktif dan hampir selalu valid.
		{ telepon: "6281234500007", laporanTotal: 24, laporanValid: 22, laporanDitolak: 1, skor: 91 },
		{ telepon: "6281234500008", laporanTotal: 4, laporanValid: 3, laporanDitolak: 1, skor: 62 },
		{ telepon: "6281234500009", laporanTotal: 1, laporanValid: 0, laporanDitolak: 0, skor: 50 },
		{ telepon: "6281234500010", laporanTotal: 11, laporanValid: 10, laporanDitolak: 1, skor: 86 },
		{ telepon: "6281234500011", laporanTotal: 2, laporanValid: 1, laporanDitolak: 1, skor: 45 },
		{ telepon: "6281234500012", laporanTotal: 3, laporanValid: 0, laporanDitolak: 3, skor: 12 },
	]);

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
