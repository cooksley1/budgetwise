import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody, UpdateGoalParams, DeleteGoalParams } from "@workspace/api-zod";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";

const router: IRouter = Router();

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

router.get("/goals", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const goals = await db.select().from(goalsTable)
    .where(eq(goalsTable.clerkUserId, userId))
    .orderBy(goalsTable.createdAt);
  const result = goals.map((g) => ({
    ...g,
    percentComplete: g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0,
  }));
  res.json(result);
});

router.post("/goals", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { targetDate, ...rest } = parsed.data;
  const [goal] = await db.insert(goalsTable)
    .values({ ...rest, clerkUserId: userId, ...(targetDate !== undefined ? { targetDate: toDateStr(targetDate) } : {}) })
    .returning();
  res.status(201).json({ ...goal, percentComplete: 0 });
});

router.put("/goals/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { targetDate: updTargetDate, ...updRest } = parsed.data;
  const [goal] = await db.update(goalsTable)
    .set({ ...updRest, ...(updTargetDate !== undefined ? { targetDate: toDateStr(updTargetDate) } : {}), updatedAt: new Date() })
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.clerkUserId, userId)))
    .returning();
  if (!goal) { res.status(404).json({ error: "Goal not found" }); return; }
  const percentComplete = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  res.json({ ...goal, percentComplete });
});

router.delete("/goals/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(goalsTable)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.clerkUserId, userId)));
  res.sendStatus(204);
});

export default router;
