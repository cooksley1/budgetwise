import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db, transactionsTable, categoriesTable, accountsTable } from "@workspace/db";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  GetTransactionParams,
  UpdateTransactionParams,
  DeleteTransactionParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

/** Drizzle's `date` column expects a YYYY-MM-DD string, not a JS Date object. */
const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

const withJoins = () =>
  db
    .select({
      id: transactionsTable.id,
      accountId: transactionsTable.accountId,
      categoryId: transactionsTable.categoryId,
      amount: transactionsTable.amount,
      type: transactionsTable.type,
      description: transactionsTable.description,
      date: transactionsTable.date,
      isRecurring: transactionsTable.isRecurring,
      originalAmount: transactionsTable.originalAmount,
      originalCurrency: transactionsTable.originalCurrency,
      fxRate: transactionsTable.fxRate,
      merchant: transactionsTable.merchant,
      location: transactionsTable.location,
      vendorAddress: transactionsTable.vendorAddress,
      vendorLat: transactionsTable.vendorLat,
      vendorLng: transactionsTable.vendorLng,
      items: transactionsTable.items,
      photoUrl: transactionsTable.photoUrl,
      mood: transactionsTable.mood,
      companions: transactionsTable.companions,
      occurredAt: transactionsTable.occurredAt,
      tipAmount: transactionsTable.tipAmount,
      weather: transactionsTable.weather,
      createdAt: transactionsTable.createdAt,
      accountName: accountsTable.name,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
    })
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id));

router.get("/transactions/recent", async (_req, res): Promise<void> => {
  const txns = await withJoins().orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt)).limit(10);
  res.json(txns);
});

router.get("/transactions", async (req, res): Promise<void> => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, categoryId, type, startDate, endDate, limit = 50, offset = 0 } = query.data;

  const conditions = [];
  if (accountId) conditions.push(eq(transactionsTable.accountId, accountId));
  if (categoryId) conditions.push(eq(transactionsTable.categoryId, categoryId));
  if (type) conditions.push(eq(transactionsTable.type, type));
  if (startDate) conditions.push(gte(transactionsTable.date, toDateStr(startDate)));
  if (endDate) conditions.push(lte(transactionsTable.date, toDateStr(endDate)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, [{ count }]] = await Promise.all([
    withJoins()
      .where(where)
      .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(transactionsTable).where(where),
  ]);

  res.json({ data, total: count });
});

router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { date, ...rest } = parsed.data;
  const [txn] = await db.insert(transactionsTable).values({ ...rest, date: toDateStr(date) }).returning();
  const [full] = await withJoins().where(eq(transactionsTable.id, txn.id));
  res.status(201).json(full);
});

router.get("/transactions/:id", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [txn] = await withJoins().where(eq(transactionsTable.id, params.data.id));
  if (!txn) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(txn);
});

router.put("/transactions/:id", async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { date: updateDate, ...updateRest } = parsed.data;
  await db
    .update(transactionsTable)
    .set({ ...updateRest, ...(updateDate !== undefined ? { date: toDateStr(updateDate) } : {}), updatedAt: new Date() })
    .where(eq(transactionsTable.id, params.data.id));
  const [txn] = await withJoins().where(eq(transactionsTable.id, params.data.id));
  if (!txn) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(txn);
});

router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(transactionsTable).where(eq(transactionsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
