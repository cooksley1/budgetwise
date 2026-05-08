import { Router, type IRouter } from "express";
import multer from "multer";
import OpenAI from "openai";
import { db, categoriesTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
});

// ── Auto-classify a transaction description into a category ────────────────
router.post("/ai/classify", async (req, res): Promise<void> => {
  const { description, amount, type } = req.body;
  if (!description) {
    res.status(400).json({ error: "description is required" });
    return;
  }

  const categories = await db.select().from(categoriesTable);
  const catList = categories.map((c) => `${c.id}: ${c.name} (${c.type})`).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 256,
    messages: [
      {
        role: "system",
        content: `You are a financial transaction classifier. Given a transaction description, classify it into the best matching category from the list below. Respond with ONLY a JSON object: {"categoryId": <number>, "categoryName": "<name>", "confidence": <0-1>}.

Categories:
${catList}`,
      },
      {
        role: "user",
        content: `Description: "${description}"\nAmount: $${amount ?? "?"}\nType: ${type ?? "expense"}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch {
    res.status(500).json({ error: "Failed to parse classification", raw });
  }
});

// ── Classify multiple transactions in batch ────────────────────────────────
router.post("/ai/classify-batch", async (req, res): Promise<void> => {
  const { transactions } = req.body;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: "transactions array is required" });
    return;
  }

  const categories = await db.select().from(categoriesTable);
  const catList = categories.map((c) => `${c.id}: ${c.name} (${c.type})`).join("\n");

  const results: any[] = [];

  for (const txn of transactions.slice(0, 20)) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 128,
        messages: [
          {
            role: "system",
            content: `Classify into the best category. Respond ONLY with JSON: {"categoryId":<number>,"categoryName":"<name>","confidence":<0-1>}.\n\nCategories:\n${catList}`,
          },
          { role: "user", content: `"${txn.description}" — $${txn.amount}` },
        ],
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      results.push({ id: txn.id, ...JSON.parse(raw) });
    } catch {
      results.push({ id: txn.id, categoryId: null, confidence: 0 });
    }
  }

  res.json({ results });
});

// ── OCR a receipt photo → extract transaction data ─────────────────────────
router.post("/ai/ocr-receipt", upload.single("receipt"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "receipt image is required" });
    return;
  }

  const base64 = req.file.buffer.toString("base64");
  const mimeType = req.file.mimetype || "image/jpeg";

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this receipt image and extract the transaction details. Respond with ONLY a JSON object (no markdown):
{
  "merchant": "<store/restaurant name>",
  "amount": <total amount as number>,
  "date": "<YYYY-MM-DD or null if unclear>",
  "items": ["<item 1>", "<item 2>"],
  "category": "<best category guess: Food, Groceries, Transport, Healthcare, Entertainment, Shopping, Utilities, or Other>",
  "type": "expense",
  "confidence": <0-1>
}`,
          },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    res.json(parsed);
  } catch {
    res.status(500).json({ error: "Failed to parse receipt", raw });
  }
});

// ── AI financial insights ──────────────────────────────────────────────────
router.post("/ai/insights", async (req, res): Promise<void> => {
  const { summary, topCategories, cashFlow } = req.body;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 600,
    messages: [
      {
        role: "system",
        content: "You are a friendly, concise personal finance advisor. Give 3-4 short, actionable insights based on the user's financial data. Be specific and encouraging. Format as a JSON array of insight objects: [{\"title\":\"<short title>\",\"body\":\"<1-2 sentence insight>\",\"type\":\"tip|warning|positive\"}]",
      },
      {
        role: "user",
        content: JSON.stringify({ summary, topCategories, cashFlow }),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "[]";
  try {
    const clean = raw.replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    res.json({ insights: JSON.parse(clean) });
  } catch {
    res.status(500).json({ error: "Failed to parse insights", raw });
  }
});

export default router;
