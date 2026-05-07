import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, goalsTable } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody, UpdateGoalParams, DeleteGoalParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/goals", async (_req, res): Promise<void> => {
  const goals = await db.select().from(goalsTable).orderBy(goalsTable.createdAt);
  const result = goals.map((g) => ({
    ...g,
    percentComplete: g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0,
  }));
  res.json(result);
});

router.post("/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [goal] = await db.insert(goalsTable).values(parsed.data).returning();
  res.status(201).json({ ...goal, percentComplete: 0 });
});

router.put("/goals/:id", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [goal] = await db.update(goalsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(goalsTable.id, params.data.id)).returning();
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const percentComplete = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  res.json({ ...goal, percentComplete });
});

router.delete("/goals/:id", async (req, res): Promise<void> => {
  const params = DeleteGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(goalsTable).where(eq(goalsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
