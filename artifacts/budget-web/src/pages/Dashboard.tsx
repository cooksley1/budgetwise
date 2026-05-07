import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, DollarSign, CreditCard, RefreshCw } from "lucide-react";
import {
  useGetDashboardSummary,
  useListRecentTransactions,
  useGetSpendingByCategory,
  useGetCashFlow,
  useGetBudgetsOverview,
} from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.07, duration: 0.35 },
});

function fmt(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(n);
}

function StatCard({ label, value, sub, icon: Icon, color, i }: any) {
  return (
    <motion.div {...fadeUp(i)} className="bg-card border border-card-border rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <span className="text-2xl font-bold text-foreground tracking-tight">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </motion.div>
  );
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: recent } = useListRecentTransactions();
  const { data: byCategory } = useGetSpendingByCategory({});
  const { data: cashFlow } = useGetCashFlow();
  const { data: budgets } = useGetBudgetsOverview();

  const stats = summary
    ? [
        { label: "Total Balance", value: fmt(summary.totalBalance), icon: Wallet, color: "bg-primary/10 text-primary" },
        { label: "Monthly Income", value: fmt(summary.monthlyIncome), icon: TrendingUp, color: "bg-emerald-100 text-emerald-600", sub: "This month" },
        { label: "Monthly Expenses", value: fmt(summary.monthlyExpenses), icon: TrendingDown, color: "bg-red-100 text-red-500", sub: "This month" },
        { label: "Spendable", value: fmt(summary.spendableAmount), icon: DollarSign, color: "bg-blue-100 text-blue-600", sub: `Savings rate: ${summary.savingsRate.toFixed(1)}%` },
        { label: "Subscriptions", value: fmt(summary.activeSubscriptionsCost, true), icon: RefreshCw, color: "bg-purple-100 text-purple-600", sub: "Monthly cost" },
        { label: "Accounts", value: String(summary.accountCount), icon: CreditCard, color: "bg-amber-100 text-amber-600", sub: `${summary.transactionCount} transactions` },
      ]
    : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <motion.div {...fadeUp(0)}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your financial snapshot for this month</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} i={i + 1} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow */}
        <motion.div {...fadeUp(3)} className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Cash Flow — Last 6 Months</h2>
          {cashFlow && cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashFlow} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmt(v)}
                />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No cash flow data yet</div>
          )}
        </motion.div>

        {/* Spending by Category */}
        <motion.div {...fadeUp(4)} className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Spending by Category</h2>
          {byCategory && byCategory.length > 0 ? (
            <div className="flex gap-4 items-center">
              <PieChart width={160} height={160}>
                <Pie data={byCategory} cx={75} cy={75} innerRadius={50} outerRadius={75} dataKey="totalAmount" strokeWidth={0}>
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={byCategory[i].categoryColor ?? COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-2">
                {byCategory.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.categoryColor ?? COLORS[i % COLORS.length] }} />
                    <span className="text-foreground truncate flex-1">{c.categoryName}</span>
                    <span className="text-muted-foreground text-xs">{c.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No spending data yet</div>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Overview */}
        {budgets && budgets.length > 0 && (
          <motion.div {...fadeUp(5)} className="bg-card border border-card-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Budget Progress</h2>
            <div className="space-y-3">
              {budgets.slice(0, 5).map((b, i) => (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{b.categoryName ?? "Budget"}</span>
                    <span className="text-muted-foreground text-xs">{fmt(b.spentAmount)} / {fmt(b.limitAmount)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.percentUsed}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
                      className={`h-full rounded-full ${b.percentUsed >= 90 ? "bg-red-500" : b.percentUsed >= 70 ? "bg-amber-500" : "bg-primary"}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recent Transactions */}
        <motion.div {...fadeUp(6)} className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Recent Transactions</h2>
          {recent && recent.length > 0 ? (
            <div className="space-y-2">
              {recent.slice(0, 8).map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-3 py-1.5"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: t.categoryColor ? `${t.categoryColor}20` : "hsl(var(--muted))", color: t.categoryColor ?? "hsl(var(--muted-foreground))" }}
                  >
                    {t.categoryIcon ?? "T"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.description ?? "Transaction"}</p>
                    <p className="text-xs text-muted-foreground">{t.categoryName ?? "Uncategorized"} · {t.date}</p>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${t.type === "income" ? "text-emerald-600" : "text-foreground"}`}>
                    {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ArrowLeftRight size={32} strokeWidth={1.5} />
              <p className="text-sm">No transactions yet</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ArrowLeftRight({ size, strokeWidth }: { size: number; strokeWidth: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}
