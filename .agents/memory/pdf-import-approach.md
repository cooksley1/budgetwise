---
name: PDF import approach
description: How PDF text extraction works in the document import pipeline; the correct production-safe approach.
---

# PDF import — pdfjs-dist (pure JS, no system binary)

**Rule:** Use `pdfjs-dist` (legacy build) for PDF text extraction. Do NOT use system `pdftotext`/poppler — it only exists in the Nix dev shell, not in Replit autoscale production containers. Do NOT use `pdf-parse` v2 (class-based API, very different from v1, harder to use correctly).

**Why:** `pdftotext` was tried first but Replit autoscale containers don't include Nix packages from `replit.nix`. The `replit.nix` file only affects the local dev shell. Every time pdftotext was "fixed" for dev, production still failed with `spawn pdftotext ENOENT`. `pdfjs-dist` is pure JS, bundles with esbuild cleanly, and has no system binary dependency — it works identically in dev and production.

**How to apply:**
```ts
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const uint8 = new Uint8Array(buffer);
  const doc = await getDocument({ data: uint8, useWorkerFetch: false, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }
  return pages.join("\n");
}
```

**Canvas is NOT needed for text extraction.** pdfjs-dist v5 has `@napi-rs/canvas` as an optional dep only for rendering (image output). Text extraction via `getTextContent()` works without canvas — confirmed in production.

**esbuild note:** `canvas` is already in the `external` list in `build.mjs`. pdfjs-dist bundles cleanly as ESM with `bundle: true`. Use `pdfjs-dist/legacy/build/pdf.mjs` subpath import (not the root `pdfjs-dist` which resolves to the browser build).

**gpt-5-mini latency: set `reasoning_effort: "minimal"`.** This is THE fix for the import timing out in production. gpt-5-mini is a reasoning model; with default effort a 215-txn statement took >115s (killed by autoscale request timeout) and large statements returned null content because reasoning tokens ate the whole `max_completion_tokens` budget. With `reasoning_effort: "minimal"` the same statement parses in ~53s with full output. Statement parsing is mechanical — no reasoning value, only latency cost.

**Parallel chunked parsing (current approach):** Split the preprocessed text into ~20k-char chunks on line boundaries (NO overlap) and parse them in parallel with bounded concurrency (4). No overlap means each line lands in exactly one chunk, so chunking never duplicates rows AND preserves genuinely-repeated transactions (e.g. two identical same-day charges) — do NOT dedupe by date+amount+description, you would delete real duplicates. Each chunk uses `max_completion_tokens: 16384` and `recoverPartialJson` (salvages complete objects before a truncation by finding the last `},` and re-closing the array). Chunking solves BOTH latency (parallelism) and truncation (≤~110 txns/chunk stays well under the output budget).

**Guard against silent chunk loss (critical).** The Replit AI proxy can return empty/null content, which `recoverPartialJson` would swallow as `[]` — silently dropping a whole chunk's transactions while the import "succeeds". So in each chunk: if `raw` is empty → retry; if non-empty but parses to 0 rows AND is not an explicit `[]` → retry; after the retry budget, THROW so the whole import fails loudly with an error instead of returning a partial result. An explicit `[]` is a legitimate "no transactions in this chunk".

**Known minor tradeoff:** a multi-line transaction split across a chunk boundary can drop ~1 record per boundary; observed counts match expected totals so it's negligible. Column headers (Debits/Credits) only appear atop the statement, so later chunks classify income/expense from position+keywords alone — accuracy ~97% on NAB (ground truth 27 income/189 expense vs AI ~28/187), acceptable since users can edit rows.

**Text preprocessing before AI call:** Strip boilerplate lines (copyright, ABN, "Page N of M", "Date created") and collapse runs of 3+ blank lines before sending to AI. Cuts Westpac-style 28-page statements by ~10–15%, helping the AI focus on transaction rows.

**Timing (with parallel chunking + minimal reasoning + pdfjs-dist):** 28-page / ~615-txn Westpac PDF ≈ 57s; 6-page / 215-txn NAB ≈ 30s. Both finish well under the autoscale request timeout. UI loading message says "usually under a minute".

**xlsx support:** The `xlsx` (SheetJS) npm package is installed and bundled normally — no issues. Use `XLSX.read(buffer, { type: "buffer" })` + `XLSX.utils.sheet_to_csv(sheet)` to convert Wise XLSX exports to CSV text for AI parsing.
