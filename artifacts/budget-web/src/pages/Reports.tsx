import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, ChevronDown } from "lucide-react";
import { useGetCashFlow, useGetSpendingByCategory } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
} from "recharts";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function last6Months(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    return { value, label };
  });
}

function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const months = last6Months();
  const selected = months.find((m) => m.value === value) ?? months[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-sm hover:bg-muted transition-colors"
      >
        {selected.label}
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
          {months.map((m) => (
            <button
              key={m.value}
              onClick={() => { onChange(m.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${m.value === value ? "font-semibold text-primary" : "text-foreground"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NetWorthPoint { month: string; netWorth: number }
interface IncomeExpensePoint { month: string; income: number; expenses: number; net: number }

function useNetWorth() {
  const [data, setData] = useState<NetWorthPoint[] | null>(null);
  useEffect(() => {
    fetch(`${BASE}/api/reports/net-worth`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);
  return data;
}

function useIncomeExpense(months = 6) {
  const [data, setData] = useState<IncomeExpensePoint[] | null>(null);
  useEffect(() => {
    fetch(`${BASE}/api/reports/income-expense?months=${months}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setData(d))
      .catch(() => {});
  }, [months]);
  return data;
}

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const { data: cashFlow } = useGetCashFlow();
  const { data: byCategory } = useGetSpendingByCategory({ month: selectedMonth });
  const netWorth = useNetWorth();
  const incomeExpense = useIncomeExpense(6);

  const monthLabel = last6Months().find((m) => m.value === selectedMonth)?.label ?? selectedMonth;

  const nwMin = netWorth ? Math.min(...netWorth.map((d) => d.netWorth)) * 0.97 : 0;
  const nwMax = netWorth ? Math.max(...netWorth.map((d) => d.netWorth)) * 1.02 : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visual breakdown of your financial activity</p>
        </div>
        <div className="flex-shrink-0 self-start">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </motion.div>

      {/* Row 1 — Cash flow + net savings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Income vs Expenses</h2>
          <p className="text-xs text-muted-foreground mb-4">Last 6 months</p>
          {cashFlow && cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={cashFlow} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Net Savings Trend</h2>
          <p className="text-xs text-muted-foreground mb-4">Monthly income minus expenses</p>
          {cashFlow && cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cashFlow} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} name="Net" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        {/* Spending by Category Pie */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Spending by Category</h2>
          <p className="text-xs text-muted-foreground mb-4">{monthLabel}</p>
          {byCategory && byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="totalAmount" nameKey="categoryName" strokeWidth={0}>
                  {byCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.categoryColor ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        {/* Category Breakdown Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Category Breakdown</h2>
          <p className="text-xs text-muted-foreground mb-4">{monthLabel}: sorted by spend</p>
          {byCategory && byCategory.length > 0 ? (
            <div className="space-y-3">
              {byCategory.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.categoryColor ?? COLORS[i % COLORS.length] }} />
                      <span className="text-foreground font-medium">{c.categoryName ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{c.transactionCount} txns</span>
                      <span className="font-semibold text-foreground">{fmt(c.totalAmount)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.percentage}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ background: c.categoryColor ?? COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart />
          )}
        </motion.div>
      </div>

      {/* Row 2 — Net Worth area chart (full width) */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-card-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-1">Net Worth Over Time</h2>
        <p className="text-xs text-muted-foreground mb-4">Estimated monthly net worth: current account balances projected backwards</p>
        {netWorth && netWorth.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={netWorth} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2F4842" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2F4842" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                domain={[nwMin, nwMax]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={52}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [fmt(v), "Net Worth"]}
              />
              <Area type="monotone" dataKey="netWorth" stroke="#2F4842" strokeWidth={2.5} fill="url(#nwGrad)" dot={{ r: 4, fill: "#2F4842" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </motion.div>

      {/* Row 3 — Stacked income/expense grouped by month + savings rate sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Monthly Cash Summary</h2>
          <p className="text-xs text-muted-foreground mb-4">Income, expenses and net: last 6 months</p>
          {incomeExpense && incomeExpense.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-4 text-xs text-muted-foreground font-medium pb-1 border-b border-border">
                <span>Month</span>
                <span className="text-right">Income</span>
                <span className="text-right">Expenses</span>
                <span className="text-right">Net</span>
              </div>
              {incomeExpense.filter((r) => r.income > 0 || r.expenses > 0).map((row, i) => (
                <div key={i} className="grid grid-cols-4 text-sm py-1 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">{row.month}</span>
                  <span className="text-right text-emerald-600 font-medium">{fmt(row.income)}</span>
                  <span className="text-right text-red-500 font-medium">{fmt(row.expenses)}</span>
                  <span className={`text-right font-semibold ${row.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(row.net)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart />
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-card-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-1">Savings Rate</h2>
          <p className="text-xs text-muted-foreground mb-4">Net divided by income: last 6 months</p>
          {incomeExpense && incomeExpense.filter((r) => r.income > 0).length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={incomeExpense.filter((r) => r.income > 0).map((r) => ({ month: r.month, rate: Math.round((r.net / r.income) * 100) }))}
                margin={{ top: 4, right: 0, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Savings rate"]}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="Savings rate">
                  {incomeExpense.filter((r) => r.income > 0).map((r, i) => (
                    <Cell key={i} fill={r.net / r.income >= 0.4 ? "#10b981" : r.net / r.income >= 0.2 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </motion.div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <BarChart3 size={32} strokeWidth={1.5} />
      <p className="text-sm">No data for this month</p>
      <p className="text-xs">Select a different month above</p>
    </div>
  );
}
