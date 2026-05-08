import { Router, type IRouter } from "express";
import multer from "multer";
import OpenAI from "openai";
import { eq, and, gte, lte, inArray, isNotNull, sql, desc } from "drizzle-orm";
import {
  db,
  trackersTable,
  trackerTransactionsTable,
  transactionsTable,
  accountsTable,
  categoriesTable,
} from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
});

const objectStorage = new ObjectStorageService();

// ──────────────────────────────────────────────────────────────────────────
// AI receipt scan (rich) — extracts vendor, address, items, currency, etc
// ──────────────────────────────────────────────────────────────────────────
router.post("/ai/scan-receipt-rich", upload.single("receipt"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "receipt image required" }); return; }
  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this receipt image. Respond with ONLY a JSON object (no markdown):
{
  "merchant": "<vendor / restaurant / shop name>",
  "address": "<full address as printed, or null>",
  "city": "<city if visible, or null>",
  "country": "<country if visible, or null>",
  "amount": <total amount as number>,
  "currency": "<3-letter ISO code from the receipt: EUR, GBP, USD, JPY etc.>",
  "tipAmount": <tip if listed, or null>,
  "date": "<YYYY-MM-DD or null>",
  "time": "<HH:MM in 24h or null>",
  "items": [{"name":"<item>","qty":<n>,"price":<unit price as number>}],
  "category": "<best guess: Food, Groceries, Transport, Activities, Shopping, Lodging, Drinks, Other>",
  "confidence": <0-1>
}`,
            },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch (err: any) {
    req.log.error({ err }, "scan-receipt-rich failed");
    res.status(500).json({ error: "Failed to parse receipt" });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Geocoding — Nominatim proxy (free, no API key, must include user-agent)
// ──────────────────────────────────────────────────────────────────────────
const geocodeCache = new Map<string, { ts: number; result: any }>();
const GEOCODE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

router.get("/geocode", async (req, res): Promise<void> => {
  const q = String(req.query["q"] ?? "").trim();
  if (!q) { res.status(400).json({ error: "q required" }); return; }
  const key = q.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.ts < GEOCODE_TTL) { res.json(cached.result); return; }
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
      { headers: { "User-Agent": "BudgetWise/1.0 (personal-finance app)" } },
    );
    if (!r.ok) { res.status(502).json({ error: "geocoder unavailable" }); return; }
    const data = (await r.json()) as any[];
    const result = data.slice(0, 5).map((d) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      display: d.display_name,
      city: d.address?.city || d.address?.town || d.address?.village,
      country: d.address?.country,
    }));
    geocodeCache.set(key, { ts: Date.now(), result });
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "geocode failed");
    res.status(500).json({ error: "geocode failed" });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Weather — open-meteo (free, no key) historical archive
// ──────────────────────────────────────────────────────────────────────────
const weatherCache = new Map<string, { ts: number; result: any }>();
const WEATHER_TTL = 7 * 24 * 60 * 60 * 1000;

router.get("/weather", async (req, res): Promise<void> => {
  const lat = Number(req.query["lat"]);
  const lng = Number(req.query["lng"]);
  const date = String(req.query["date"] ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "lat, lng, date (YYYY-MM-DD) required" });
    return;
  }
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${date}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.ts < WEATHER_TTL) { res.json(cached.result); return; }
  try {
    const r = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum`,
    );
    if (!r.ok) { res.status(502).json({ error: "weather unavailable" }); return; }
    const data = (await r.json()) as any;
    const d = data?.daily;
    if (d?.temperature_2m_max?.[0] == null) { res.json(null); return; }
    const code: number = d.weather_code[0];
    const result = {
      tempMax: d.temperature_2m_max[0],
      tempMin: d.temperature_2m_min[0],
      precip: d.precipitation_sum[0],
      code,
      icon: weatherIcon(code),
      label: weatherLabel(code),
    };
    weatherCache.set(key, { ts: Date.now(), result });
    res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "weather failed");
    res.status(500).json({ error: "weather failed" });
  }
});

function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}
function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

// ──────────────────────────────────────────────────────────────────────────
// Quick-add holiday transaction (rich) + tag to tracker in one call
// ──────────────────────────────────────────────────────────────────────────
router.post("/trackers/:id/quick-add", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const [tracker] = await db.select().from(trackersTable).where(eq(trackersTable.id, id));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }

  const b = req.body ?? {};
  // Validation
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount) || b.amount <= 0 || b.amount > 1_000_000) {
    res.status(400).json({ error: "amount must be a positive number <= 1,000,000" }); return;
  }
  if (!Number.isInteger(b.accountId)) { res.status(400).json({ error: "accountId (integer) required" }); return; }
  if (b.categoryId != null && !Number.isInteger(b.categoryId)) { res.status(400).json({ error: "categoryId must be integer" }); return; }
  const date = b.date || tracker.startDate || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: "date must be YYYY-MM-DD" }); return; }
  if (b.vendorLat != null && (typeof b.vendorLat !== "number" || !Number.isFinite(b.vendorLat) || b.vendorLat < -90 || b.vendorLat > 90)) {
    res.status(400).json({ error: "vendorLat out of range" }); return;
  }
  if (b.vendorLng != null && (typeof b.vendorLng !== "number" || !Number.isFinite(b.vendorLng) || b.vendorLng < -180 || b.vendorLng > 180)) {
    res.status(400).json({ error: "vendorLng out of range" }); return;
  }
  if (b.originalCurrency != null && !/^[A-Z]{3}$/.test(String(b.originalCurrency))) {
    res.status(400).json({ error: "originalCurrency must be 3-letter ISO code" }); return;
  }
  if (b.occurredAt != null && Number.isNaN(new Date(b.occurredAt).getTime())) {
    res.status(400).json({ error: "occurredAt invalid" }); return;
  }
  if (b.items != null) {
    if (!Array.isArray(b.items)) { res.status(400).json({ error: "items must be array" }); return; }
    for (const it of b.items) {
      if (!it || typeof it !== "object" || typeof it.name !== "string") {
        res.status(400).json({ error: "each item needs a name string" }); return;
      }
    }
  }
  if (b.companions != null && (!Array.isArray(b.companions) || b.companions.some((c: any) => typeof c !== "string"))) {
    res.status(400).json({ error: "companions must be string[]" }); return;
  }
  // Verify FK existence (account is required, category optional)
  const [acct] = await db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.id, b.accountId));
  if (!acct) { res.status(400).json({ error: "accountId not found" }); return; }
  if (b.categoryId != null) {
    const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, b.categoryId));
    if (!cat) { res.status(400).json({ error: "categoryId not found" }); return; }
  }

  // Build optional weather snapshot if lat/lng provided
  let weather: any = null;
  if (typeof b.vendorLat === "number" && typeof b.vendorLng === "number") {
    try {
      const wr = await fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${b.vendorLat}&longitude=${b.vendorLng}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,weather_code`,
      );
      if (wr.ok) {
        const d = (await wr.json()) as any;
        const code = d?.daily?.weather_code?.[0];
        const tmax = d?.daily?.temperature_2m_max?.[0];
        if (code !== undefined && tmax !== undefined) {
          weather = { temp: tmax, code, icon: weatherIcon(code), label: weatherLabel(code) };
        }
      }
    } catch { /* non-fatal */ }
  }

  const occurredAt = b.occurredAt ? new Date(b.occurredAt) : null;

  const [txn] = await db
    .insert(transactionsTable)
    .values({
      accountId: b.accountId,
      categoryId: b.categoryId ?? null,
      amount: b.amount,
      type: b.type || "expense",
      description: b.description ?? null,
      date,
      isRecurring: false,
      originalAmount: typeof b.originalAmount === "number" ? b.originalAmount : null,
      originalCurrency: b.originalCurrency ?? null,
      fxRate: typeof b.fxRate === "number" ? b.fxRate : null,
      merchant: b.merchant ?? null,
      location: b.location ?? null,
      vendorAddress: b.vendorAddress ?? null,
      vendorLat: typeof b.vendorLat === "number" ? b.vendorLat : null,
      vendorLng: typeof b.vendorLng === "number" ? b.vendorLng : null,
      items: Array.isArray(b.items) ? b.items : null,
      photoUrl: b.photoUrl ?? null,
      mood: b.mood ?? null,
      companions: Array.isArray(b.companions) && b.companions.length > 0 ? b.companions : null,
      occurredAt,
      tipAmount: typeof b.tipAmount === "number" ? b.tipAmount : null,
      weather,
    })
    .returning();

  await db.insert(trackerTransactionsTable).values({ trackerId: id, transactionId: txn.id }).onConflictDoNothing();

  res.status(201).json(txn);
});

// ──────────────────────────────────────────────────────────────────────────
// Update a tracked transaction (rich fields) — for editing memory metadata
// ──────────────────────────────────────────────────────────────────────────
router.patch("/transactions/:id/memory", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const b = req.body ?? {};
  // Per-field validation
  if (b.vendorLat != null && (typeof b.vendorLat !== "number" || !Number.isFinite(b.vendorLat) || b.vendorLat < -90 || b.vendorLat > 90)) {
    res.status(400).json({ error: "vendorLat out of range" }); return;
  }
  if (b.vendorLng != null && (typeof b.vendorLng !== "number" || !Number.isFinite(b.vendorLng) || b.vendorLng < -180 || b.vendorLng > 180)) {
    res.status(400).json({ error: "vendorLng out of range" }); return;
  }
  if (b.originalCurrency != null && !/^[A-Z]{3}$/.test(String(b.originalCurrency))) {
    res.status(400).json({ error: "originalCurrency must be 3-letter ISO code" }); return;
  }
  if (b.items != null && (!Array.isArray(b.items) || b.items.some((it: any) => !it || typeof it.name !== "string"))) {
    res.status(400).json({ error: "items must be array of {name}" }); return;
  }
  if (b.companions != null && (!Array.isArray(b.companions) || b.companions.some((c: any) => typeof c !== "string"))) {
    res.status(400).json({ error: "companions must be string[]" }); return;
  }
  const set: any = { updatedAt: new Date() };
  for (const k of ["merchant", "vendorAddress", "vendorLat", "vendorLng", "items", "photoUrl", "mood", "companions", "tipAmount", "occurredAt", "originalAmount", "originalCurrency", "fxRate", "description"] as const) {
    if (b[k] !== undefined) set[k] = b[k];
  }
  if (set.occurredAt && typeof set.occurredAt === "string") {
    const d = new Date(set.occurredAt);
    if (Number.isNaN(d.getTime())) { res.status(400).json({ error: "occurredAt invalid" }); return; }
    set.occurredAt = d;
  }
  const [updated] = await db.update(transactionsTable).set(set).where(eq(transactionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Transaction not found" }); return; }
  res.json(updated);
});

// ──────────────────────────────────────────────────────────────────────────
// Holiday/trip insights — surprise-and-delight bundle
// ──────────────────────────────────────────────────────────────────────────
router.get("/trackers/:id/insights", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (Number.isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [tracker] = await db.select().from(trackersTable).where(eq(trackersTable.id, id));
  if (!tracker) { res.status(404).json({ error: "Tracker not found" }); return; }

  // All txns tagged to tracker
  const txns = await db
    .select({
      id: transactionsTable.id,
      amount: transactionsTable.amount,
      date: transactionsTable.date,
      occurredAt: transactionsTable.occurredAt,
      type: transactionsTable.type,
      description: transactionsTable.description,
      merchant: transactionsTable.merchant,
      categoryName: categoriesTable.name,
      categoryColor: categoriesTable.color,
      originalAmount: transactionsTable.originalAmount,
      originalCurrency: transactionsTable.originalCurrency,
      tipAmount: transactionsTable.tipAmount,
      vendorLat: transactionsTable.vendorLat,
      vendorLng: transactionsTable.vendorLng,
      vendorAddress: transactionsTable.vendorAddress,
      items: transactionsTable.items,
      mood: transactionsTable.mood,
      companions: transactionsTable.companions,
      photoUrl: transactionsTable.photoUrl,
      weather: transactionsTable.weather,
    })
    .from(trackerTransactionsTable)
    .innerJoin(transactionsTable, eq(trackerTransactionsTable.transactionId, transactionsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(eq(trackerTransactionsTable.trackerId, id));

  const expenses = txns.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  // Time-of-day pattern (only on rows with occurredAt)
  const byHour = new Map<number, { count: number; total: number }>();
  for (const t of expenses) {
    if (!t.occurredAt) continue;
    const h = new Date(t.occurredAt).getHours();
    const e = byHour.get(h) ?? { count: 0, total: 0 };
    byHour.set(h, { count: e.count + 1, total: e.total + t.amount });
  }
  const peakHour = [...byHour.entries()].sort((a, b) => b[1].total - a[1].total)[0];

  // Top vendor + cheapest gem
  const byMerchant = new Map<string, { count: number; total: number; min: number; max: number }>();
  for (const t of expenses) {
    const key = (t.merchant || t.description || "").trim();
    if (!key) continue;
    const e = byMerchant.get(key) ?? { count: 0, total: 0, min: Infinity, max: 0 };
    byMerchant.set(key, { count: e.count + 1, total: e.total + t.amount, min: Math.min(e.min, t.amount), max: Math.max(e.max, t.amount) });
  }
  const topVendor = [...byMerchant.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  const visited = [...byMerchant.entries()].filter(([, v]) => v.count >= 2).sort((a, b) => b[1].count - a[1].count)[0];
  const cheapest = expenses.length ? expenses.reduce((m, t) => (t.amount > 0 && t.amount < m.amount ? t : m)) : null;
  const splurge = expenses.length ? expenses.reduce((m, t) => (t.amount > m.amount ? t : m)) : null;

  // DCC fee detector — paid in home currency despite trip foreign currency
  let dccLeak = 0;
  if (tracker.foreignCurrency && tracker.foreignCurrency !== tracker.homeCurrency) {
    for (const t of expenses) {
      if (t.originalCurrency && t.originalCurrency !== tracker.foreignCurrency && t.originalCurrency === tracker.homeCurrency) {
        dccLeak += t.amount * 0.03; // typical DCC markup ~3%
      }
    }
  }

  // Tip pattern
  const withTips = expenses.filter((t) => typeof t.tipAmount === "number" && t.tipAmount > 0);
  const tipAvgPct = withTips.length
    ? withTips.reduce((s, t) => s + (t.tipAmount! / Math.max(0.01, t.amount - t.tipAmount!)) * 100, 0) / withTips.length
    : null;

  // Daily velocity vs budget
  let velocity = null as null | { spentPerDay: number; projectedTotal: number; budgetTotal: number; daysElapsed: number; daysTotal: number };
  if (tracker.startDate && tracker.endDate && tracker.dailyBudget) {
    const start = new Date(tracker.startDate).getTime();
    const end = new Date(tracker.endDate).getTime();
    const now = Date.now();
    const daysTotal = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const daysElapsed = Math.max(1, Math.min(daysTotal, Math.round((Math.min(now, end) - start) / 86400000) + 1));
    const spentPerDay = total / daysElapsed;
    velocity = { spentPerDay, projectedTotal: spentPerDay * daysTotal, budgetTotal: tracker.dailyBudget * daysTotal, daysElapsed, daysTotal };
  }

  // Map points
  const mapPoints = expenses
    .filter((t) => typeof t.vendorLat === "number" && typeof t.vendorLng === "number")
    .map((t) => ({
      id: t.id,
      lat: t.vendorLat as number,
      lng: t.vendorLng as number,
      title: t.merchant || t.description || "Place",
      address: t.vendorAddress,
      amount: t.amount,
      currency: tracker.homeCurrency,
      originalAmount: t.originalAmount,
      originalCurrency: t.originalCurrency,
      date: t.date,
      occurredAt: t.occurredAt,
      categoryName: t.categoryName,
      categoryColor: t.categoryColor,
      photoUrl: t.photoUrl,
      mood: t.mood,
      items: t.items,
      companions: t.companions,
      weather: t.weather,
    }));

  // Days grouped (story tab) — sorted desc
  const byDay = new Map<string, any[]>();
  for (const t of expenses) {
    const arr = byDay.get(t.date) ?? [];
    arr.push(t);
    byDay.set(t.date, arr);
  }
  const story = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({
      date,
      total: items.reduce((s, t) => s + t.amount, 0),
      count: items.length,
      weather: items.find((i) => i.weather)?.weather ?? null,
      items: items.sort((a, b) => {
        const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
        const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
        return tb - ta;
      }),
    }));

  // Achievements / badges
  const badges: { emoji: string; title: string; sub: string }[] = [];
  if (mapPoints.length >= 5) badges.push({ emoji: "🗺️", title: "Explorer", sub: `Visited ${mapPoints.length} places` });
  if ((byMerchant.size ?? 0) >= 10) badges.push({ emoji: "🌟", title: "Variety Seeker", sub: `${byMerchant.size} unique vendors` });
  const foodCount = expenses.filter((t) => /food|restaurant|drinks|cafe|coffee|bar/i.test((t.categoryName || "") + " " + (t.merchant || ""))).length;
  if (foodCount >= 5) badges.push({ emoji: "🍽️", title: "Foodie", sub: `${foodCount} food/drink stops` });
  if (velocity && velocity.spentPerDay < (tracker.dailyBudget ?? Infinity)) badges.push({ emoji: "💚", title: "Budget Hero", sub: "Under daily budget so far" });
  if (visited) badges.push({ emoji: "🔁", title: "Regular", sub: `${visited[0]} × ${visited[1].count}` });
  if (withTips.length >= 3 && tipAvgPct !== null) badges.push({ emoji: "🙌", title: "Generous", sub: `~${tipAvgPct.toFixed(0)}% avg tip` });

  res.json({
    total,
    transactionCount: expenses.length,
    peakHour: peakHour ? { hour: peakHour[0], total: peakHour[1].total, count: peakHour[1].count } : null,
    topVendor: topVendor ? { name: topVendor[0], total: topVendor[1].total, visits: topVendor[1].count } : null,
    cheapest: cheapest ? { name: cheapest.merchant || cheapest.description, amount: cheapest.amount, date: cheapest.date } : null,
    splurge: splurge ? { name: splurge.merchant || splurge.description, amount: splurge.amount, date: splurge.date } : null,
    mostVisited: visited ? { name: visited[0], visits: visited[1].count, total: visited[1].total } : null,
    dccLeak: dccLeak > 0 ? dccLeak : null,
    tipAvgPct,
    velocity,
    mapPoints,
    story,
    badges,
    uniqueVendors: byMerchant.size,
  });
});

export default router;
