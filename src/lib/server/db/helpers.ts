import { sql } from "drizzle-orm";

/**
 * Count-query fragment: `count(*)::int`.
 *
 * postgres.js returns Postgres bigint (int8) as a string, and `count(*)` is
 * int8 — so every count query needs an explicit `::int` cast to get a JS
 * number. This used to be hand-rolled at every call site; centralized here so
 * the cast can't drift between count queries.
 */
export const countAll = sql<number>`count(*)::int`;
