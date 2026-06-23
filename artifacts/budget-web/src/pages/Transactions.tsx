import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Pencil, ArrowUpRight, ArrowDownRight, ArrowLeftRight,
  Filter, Upload, X, FileText, Loader2, CheckCircle2, AlertCircle,
  Globe, Camera, ScanLine, Wallet,
} from "lucide-react";
import {
  useListTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useListAccounts,
  useListCategories,
  getListTransactionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);
}

const COMMON_CURRENCIES = [
  "AED","AUD","CAD","CHF","CNY","CZK","DKK","EUR","GBP","HKD",
  "HUF","IDR","ILS","INR","JPY","KRW","MXN","MYR","NOK","NZD",
  "PHP","PLN","RON","SEK","SGD","THB","TRY","USD","ZAR",
];

type TxnForm = {
  accountId: number;
  categoryId?: number;
  amount: number;
  type: "income" | "expense" | "transfer";
  description?: string;
  date: string;
  isRecurring: boolean;
  originalCurrency?: string;
  originalAmount?: number;
  fxRate?: number;
};
type Filters = { type: string; categoryId: string; startDate: string; endDate: string };

const TYPE_ICONS: Record<string, React.ReactNode> = {
  income: <ArrowUpRight size={14} className="text-emerald-600" />,
  expense: <ArrowDownRight size={14} className="text-red-500" />,
  transfer: <ArrowLeftRight size={14} className="text-blue-500" />,
};

// ── Receipt scan banner ──────────────────────────────────────────────────────
function ScanBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
      <span className="flex-1">{text}</span>
      <button onClick={onDismiss} className="text-emerald-500 hover:text-emerald-700 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ── Transaction form modal ───────────────────────────────────────────────────
function TransactionFormModal({
  accounts,
  categories,
  initial,
  onSave,
  onCancel,
}: {
  accounts: any[];
  categories: any[];
  initial?: any;
  onSave: (d: TxnForm) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, watch, setValue } = useForm<TxnForm>({
    defaultValues: {
      accountId: initial?.accountId ?? accounts[0]?.id ?? 0,
      categoryId: initial?.categoryId ?? undefined,
      amount: initial?.amount ?? undefined,
      type: initial?.type ?? "expense",
      description: initial?.description ?? "",
      date: initial?.date ?? new Date().toISOString().split("T")[0],
      isRecurring: initial?.isRecurring ?? false,
      originalCurrency: initial?.originalCurrency ?? "",
      originalAmount: initial?.originalAmount ?? undefined,
      fxRate: initial?.fxRate ?? undefined,
    },
  });

  const [showFX, setShowFX] = useState(!!(initial?.originalCurrency));
  const [fxLoading, setFxLoading] = useState(false);
  const [fxDisplay, setFxDisplay] = useState(
    initial?.originalCurrency && initial?.originalAmount && initial?.fxRate
      ? `${initial.originalAmount} ${initial.originalCurrency} at rate ${initial.fxRate.toFixed(4)}`
      : ""
  );

  // Receipt scan state
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [scanBanner, setScanBanner] = useState("");
  const receiptRef = useRef<HTMLInputElement>(null);

  const watchedAccountId = watch("accountId");
  const watchedOrigCurrency = watch("originalCurrency");
  const watchedOrigAmount = watch("originalAmount");
  const targetCurrency = accounts.find((a: any) => a.id === Number(watchedAccountId))?.currency ?? "USD";

  // Live FX conversion
  useEffect(() => {
    if (!showFX || !watchedOrigCurrency || !watchedOrigAmount || watchedOrigAmount <= 0) return;
    if (watchedOrigCurrency.toUpperCase() === targetCurrency.toUpperCase()) {
      setValue("amount", watchedOrigAmount);
      setValue("fxRate", 1);
      setFxDisplay(`1 ${watchedOrigCurrency} = 1 ${targetCurrency} (same currency)`);
      return;
    }
    const ctrl = new AbortController();
    setFxLoading(true);
    fetch(`${BASE}/api/fx/convert?from=${watchedOrigCurrency}&to=${targetCurrency}&amount=${watchedOrigAmount}`, { signal: ctrl.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.converted != null && d?.rate != null) {
          const converted = Math.round(d.converted * 100) / 100;
          setValue("amount", converted);
          setValue("fxRate", d.rate);
          setFxDisplay(`${watchedOrigAmount} ${watchedOrigCurrency} → ${converted} ${targetCurrency} (rate ${d.rate.toFixed(4)})`);
        }
        setFxLoading(false);
      })
      .catch(() => setFxLoading(false));
    return () => ctrl.abort();
  }, [showFX, watchedOrigCurrency, watchedOrigAmount, targetCurrency, setValue]);

  // Receipt OCR
  const handleReceiptFile = async (file: File) => {
    setScanState("scanning");
    setScanBanner("");
    const fd = new FormData();
    fd.append("receipt", file);
    try {
      const r = await fetch(`${BASE}/api/ai/ocr-receipt`, { method: "POST", body: fd });
      if (!r.ok) throw new Error("scan failed");
      const d = await r.json();
      if (d.merchant) setValue("description", d.merchant);
      if (d.amount && d.amount > 0) setValue("amount", d.amount);
      if (d.date) setValue("date", d.date);
      if (d.type) setValue("type", d.type);
      if (d.category) {
        const lower = d.category.toLowerCase();
        const matched = categories.find((c: any) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
        if (matched) setValue("categoryId", matched.id);
      }
      const merchant = d.merchant ?? "the receipt";
      const confidence = d.confidence != null ? Math.round(d.confidence * 100) : null;
      setScanBanner(
        `Scanned from receipt${merchant !== "the receipt" ? ` (${merchant})` : ""}${confidence ? ` — ${confidence}% confidence` : ""}. Review the fields below and save when ready.`
      );
      setScanState("done");
    } catch {
      setScanState("error");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="bg-card border border-card-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{initial ? "Edit transaction" : "New transaction"}</h2>
          <div className="flex items-center gap-2">
            {/* Scan receipt button */}
            <button
              type="button"
              onClick={() => receiptRef.current?.click()}
              disabled={scanState === "scanning"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="Scan a receipt photo"
            >
              {scanState === "scanning" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ScanLine size={14} />
              )}
              {scanState === "scanning" ? "Reading receipt…" : "Scan receipt"}
            </button>
            <input
              ref={receiptRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptFile(f); e.target.value = ""; }}
            />
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="p-5 space-y-4">
          {/* Scan result banner */}
          <AnimatePresence>
            {scanState === "done" && scanBanner && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <ScanBanner text={scanBanner} onDismiss={() => { setScanBanner(""); setScanState("idle"); }} />
              </motion.div>
            )}
            {scanState === "error" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>Couldn't read the receipt. Please fill in the details manually.</span>
                  <button type="button" onClick={() => setScanState("idle")} className="ml-auto"><X size={13} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Account — first and prominent */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Wallet size={12} /> Account
            </label>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No accounts yet — add one in Accounts first.</p>
            ) : accounts.length <= 4 ? (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a: any) => {
                  const selected = Number(watch("accountId")) === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setValue("accountId", a.id)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        selected
                          ? "bg-primary text-primary-foreground border-transparent"
                          : "border-border hover:bg-muted text-foreground"
                      }`}
                    >
                      {a.name}
                      {a.currency && a.currency !== "USD" && (
                        <span className={`ml-1.5 text-xs ${selected ? "opacity-70" : "text-muted-foreground"}`}>{a.currency}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <select
                {...register("accountId", { valueAsNumber: true })}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm"
              >
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Description */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <input
                {...register("description")}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                placeholder="e.g. Coffee at Café Roma"
                autoFocus
              />
            </div>

            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {showFX ? `Home amount (${targetCurrency})` : "Amount"}
              </label>
              <input
                {...register("amount", { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                readOnly={showFX && !!fxDisplay && !fxLoading}
                className={`w-full px-3 py-2 rounded-lg border border-border bg-background text-sm ${showFX && fxDisplay ? "opacity-60" : ""}`}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <select {...register("type")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <select {...register("categoryId", { valueAsNumber: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="">None</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
              <input {...register("date")} type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>

            {/* Recurring */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input {...register("isRecurring")} type="checkbox" className="rounded" />
                <span className="text-sm text-foreground">Recurring transaction</span>
              </label>
            </div>

            {/* Foreign currency toggle */}
            <div className="col-span-2 border-t border-border pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFX}
                  onChange={(e) => {
                    setShowFX(e.target.checked);
                    if (!e.target.checked) {
                      setValue("originalCurrency", "");
                      setValue("originalAmount", undefined as any);
                      setValue("fxRate", undefined as any);
                      setFxDisplay("");
                    }
                  }}
                  className="rounded"
                />
                <Globe size={14} className="text-muted-foreground" />
                <span className="text-sm text-foreground">Paid in a different currency</span>
              </label>
            </div>

            {showFX && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Original currency</label>
                  <select {...register("originalCurrency")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option value="">Select currency</option>
                    {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Original amount</label>
                  <input
                    {...register("originalAmount", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 82.50"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                {(fxDisplay || fxLoading) && (
                  <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                    {fxLoading
                      ? <><Loader2 size={12} className="animate-spin" /> Fetching live rate…</>
                      : <><Globe size={12} className="text-blue-500" /> {fxDisplay}</>
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
            >
              {initial ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Import modal (CSV, PDF, TXT, OFX) ────────────────────────────────────────
interface PreviewRow { date: string; description: string; amount: number; type: "income" | "expense" }
type ImportStep = "idle" | "parsing" | "previewing" | "importing" | "done" | "error";

function ImportModal({ accounts, trackers, onClose, onImported }: { accounts: any[]; trackers: any[]; onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<ImportStep>("idle");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parsedRows, setParsedRows] = useState<PreviewRow[]>([]);
  const [isDocFile, setIsDocFile] = useState(false);
  const [total, setTotal] = useState(0);
  const mySpend = trackers.find((t: any) => t.name === "My Spend") ?? trackers[0];
  const [trackerId, setTrackerId] = useState<number>(mySpend?.id ?? 0);
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id ?? 0);
  const [errorMsg, setErrorMsg] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep("idle"); setFile(null); setParsedRows([]); setIsDocFile(false); setErrorMsg(""); };

  const processFile = async (f: File) => {
    setFile(f);
    setErrorMsg("");
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    const isCSV = ext === "csv" || f.type === "text/csv" || f.type === "application/csv";
    setIsDocFile(!isCSV);

    if (isCSV) {
      setStep("previewing");
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${BASE}/api/transactions/import?preview=true`, { method: "POST", body: fd });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Parse failed" }));
        setErrorMsg(e.error ?? "Could not parse file");
        setStep("error");
        return;
      }
      const d = await r.json();
      setPreview(d.preview ?? []);
      setTotal(d.total ?? 0);
    } else {
      setStep("parsing");
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch(`${BASE}/api/transactions/import/document`, { method: "POST", body: fd });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Parse failed" }));
        setErrorMsg(e.error ?? "Could not read document");
        setStep("error");
        return;
      }
      const d = await r.json();
      setParsedRows(d.rows ?? []);
      setPreview(d.preview ?? []);
      setTotal(d.total ?? 0);
      setStep("previewing");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const handleConfirm = async () => {
    if (!file) return;
    setStep("importing");
    if (isDocFile && parsedRows.length > 0) {
      const r = await fetch(`${BASE}/api/transactions/import/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows, accountId, trackerId: trackerId || undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Import failed" }));
        setErrorMsg(e.error ?? "Import failed");
        setStep("error");
        return;
      }
      const d = await r.json();
      setImportedCount(d.imported ?? 0);
      setStep("done");
      onImported();
    } else {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("accountId", String(accountId));
      if (trackerId) fd.append("trackerId", String(trackerId));
      const r = await fetch(`${BASE}/api/transactions/import`, { method: "POST", body: fd });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Import failed" }));
        setErrorMsg(e.error ?? "Import failed");
        setStep("error");
        return;
      }
      const d = await r.json();
      setImportedCount(d.imported ?? 0);
      setStep("done");
      onImported();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="bg-card border border-card-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Import bank statement</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {step === "done" ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto" />
              <p className="font-semibold text-foreground text-lg">Imported {importedCount} transaction{importedCount !== 1 ? "s" : ""}</p>
              <p className="text-sm text-muted-foreground">Your transactions have been added successfully.</p>
              <button onClick={onClose} className="mt-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
            </div>
          ) : step === "error" ? (
            <div className="text-center py-8 space-y-3">
              <AlertCircle size={48} className="text-red-400 mx-auto" />
              <p className="font-semibold text-foreground">Could not parse file</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">{errorMsg}</p>
              <p className="text-xs text-muted-foreground">
                {isDocFile
                  ? "Make sure the PDF or text file is a readable bank statement (not a scanned image)."
                  : <>Make sure the CSV has columns for <strong>date</strong>, <strong>description</strong>, and <strong>amount</strong>.</>
                }
              </p>
              <button onClick={reset} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors">Try another file</button>
            </div>
          ) : step === "parsing" ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Loader2 size={24} className="text-primary animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Reading your statement…</p>
                <p className="text-sm text-muted-foreground mt-1">AI is extracting transactions — usually under a minute</p>
              </div>
              <p className="text-xs text-muted-foreground">{file?.name}</p>
            </div>
          ) : (step === "idle" || !file) ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}
              >
                <Upload size={32} className="mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-foreground text-sm">Drop your bank statement here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <p className="text-xs text-muted-foreground mt-3 font-medium">PDF · CSV · XLSX · TXT · XML · QIF</p>
                <p className="text-xs text-muted-foreground mt-1">Westpac, CommBank, ANZ, Wise, Monzo, Revolut, Starling and more</p>
                <input ref={fileRef} type="file" accept=".csv,.pdf,.txt,.ofx,.xlsx,.xls,.xml,.qif,.mt940,text/csv,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
              </div>
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
                <p className="font-medium text-foreground">How to get your statement:</p>
                <p>• <strong>Westpac / CommBank / ANZ / NAB:</strong> Internet banking → Accounts → Statement → PDF</p>
                <p>• <strong>Wise:</strong> Home → Statements → choose date range → PDF, XLSX, CSV, XML or QIF</p>
                <p>• <strong>Monzo / Revolut / Starling:</strong> Account → Statements → CSV</p>
                <p>• <strong>HSBC / Barclays / Chase:</strong> Accounts → Download statement → PDF or CSV</p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                <FileText size={14} />
                <span className="font-medium text-foreground truncate">{file.name}</span>
                <span className="ml-auto text-xs whitespace-nowrap">{total} {isDocFile ? "transactions found" : "rows detected"}</span>
                <button onClick={reset} className="ml-1 hover:text-foreground transition-colors"><X size={13} /></button>
              </div>

              {step === "importing" ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Importing {total} transactions…</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Import into tracker</label>
                    {trackers.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No trackers yet — create one in Trackers first.</p>
                    ) : (
                      <select value={trackerId} onChange={(e) => setTrackerId(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                        <option value={0}>— None (transactions only) —</option>
                        {trackers.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Bank account</label>
                    {accounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No accounts yet — add one in Accounts first.</p>
                    ) : (
                      <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    )}
                  </div>
                  {preview.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Preview: first {preview.length} of {total} rows</p>
                      <div className="rounded-lg border border-border overflow-hidden text-xs">
                        <div className="grid grid-cols-3 bg-muted/60 px-3 py-2 font-medium text-muted-foreground">
                          <span>Date</span><span>Description</span><span className="text-right">Amount</span>
                        </div>
                        {preview.map((r, i) => (
                          <div key={i} className="grid grid-cols-3 px-3 py-2 border-t border-border/50 items-center">
                            <span className="text-muted-foreground">{r.date}</span>
                            <span className="truncate pr-2">{r.description}</span>
                            <span className={`text-right font-medium ${r.type === "income" ? "text-emerald-600" : "text-foreground"}`}>
                              {r.type === "income" ? "+" : "-"}{fmt(r.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleConfirm}
                    className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Import {total} transaction{total !== 1 ? "s" : ""}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Transactions() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState<Filters>({ type: "", categoryId: "", startDate: "", endDate: "" });

  const params = {
    type: (filters.type as any) || undefined,
    categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    limit: 100,
    offset: 0,
  };

  const [trackers, setTrackers] = useState<any[]>([]);

  // staleTime keeps accounts/categories cached so the form opens with instant data
  const { data } = useListTransactions(params);
  const { data: accounts = [] } = useListAccounts();
  const { data: categories = [] } = useListCategories();

  useEffect(() => {
    fetch(`${BASE}/api/trackers`).then((r) => r.ok ? r.json() : []).then(setTrackers).catch(() => {});
  }, []);

  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const deleteTxn = useDeleteTransaction();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTransactionsQueryKey(params) });

  const handleCreate = (d: TxnForm) => {
    createTxn.mutate({ data: d as any }, { onSuccess: () => { invalidate(); setShowForm(false); } });
  };

  const handleUpdate = (id: number, d: TxnForm) => {
    updateTxn.mutate({ id, data: d as any }, { onSuccess: () => { invalidate(); setEditing(null); } });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this transaction?")) deleteTxn.mutate({ id }, { onSuccess: invalidate });
  };

  const transactions = data?.data ?? [];
  const editingTxn = editing !== null ? transactions.find((t) => t.id === editing) : undefined;

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Transactions</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total transactions</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${showFilters ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:bg-muted"}`}
            >
              <Filter size={14} /> Filters
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              <Upload size={14} /> Import
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-muted/40 border border-border rounded-xl p-4 overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                  <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option value="">All</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                  <select value={filters.categoryId} onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option value="">All</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
                  <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
                  <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {transactions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ArrowDownRight size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">No transactions yet</p>
            <p className="text-sm mt-1">Add your first transaction or import a bank statement.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity mx-auto"
            >
              <Plus size={15} /> Add transaction
            </button>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto] text-xs font-medium text-muted-foreground px-4 py-2.5 border-b border-border bg-muted/40">
              <span className="w-8" />
              <span>Description</span>
              <span className="text-right pr-8">Amount</span>
              <span />
            </div>
            {transactions.map((t: any, i: number) => (
              <div
                key={t.id}
                className={`grid grid-cols-[auto_1fr_auto_auto] items-center px-4 py-3 gap-3 ${i > 0 ? "border-t border-border/50" : ""} hover:bg-muted/30 group transition-colors`}
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {TYPE_ICONS[t.type] ?? <ArrowLeftRight size={14} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.date}
                    {t.categoryName && <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">{t.categoryName}</span>}
                    {t.accountName && <span className="ml-1.5 text-xs text-muted-foreground/70">{t.accountName}</span>}
                    {t.originalCurrency && t.originalCurrency !== (t.currency ?? "USD") && (
                      <span className="ml-1.5 text-xs text-blue-500">{t.originalAmount} {t.originalCurrency}</span>
                    )}
                  </p>
                </div>
                <span className={`text-sm font-semibold pr-2 ${t.type === "income" ? "text-emerald-600" : t.type === "expense" ? "text-foreground" : "text-blue-500"}`}>
                  {t.type === "income" ? "+" : t.type === "expense" ? "-" : ""}{fmt(Math.abs(t.amount), t.currency ?? "USD")}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditing(t.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New transaction modal */}
      <AnimatePresence>
        {showForm && (
          <TransactionFormModal
            accounts={accounts as any[]}
            categories={categories as any[]}
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Edit transaction modal */}
      <AnimatePresence>
        {editing !== null && editingTxn && (
          <TransactionFormModal
            accounts={accounts as any[]}
            categories={categories as any[]}
            initial={editingTxn}
            onSave={(d) => handleUpdate(editing, d)}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      {/* Import modal */}
      <AnimatePresence>
        {showImport && (
          <ImportModal
            accounts={accounts as any[]}
            trackers={trackers}
            onClose={() => setShowImport(false)}
            onImported={() => { invalidate(); setShowImport(false); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
