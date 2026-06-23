import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable } from "@workspace/db";

const router: IRouter = Router();

// ──────────────────────────────────────────────────────────────────────────────
// GET /reports/net-worth
// Returns monthly net-worth snapshots for the last 13 months.
// Approach: current account total is ground truth; each prior month is derived
// by subtracting the net income/expense of all months that follow it.
// ──────────────────────────────────────────────────────────────────────────────
router.get("/reports/net-worth", async (_req, res): Promise<void> => {
  const [{ current }] = await db
    .select({ current: sql<number>`coalesce(sum(balance), 0)::float` })
    .from(accountsTable);

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', date::date), 'YYYY-MM')`,
      net: sql<number>`
        coalesce(sum(case when type = 'income' then amount else 0 end), 0)::float -
        coalesce(sum(case when type = 'expense' then amount else 0 end), 0)::float
      `,
    })
    .from(transactionsTable)
    .where(sql`date::date >= (current_date - interval '13 months')`)
    .groupBy(sql`date_trunc('month', date::date)`)
    .orderBy(sql`date_trunc('month', date::date) desc`);

  // Walk backward from current: each month's net worth = following month's - that month's net change
  let running = current;
  const result: { month: string; netWorth: number }[] = [];
  for (const row of rows) {
    result.push({ month: row.month, netWorth: Math.round(running * 100) / 100 });
    running -= row.net; // go back in time
  }

  res.json(result.reverse());
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /reports/income-expense
// Returns per-month income and expense totals + per-category breakdown.
// Query param: months (default 6)
// ──────────────────────────────────────────────────────────────────────────────
router.get("/reports/income-expense", async (req, res): Promise<void> => {
  const months = Math.min(24, Math.max(1, Number(req.query["months"] ?? 6)));

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', date::date), 'YYYY-MM')`,
      type: transactionsTable.type,
      income: sql<number>`coalesce(sum(case when type = 'income' then amount else 0 end), 0)::float`,
      expenses: sql<number>`coalesce(sum(case when type = 'expense' then amount else 0 end), 0)::float`,
    })
    .from(transactionsTable)
    .where(sql`date::date >= (current_date - interval '${sql.raw(String(months))} months')`)
    .groupBy(sql`date_trunc('month', date::date)`, transactionsTable.type)
    .orderBy(sql`date_trunc('month', date::date)`);

  // Collapse by month
  const byMonth = new Map<string, { month: string; income: number; expenses: number; net: number }>();
  for (const r of rows) {
    const m = byMonth.get(r.month) ?? { month: r.month, income: 0, expenses: 0, net: 0 };
    m.income += r.income;
    m.expenses += r.expenses;
    m.net = m.income - m.expenses;
    byMonth.set(r.month, m);
  }

  res.json([...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)));
});

export default router;
