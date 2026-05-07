import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Pencil, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Filter } from "lucide-react";
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type TxnForm = { accountId: number; categoryId?: number; amount: number; type: string; description?: string; date: string; isRecurring: boolean };
type Filters = { type: string; categoryId: string; startDate: string; endDate: string };

const TYPE_ICONS: Record<string, React.ReactNode> = {
  income: <ArrowUpRight size={14} className="text-emerald-600" />,
  expense: <ArrowDownRight size={14} className="text-red-500" />,
  transfer: <ArrowLeftRight size={14} className="text-blue-500" />,
};

function TransactionForm({ accounts, categories, initial, onSave, onCancel }: any) {
  const { register, handleSubmit } = useForm<TxnForm>({
    defaultValues: {
      accountId: initial?.accountId ?? accounts[0]?.id ?? 0,
      categoryId: initial?.categoryId ?? undefined,
      amount: initial?.amount ?? 0,
      type: initial?.type ?? "expense",
      description: initial?.description ?? "",
      date: initial?.date ?? new Date().toISOString().split("T")[0],
      isRecurring: initial?.isRecurring ?? false,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <input {...register("description")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="e.g. Grocery run" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ($)</label>
          <input {...register("amount", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
          <select {...register("type")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Account</label>
          <select {...register("accountId", { valueAsNumber: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
          <select {...register("categoryId", { valueAsNumber: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">None</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
          <input {...register("date")} type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div className="flex items-center gap-2 self-end py-2">
          <input {...register("isRecurring")} type="checkbox" id="recurring" className="rounded" />
          <label htmlFor="recurring" className="text-sm text-foreground cursor-pointer">Recurring</label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Save</button>
      </div>
    </form>
  );
}

export default function Transactions() {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ type: "", categoryId: "", startDate: "", endDate: "" });

  const params = {
    type: (filters.type as any) || undefined,
    categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    limit: 100,
    offset: 0,
  };

  const { data } = useListTransactions(params);
  const { data: accounts } = useListAccounts();
  const { data: categories } = useListCategories();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const deleteTxn = useDeleteTransaction();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTransactionsQueryKey(params) });

  const handleCreate = (d: TxnForm) => {
    createTxn.mutate({ data: d }, { onSuccess: () => { invalidate(); setAdding(false); } });
  };

  const handleUpdate = (id: number, d: TxnForm) => {
    updateTxn.mutate({ id, data: d }, { onSuccess: () => { invalidate(); setEditing(null); } });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this transaction?")) deleteTxn.mutate({ id }, { onSuccess: invalidate });
  };

  const transactions = data?.data ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} total transactions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:bg-muted"}`}>
            <Filter size={15} /> Filters
          </button>
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="bg-muted/40 border border-border rounded-xl p-4">
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
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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

        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <TransactionForm accounts={accounts ?? []} categories={categories ?? []} onSave={handleCreate} onCancel={() => setAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {transactions.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="bg-card border border-card-border rounded-xl p-4"
          >
            {editing === t.id ? (
              <TransactionForm
                accounts={accounts ?? []}
                categories={categories ?? []}
                initial={t}
                onSave={(d: TxnForm) => handleUpdate(t.id, d)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: t.categoryColor ? `${t.categoryColor}20` : "hsl(var(--muted))" }}>
                  {TYPE_ICONS[t.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.description || "Transaction"}</p>
                  <p className="text-xs text-muted-foreground">{t.categoryName ?? "Uncategorized"} · {t.accountName} · {t.date}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${t.type === "income" ? "text-emerald-600" : "text-foreground"}`}>
                  {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(t.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil size={13} /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {transactions.length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground">
          <ArrowDownRight size={40} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="font-medium text-foreground">No transactions found</p>
          <p className="text-sm mt-1">Add your first transaction to start tracking</p>
        </div>
      )}
    </div>
  );
}
