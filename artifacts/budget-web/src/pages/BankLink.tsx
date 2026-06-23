import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2, CheckCircle, AlertCircle, Loader2, Building2,
  RefreshCw, Camera, Sparkles, ChevronDown, Globe, Search,
  ExternalLink,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAccountsQueryKey,
  getListTransactionsQueryKey,
  useGetDashboardSummary,
  useGetSpendingByCategory,
} from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─────────────────────────────────────────────────────────────────────────────
// Region / provider map
// ─────────────────────────────────────────────────────────────────────────────

type Provider = "gocardless" | "plaid" | "basiq" | "akahu" | "none";

interface Region {
  code: string;
  flag: string;
  name: string;
  provider: Provider;
  gcCountry?: string; // ISO country code for GoCardless
}

const REGIONS: Region[] = [
  // GoCardless — UK + major EU
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", provider: "gocardless", gcCountry: "GB" },
  { code: "IE", flag: "🇮🇪", name: "Ireland", provider: "gocardless", gcCountry: "IE" },
  { code: "DE", flag: "🇩🇪", name: "Germany", provider: "gocardless", gcCountry: "DE" },
  { code: "FR", flag: "🇫🇷", name: "France", provider: "gocardless", gcCountry: "FR" },
  { code: "ES", flag: "🇪🇸", name: "Spain", provider: "gocardless", gcCountry: "ES" },
  { code: "IT", flag: "🇮🇹", name: "Italy", provider: "gocardless", gcCountry: "IT" },
  { code: "NL", flag: "🇳🇱", name: "Netherlands", provider: "gocardless", gcCountry: "NL" },
  { code: "BE", flag: "🇧🇪", name: "Belgium", provider: "gocardless", gcCountry: "BE" },
  { code: "SE", flag: "🇸🇪", name: "Sweden", provider: "gocardless", gcCountry: "SE" },
  { code: "NO", flag: "🇳🇴", name: "Norway", provider: "gocardless", gcCountry: "NO" },
  { code: "DK", flag: "🇩🇰", name: "Denmark", provider: "gocardless", gcCountry: "DK" },
  { code: "FI", flag: "🇫🇮", name: "Finland", provider: "gocardless", gcCountry: "FI" },
  { code: "AT", flag: "🇦🇹", name: "Austria", provider: "gocardless", gcCountry: "AT" },
  { code: "PL", flag: "🇵🇱", name: "Poland", provider: "gocardless", gcCountry: "PL" },
  { code: "PT", flag: "🇵🇹", name: "Portugal", provider: "gocardless", gcCountry: "PT" },
  { code: "CZ", flag: "🇨🇿", name: "Czech Republic", provider: "gocardless", gcCountry: "CZ" },
  { code: "HU", flag: "🇭🇺", name: "Hungary", provider: "gocardless", gcCountry: "HU" },
  { code: "RO", flag: "🇷🇴", name: "Romania", provider: "gocardless", gcCountry: "RO" },
  { code: "LT", flag: "🇱🇹", name: "Lithuania", provider: "gocardless", gcCountry: "LT" },
  { code: "LV", flag: "🇱🇻", name: "Latvia", provider: "gocardless", gcCountry: "LV" },
  { code: "EE", flag: "🇪🇪", name: "Estonia", provider: "gocardless", gcCountry: "EE" },
  // Plaid — US & Canada
  { code: "US", flag: "🇺🇸", name: "United States", provider: "plaid" },
  { code: "CA", flag: "🇨🇦", name: "Canada", provider: "plaid" },
  // Basiq — Australia
  { code: "AU", flag: "🇦🇺", name: "Australia", provider: "basiq" },
  // Akahu — New Zealand
  { code: "NZ", flag: "🇳🇿", name: "New Zealand", provider: "akahu" },
  // Not yet supported
  { code: "SG", flag: "🇸🇬", name: "Singapore", provider: "none" },
  { code: "JP", flag: "🇯🇵", name: "Japan", provider: "none" },
];

// ─────────────────────────────────────────────────────────────────────────────
// GoCardless bank-link flow
// ─────────────────────────────────────────────────────────────────────────────

interface Institution { id: string; name: string; logo: string | null }

function GoCardlessFlow({
  region,
  onSuccess,
}: {
  region: Region;
  onSuccess: (accounts: number, txns: number) => void;
}) {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingInst, setLoadingInst] = useState(false);
  const [instError, setInstError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Institution | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Load bank list when region changes
  useEffect(() => {
    if (!region.gcCountry) return;
    setLoadingInst(true);
    setInstError(null);
    setInstitutions([]);
    setSelected(null);
    fetch(`${BASE}/api/gocardless/institutions?country=${region.gcCountry}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setInstitutions(d.institutions ?? []);
      })
      .catch((e) => setInstError(e.message))
      .finally(() => setLoadingInst(false));
  }, [region.gcCountry]);

  // Handle return from bank redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reqId = sessionStorage.getItem("gc_requisition_id");
    const provider = params.get("provider");
    if (provider === "gocardless" && reqId) {
      sessionStorage.removeItem("gc_requisition_id");
      setLinking(true);
      fetch(`${BASE}/api/gocardless/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requisitionId: reqId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          onSuccess(d.accountsImported, d.transactionsImported);
        })
        .catch((e) => setLinkError(e.message))
        .finally(() => {
          setLinking(false);
          // Clean up URL params without page reload
          const url = new URL(window.location.href);
          url.searchParams.delete("provider");
          window.history.replaceState({}, "", url.toString());
        });
    }
  }, []);

  const startLink = async () => {
    if (!selected) return;
    setLinking(true);
    setLinkError(null);
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}?provider=gocardless`;
      const res = await fetch(`${BASE}/api/gocardless/create-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId: selected.id, redirectUri }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      sessionStorage.setItem("gc_requisition_id", data.requisitionId);
      window.location.href = data.link;
    } catch (e: any) {
      setLinkError(e.message);
      setLinking(false);
    }
  };

  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Provider badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
          Free · GoCardless Open Banking
        </span>
        <span>Up to 90 days of transactions</span>
      </div>

      {instError && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle size={14} />
          {instError}
        </p>
      )}

      {/* Bank search */}
      {!loadingInst && institutions.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${institutions.length} banks in ${region.name}…`}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {filtered.slice(0, 30).map((inst) => (
              <button
                key={inst.id}
                onClick={() => setSelected(inst)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left ${
                  selected?.id === inst.id ? "bg-primary/5 font-medium" : ""
                }`}
              >
                {inst.logo ? (
                  <img src={inst.logo} alt="" className="w-6 h-6 rounded object-contain" />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                    <Building2 size={12} className="text-muted-foreground" />
                  </div>
                )}
                <span>{inst.name}</span>
                {selected?.id === inst.id && (
                  <CheckCircle size={14} className="ml-auto text-primary" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No banks match "{search}"</p>
            )}
          </div>
        </div>
      )}

      {loadingInst && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 size={14} className="animate-spin" /> Loading banks for {region.name}…
        </div>
      )}

      {linkError && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle size={14} /> {linkError}
        </p>
      )}

      <button
        onClick={startLink}
        disabled={!selected || linking}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {linking ? (
          <><Loader2 size={18} className="animate-spin" /> Connecting…</>
        ) : (
          <><Link2 size={18} /> {selected ? `Connect ${selected.name}` : "Select a bank above"}</>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plaid flow (US / Canada)
// ─────────────────────────────────────────────────────────────────────────────

function PlaidFlow({ onSuccess }: { onSuccess: (a: number, t: number) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ltRes = await fetch(`${BASE}/api/plaid/link-token`, { method: "POST" });
      const { link_token, error: ltErr } = await ltRes.json();
      if (ltErr) throw new Error(ltErr);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
          Plaid · 10,000+ institutions
        </span>
        <span>30 days of transactions</span>
      </div>
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      <button
        onClick={openLink}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? <><Loader2 size={18} className="animate-spin" /> Connecting…</> : <><Link2 size={18} /> Connect Bank Account</>}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Sandbox mode: use username{" "}
        <code className="font-mono bg-muted px-1 rounded">user_good</code> /{" "}
        password <code className="font-mono bg-muted px-1 rounded">pass_good</code>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Info cards for providers that need separate sign-up
// ─────────────────────────────────────────────────────────────────────────────

function ProviderInfoCard({
  flag,
  country,
  provider,
  url,
  envVars,
  description,
}: {
  flag: string;
  country: string;
  provider: string;
  url: string;
  envVars: string[];
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="text-2xl">{flag}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{country} → {provider}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          <div className="mt-2 space-y-1">
            {envVars.map((v) => (
              <code key={v} className="block text-xs font-mono bg-background border border-border rounded px-2 py-1 text-muted-foreground">
                {v}
              </code>
            ))}
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline shrink-0"
        >
          Sign up free <ExternalLink size={11} />
        </a>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Once registered, add the env vars above as secrets and redeploy.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt OCR
// ─────────────────────────────────────────────────────────────────────────────

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
          <p className="text-xs text-muted-foreground">Upload a photo. AI extracts merchant, amount, date and line items.</p>
        </div>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) processFile(f); }}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
        {loading ? (
          <><Loader2 size={28} className="animate-spin text-primary" /><p className="text-sm text-muted-foreground">Analysing receipt…</p></>
        ) : preview ? (
          <img src={preview} alt="Receipt" className="max-h-40 rounded-lg object-contain" />
        ) : (
          <><Camera size={28} className="text-muted-foreground" /><p className="text-sm text-muted-foreground">Drop an image or click to upload</p></>
        )}
      </label>

      {error && <p className="text-sm text-red-500 flex items-center gap-2"><AlertCircle size={14} />{error}</p>}

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
                <p className="text-xs text-muted-foreground mb-1">Line items</p>
                <ul className="text-sm space-y-0.5">{result.items.slice(0, 6).map((item, i) => <li key={i} className="text-muted-foreground">• {item}</li>)}</ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Save as Transaction</button>
              <button onClick={() => { setResult(null); setPreview(null); }} className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm transition-colors">Discard</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Insights
// ─────────────────────────────────────────────────────────────────────────────

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
            <p className="text-xs text-muted-foreground">Personalised tips based on your spending data</p>
          </div>
        </div>
        <button onClick={fetchInsights} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-60">
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
          <Loader2 size={18} className="animate-spin" /><span className="text-sm">Analysing your finances…</span>
        </div>
      )}
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className={`p-3 rounded-lg border text-sm ${TYPE_STYLES[ins.type] ?? TYPE_STYLES.tip}`}>
            <p className="font-semibold mb-0.5">{ins.title}</p>
            <p className="opacity-80">{ins.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function BankLink() {
  const qc = useQueryClient();
  const [region, setRegion] = useState<Region | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [linkResult, setLinkResult] = useState<{ accounts: number; txns: number } | null>(null);
  const [classifyDesc, setClassifyDesc] = useState("");
  const [classifying, setClassifying] = useState(false);
  const [classResult, setClassResult] = useState<any | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) setRegionOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLinkSuccess = (accounts: number, txns: number) => {
    setLinkResult({ accounts, txns });
    qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    qc.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 50, offset: 0 }) });
  };

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

      {/* ── Bank Link ── */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Link a Bank Account</h3>
            <p className="text-xs text-muted-foreground">Connects using free open-banking providers, covering 30+ countries.</p>
          </div>
        </div>

        {/* Region picker */}
        <div ref={regionRef} className="relative">
          <button
            onClick={() => setRegionOpen(!regionOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background text-sm hover:bg-muted transition-colors"
          >
            <span className="flex items-center gap-2">
              {region ? (
                <><span className="text-base">{region.flag}</span><span>{region.name}</span></>
              ) : (
                <><Globe size={16} className="text-muted-foreground" /><span className="text-muted-foreground">Select your country…</span></>
              )}
            </span>
            <ChevronDown size={14} className={`text-muted-foreground transition-transform ${regionOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {regionOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden"
              >
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {REGIONS.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => { setRegion(r); setRegionOpen(false); setLinkResult(null); }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base">{r.flag}</span>
                        <span>{r.name}</span>
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        r.provider === "gocardless" ? "bg-emerald-100 text-emerald-700" :
                        r.provider === "plaid" ? "bg-blue-100 text-blue-700" :
                        r.provider === "basiq" ? "bg-orange-100 text-orange-700" :
                        r.provider === "akahu" ? "bg-purple-100 text-purple-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {r.provider === "gocardless" ? "GoCardless" :
                         r.provider === "plaid" ? "Plaid" :
                         r.provider === "basiq" ? "Basiq" :
                         r.provider === "akahu" ? "Akahu" : "Soon"}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Success banner */}
        <AnimatePresence>
          {linkResult && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              <CheckCircle size={16} />
              <span>Imported <strong>{linkResult.accounts}</strong> account{linkResult.accounts !== 1 ? "s" : ""} and <strong>{linkResult.txns}</strong> transaction{linkResult.txns !== 1 ? "s" : ""}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Provider-specific flow */}
        <AnimatePresence mode="wait">
          {region && (
            <motion.div key={region.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {region.provider === "gocardless" && (
                <GoCardlessFlow region={region} onSuccess={handleLinkSuccess} />
              )}
              {region.provider === "plaid" && (
                <PlaidFlow onSuccess={handleLinkSuccess} />
              )}
              {region.provider === "basiq" && (
                <ProviderInfoCard
                  flag="🇦🇺"
                  country="Australia"
                  provider="Basiq"
                  url="https://basiq.io/signup"
                  description="Free tier (50 connections/month). Australia's leading open banking API under the Consumer Data Right (CDR) mandate."
                  envVars={["BASIQ_API_KEY"]}
                />
              )}
              {region.provider === "akahu" && (
                <ProviderInfoCard
                  flag="🇳🇿"
                  country="New Zealand"
                  provider="Akahu"
                  url="https://my.akahu.nz/apps"
                  description="Free for personal/non-commercial use. Covers all major NZ banks including ANZ, ASB, BNZ, Westpac and Kiwibank."
                  envVars={["AKAHU_APP_TOKEN", "AKAHU_USER_TOKEN"]}
                />
              )}
              {region.provider === "none" && (
                <div className="text-center py-6 text-muted-foreground">
                  <Globe size={28} strokeWidth={1.5} className="mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">Not yet supported</p>
                  <p className="text-xs mt-1">Open banking infrastructure for {region.name} is coming soon</p>
                </div>
              )}
            </motion.div>
          )}
          {!region && (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-muted-foreground py-2">
              Select your country to see available banks
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ── AI Classify ── */}
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
        <div className="flex items-center gap-2">
          <input
            value={classifyDesc}
            onChange={(e) => setClassifyDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && classify()}
            placeholder="e.g. Starbucks, Netflix, Tesco…"
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={classify}
            disabled={classifying || !classifyDesc.trim()}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {classifying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Classify
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

      {/* ── Receipt OCR ── */}
      <ReceiptOcr />

      {/* ── AI Insights ── */}
      <AiInsights />
    </div>
  );
}
