import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, budgetsTable, categoriesTable, transactionsTable } from "@workspace/db";
import {
  CreateBudgetBody,
  UpdateBudgetBody,
  UpdateBudgetParams,
  DeleteBudgetParams,
  ListBudgetsQueryParams,
} from "@workspace/api-zod";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";

const router: IRouter = Router();

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

router.get("/budgets/overview", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const month = currentMonth();
  const budgets = await db
    .select({
      id: budgetsTable.id,
      categoryId: budgetsTable.categoryId,
      limitAmount: budgetsTable.limitAmount,
      month: budgetsTable.month,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
    })
    .from(budgetsTable)
    .leftJoin(categoriesTable, eq(budgetsTable.categoryId, categoriesTable.id))
    .where(and(eq(budgetsTable.clerkUserId, userId), eq(budgetsTable.month, month)));

  const result = await Promise.all(
    budgets.map(async (b) => {
      const [{ spent }] = await db
        .select({ spent: sql<number>`coalesce(sum(amount), 0)::float` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.clerkUserId, userId),
            eq(transactionsTable.categoryId, b.categoryId),
            eq(transactionsTable.type, "expense"),
            sql`to_char(date::date, 'YYYY-MM') = ${month}`
          )
        );
      const spentAmount = spent ?? 0;
      const remainingAmount = b.limitAmount - spentAmount;
      const percentUsed = b.limitAmount > 0 ? Math.min(100, (spentAmount / b.limitAmount) * 100) : 0;
      return { ...b, spentAmount, remainingAmount, percentUsed };
    })
  );
  res.json(result);
});

router.get("/budgets", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const query = ListBudgetsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const month = query.data.month ?? currentMonth();
  const budgets = await db
    .select({
      id: budgetsTable.id,
      categoryId: budgetsTable.categoryId,
      limitAmount: budgetsTable.limitAmount,
      month: budgetsTable.month,
      createdAt: budgetsTable.createdAt,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
    })
    .from(budgetsTable)
    .leftJoin(categoriesTable, eq(budgetsTable.categoryId, categoriesTable.id))
    .where(and(eq(budgetsTable.clerkUserId, userId), eq(budgetsTable.month, month)));
  res.json(budgets);
});

router.post("/budgets", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [budget] = await db.insert(budgetsTable).values({ ...parsed.data, clerkUserId: userId }).returning();
  res.status(201).json(budget);
});

router.put("/budgets/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = UpdateBudgetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [budget] = await db.update(budgetsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.clerkUserId, userId)))
    .returning();
  if (!budget) { res.status(404).json({ error: "Budget not found" }); return; }
  res.json(budget);
});

router.delete("/budgets/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = DeleteBudgetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(budgetsTable)
    .where(and(eq(budgetsTable.id, params.data.id), eq(budgetsTable.clerkUserId, userId)));
  res.sendStatus(204);
});

export default router;
