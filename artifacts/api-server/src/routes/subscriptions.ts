import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, categoriesTable } from "@workspace/db";
import { CreateSubscriptionBody, UpdateSubscriptionBody, UpdateSubscriptionParams, DeleteSubscriptionParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/subscriptions", async (_req, res): Promise<void> => {
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
    .orderBy(subscriptionsTable.name);
  res.json(subs);
});

router.post("/subscriptions", async (req, res): Promise<void> => {
  const parsed = CreateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [sub] = await db.insert(subscriptionsTable).values(parsed.data).returning();
  res.status(201).json(sub);
});

router.put("/subscriptions/:id", async (req, res): Promise<void> => {
  const params = UpdateSubscriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [sub] = await db.update(subscriptionsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(subscriptionsTable.id, params.data.id)).returning();
  if (!sub) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }
  res.json(sub);
});

router.delete("/subscriptions/:id", async (req, res): Promise<void> => {
  const params = DeleteSubscriptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
