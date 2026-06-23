import { Router, type IRouter } from "express";
import { eq, desc, gte, and } from "drizzle-orm";
import { db, subscriptionsTable, categoriesTable, transactionsTable } from "@workspace/db";
import { CreateSubscriptionBody, UpdateSubscriptionBody, UpdateSubscriptionParams, DeleteSubscriptionParams } from "@workspace/api-zod";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";

const router: IRouter = Router();

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

router.get("/subscriptions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const subs = await db
    .select({
      id: subscriptionsTable.id,
      name: subscriptionsTable.name,
      amount: subscriptionsTable.amount,
      billingCycle: subscriptionsTable.billingCycle,
      nextBillingDate: subscriptionsTable.nextBillingDate,
      categoryId: subscriptionsTable.categoryId,
      isActive: subscriptionsTable.isActive,
      color: subscriptionsTable.color,
      createdAt: subscriptionsTable.createdAt,
      categoryName: categoriesTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(categoriesTable, eq(subscriptionsTable.categoryId, categoriesTable.id))
    .where(eq(subscriptionsTable.clerkUserId, userId))
    .orderBy(subscriptionsTable.name);
  res.json(subs);
});

router.post("/subscriptions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { nextBillingDate, ...subRest } = parsed.data;
  const [sub] = await db.insert(subscriptionsTable)
    .values({ ...subRest, nextBillingDate: toDateStr(nextBillingDate), clerkUserId: userId })
    .returning();
  res.status(201).json(sub);
});

router.put("/subscriptions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = UpdateSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { nextBillingDate: updNbd, ...updSubRest } = parsed.data;
  const [sub] = await db
    .update(subscriptionsTable)
    .set({ ...updSubRest, ...(updNbd !== undefined ? { nextBillingDate: toDateStr(updNbd) } : {}), updatedAt: new Date() })
    .where(and(eq(subscriptionsTable.id, params.data.id), eq(subscriptionsTable.clerkUserId, userId)))
    .returning();
  if (!sub) { res.status(404).json({ error: "Subscription not found" }); return; }
  res.json(sub);
});

router.delete("/subscriptions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = DeleteSubscriptionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(subscriptionsTable)
    .where(and(eq(subscriptionsTable.id, params.data.id), eq(subscriptionsTable.clerkUserId, userId)));
  res.sendStatus(204);
});

router.get("/subscriptions/detect", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 13);

  const rows = await db
    .select({
      id: transactionsTable.id,
      description: transactionsTable.description,
      merchant: transactionsTable.merchant,
      amount: transactionsTable.amount,
      date: transactionsTable.date,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.clerkUserId, userId),
      gte(transactionsTable.date, cutoff.toISOString().slice(0, 10))
    ))
    .orderBy(desc(transactionsTable.date));

  const normalise = (s: string) =>
    s.toLowerCase().replace(/\*.*$/, "").replace(/\s+(ltd|inc|llc|plc|limited|corp)\.?$/i, "")
      .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();

  const groups = new Map<string, { label: string; amounts: number[]; dates: string[] }>();
  for (const row of rows) {
    const raw = (row.merchant || row.description || "").trim();
    if (!raw) continue;
    const key = normalise(raw);
    if (!key) continue;
    const g = groups.get(key) ?? { label: raw, amounts: [], dates: [] };
    g.amounts.push(row.amount);
    g.dates.push(row.date as string);
    groups.set(key, g);
  }

  const CYCLE_RANGES: Array<{ label: string; days: number; tol: number }> = [
    { label: "weekly", days: 7, tol: 2 },
    { label: "monthly", days: 30, tol: 5 },
    { label: "quarterly", days: 91, tol: 10 },
    { label: "annually", days: 365, tol: 20 },
  ];

  const candidates: Array<{
    name: string; amount: number; billingCycle: string;
    occurrences: number; confidence: number; lastSeen: string;
  }> = [];

  for (const [, g] of groups) {
    if (g.dates.length < 2) continue;
    const sortedDates = [...g.dates].sort();
    const ms = sortedDates.map((d) => new Date(d).getTime());
    const intervals = ms.slice(1).map((t, i) => Math.round((t - ms[i]) / 86400000));
    let bestCycle: string | null = null;
    let bestScore = 0;
    for (const cyc of CYCLE_RANGES) {
      const matching = intervals.filter((iv) => Math.abs(iv - cyc.days) <= cyc.tol);
      const score = matching.length / intervals.length;
      if (score > bestScore && score >= 0.5) { bestScore = score; bestCycle = cyc.label; }
    }
    if (!bestCycle) continue;
    const mean = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
    const variance = g.amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / g.amounts.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > 0.25) continue;
    const confidence = Math.min(1, ((g.dates.length - 1) / 6) * 0.5 + bestScore * 0.3 + (1 - cv) * 0.2);
    candidates.push({
      name: g.label,
      amount: Math.round(mean * 100) / 100,
      billingCycle: bestCycle,
      occurrences: g.dates.length,
      confidence: Math.round(confidence * 100),
      lastSeen: sortedDates[sortedDates.length - 1],
    });
  }

  const existing = await db.select({ name: subscriptionsTable.name }).from(subscriptionsTable)
    .where(eq(subscriptionsTable.clerkUserId, userId));
  const existingNames = new Set(existing.map((s) => normalise(s.name)));
  const filtered = candidates.filter((c) => !existingNames.has(normalise(c.name)));
  filtered.sort((a, b) => b.confidence - a.confidence);
  res.json(filtered.slice(0, 20));
});

export default router;
