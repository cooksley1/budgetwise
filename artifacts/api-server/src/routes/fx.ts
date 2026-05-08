import { Router, type IRouter } from "express";

const router: IRouter = Router();
const FX_BASE = "https://api.frankfurter.app";

// Simple in-memory cache (1 hour)
const cache = new Map<string, { data: any; expiry: number }>();

async function cachedFetch(url: string) {
  const cached = cache.get(url);
  if (cached && Date.now() < cached.expiry) return cached.data;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, expiry: Date.now() + 60 * 60 * 1000 });
  return data;
}

// GET /api/fx/convert?from=EUR&to=GBP&amount=100
router.get("/fx/convert", async (req, res): Promise<void> => {
  const from = (req.query["from"] as string)?.toUpperCase();
  const to = (req.query["to"] as string)?.toUpperCase();
  const amount = parseFloat(req.query["amount"] as string);

  if (!from || !to || !Number.isFinite(amount)) {
    res.status(400).json({ error: "from, to, and amount are required" });
    return;
  }
  if (from === to) {
    res.json({ from, to, amount, converted: amount, rate: 1 });
    return;
  }

  try {
    const data = await cachedFetch(`${FX_BASE}/latest?from=${from}&to=${to}`);
    const rate = data.rates?.[to];
    if (!rate) throw new Error(`No rate found for ${from} → ${to}`);
    res.json({ from, to, amount, converted: amount * rate, rate });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fx/rates?base=GBP
router.get("/fx/rates", async (req, res): Promise<void> => {
  const base = (req.query["base"] as string)?.toUpperCase() || "USD";
  try {
    const data = await cachedFetch(`${FX_BASE}/latest?from=${base}`);
    res.json({ base, rates: data.rates ?? {}, date: data.date });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fx/currencies — list of supported currency codes
router.get("/fx/currencies", async (_req, res): Promise<void> => {
  try {
    const data = await cachedFetch(`${FX_BASE}/currencies`);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
