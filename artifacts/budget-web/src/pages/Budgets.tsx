import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, PieChart } from "lucide-react";
import {
  useGetBudgetsOverview,
  useListBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  useListCategories,
  getGetBudgetsOverviewQueryKey,
  getListBudgetsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type FormData = { categoryId: number; limitAmount: number; month: string };

function BudgetForm({ categories, initial, onSave, onCancel }: any) {
  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: { categoryId: initial?.categoryId ?? categories[0]?.id ?? 0, limitAmount: initial?.limitAmount ?? 0, month: initial?.month ?? currentMonth() },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
          <select {...register("categoryId", { valueAsNumber: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            {categories.filter((c: any) => c.type === "expense").map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Limit ($)</label>
          <input {...register("limitAmount", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Month (YYYY-MM)</label>
          <input {...register("month")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="2025-01" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Save</button>
      </div>
    </form>
  );
}

export default function Budgets() {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const month = currentMonth();

  const { data: overview } = useGetBudgetsOverview();
  const { data: allBudgets } = useListBudgets({ month });
  const { data: categories } = useListCategories();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetBudgetsOverviewQueryKey() });
    qc.invalidateQueries({ queryKey: getListBudgetsQueryKey({ month }) });
  };

  const handleCreate = (d: FormData) => {
    createBudget.mutate({ data: d }, { onSuccess: () => { invalidate(); setAdding(false); } });
  };

  const handleUpdate = (id: number, d: Partial<FormData>) => {
    updateBudget.mutate({ id, data: d }, { onSuccess: () => { invalidate(); setEditing(null); } });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this budget?")) deleteBudget.mutate({ id }, { onSuccess: invalidate });
  };

  const totalBudget = overview?.reduce((s, b) => s + b.limitAmount, 0) ?? 0;
  const totalSpent = overview?.reduce((s, b) => s + b.spentAmount, 0) ?? 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Budgets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fmt(totalSpent)} spent of {fmt(totalBudget)} budget this month
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> Add Budget
        </button>
      </div>

      {/* Overall progress */}
      {totalBudget > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Overall Budget</span>
            <span className="text-sm text-muted-foreground">{((totalSpent / totalBudget) * 100).toFixed(0)}% used</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalSpent / totalBudget) * 100)}%` }}
              transition={{ duration: 0.6 }}
              className={`h-full rounded-full ${(totalSpent / totalBudget) >= 0.9 ? "bg-red-500" : (totalSpent / totalBudget) >= 0.7 ? "bg-amber-500" : "bg-primary"}`}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{fmt(totalSpent)} spent</span>
            <span>{fmt(totalBudget - totalSpent)} remaining</span>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <BudgetForm categories={categories ?? []} onSave={handleCreate} onCancel={() => setAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {overview?.map((b, i) => {
          const budget = allBudgets?.find(ab => ab.id === b.id);
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-card border border-card-border rounded-xl p-5"
            >
              {editing === b.id ? (
                <BudgetForm
                  categories={categories ?? []}
                  initial={{ categoryId: b.categoryId, limitAmount: b.limitAmount, month: b.month }}
                  onSave={(d: FormData) => handleUpdate(b.id, d)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold"
                        style={{ background: `${b.categoryColor ?? "#10b981"}20`, color: b.categoryColor ?? "#10b981" }}
                      >
                        {b.categoryIcon ?? b.categoryName?.charAt(0) ?? "B"}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{b.categoryName ?? "Budget"}</p>
                        <p className="text-xs text-muted-foreground">{b.month}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${b.percentUsed >= 90 ? "bg-red-100 text-red-600" : b.percentUsed >= 70 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-700"}`}>
                        {b.percentUsed.toFixed(0)}%
                      </span>
                      <button onClick={() => setEditing(b.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.percentUsed}%` }}
                      transition={{ delay: 0.2 + i * 0.07, duration: 0.5 }}
                      className={`h-full rounded-full ${b.percentUsed >= 90 ? "bg-red-500" : b.percentUsed >= 70 ? "bg-amber-500" : "bg-primary"}`}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{fmt(b.spentAmount)} spent</span>
                    <span className={b.remainingAmount < 0 ? "text-red-500 font-medium" : ""}>{fmt(b.remainingAmount)} remaining of {fmt(b.limitAmount)}</span>
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {(!overview || overview.length === 0) && !adding && (
        <div className="text-center py-16 text-muted-foreground">
          <PieChart size={40} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="font-medium text-foreground">No budgets set for {month}</p>
          <p className="text-sm mt-1">Create a budget to track your spending by category</p>
        </div>
      )}
    </div>
  );
}
