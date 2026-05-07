import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { useGetCashFlow, useGetSpendingByCategory } from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function Reports() {
  const { data: cashFlow } = useGetCashFlow();
  const { data: byCategory } = useGetSpendingByCategory({});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Visual breakdown of your financial activity</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Bar Chart */}
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

        {/* Net Savings Line Chart */}
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
          <p className="text-xs text-muted-foreground mb-4">This month</p>
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
          <p className="text-xs text-muted-foreground mb-4">This month — sorted by spend</p>
          {byCategory && byCategory.length > 0 ? (
            <div className="space-y-3">
              {byCategory.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.categoryColor ?? COLORS[i % COLORS.length] }} />
                      <span className="text-foreground font-medium">{c.categoryName}</span>
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
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <BarChart3 size={32} strokeWidth={1.5} />
      <p className="text-sm">No data available yet</p>
      <p className="text-xs">Add transactions to see your reports</p>
    </div>
  );
}
