import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  db,
  transactionsTable,
  categoriesTable,
  accountsTable,
  trackersTable,
  trackerTransactionsTable,
} from "@workspace/db";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  GetTransactionParams,
  UpdateTransactionParams,
  DeleteTransactionParams,
  ListTransactionsQueryParams,
} from "@workspace/api-zod";
import type { Request, Response } from "express";
import { requireUserId } from "../lib/requireUserId";
import OpenAI from "openai";
import * as XLSX from "xlsx";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  // pdfjs-dist is kept external (not bundled) so it can locate its own worker
  // file at runtime. useSystemFonts avoids font-file network fetches.
  const doc = await getDocument({
    data: uint8,
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }
  return pages.join("\n");
}

const router: IRouter = Router();

const aiClient = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
});

// Salvage complete transaction objects from a possibly-truncated AI JSON array.
function recoverPartialJson(raw: string): unknown[] {
  const clean = raw
    .replace(/```json?\n?/gi, "")
    .replace(/```/g, "")
    .trim();
  if (!clean) return [];
  // Full parse first.
  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    /* fall through */
  }
  // Truncated — find the last complete JSON object and close the array.
  const lastClose = clean.lastIndexOf("},");
  if (lastClose > 0) {
    try {
      const parsed = JSON.parse(clean.slice(0, lastClose + 1) + "]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      /* fall through */
    }
  }
  // Try closing without a trailing comma (last object before truncation).
  const lastBrace = clean.lastIndexOf("}");
  if (lastBrace > 0) {
    try {
      const parsed = JSON.parse(clean.slice(0, lastBrace + 1) + "]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      /* fall through */
    }
  }
  return [];
}

// Split text into chunks no larger than maxChars, breaking only on line
// boundaries. No overlap: each line lands in exactly one chunk, so chunking
// never introduces duplicate rows and genuinely-repeated transactions survive.
function chunkByLines(text: string, maxChars: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur.length + line.length + 1 > maxChars && cur.length > 0) {
      chunks.push(cur);
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.length > 0 ? chunks : [text];
}

// Run an async mapper over items with bounded concurrency, preserving order.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]!, idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// FX fields are not yet in the OpenAPI spec — read them directly from req.body
// after the core schema validates, and sanitise inline.
function extractFxFields(body: Record<string, unknown>): {
  originalCurrency?: string;
  originalAmount?: number;
  fxRate?: number;
} {
  const out: {
    originalCurrency?: string;
    originalAmount?: number;
    fxRate?: number;
  } = {};
  if (
    typeof body["originalCurrency"] === "string" &&
    body["originalCurrency"]
  ) {
    out.originalCurrency = body["originalCurrency"];
  }
  if (
    typeof body["originalAmount"] === "number" &&
    body["originalAmount"] > 0
  ) {
    out.originalAmount = body["originalAmount"];
  }
  if (typeof body["fxRate"] === "number" && body["fxRate"] > 0) {
    out.fxRate = body["fxRate"];
  }
  return out;
}

const toDateStr = (d: Date): string => d.toISOString().slice(0, 10);

// Ensure every user has a "My Spend" default tracker — created lazily on their
// first write (manual entry, CSV, PDF, or account add) so no setup step is needed.
async function ensureMySpend(userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: trackersTable.id })
    .from(trackersTable)
    .where(eq(trackersTable.clerkUserId, userId))
    .limit(1);
  if (!existing) {
    await db.insert(trackersTable).values({
      name: "My Spend",
      type: "theme",
      clerkUserId: userId,
      homeCurrency: "USD",
      color: "#2F4842",
      icon: "wallet",
    });
  }
}

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
      clerkUserId: transactionsTable.clerkUserId,
      accountName: accountsTable.name,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      categoryIcon: categoriesTable.icon,
    })
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(
      categoriesTable,
      eq(transactionsTable.categoryId, categoriesTable.id),
    );

router.get("/transactions/recent", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const txns = await withJoins()
    .where(eq(transactionsTable.clerkUserId, userId))
    .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt))
    .limit(10);
  res.json(txns);
});

router.get("/transactions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const {
    accountId,
    categoryId,
    type,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = query.data;

  const conditions: ReturnType<typeof eq>[] = [
    eq(transactionsTable.clerkUserId, userId) as any,
  ];
  if (accountId)
    conditions.push(eq(transactionsTable.accountId, accountId) as any);
  if (categoryId)
    conditions.push(eq(transactionsTable.categoryId, categoryId) as any);
  if (type) conditions.push(eq(transactionsTable.type, type) as any);
  if (startDate)
    conditions.push(gte(transactionsTable.date, toDateStr(startDate)) as any);
  if (endDate)
    conditions.push(lte(transactionsTable.date, toDateStr(endDate)) as any);

  const where = and(...conditions);

  const [data, [{ count }]] = await Promise.all([
    withJoins()
      .where(where)
      .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactionsTable)
      .where(where),
  ]);

  res.json({ data, total: count });
});

router.post("/transactions", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await ensureMySpend(userId);
  const { date, ...rest } = parsed.data;
  const fx = extractFxFields(req.body as Record<string, unknown>);
  const [txn] = await db
    .insert(transactionsTable)
    .values({ ...rest, ...fx, date: toDateStr(date), clerkUserId: userId })
    .returning();
  const [full] = await withJoins().where(eq(transactionsTable.id, txn.id));
  res.status(201).json(full);
});

router.get("/transactions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [txn] = await withJoins().where(
    and(
      eq(transactionsTable.id, params.data.id),
      eq(transactionsTable.clerkUserId, userId),
    ),
  );
  if (!txn) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(txn);
});

router.put("/transactions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
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
  const fxUpdate = extractFxFields(req.body as Record<string, unknown>);
  await db
    .update(transactionsTable)
    .set({
      ...updateRest,
      ...fxUpdate,
      ...(updateDate !== undefined ? { date: toDateStr(updateDate) } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(transactionsTable.id, params.data.id),
        eq(transactionsTable.clerkUserId, userId),
      ),
    );
  const [txn] = await withJoins().where(
    and(
      eq(transactionsTable.id, params.data.id),
      eq(transactionsTable.clerkUserId, userId),
    ),
  );
  if (!txn) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.json(txn);
});

router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(transactionsTable)
    .where(
      and(
        eq(transactionsTable.id, params.data.id),
        eq(transactionsTable.clerkUserId, userId),
      ),
    );
  res.sendStatus(204);
});

// ── CSV / bank statement import ───────────────────────────────────────────────
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        cols.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

function parseDate(s: string): string | null {
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    let [, a, b, y] = slashMatch;
    if (y.length === 2) y = `20${y}`;
    const an = Number(a);
    const [dd, mm] = an > 12 ? [a, b] : [b, a];
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    let [, a, b, y] = dashMatch;
    if (y.length === 2) y = `20${y}`;
    const an = Number(a);
    const [dd, mm] = an > 12 ? [a, b] : [b, a];
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const wordMatch =
    s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/) ||
    s.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (wordMatch) {
    const m1 = wordMatch[1],
      m2 = wordMatch[2],
      m3 = wordMatch[3];
    if (/^\d+$/.test(m1)) {
      const mm = months[m2.toLowerCase()];
      if (mm) return `${m3}-${mm}-${m1.padStart(2, "0")}`;
    } else {
      const mm = months[m1.toLowerCase()];
      if (mm) return `${m3}-${mm}-${m2.padStart(2, "0")}`;
    }
  }
  return null;
}

function parseAmount(s: string): number | null {
  s = s.trim().replace(/[£$€,\s]/g, "");
  const negative = s.startsWith("(") && s.endsWith(")");
  s = s.replace(/[()]/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

function scoreHeader(header: string, keywords: string[]): number {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  return keywords.some((k) => h.includes(k)) ? 1 : 0;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

function autoDetect(rows: string[][]): ParsedRow[] | null {
  if (rows.length < 2) return null;
  const headers = rows[0].map((h) =>
    h.toLowerCase().replace(/[^a-z0-9 ]/g, ""),
  );
  const dataRows = rows.slice(1);
  const dateIdx = headers.findIndex(
    (h) =>
      scoreHeader(h, ["date", "posted", "transactiondate", "valuedate"]) === 1,
  );
  const descIdx = headers.findIndex(
    (h) =>
      scoreHeader(h, [
        "description",
        "payee",
        "name",
        "merchant",
        "narrative",
        "details",
        "reference",
        "memo",
        "particulars",
      ]) === 1,
  );
  const debitIdx = headers.findIndex(
    (h) => scoreHeader(h, ["debit", "withdrawal", "out", "paid out"]) === 1,
  );
  const creditIdx = headers.findIndex(
    (h) => scoreHeader(h, ["credit", "deposit", "in", "paid in"]) === 1,
  );
  const amtIdx = headers.findIndex(
    (h) => scoreHeader(h, ["amount", "value", "sum", "total"]) === 1,
  );
  if (dateIdx === -1 || descIdx === -1) return null;
  if (debitIdx === -1 && creditIdx === -1 && amtIdx === -1) return null;
  const parsed: ParsedRow[] = [];
  for (const row of dataRows) {
    if (row.length < 2) continue;
    const date = parseDate(row[dateIdx] ?? "");
    if (!date) continue;
    const description = (row[descIdx] ?? "").trim();
    if (!description) continue;
    let amount: number | null = null;
    let type: "income" | "expense" = "expense";
    if (debitIdx !== -1 || creditIdx !== -1) {
      const debit = debitIdx !== -1 ? parseAmount(row[debitIdx] ?? "") : null;
      const credit =
        creditIdx !== -1 ? parseAmount(row[creditIdx] ?? "") : null;
      if (debit && Math.abs(debit) > 0) {
        amount = Math.abs(debit);
        type = "expense";
      } else if (credit && Math.abs(credit) > 0) {
        amount = Math.abs(credit);
        type = "income";
      }
    } else {
      const raw = parseAmount(row[amtIdx] ?? "");
      if (raw === null) continue;
      amount = Math.abs(raw);
      type = raw < 0 ? "expense" : "income";
    }
    if (!amount || amount <= 0) continue;
    parsed.push({ date, description, amount, type });
  }
  return parsed;
}

router.post(
  "/transactions/import",
  csvUpload.single("file"),
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    if (!req.file) {
      res.status(400).json({ error: "CSV file required (field name: file)" });
      return;
    }
    const text = req.file.buffer.toString("utf-8");
    const rows = parseCsv(text);
    if (rows.length < 2) {
      res
        .status(400)
        .json({
          error: "File must have a header row and at least one data row",
        });
      return;
    }
    const parsed = autoDetect(rows);
    if (!parsed || parsed.length === 0) {
      res.status(422).json({
        error:
          "Could not auto-detect columns. Ensure your CSV has headers including date, description/payee, and amount (or debit/credit) columns.",
        headers: rows[0],
      });
      return;
    }
    const preview = req.query["preview"] === "true";
    if (preview) {
      res.json({
        total: parsed.length,
        preview: parsed.slice(0, 8),
        headers: rows[0],
      });
      return;
    }
    await ensureMySpend(userId);
    const accountId = Number(req.body?.accountId ?? req.query["accountId"]);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      res.status(400).json({ error: "accountId required for import" });
      return;
    }
    const [acct] = await db
      .select({ id: accountsTable.id })
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.id, accountId),
          eq(accountsTable.clerkUserId, userId),
        ),
      );
    if (!acct) {
      res.status(400).json({ error: "accountId not found" });
      return;
    }
    const inserted = await db
      .insert(transactionsTable)
      .values(
        parsed.map((r) => ({
          accountId,
          clerkUserId: userId,
          amount: r.amount,
          type: r.type,
          description: r.description,
          date: r.date,
          isRecurring: false,
        })),
      )
      .returning({ id: transactionsTable.id });
    // Link to tracker if provided
    const trackerId = Number(req.body?.trackerId ?? req.query["trackerId"]);
    if (Number.isInteger(trackerId) && trackerId > 0 && inserted.length > 0) {
      await db
        .insert(trackerTransactionsTable)
        .values(inserted.map((t) => ({ trackerId, transactionId: t.id })))
        .onConflictDoNothing();
    }
    res.status(201).json({ imported: inserted.length });
  },
);

// ── Document (PDF / TXT / OFX) import — AI-powered ───────────────────────────
router.post(
  "/transactions/import/document",
  docUpload.single("file"),
  async (req, res): Promise<void> => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const name = req.file.originalname.toLowerCase();
    let text = "";

    try {
      if (name.endsWith(".pdf") || req.file.mimetype === "application/pdf") {
        text = await extractPdfText(req.file.buffer);
      } else if (
        name.endsWith(".xlsx") ||
        name.endsWith(".xls") ||
        req.file.mimetype.includes("spreadsheetml") ||
        req.file.mimetype.includes("ms-excel")
      ) {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        text = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName] ?? {});
      } else {
        // Covers: CSV, TXT, OFX, QIF, XML (CAMT.053), MT940 — all text-based
        text = req.file.buffer.toString("utf-8");
      }
    } catch (err: unknown) {
      res
        .status(400)
        .json({
          error: `Could not read file: ${err instanceof Error ? err.message : String(err)}`,
        });
      return;
    }

    if (!text.trim()) {
      res
        .status(422)
        .json({
          error: "No readable text found. Is this a scanned (image) PDF?",
        });
      return;
    }

    // ── PDF text preprocessing ───────────────────────────────────────────────────
    // Strip common bank-PDF boilerplate (copyright lines, "Page N of M" footers,
    // repeated column headers, "Date created" stamps) and collapse runs of blank
    // lines. This can cut input size by 10–20% for long statements, helping the
    // AI focus on transaction rows and stay within the output token budget.
    text = text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return true; // keep blank lines (collapse later)
        if (/copyright\s*©/i.test(t)) return false;
        if (/^abn\s+\d/i.test(t)) return false;
        if (/^date\s+created:/i.test(t)) return false;
        if (/page\s+\d+\s+of\s+\d+/i.test(t)) return false;
        if (/^afsl\s*&/i.test(t)) return false;
        return true;
      })
      .join("\n")
      // Collapse 3+ consecutive blank lines to a single blank line.
      .replace(/(\n\s*){3,}/g, "\n\n");

    // Hard cap at 300 000 chars.
    if (text.length > 300000) text = text.slice(0, 300000);

    // ── AI parsing — chunked + parallel ──────────────────────────────────────────
    // Split the statement into ~20k-char chunks (on line boundaries) and parse them
    // in parallel with minimal-reasoning gpt-4o-mini. Chunking keeps each call fast
    // and its output well under the token budget, so even a 28-page / ~580-txn
    // statement completes in well under a minute and never truncates. Each chunk
    // retries once on a transient error.
    try {
      const parseChunk = async (chunk: string): Promise<unknown[]> => {
        let lastErr: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await aiClient.chat.completions.create({
              model: "gpt-4o-mini",
              max_completion_tokens: 16384,
              // Bank-statement parsing is mechanical extraction — no reasoning needed.
              // "minimal" skips the reasoning phase, cutting latency ~5-10x.
              reasoning_effort: "minimal",
              messages: [
                {
                  role: "system",
                  content: `You are a universal bank statement parser. Extract every financial transaction from the statement text, regardless of the bank, country, language, or format.

Return ONLY a valid JSON array — no markdown, no explanation:
[{"date":"YYYY-MM-DD","description":"<clean merchant name>","amount":<positive number>,"type":"expense"}]

══ AMOUNT — always output a positive number ══
• Strip all currency symbols ($, €, £, ¥, A$, HK$, CHF, kr, zł, ₹, R, etc.) and thousand-separators
• European decimal format: "1.234,56" → 1234.56 (period = thousands, comma = decimal)
• Standard format: "1,234.56" → 1234.56 (comma = thousands, period = decimal)
• Trailing minus: "30.70-" or "30.70 -" → 30.70
• Parentheses mean negative/expense: "(30.70)" → 30.70
• Always output a plain positive float with no symbols

══ TYPE — expense or income ══
• expense = money leaving the account: purchases, withdrawals, direct debits, payments made, negative amounts, DR suffix, amounts in a Debit / Withdrawal / Out / Paid / Charged column
• income = money entering the account: deposits, salary, refunds, transfers received, credits, CR suffix, positive amounts, amounts in a Credit / Deposit / In / Received / Paid-In column
• Single-column statement: negative / DR / parenthetical → expense; positive / CR → income
• Keywords that signal income: "DIRECT CREDIT", "SALARY", "PAYMENT RECEIVED", "BPAY PAYMENT", "CREDIT TRANSFER", "REFUND", "CASHBACK", "INTEREST CREDIT"
• Keywords that signal expense: "PURCHASE", "DIRECT DEBIT", "PAYMENT", "TRANSFER OUT", "FEE", "WITHDRAWAL"
• When ambiguous, prefer "expense"

══ DATE — convert any format to YYYY-MM-DD ══
• "22 Jun 2026" / "22 JUN 26" → "2026-06-22"
• "22/06/2026" or "22.06.2026" → "2026-06-22"
• "06/22/2026" (US MM/DD/YYYY) → "2026-06-22" (if day value > 12, treat first number as day)
• "2026-06-22" → unchanged
• Infer century for 2-digit years: 00–49 → 2000s, 50–99 → 1900s

══ DESCRIPTION — clean, readable merchant name ══
• Remove location, city name, country code, postcode, terminal/store IDs, and long reference numbers
• "WOOLWORTHS 3195 ABBOTSFORD AUS" → "Woolworths"
• "ANTHROPIC* CLAUDE SUB SAN FRANCIS USA FRGN AMT: 22.00 U.S. DOLLAR" → "Anthropic Claude"
• "SQ *DAYBAKER Abbotsford AUS" → "Daybaker"
• For transfers: use payee name or meaningful reference

══ SKIP these rows entirely ══
• Opening balance, closing balance, running/available balance rows
• Standalone fee-description lines with NO dollar amount in their own amount column (e.g. "FOREIGN FEE AUD 0.94 FRGN AMT: 22.00 U.S. DOLLAR" appearing as a label without a matching amount value)
• Page headers, footers, column headings, account summary rows
• Zero-amount rows

For multi-line entries (date on one line, description on the next), merge into one transaction.
Output ONLY the JSON array — nothing else.`,
                },
                { role: "user", content: chunk },
              ],
            });
            const raw = (response.choices[0]?.message?.content ?? "").trim();
            // Empty/null content from the proxy must NOT be swallowed as "no
            // transactions" — that silently drops this chunk's rows. Treat it
            // as a transient failure and retry.
            if (!raw) {
              lastErr = new Error("AI returned empty content");
              continue;
            }
            const parsed = recoverPartialJson(raw);
            // A non-empty response that yields zero rows and is not an explicit
            // empty array ("[]") means we failed to parse it — retry rather than
            // silently drop. An explicit "[]" is a legitimate "no transactions
            // in this chunk" and is returned as-is.
            const cleaned = raw
              .replace(/```json?\n?/gi, "")
              .replace(/```/g, "")
              .trim();
            if (parsed.length === 0 && !/^\[\s*\]$/.test(cleaned)) {
              lastErr = new Error("AI response could not be parsed into transactions");
              continue;
            }
            return parsed;
          } catch (err) {
            lastErr = err;
          }
        }
        // Exhausted retries — fail loudly so the whole import errors out with a
        // clear message instead of returning a partial result missing a chunk.
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
      };

      const chunks = chunkByLines(text, 20000);
      const chunkResults = await mapWithConcurrency(chunks, 4, (chunk) =>
        parseChunk(chunk),
      );
      const aiRows = chunkResults.flat();

      if (aiRows.length === 0) {
        res
          .status(500)
          .json({
            error:
              "Could not extract any transactions from this document. It may be a scanned image or an unsupported format.",
          });
        return;
      }

      const rows: ParsedRow[] = aiRows
        .filter(
          (r: any) =>
            r?.date &&
            r?.description &&
            r?.amount != null &&
            Number(r.amount) > 0,
        )
        .map((r: any) => ({
          date: String(r.date),
          description: String(r.description).trim(),
          amount: Number(r.amount),
          type: (r.type === "income" ? "income" : "expense") as
            | "income"
            | "expense",
        }));

      res.json({ rows, total: rows.length, preview: rows.slice(0, 8) });
    } catch (err: unknown) {
      res
        .status(500)
        .json({
          error: `AI parsing failed: ${err instanceof Error ? err.message : String(err)}`,
        });
    }
  },
);

// ── Batch-save pre-parsed rows (used after AI document import) ────────────────
router.post("/transactions/import/batch", async (req, res): Promise<void> => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const { rows, accountId, trackerId } = req.body as {
    rows: ParsedRow[];
    accountId: unknown;
    trackerId?: unknown;
  };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" });
    return;
  }
  const aid = Number(accountId);
  if (!Number.isInteger(aid) || aid <= 0) {
    res.status(400).json({ error: "accountId is required" });
    return;
  }

  const [acct] = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(
      and(eq(accountsTable.id, aid), eq(accountsTable.clerkUserId, userId)),
    );
  if (!acct) {
    res.status(400).json({ error: "Account not found" });
    return;
  }

  const inserts = (rows as ParsedRow[])
    .filter((r) => r.date && r.description && r.amount > 0)
    .map((r) => ({
      accountId: aid,
      clerkUserId: userId,
      amount: r.amount,
      type: r.type,
      description: r.description,
      date: r.date,
      isRecurring: false,
    }));

  if (inserts.length === 0) {
    res.json({ imported: 0 });
    return;
  }

  await ensureMySpend(userId);
  const inserted = await db
    .insert(transactionsTable)
    .values(inserts)
    .returning({ id: transactionsTable.id });

  // Link to tracker if provided
  const tid = Number(trackerId);
  if (Number.isInteger(tid) && tid > 0 && inserted.length > 0) {
    await db
      .insert(trackerTransactionsTable)
      .values(inserted.map((t) => ({ trackerId: tid, transactionId: t.id })))
      .onConflictDoNothing();
  }

  res.status(201).json({ imported: inserted.length });
});

export default router;
