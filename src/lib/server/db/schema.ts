import { pgTable, text, bigint, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	role: text("role", {
		enum: ["admin", "operator", "kepala_seksi", "kepala_dinas", "walikota", "petugas_lapangan"],
	})
		.notNull()
		.default("operator"),
	createdAt: timestamp("created_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const sessions = pgTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		// Millisecond epoch timestamps exceed int4 (max ~2.1e9); must be int8.
		// mode:"number" makes postgres.js (which returns int8 as string) parse to number.
		expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
		userAgent: text("user_agent"),
		ipAddress: text("ip_address"),
		createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
	},
	(table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const pages = pgTable(
	"pages",
	{
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		slug: text("slug").notNull().unique(),
		content: text("content").notNull().default(""),
		template: text("template", { enum: ["default", "landing", "blog"] })
			.notNull()
			.default("default"),
		status: text("status", { enum: ["draft", "published", "archived"] })
			.notNull()
			.default("draft"),
		authorId: text("author_id")
			.notNull()
			.references(() => users.id),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: timestamp("updated_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
		publishedAt: timestamp("published_at", { mode: "date" }),
	},
	(table) => [
		index("pages_author_id_idx").on(table.authorId),
		index("pages_status_idx").on(table.status),
	]
);

export const notifications = pgTable(
	"notifications",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").references(() => users.id),
		title: text("title").notNull(),
		message: text("message").notNull(),
		type: text("type", { enum: ["info", "warning", "error", "success"] })
			.notNull()
			.default("info"),
		read: boolean("read").notNull().default(false),
		createdAt: timestamp("created_at", { mode: "date" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("notifications_user_id_idx").on(table.userId),
		// Supports the unread-count + recent-unread queries in the app shell.
		index("notifications_read_created_idx").on(table.read, table.createdAt),
	]
);

export const passwordResetTokens = pgTable(
	"password_reset_tokens",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		tokenHash: text("token_hash").notNull(),
		expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
	},
	(table) => [
		index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
		index("password_reset_tokens_user_id_idx").on(table.userId),
	]
);

export const appSettings = pgTable("app_settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: timestamp("updated_at", { mode: "date" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
