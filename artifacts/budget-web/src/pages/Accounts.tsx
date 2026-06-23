import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, CreditCard, Banknote, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { useListAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAccountsQueryKey } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";

const ACCOUNT_ICONS: Record<string, React.ReactNode> = {
  checking: <Banknote size={20} />,
  savings: <PiggyBank size={20} />,
  credit: <CreditCard size={20} />,
  investment: <TrendingUp size={20} />,
  cash: <Wallet size={20} />,
};

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type FormData = { name: string; type: "checking" | "savings" | "credit" | "investment" | "cash"; balance: number; color: string; currency: string };

function AccountForm({ initial, onSave, onCancel }: { initial?: Partial<FormData & { id: number }>; onSave: (d: FormData) => void; onCancel: () => void }) {
  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: { name: initial?.name ?? "", type: initial?.type ?? "checking", balance: initial?.balance ?? 0, color: initial?.color ?? COLORS[0], currency: initial?.currency ?? "USD" },
  });
  const color = watch("color");
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Account Name</label>
          <input {...register("name", { required: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="e.g. Main Checking" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
          <select {...register("type")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit Card</option>
            <option value="investment">Investment</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Balance ($)</label>
          <input {...register("balance", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <label key={c} className="cursor-pointer">
                <input type="radio" {...register("color")} value={c} className="sr-only" />
                <div className={`w-6 h-6 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""}`} style={{ background: c }} />
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Save</button>
      </div>
    </form>
  );
}

export default function Accounts() {
  const { data: accounts } = useListAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAccountsQueryKey() });

  const handleCreate = (data: FormData) => {
    createAccount.mutate({ data }, { onSuccess: () => { invalidate(); setAdding(false); } });
  };

  const handleUpdate = (id: number, data: FormData) => {
    updateAccount.mutate({ id, data }, { onSuccess: () => { invalidate(); setEditing(null); } });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this account?")) deleteAccount.mutate({ id }, { onSuccess: invalidate });
  };

  const totalBalance = accounts?.reduce((s, a) => s + a.balance, 0) ?? 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Total balance: <span className="font-semibold text-foreground">{fmt(totalBalance)}</span></p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 self-start">
          <Plus size={15} /> Add account
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <AccountForm onSave={handleCreate} onCancel={() => setAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {accounts?.map((a, i) => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-card border border-card-border rounded-xl p-5"
          >
            {editing === a.id ? (
              <AccountForm initial={a} onSave={(d) => handleUpdate(a.id, d)} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${a.color ?? "#10b981"}20`, color: a.color ?? "#10b981" }}>
                      {ACCOUNT_ICONS[a.type] ?? <Wallet size={20} />}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(a.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className={`text-2xl font-bold ${a.balance < 0 ? "text-red-500" : "text-foreground"}`}>{fmt(a.balance)}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.currency}</p>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {accounts?.length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground">
          <CreditCard size={40} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="font-medium text-foreground">No accounts yet</p>
          <p className="text-sm mt-1">Add your first account to get started</p>
        </div>
      )}
    </div>
  );
}
