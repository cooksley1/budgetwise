import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { useListSubscriptions, useCreateSubscription, useUpdateSubscription, useDeleteSubscription, useListCategories, getListSubscriptionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const CYCLE_LABELS: Record<string, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly", annually: "Annually" };
const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

type FormData = { name: string; amount: number; billingCycle: "weekly" | "monthly" | "quarterly" | "annually"; nextBillingDate: string; categoryId?: number; isActive: boolean; color: string };

function SubForm({ initial, onSave, onCancel, categories }: { initial?: Partial<FormData & { id: number }>; onSave: (d: FormData) => void; onCancel: () => void; categories: any[] }) {
  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      name: initial?.name ?? "",
      amount: initial?.amount ?? 0,
      billingCycle: initial?.billingCycle ?? "monthly",
      nextBillingDate: initial?.nextBillingDate ?? new Date().toISOString().split("T")[0],
      categoryId: initial?.categoryId,
      isActive: initial?.isActive ?? true,
      color: initial?.color ?? COLORS[0],
    },
  });
  const color = watch("color");
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Service Name</label>
          <input {...register("name", { required: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="e.g. Netflix" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ($)</label>
          <input {...register("amount", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Billing Cycle</label>
          <select {...register("billingCycle")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Next Billing Date</label>
          <input {...register("nextBillingDate")} type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category (optional)</label>
          <select {...register("categoryId", { valueAsNumber: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="">None</option>
            {categories.filter(c => c.type === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
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

export default function Subscriptions() {
  const { data: subs } = useListSubscriptions();
  const { data: categories } = useListCategories();
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription();
  const deleteSub = useDeleteSubscription();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });

  const handleCreate = (data: FormData) => {
    createSub.mutate({ data }, { onSuccess: () => { invalidate(); setAdding(false); } });
  };

  const handleUpdate = (id: number, data: Partial<FormData>) => {
    updateSub.mutate({ id, data }, { onSuccess: () => { invalidate(); setEditing(null); } });
  };

  const handleToggle = (id: number, current: boolean) => {
    updateSub.mutate({ id, data: { isActive: !current } }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this subscription?")) deleteSub.mutate({ id }, { onSuccess: invalidate });
  };

  const monthlyTotal = subs?.filter(s => s.isActive).reduce((sum, s) => {
    const multipliers: Record<string, number> = { weekly: 4.33, monthly: 1, quarterly: 1 / 3, annually: 1 / 12 };
    return sum + s.amount * (multipliers[s.billingCycle] ?? 1);
  }, 0) ?? 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Monthly cost: <span className="font-semibold text-foreground">{fmt(monthlyTotal)}</span></p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> Add Subscription
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <SubForm onSave={handleCreate} onCancel={() => setAdding(false)} categories={categories ?? []} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {subs?.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-card border border-card-border rounded-xl p-4 ${!s.isActive ? "opacity-50" : ""}`}
          >
            {editing === s.id ? (
              <SubForm
                initial={{ name: s.name, amount: s.amount, billingCycle: s.billingCycle, nextBillingDate: s.nextBillingDate, categoryId: s.categoryId ?? undefined, isActive: s.isActive, color: s.color ?? COLORS[0] }}
                onSave={(d) => handleUpdate(s.id, d)}
                onCancel={() => setEditing(null)}
                categories={categories ?? []}
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: `${s.color ?? COLORS[0]}20`, color: s.color ?? COLORS[0] }}>
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{CYCLE_LABELS[s.billingCycle]} · Next: {s.nextBillingDate}</p>
                </div>
                <p className="font-bold text-foreground">{fmt(s.amount)}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(s.id, s.isActive)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                    {s.isActive ? <ToggleRight size={22} className="text-primary" /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => setEditing(s.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {subs?.length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground">
          <RefreshCw size={40} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="font-medium text-foreground">No subscriptions tracked</p>
          <p className="text-sm mt-1">Add recurring services to track your monthly costs</p>
        </div>
      )}
    </div>
  );
}
