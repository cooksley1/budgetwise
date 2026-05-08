import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, Plus, Trash2, Tag, Settings, Plane, Coffee, Hammer, Heart, GraduationCap, Repeat, GitCompare, Sparkles } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ICONS: Record<string, React.ReactNode> = {
  plane: <Plane size={18} />,
  coffee: <Coffee size={18} />,
  hammer: <Hammer size={18} />,
  heart: <Heart size={18} />,
  graduationcap: <GraduationCap size={18} />,
};

interface Detail {
  tracker: any;
  summary: { totalSpent: number; totalIncome: number; days: number; dailyAvg: number; weeklyAvg: number; monthlyAvg: number; transactionCount: number };
  byCategory: Array<{ name: string; color: string | null; total: number; count: number }>;
  byDay: Array<{ date: string; total: number }>;
  byMerchant: Array<{ name: string; total: number; count: number; min: number; max: number; avg: number }>;
  budgetStatus: { dailyBudget: number; totalBudget: number; over: boolean; percent: number } | null;
  transactions: Array<any>;
}

interface Tx { id: number; description: string | null; amount: number; date: string; type: string; categoryName: string | null; }

const PIE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function TrackerDetail() {
  const [, params] = useRoute("/trackers/:id");
  const id = Number(params?.id);
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<"overview" | "transactions" | "rules" | "compare">("overview");
  const [showAddTxn, setShowAddTxn] = useState(false);

  const load = async () => {
    const res = await fetch(`${BASE}/api/trackers/${id}`);
    if (res.ok) setData(await res.json());
  };

  useEffect(() => { if (!Number.isNaN(id)) load(); }, [id]);

  if (!data) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;

  const { tracker, summary, byCategory, byDay, byMerchant, budgetStatus, transactions } = data;
  const fmtHome = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: tracker.homeCurrency }).format(n);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link href="/trackers" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"><ArrowLeft size={14} /> Back to trackers</Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${tracker.color}20`, color: tracker.color }}>
            {ICONS[tracker.icon] ?? <Plane size={24} />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{tracker.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted font-medium">{tracker.type === "trip" ? "Trip / Event" : "Theme"}</span>
              {tracker.startDate && (
                <span className="flex items-center gap-1"><Calendar size={11} />
                  {new Date(tracker.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {tracker.endDate && ` → ${new Date(tracker.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                </span>
              )}
              {tracker.foreignCurrency && tracker.foreignCurrency !== tracker.homeCurrency && (
                <span>{tracker.foreignCurrency} → {tracker.homeCurrency}</span>
              )}
            </div>
            {tracker.description && <p className="text-sm text-muted-foreground mt-1">{tracker.description}</p>}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total spent" value={fmtHome(summary.totalSpent)} accent={tracker.color} />
        <StatCard label="Transactions" value={summary.transactionCount.toString()} />
        {summary.days > 0 && <StatCard label={`Daily avg (${summary.days} days)`} value={fmtHome(summary.dailyAvg)} />}
        {summary.days > 0 && <StatCard label="Monthly equivalent" value={fmtHome(summary.monthlyAvg)} />}
      </div>

      {/* Budget status */}
      {budgetStatus && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Daily budget: {fmtHome(budgetStatus.dailyBudget)}</p>
            <p className={`text-sm font-semibold ${budgetStatus.over ? "text-red-500" : "text-emerald-500"}`}>
              {budgetStatus.over ? <><TrendingDown size={14} className="inline" /> Over budget</> : <><TrendingUp size={14} className="inline" /> On track</>}
              {" — "}{budgetStatus.percent.toFixed(0)}%
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetStatus.over ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, budgetStatus.percent)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{fmtHome(summary.totalSpent)} of {fmtHome(budgetStatus.totalBudget)} budget across {summary.days} days</p>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-1">
        {[
          { k: "overview", label: "Overview", icon: TrendingUp },
          { k: "transactions", label: "Transactions", icon: Tag },
          { k: "rules", label: "Auto-rules", icon: Repeat },
          { k: "compare", label: "Compare", icon: GitCompare },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          {byCategory.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-card-border rounded-xl p-5">
                <p className="font-semibold text-sm text-foreground mb-3">By category</p>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byCategory} dataKey="total" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {byCategory.map((c, i) => <Cell key={i} fill={c.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtHome(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-card border border-card-border rounded-xl p-5">
                <p className="font-semibold text-sm text-foreground mb-3">Spending by day</p>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => fmtHome(v)} />
                      <Bar dataKey="total" fill={tracker.color} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <EmptyTab message="No transactions tagged yet. Add some from the Transactions tab." />
          )}

          {/* Theme variance — top merchants */}
          {tracker.type === "theme" && byMerchant.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5">
              <p className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Variance by merchant / description</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border">
                    <tr><th className="text-left py-2 font-medium">Place</th><th className="text-right font-medium">Visits</th><th className="text-right font-medium">Avg</th><th className="text-right font-medium">Min</th><th className="text-right font-medium">Max</th><th className="text-right font-medium">Total</th></tr>
                  </thead>
                  <tbody>
                    {byMerchant.map((m, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 font-medium text-foreground">{m.name}</td>
                        <td className="py-2 text-right">{m.count}</td>
                        <td className="py-2 text-right">{fmtHome(m.avg)}</td>
                        <td className="py-2 text-right text-emerald-600">{fmtHome(m.min)}</td>
                        <td className="py-2 text-right text-red-500">{fmtHome(m.max)}</td>
                        <td className="py-2 text-right font-semibold">{fmtHome(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "transactions" && (
        <TransactionsTab trackerId={id} transactions={transactions} fmtHome={fmtHome} onChange={load} showAdd={showAddTxn} setShowAdd={setShowAddTxn} />
      )}

      {tab === "rules" && <RulesTab trackerId={id} onApplied={load} />}

      {tab === "compare" && <CompareTab trackerId={id} fmtHome={fmtHome} />}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-xl font-bold text-foreground mt-1" style={accent ? { color: accent } : undefined}>{value}</p>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return <div className="text-center py-12 text-muted-foreground text-sm">{message}</div>;
}

function TransactionsTab({ trackerId, transactions, fmtHome, onChange, showAdd, setShowAdd }: any) {
  const [allTxns, setAllTxns] = useState<Tx[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (showAdd) {
      fetch(`${BASE}/api/transactions?limit=200`).then((r) => r.json()).then((d) => setAllTxns(d.data));
    }
  }, [showAdd]);

  const taggedIds = new Set(transactions.map((t: any) => t.id));
  const candidates = allTxns.filter((t) => !taggedIds.has(t.id));

  const handleAddSelected = async () => {
    if (selected.size === 0) return;
    await fetch(`${BASE}/api/trackers/${trackerId}/transactions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionIds: Array.from(selected) }),
    });
    setSelected(new Set());
    setShowAdd(false);
    onChange();
  };

  const handleRemove = async (txnId: number) => {
    await fetch(`${BASE}/api/trackers/${trackerId}/transactions/${txnId}`, { method: "DELETE" });
    onChange();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{transactions.length} transactions tagged</p>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus size={14} /> {showAdd ? "Cancel" : "Tag transactions"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2 max-h-96 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-2">Select transactions to add to this tracker:</p>
          {candidates.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No untagged transactions</p> : candidates.map((t) => (
            <label key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-background cursor-pointer">
              <input type="checkbox" checked={selected.has(t.id)} onChange={(e) => {
                const ns = new Set(selected); e.target.checked ? ns.add(t.id) : ns.delete(t.id); setSelected(ns);
              }} className="w-4 h-4 accent-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.description || "—"}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()} · {t.categoryName ?? "Uncategorised"}</p>
              </div>
              <p className={`text-sm font-semibold ${t.type === "expense" ? "text-red-500" : "text-emerald-500"}`}>{fmtHome(t.amount)}</p>
            </label>
          ))}
          {selected.size > 0 && (
            <div className="pt-2 border-t border-border flex justify-end">
              <button onClick={handleAddSelected} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Add {selected.size} transaction{selected.size > 1 ? "s" : ""}</button>
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
        {transactions.length === 0 ? <p className="text-center py-12 text-muted-foreground text-sm">No transactions yet</p> :
          transactions.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 p-3 group">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                {(t.merchant || t.description || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.merchant || t.description || "—"}</p>
                <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()} · {t.categoryName ?? "Uncategorised"} · {t.accountName}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${t.type === "expense" ? "text-red-500" : "text-emerald-500"}`}>{fmtHome(t.amount)}</p>
                {t.originalAmount && t.originalCurrency && (
                  <p className="text-xs text-muted-foreground">{t.originalCurrency} {t.originalAmount.toFixed(2)}</p>
                )}
              </div>
              <button onClick={() => handleRemove(t.id)} aria-label="Remove transaction from tracker" className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}

function RulesTab({ trackerId, onApplied }: { trackerId: number; onApplied: () => void }) {
  const [rules, setRules] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("merchant_match");
  const [keywords, setKeywords] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [applying, setApplying] = useState(false);
  const [tagged, setTagged] = useState<number | null>(null);

  const load = async () => setRules(await (await fetch(`${BASE}/api/trackers/${trackerId}/rules`)).json());
  useEffect(() => { load(); }, [trackerId]);

  const create = async () => {
    let config: any = {};
    if (type === "merchant_match") config = { keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean) };
    else if (type === "date_range") config = { start, end };
    else if (type === "currency") config = { currency };
    await fetch(`${BASE}/api/trackers/${trackerId}/rules`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, config }),
    });
    setAdding(false);
    setKeywords(""); setStart(""); setEnd("");
    load();
  };

  const remove = async (id: number) => { await fetch(`${BASE}/api/trackers/${trackerId}/rules/${id}`, { method: "DELETE" }); load(); };

  const applyAll = async () => {
    setApplying(true);
    const res = await fetch(`${BASE}/api/trackers/${trackerId}/apply-rules`, { method: "POST" });
    const data = await res.json();
    setTagged(data.tagged);
    setApplying(false);
    onApplied();
    setTimeout(() => setTagged(null), 4000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Auto-tag transactions matching these rules</p>
        <div className="flex gap-2">
          <button onClick={applyAll} disabled={applying || rules.length === 0} className="px-3 py-1.5 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center gap-1.5">
            <Sparkles size={14} /> {applying ? "Running…" : "Apply rules now"}
          </button>
          <button onClick={() => setAdding(!adding)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            <Plus size={14} /> Add rule
          </button>
        </div>
      </div>
      {tagged !== null && <div className="text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg border border-emerald-200">✓ Tagged {tagged} matching transaction{tagged === 1 ? "" : "s"}</div>}

      {adding && (
        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Rule type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
              <option value="merchant_match">Merchant / description match</option>
              <option value="date_range">Date range</option>
              <option value="currency">Foreign currency</option>
            </select>
          </div>
          {type === "merchant_match" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Keywords (comma-separated)</label>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="e.g. starbucks, costa, pret" />
            </div>
          )}
          {type === "date_range" && (
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
          )}
          {type === "currency" && (
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="e.g. EUR" />
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-sm rounded-lg border border-border">Cancel</button>
            <button onClick={create} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground">Save rule</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
        {rules.length === 0 ? <p className="text-center py-12 text-muted-foreground text-sm">No rules yet</p> :
          rules.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 group">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Repeat size={14} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground capitalize">{r.type.replace("_", " ")}</p>
                <p className="text-xs text-muted-foreground truncate">{describeRule(r)}</p>
              </div>
              <button onClick={() => remove(r.id)} aria-label="Delete rule" className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
      </div>
    </div>
  );
}

function describeRule(r: any): string {
  const c = r.config;
  if (r.type === "merchant_match") return `Keywords: ${(c.keywords || []).join(", ")}`;
  if (r.type === "date_range") return `${c.start} → ${c.end}`;
  if (r.type === "currency") return `Currency: ${c.currency}`;
  if (r.type === "category") return `Categories: ${(c.categoryIds || []).join(", ")}`;
  return JSON.stringify(c);
}

function CompareTab({ trackerId, fmtHome }: { trackerId: number; fmtHome: (n: number) => string }) {
  const [allTrackers, setAllTrackers] = useState<any[]>([]);
  const [otherId, setOtherId] = useState<number | null>(null);
  const [comparison, setComparison] = useState<any[] | null>(null);

  useEffect(() => { fetch(`${BASE}/api/trackers`).then((r) => r.json()).then((d) => setAllTrackers(d.filter((t: any) => t.id !== trackerId))); }, [trackerId]);

  useEffect(() => {
    if (otherId) fetch(`${BASE}/api/trackers/compare?ids=${trackerId},${otherId}`).then((r) => r.json()).then(setComparison);
  }, [otherId, trackerId]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Compare with another tracker</label>
        <select value={otherId ?? ""} onChange={(e) => setOtherId(e.target.value ? Number(e.target.value) : null)} className="w-full max-w-md px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="">— Select a tracker —</option>
          {allTrackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {comparison && comparison.length === 2 && (
        <div className="grid grid-cols-2 gap-4">
          {comparison.map((c: any) => (
            <div key={c.tracker.id} className="bg-card border border-card-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.tracker.color}20`, color: c.tracker.color }}>
                  {ICONS[c.tracker.icon] ?? <Plane size={14} />}
                </div>
                <p className="font-semibold text-foreground">{c.tracker.name}</p>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Row label="Total spent" value={fmtHome(c.totalSpent)} />
                <Row label="Days" value={c.days.toString()} />
                <Row label="Daily avg" value={fmtHome(c.dailyAvg)} />
                <Row label="Transactions" value={c.transactionCount.toString()} />
              </div>
            </div>
          ))}
        </div>
      )}

      {comparison && comparison.length === 2 && (
        <div className="bg-muted/40 border border-border rounded-xl p-5 text-sm">
          <p className="font-medium text-foreground mb-2 flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Variance</p>
          <p className="text-muted-foreground">
            <strong className="text-foreground">{comparison[0].tracker.name}</strong> spent{" "}
            <strong className={comparison[0].totalSpent > comparison[1].totalSpent ? "text-red-500" : "text-emerald-500"}>
              {fmtHome(Math.abs(comparison[0].totalSpent - comparison[1].totalSpent))}
              {comparison[0].totalSpent > comparison[1].totalSpent ? " more" : " less"}
            </strong>{" "}
            than <strong className="text-foreground">{comparison[1].tracker.name}</strong>
            {comparison[1].totalSpent > 0 && (
              <span> ({(((comparison[0].totalSpent - comparison[1].totalSpent) / comparison[1].totalSpent) * 100).toFixed(0)}% diff)</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
