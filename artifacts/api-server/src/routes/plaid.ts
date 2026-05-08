import { Router, type IRouter } from "express";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import { db, accountsTable, transactionsTable, categoriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env["PLAID_CLIENT_ID"] ?? "",
      "PLAID-SECRET": process.env["PLAID_SECRET"] ?? "",
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Create link token so the frontend can open Plaid Link
router.post("/plaid/link-token", async (req, res): Promise<void> => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "wayfare-user" },
      client_name: "Wayfare",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ link_token: response.data.link_token });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create link token" });
  }
});

// Exchange public token for access token and sync accounts + transactions
router.post("/plaid/exchange-token", async (req, res): Promise<void> => {
  const { public_token } = req.body;
  if (!public_token) {
    res.status(400).json({ error: "public_token is required" });
    return;
  }

  try {
    // Exchange
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const accessToken = exchangeRes.data.access_token;

    // Fetch accounts
    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });
    const plaidAccounts = accountsRes.data.accounts;

    const createdAccounts: { plaidId: string; dbId: number }[] = [];

    for (const pa of plaidAccounts) {
      const typeMap: Record<string, string> = {
        depository: pa.subtype === "savings" ? "savings" : "checking",
        credit: "credit",
        investment: "investment",
        loan: "checking",
        other: "checking",
      };
      const [inserted] = await db
        .insert(accountsTable)
        .values({
          name: `${pa.name} (Plaid)`,
          type: typeMap[pa.type] ?? "checking",
          balance: pa.balances.current ?? 0,
          currency: pa.balances.iso_currency_code ?? "USD",
          color: "#3b82f6",
        })
        .returning();
      createdAccounts.push({ plaidId: pa.account_id, dbId: inserted.id });
    }

    // Fetch last 30 days of transactions
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const txnRes = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });

    const categories = await db.select().from(categoriesTable);

    let imported = 0;
    for (const pt of txnRes.data.transactions) {
      const account = createdAccounts.find((a) => a.plaidId === pt.account_id);
      if (!account) continue;

      // Simple category matching
      const catName = pt.personal_finance_category?.primary ?? pt.category?.[0] ?? "";
      const matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes(catName.toLowerCase()) ||
          catName.toLowerCase().includes(c.name.toLowerCase())
      );

      await db.insert(transactionsTable).values({
        accountId: account.dbId,
        categoryId: matchedCat?.id ?? null,
        amount: Math.abs(pt.amount),
        type: pt.amount < 0 ? "income" : "expense",
        description: pt.name,
        date: pt.date,
        isRecurring: false,
      });
      imported++;
    }

    res.json({
      accountsImported: createdAccounts.length,
      transactionsImported: imported,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to exchange token" });
  }
});

export default router;
