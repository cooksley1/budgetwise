import { Router, type IRouter } from "express";
import { eq, and, inArray, sql, desc, gte, lte, like, or } from "drizzle-orm";
import {
  db,
  trackersTable,
  trackerTransactionsTable,
  trackerRulesTable,
  transactionsTable,
  categoriesTable,
  accountsTable,
} from "@workspace/db";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getTrackerSummary(trackerId: number, userId: string) {
  const [tracker] = await db.select().from(trackersTable)
    .where(and(eq(trackersTable.id, trackerId), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) return null;

  const txnRows = await db
    .select({
      id: transactionsTable.id,
      amount: transactionsTable.amount,
      originalAmount: transactionsTable.originalAmount,
      originalCurrency: transactionsTable.originalCurrency,
      type: transactionsTable.type,
      date: transactionsTable.date,
      description: transactionsTable.description,
      merchant: transactionsTable.merchant,
      location: transactionsTable.location,
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
      accountName: accountsTable.name,
    })
    .from(trackerTransactionsTable)
    .innerJoin(transactionsTable, eq(trackerTransactionsTable.transactionId, transactionsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .where(eq(trackerTransactionsTable.trackerId, trackerId));

  const expenses = txnRows.filter((t) => t.type === "expense");
  const totalSpent = expenses.reduce((s, t) => s + (t.amount ?? 0), 0);
  const totalIncome = txnRows.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount ?? 0), 0);

  let days = 0;
  if (tracker.startDate && tracker.endDate) {
    const start = new Date(tracker.startDate);
    const end = new Date(tracker.endDate);
    days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
  } else if (txnRows.length > 0) {
    const dates = txnRows.map((t) => new Date(t.date).getTime()).sort();
    days = Math.max(1, Math.ceil((dates[dates.length - 1] - dates[0]) / 86400000) + 1);
  }

  const dailyAvg = days > 0 ? totalSpent / days : 0;
  const weeklyAvg = dailyAvg * 7;
  const monthlyAvg = dailyAvg * 30;

  return { tracker, txnRows, totalSpent, totalIncome, days, dailyAvg, weeklyAvg, monthlyAvg };
}

// ── List trackers ─────────────────────────────────────────────────────────────
router.get("/trackers", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const trackers = await db.select().from(trackersTable)
    .where(eq(trackersTable.clerkUserId, userId))
    .orderBy(desc(trackersTable.createdAt));

  const stats = await db
    .select({
      trackerId: trackerTransactionsTable.trackerId,
      total: sql<number>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'expense' THEN ${transactionsTable.amount} ELSE 0 END), 0)::float`,
      count: sql<number>`COUNT(${transactionsTable.id})::int`,
    })
    .from(trackerTransactionsTable)
    .innerJoin(transactionsTable, eq(trackerTransactionsTable.transactionId, transactionsTable.id))
    .where(inArray(trackerTransactionsTable.trackerId, trackers.map((t) => t.id).filter((id) => id > 0)))
    .groupBy(trackerTransactionsTable.trackerId);

  const statsMap = new Map(stats.map((s) => [s.trackerId, s]));
  const enriched = trackers.map((t) => ({
    ...t,
    totalSpent: statsMap.get(t.id)?.total ?? 0,
    transactionCount: statsMap.get(t.id)?.count ?? 0,
  }));

  res.json(enriched);
});

// ── Create tracker ─────────────────────────────────────────────────────────────
router.post("/trackers", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const { name, type, description, startDate, endDate, homeCurrency, foreignCurrency, dailyBudget, color, icon } = req.body;
  if (!name || !type) { res.status(400).json({ error: "name and type are required" }); return; }
  const [created] = await db
    .insert(trackersTable)
    .values({
      clerkUserId: userId,
      name, type,
      description: description ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      homeCurrency: homeCurrency ?? "USD",
      foreignCurrency: foreignCurrency ?? null,
      dailyBudget: dailyBudget ?? null,
      color: color ?? "#10b981",
      icon: icon ?? "plane",
    })
    .returning();
  res.status(201).json(created);
});

// ── Update tracker ─────────────────────────────────────────────────────────────
router.put("/trackers/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { name, type, description, startDate, endDate, homeCurrency, foreignCurrency, dailyBudget, color, icon } = req.body;
  const [updated] = await db
    .update(trackersTable)
    .set({
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(description !== undefined && { description }),
      ...(startDate !== undefined && { startDate }),
      ...(endDate !== undefined && { endDate }),
      ...(homeCurrency !== undefined && { homeCurrency }),
      ...(foreignCurrency !== undefined && { foreignCurrency }),
      ...(dailyBudget !== undefined && { dailyBudget }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      updatedAt: new Date(),
    })
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Tracker not found" }); return; }
  res.json(updated);
});

// ── Delete tracker ─────────────────────────────────────────────────────────────
router.delete("/trackers/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [existing] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!existing) { res.status(404).json({ error: "Tracker not found" }); return; }
  await db.transaction(async (tx) => {
    await tx.delete(trackerTransactionsTable).where(eq(trackerTransactionsTable.trackerId, id));
    await tx.delete(trackerRulesTable).where(eq(trackerRulesTable.trackerId, id));
    await tx.delete(trackersTable).where(eq(trackersTable.id, id));
  });
  res.sendStatus(204);
});

// ── Compare trackers ──────────────────────────────────────────────────────────
router.get("/trackers/compare", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const idsParam = req.query["ids"] as string | undefined;
  if (!idsParam) { res.status(400).json({ error: "ids query param required (comma-separated)" }); return; }
  const ids = idsParam.split(",").map(Number).filter((n) => !Number.isNaN(n));
  const summaries = await Promise.all(ids.map((id) => getTrackerSummary(id, userId)));
  res.json(
    summaries.filter(Boolean).map((s) => ({
      tracker: s!.tracker,
      totalSpent: s!.totalSpent,
      days: s!.days,
      dailyAvg: s!.dailyAvg,
      transactionCount: s!.txnRows.length,
    }))
  );
});

// ── Get single tracker ────────────────────────────────────────────────────────
router.get("/trackers/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const summary = await getTrackerSummary(id, userId);
  if (!summary) { res.status(404).json({ error: "Tracker not found" }); return; }

  const { tracker, txnRows, totalSpent, totalIncome, days, dailyAvg, weeklyAvg, monthlyAvg } = summary;
  const expenses = txnRows.filter((t) => t.type === "expense");

  const catMap = new Map<string, { name: string; color: string | null; icon: string | null; total: number; count: number }>();
  for (const t of expenses) {
    const key = t.categoryName ?? "Uncategorised";
    const existing = catMap.get(key) ?? { name: key, color: t.categoryColor, icon: t.categoryIcon, total: 0, count: 0 };
    existing.total += t.amount ?? 0;
    existing.count += 1;
    catMap.set(key, existing);
  }
  const byCategory = Array.from(catMap.values()).sort((a, b) => b.total - a.total);

  const dayMap = new Map<string, number>();
  for (const t of expenses) { dayMap.set(t.date, (dayMap.get(t.date) ?? 0) + (t.amount ?? 0)); }
  const byDay = Array.from(dayMap.entries()).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));

  const merchMap = new Map<string, { name: string; total: number; count: number; min: number; max: number; avg: number }>();
  for (const t of expenses) {
    const key = t.merchant ?? t.description ?? "Unknown";
    const existing = merchMap.get(key) ?? { name: key, total: 0, count: 0, min: Infinity, max: 0, avg: 0 };
    existing.total += t.amount ?? 0;
    existing.count += 1;
    existing.min = Math.min(existing.min, t.amount ?? 0);
    existing.max = Math.max(existing.max, t.amount ?? 0);
    existing.avg = existing.total / existing.count;
    merchMap.set(key, existing);
  }
  const byMerchant = Array.from(merchMap.values()).sort((a, b) => b.count - a.count).slice(0, 20);

  let budgetStatus: { dailyBudget: number; totalBudget: number; over: boolean; percent: number } | null = null;
  if (tracker.dailyBudget && days > 0) {
    const totalBudget = tracker.dailyBudget * days;
    budgetStatus = { dailyBudget: tracker.dailyBudget, totalBudget, over: totalSpent > totalBudget, percent: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0 };
  }

  res.json({
    tracker,
    summary: { totalSpent, totalIncome, days, dailyAvg, weeklyAvg, monthlyAvg, transactionCount: txnRows.length },
    byCategory,
    byDay,
    byMerchant,
    budgetStatus,
    transactions: txnRows.sort((a, b) => b.date.localeCompare(a.date)),
  });
});

// ── Tag transactions to tracker ───────────────────────────────────────────────
router.post("/trackers/:id/transactions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { transactionIds } = req.body as { transactionIds?: number[] };
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) { res.status(400).json({ error: "transactionIds array required" }); return; }
  const validIds = transactionIds.filter((n) => Number.isInteger(n));
  if (validIds.length === 0) { res.status(400).json({ error: "no valid transaction ids" }); return; }
  const [tracker] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }
  const existing = await db.select({ id: transactionsTable.id }).from(transactionsTable)
    .where(and(inArray(transactionsTable.id, validIds), eq(transactionsTable.clerkUserId, userId)));
  if (existing.length === 0) { res.json({ added: 0 }); return; }
  await db.insert(trackerTransactionsTable)
    .values(existing.map((t) => ({ trackerId: id, transactionId: t.id })))
    .onConflictDoNothing();
  res.json({ added: existing.length });
});

// ── Untag transaction ─────────────────────────────────────────────────────────
router.delete("/trackers/:id/transactions/:txnId", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  const txnId = Number(req.params["txnId"]);
  if (Number.isNaN(id) || Number.isNaN(txnId)) { res.status(400).json({ error: "invalid id" }); return; }
  const [tracker] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }
  await db.delete(trackerTransactionsTable)
    .where(and(eq(trackerTransactionsTable.trackerId, id), eq(trackerTransactionsTable.transactionId, txnId)));
  res.sendStatus(204);
});

// ── Rules ─────────────────────────────────────────────────────────────────────
router.get("/trackers/:id/rules", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [tracker] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }
  const rules = await db.select().from(trackerRulesTable).where(eq(trackerRulesTable.trackerId, id));
  res.json(rules);
});

const VALID_RULE_TYPES = new Set(["date_range", "merchant_match", "category", "currency"]);
router.post("/trackers/:id/rules", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [tracker] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }
  const { type, config } = req.body;
  if (!type || !config || typeof config !== "object") { res.status(400).json({ error: "type and config object required" }); return; }
  if (!VALID_RULE_TYPES.has(type)) { res.status(400).json({ error: `type must be one of: ${Array.from(VALID_RULE_TYPES).join(", ")}` }); return; }
  if (type === "merchant_match" && (!Array.isArray(config.keywords) || config.keywords.filter((k: any) => String(k).trim()).length === 0)) { res.status(400).json({ error: "merchant_match rule requires non-empty keywords array" }); return; }
  if (type === "date_range" && (!config.start || !config.end)) { res.status(400).json({ error: "date_range rule requires start and end dates" }); return; }
  if (type === "category" && (!Array.isArray(config.categoryIds) || config.categoryIds.length === 0)) { res.status(400).json({ error: "category rule requires non-empty categoryIds array" }); return; }
  if (type === "currency" && !config.currency) { res.status(400).json({ error: "currency rule requires a currency code" }); return; }
  const [rule] = await db.insert(trackerRulesTable).values({ trackerId: id, type, config }).returning();
  res.status(201).json(rule);
});

router.delete("/trackers/:id/rules/:ruleId", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  const ruleId = Number(req.params["ruleId"]);
  if (Number.isNaN(id) || Number.isNaN(ruleId)) { res.status(400).json({ error: "invalid id" }); return; }
  const [tracker] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }
  await db.delete(trackerRulesTable).where(and(eq(trackerRulesTable.id, ruleId), eq(trackerRulesTable.trackerId, id)));
  res.sendStatus(204);
});

// ── Apply rules ───────────────────────────────────────────────────────────────
router.post("/trackers/:id/apply-rules", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [tracker] = await db.select({ id: trackersTable.id }).from(trackersTable)
    .where(and(eq(trackersTable.id, id), eq(trackersTable.clerkUserId, userId)));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }

  const rules = await db.select().from(trackerRulesTable).where(eq(trackerRulesTable.trackerId, id));
  if (rules.length === 0) { res.json({ tagged: 0 }); return; }

  const matchingIds = new Set<number>();
  for (const rule of rules) {
    const cfg = rule.config as any;
    const conditions: any[] = [eq(transactionsTable.clerkUserId, userId)];

    if (rule.type === "date_range" && cfg.start && cfg.end) {
      conditions.push(and(gte(transactionsTable.date, cfg.start), lte(transactionsTable.date, cfg.end)));
    } else if (rule.type === "merchant_match" && Array.isArray(cfg.keywords) && cfg.keywords.length > 0) {
      const cleaned = cfg.keywords.map((s: string) => String(s).trim()).filter(Boolean);
      if (cleaned.length === 0) continue;
      const ors = cleaned.map((kw: string) =>
        or(
          like(sql`LOWER(${transactionsTable.description})`, `%${kw.toLowerCase()}%`),
          like(sql`LOWER(${transactionsTable.merchant})`, `%${kw.toLowerCase()}%`),
        )
      );
      conditions.push(or(...ors));
    } else if (rule.type === "category" && Array.isArray(cfg.categoryIds) && cfg.categoryIds.length > 0) {
      conditions.push(inArray(transactionsTable.categoryId, cfg.categoryIds));
    } else if (rule.type === "currency" && cfg.currency) {
      conditions.push(eq(transactionsTable.originalCurrency, cfg.currency));
    } else {
      continue;
    }

    if (conditions.length > 0) {
      const matches = await db.select({ id: transactionsTable.id }).from(transactionsTable).where(and(...conditions));
      matches.forEach((m) => matchingIds.add(m.id));
    }
  }

  if (matchingIds.size > 0) {
    await db.insert(trackerTransactionsTable)
      .values(Array.from(matchingIds).map((txnId) => ({ trackerId: id, transactionId: txnId })))
      .onConflictDoNothing();
  }
  res.json({ tagged: matchingIds.size });
});

export default router;
