import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, accountsTable, transactionsTable, subscriptionsTable, categoriesTable } from "@workspace/db";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";

const router: IRouter = Router();

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const month = currentMonth();

  const [accounts, { income, expenses, txnCount }, { subsCost }, { accountCount }] = await Promise.all([
    db.select({ balance: accountsTable.balance }).from(accountsTable)
      .where(eq(accountsTable.clerkUserId, userId)),
    db
      .select({
        income: sql<number>`coalesce(sum(case when type = 'income' then amount else 0 end), 0)::float`,
        expenses: sql<number>`coalesce(sum(case when type = 'expense' then amount else 0 end), 0)::float`,
        txnCount: sql<number>`count(*)::int`,
      })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.clerkUserId, userId),
        sql`to_char(date::date, 'YYYY-MM') = ${month}`
      ))
      .then((r) => r[0]),
    db
      .select({ subsCost: sql<number>`coalesce(sum(amount), 0)::float` })
      .from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.clerkUserId, userId), eq(subscriptionsTable.isActive, true)))
      .then((r) => r[0]),
    db
      .select({ accountCount: sql<number>`count(*)::int` })
      .from(accountsTable)
      .where(eq(accountsTable.clerkUserId, userId))
      .then((r) => r[0]),
  ]);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const monthlyIncome = income ?? 0;
  const monthlyExpenses = expenses ?? 0;
  const spendableAmount = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  res.json({
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    spendableAmount,
    savingsRate,
    accountCount: accountCount ?? 0,
    transactionCount: txnCount ?? 0,
    activeSubscriptionsCost: subsCost ?? 0,
  });
});

router.get("/dashboard/spending-by-category", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const month = (req.query.month as string) ?? currentMonth();

  const rows = await db
    .select({
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
      totalAmount: sql<number>`sum(amount)::float`,
      transactionCount: sql<number>`count(*)::int`,
    })
    .from(transactionsTable)
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(and(
      eq(transactionsTable.clerkUserId, userId),
      eq(transactionsTable.type, "expense"),
      sql`to_char(date::date, 'YYYY-MM') = ${month}`
    ))
    .groupBy(transactionsTable.categoryId, categoriesTable.name, categoriesTable.color, categoriesTable.icon)
    .orderBy(sql`sum(amount) desc`);

  const total = rows.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const result = rows.map((r) => ({
    ...r,
    categoryId: r.categoryId ?? 0,
    categoryName: r.categoryName ?? "Uncategorized",
    percentage: total > 0 ? ((r.totalAmount ?? 0) / total) * 100 : 0,
  }));

  res.json(result);
});

router.get("/dashboard/cash-flow", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', date::date), 'YYYY-MM')`,
      income: sql<number>`coalesce(sum(case when type = 'income' then amount else 0 end), 0)::float`,
      expenses: sql<number>`coalesce(sum(case when type = 'expense' then amount else 0 end), 0)::float`,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.clerkUserId, userId),
      sql`date::date >= (current_date - interval '6 months')`
    ))
    .groupBy(sql`date_trunc('month', date::date)`)
    .orderBy(sql`date_trunc('month', date::date)`);

  const result = rows.map((r) => ({
    month: r.month,
    income: r.income ?? 0,
    expenses: r.expenses ?? 0,
    net: (r.income ?? 0) - (r.expenses ?? 0),
  }));

  res.json(result);
});

export default router;
