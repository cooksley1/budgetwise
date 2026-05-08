import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link2, CheckCircle, AlertCircle, Loader2, Building2, RefreshCw, Camera, Sparkles, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAccountsQueryKey, getListTransactionsQueryKey, useGetDashboardSummary, useGetSpendingByCategory } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Plaid Link ────────────────────────────────────────────────────────────
function usePlaidLink(onSuccess: (accountsImported: number, txnImported: number) => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ltRes = await fetch(`${BASE}/api/plaid/link-token`, { method: "POST" });
      const { link_token, error: ltErr } = await ltRes.json();
      if (ltErr) throw new Error(ltErr);

      // Load Plaid Link script dynamically
      if (!document.getElementById("plaid-script")) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.id = "plaid-script";
          s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Plaid script"));
          document.body.appendChild(s);
        });
      }

      const handler = (window as any).Plaid.create({
        token: link_token,
        onSuccess: async (public_token: string) => {
          const exRes = await fetch(`${BASE}/api/plaid/exchange-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token }),
          });
          const data = await exRes.json();
          if (data.error) throw new Error(data.error);
          onSuccess(data.accountsImported, data.transactionsImported);
          setLoading(false);
        },
        onExit: () => setLoading(false),
      });
      handler.open();
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }, [onSuccess]);

  return { openLink, loading, error };
}

// ── OCR Receipt ───────────────────────────────────────────────────────────
interface OcrResult {
  merchant?: string;
  amount?: number;
  date?: string;
  items?: string[];
  category?: string;
  type?: string;
  confidence?: number;
}

function ReceiptOcr() {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const qc = useQueryClient();

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const form = new FormData();
    form.append("receipt", file);

    try {
      const res = await fetch(`${BASE}/api/ai/ocr-receipt`, { method: "POST", body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) processFile(file);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSave = async () => {
    if (!result?.amount) return;
    await fetch(`${BASE}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: 1,
        amount: result.amount,
        type: result.type ?? "expense",
        description: result.merchant ?? "Receipt scan",
        date: result.date ?? new Date().toISOString().split("T")[0],
      }),
    });
    qc.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 50, offset: 0 }) });
    setResult(null);
    setPreview(null);
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
          <Camera size={18} className="text-violet-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Scan a Receipt</h3>
          <p className="text-xs text-muted-foreground">Upload a photo — AI extracts the details</p>
        </div>
      </div>

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
        }`}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        {loading ? (
          <><Loader2 size={28} className="animate-spin text-primary" /><p className="text-sm text-muted-foreground">Analysing receipt…</p></>
        ) : preview ? (
          <img src={preview} alt="Receipt" className="max-h-40 rounded-lg object-contain" />
        ) : (
          <><Camera size={28} className="text-muted-foreground" /><p className="text-sm text-muted-foreground">Drop an image or click to upload</p></>
        )}
      </label>

      {error && <p className="text-sm text-red-500 flex items-center gap-2"><AlertCircle size={14} />{error}</p>}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{result.merchant ?? "Unknown merchant"}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                {((result.confidence ?? 0) * 100).toFixed(0)}% confidence
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground mb-0.5">Amount</p><p className="font-semibold">${result.amount?.toFixed(2) ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Date</p><p className="font-semibold">{result.date ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Category</p><p className="font-semibold">{result.category ?? "—"}</p></div>
            </div>
            {result.items && result.items.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Items</p>
                <ul className="text-sm space-y-0.5">{result.items.slice(0, 5).map((item, i) => <li key={i} className="text-muted-foreground">• {item}</li>)}</ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Save as Transaction
              </button>
              <button onClick={() => { setResult(null); setPreview(null); }} className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm transition-colors">
                Discard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AI Insights ───────────────────────────────────────────────────────────
function AiInsights() {
  const { data: summary } = useGetDashboardSummary();
  const { data: byCategory } = useGetSpendingByCategory({});
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const TYPE_STYLES: Record<string, string> = {
    positive: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    tip: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/ai/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, topCategories: byCategory?.slice(0, 5) }),
      });
      const data = await res.json();
      setInsights(data.insights ?? []);
      setFetched(true);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <Sparkles size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">AI Insights</h3>
            <p className="text-xs text-muted-foreground">Personalised tips based on your data</p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {fetched ? "Refresh" : "Generate"}
        </button>
      </div>

      {!fetched && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles size={32} strokeWidth={1.5} className="mx-auto mb-2" />
          <p className="text-sm">Click "Generate" to get personalised financial insights</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Analysing your finances…</span>
        </div>
      )}

      <div className="space-y-3">
        {insights.map((ins, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`p-3 rounded-lg border text-sm ${TYPE_STYLES[ins.type] ?? TYPE_STYLES.tip}`}
          >
            <p className="font-semibold mb-0.5">{ins.title}</p>
            <p className="opacity-80">{ins.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function BankLink() {
  const qc = useQueryClient();
  const [linkResult, setLinkResult] = useState<{ accounts: number; txns: number } | null>(null);
  const [classifyDesc, setClassifyDesc] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [classResult, setClassResult] = useState<any | null>(null);

  const { openLink, loading: linkLoading, error: linkError } = usePlaidLink((accounts, txns) => {
    setLinkResult({ accounts, txns });
    qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    qc.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 50, offset: 0 }) });
  });

  const classify = async () => {
    if (!classifyDesc.trim()) return;
    setClassifying(true);
    setClassResult(null);
    try {
      const res = await fetch(`${BASE}/api/ai/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: classifyDesc, type: "expense" }),
      });
      setClassResult(await res.json());
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Smart Features</h1>
        <p className="text-muted-foreground text-sm mt-1">Bank linking, AI classification, receipt scanning & insights</p>
      </div>

      {/* Bank Link */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Link a Bank Account</h3>
            <p className="text-xs text-muted-foreground">Securely connect via Plaid — imports accounts & 30 days of transactions</p>
          </div>
        </div>

        <AnimatePresence>
          {linkResult && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle size={16} />
              <span>Imported <strong>{linkResult.accounts}</strong> account{linkResult.accounts !== 1 ? "s" : ""} and <strong>{linkResult.txns}</strong> transactions</span>
            </motion.div>
          )}
          {linkError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle size={16} /><span>{linkError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={openLink}
          disabled={linkLoading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {linkLoading ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
          {linkLoading ? "Connecting…" : "Connect Bank Account"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          Using Plaid sandbox — connect with test credentials (username: <code className="font-mono bg-muted px-1 rounded">user_good</code>, password: <code className="font-mono bg-muted px-1 rounded">pass_good</code>)
        </p>
      </div>

      {/* AI Classify */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Sparkles size={18} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Auto-Classify a Transaction</h3>
            <p className="text-xs text-muted-foreground">AI matches any description to your spending categories</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={classifyDesc}
            onChange={(e) => setClassifyDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && classify()}
            placeholder="e.g. Starbucks coffee, Netflix subscription…"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={classify}
            disabled={classifying || !classifyDesc.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-1.5"
          >
            {classifying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Classify
          </button>
        </div>
        <AnimatePresence>
          {classResult && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
              <div>
                <p className="font-semibold text-foreground">{classResult.categoryName ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground">Best match</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(classResult.confidence ?? 0) > 0.7 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {((classResult.confidence ?? 0) * 100).toFixed(0)}% confident
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Receipt OCR */}
      <ReceiptOcr />

      {/* AI Insights */}
      <AiInsights />
    </div>
  );
}
