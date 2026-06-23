import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, accountsTable, trackersTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  DeleteAccountParams,
} from "@workspace/api-zod";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";

const router: IRouter = Router();

router.get("/accounts", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const accounts = await db.select().from(accountsTable)
    .where(eq(accountsTable.clerkUserId, userId))
    .orderBy(accountsTable.name);
  res.json(accounts);
});

router.post("/accounts", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [account] = await db.insert(accountsTable).values({ ...parsed.data, clerkUserId: userId }).returning();
  // Auto-create ONE global "My Spend" tracker the first time a user adds any account.
  // This is their default catch-all bucket — all accounts, imports, and manual entries
  // flow here unless explicitly redirected. Only created if they have no trackers yet.
  const existingTracker = await db
    .select({ id: trackersTable.id })
    .from(trackersTable)
    .where(eq(trackersTable.clerkUserId, userId))
    .limit(1);
  if (existingTracker.length === 0) {
    await db.insert(trackersTable).values({
      name: "My Spend",
      type: "theme",
      clerkUserId: userId,
      homeCurrency: (parsed.data as any).currency ?? "USD",
      color: "#2F4842",
      icon: "wallet",
    });
  }
  res.status(201).json(account);
});

router.get("/accounts/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = GetAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [account] = await db.select().from(accountsTable)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.clerkUserId, userId)));
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(account);
});

router.put("/accounts/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [account] = await db.update(accountsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.clerkUserId, userId)))
    .returning();
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(account);
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(accountsTable)
    .where(and(eq(accountsTable.id, params.data.id), eq(accountsTable.clerkUserId, userId)));
  res.sendStatus(204);
});

export default router;
