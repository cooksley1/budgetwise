import { Router, type IRouter } from "express";
import { db, accountsTable, transactionsTable, categoriesTable } from "@workspace/db";

const router: IRouter = Router();
const GC_BASE = "https://bankaccountdata.gocardless.com/api/v2";

// ── Token cache (access token lives 24 h, refresh 30 days) ────────────────
let cachedToken: { access: string; expiry: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiry) return cachedToken.access;

  const secretId = process.env["GOCARDLESS_SECRET_ID"];
  const secretKey = process.env["GOCARDLESS_SECRET_KEY"];
  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID / GOCARDLESS_SECRET_KEY not configured");
  }

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoCardless auth failed ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { access: string; access_expires: number };
  // 5-minute buffer before expiry
  cachedToken = { access: data.access, expiry: Date.now() + (data.access_expires - 300) * 1000 };
  return cachedToken.access;
}

async function gcFetch<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${GC_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoCardless ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── GET /api/gocardless/institutions?country=GB ────────────────────────────
router.get("/gocardless/institutions", async (req, res): Promise<void> => {
  const country = (req.query["country"] as string | undefined)?.toUpperCase();
  if (!country) {
    res.status(400).json({ error: "country query parameter is required" });
    return;
  }
  try {
    const data = await gcFetch<any[]>(`/institutions/?country=${country}`);
    const institutions = data.map((i: any) => ({
      id: i.id,
      name: i.name,
      logo: i.logo ?? null,
      bic: i.bic ?? null,
    }));
    res.json({ institutions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/gocardless/create-link ──────────────────────────────────────
// Body: { institutionId, redirectUri }
// Returns: { requisitionId, link }
router.post("/gocardless/create-link", async (req, res): Promise<void> => {
  const { institutionId, redirectUri } = req.body as { institutionId?: string; redirectUri?: string };
  if (!institutionId || !redirectUri) {
    res.status(400).json({ error: "institutionId and redirectUri are required" });
    return;
  }
  try {
    // 1. Create end-user agreement: 90 days of history, 30-day access window
    const agreement = await gcFetch<{ id: string }>("/agreements/enduser/", {
      method: "POST",
      body: JSON.stringify({
        institution_id: institutionId,
        max_historical_days: 90,
        access_valid_for_days: 30,
        access_scope: ["balances", "details", "transactions"],
      }),
    });

    // 2. Create requisition — the frontend will store the returned requisitionId
    //    in sessionStorage; on return from the bank we look it up there.
    const requisition = await gcFetch<{ id: string; link: string }>("/requisitions/", {
      method: "POST",
      body: JSON.stringify({
        redirect: redirectUri,
        institution_id: institutionId,
        agreement: agreement.id,
        reference: `bw-${Date.now()}`,
        user_language: "EN",
      }),
    });

    res.json({ requisitionId: requisition.id, link: requisition.link });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/gocardless/sync ─────────────────────────────────────────────
// Body: { requisitionId }
// Called after user returns from bank auth; imports accounts + transactions.
router.post("/gocardless/sync", async (req, res): Promise<void> => {
  const { requisitionId } = req.body as { requisitionId?: string };
  if (!requisitionId) {
    res.status(400).json({ error: "requisitionId is required" });
    return;
  }
  try {
    const requisition = await gcFetch<{ status: string; accounts: string[] }>(
      `/requisitions/${requisitionId}/`
    );

    // "LN" = Linked (accounts available). Could also be "GA" = Granted.
    if (!["LN", "GA"].includes(requisition.status)) {
      res.status(400).json({
        error: `Requisition not ready yet (status: ${requisition.status}). Please try again.`,
      });
      return;
    }

    const categories = await db.select().from(categoriesTable);
    let accountsImported = 0;
    let transactionsImported = 0;

    for (const accountId of requisition.accounts ?? []) {
      let details: any = {};
      let balances: any = {};
      let transactions: any = { booked: [] };

      try {
        details = await gcFetch(`/accounts/${accountId}/details/`);
      } catch {}
      try {
        balances = await gcFetch(`/accounts/${accountId}/balances/`);
      } catch {}
      try {
        transactions = await gcFetch(`/accounts/${accountId}/transactions/`);
      } catch {}

      const acct = (details as any).account ?? {};
      const balanceEntry =
        (balances as any).balances?.find((b: any) => b.balanceType === "closingBooked") ??
        (balances as any).balances?.[0];
      const balance = parseFloat(balanceEntry?.balanceAmount?.amount ?? "0") || 0;

      const typeMap: Record<string, string> = {
        CACC: "checking",
        SVGS: "savings",
        CARD: "credit",
        LOAN: "checking",
        LLSV: "savings",
        OTHR: "checking",
      };
      const acctType = typeMap[acct.cashAccountType] ?? "checking";

      const [inserted] = await db
        .insert(accountsTable)
        .values({
          name: acct.name ?? acct.iban ?? `Linked account ${accountsImported + 1}`,
          type: acctType,
          balance,
          currency: acct.currency ?? "GBP",
          color: "#3b82f6",
        })
        .returning();
      accountsImported++;

      const booked: any[] = (transactions as any).transactions?.booked ?? [];
      for (const txn of booked) {
        const amount = parseFloat(txn.transactionAmount?.amount ?? "0");
        const desc =
          txn.remittanceInformationUnstructured ??
          txn.creditorName ??
          txn.debtorName ??
          "Bank transaction";

        const catHint = txn.proprietaryBankTransactionCode ?? txn.creditorName ?? "";
        const matchedCat = categories.find(
          (c) =>
            catHint.toLowerCase().includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(catHint.toLowerCase())
        );

        await db.insert(transactionsTable).values({
          accountId: inserted.id,
          categoryId: matchedCat?.id ?? null,
          amount: Math.abs(amount),
          type: amount < 0 ? "expense" : "income",
          description: desc,
          date: txn.bookingDate ?? new Date().toISOString().split("T")[0],
          isRecurring: false,
        });
        transactionsImported++;
      }
    }

    res.json({ accountsImported, transactionsImported });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
