---
name: Clerk user scoping pattern
description: How per-user data isolation is implemented across all Wayfare DB tables using clerkUserId.
---

All user-owned tables (accounts, transactions, budgets, goals, subscriptions, trackers) have a `clerkUserId text NOT NULL DEFAULT ""` column.

**Rule:** Every API route that touches user data must:
1. Call `requireUserId(req, res)` — extracts userId via `getAuth(req)` from `@clerk/express`, returns 401 if absent.
2. Filter every query with `eq(table.clerkUserId, userId)`.

**Why:** Default value `""` isolates any seed/demo rows (clerkUserId = "") from real users (clerkUserId = real Clerk ID). No row-level-security needed in Postgres — the application layer enforces isolation.

**How to apply:** When adding a new user-owned table, add the column with `.default("")`, push the migration, and add the filter to every route that queries or mutates that table.
