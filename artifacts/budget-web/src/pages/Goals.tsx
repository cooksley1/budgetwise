import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Target, CheckCircle } from "lucide-react";
import { useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, getListGoalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type FormData = { name: string; targetAmount: number; currentAmount: number; targetDate?: string; color: string; icon: string };

function GoalForm({ initial, onSave, onCancel }: { initial?: Partial<FormData & { id: number }>; onSave: (d: FormData) => void; onCancel: () => void }) {
  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: { name: initial?.name ?? "", targetAmount: initial?.targetAmount ?? 0, currentAmount: initial?.currentAmount ?? 0, targetDate: initial?.targetDate ?? "", color: initial?.color ?? COLORS[0], icon: initial?.icon ?? "T" },
  });
  const color = watch("color");
  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Goal Name</label>
          <input {...register("name", { required: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="e.g. Emergency Fund" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Target ($)</label>
          <input {...register("targetAmount", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Saved So Far ($)</label>
          <input {...register("currentAmount", { valueAsNumber: true })} type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Target Date (optional)</label>
          <input {...register("targetDate")} type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Icon (letter/emoji)</label>
          <input {...register("icon")} maxLength={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
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

function CircularProgress({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Goals() {
  const { data: goals } = useListGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListGoalsQueryKey() });

  const handleCreate = (data: FormData) => {
    createGoal.mutate({ data }, { onSuccess: () => { invalidate(); setAdding(false); } });
  };

  const handleUpdate = (id: number, data: FormData) => {
    updateGoal.mutate({ id, data }, { onSuccess: () => { invalidate(); setEditing(null); } });
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this goal?")) deleteGoal.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Savings Goals</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track your progress toward financial milestones</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 self-start">
          <Plus size={15} /> Add goal
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <GoalForm onSave={handleCreate} onCancel={() => setAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals?.map((g, i) => (
          <motion.div
            key={g.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={`bg-card border border-card-border rounded-xl p-5 relative overflow-hidden ${g.isCompleted ? "ring-2 ring-emerald-500/30" : ""}`}
          >
            {g.isCompleted && (
              <div className="absolute top-3 right-3 text-emerald-500"><CheckCircle size={18} /></div>
            )}
            {editing === g.id ? (
              <GoalForm
                initial={{ name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate ?? undefined, color: g.color ?? COLORS[0], icon: g.icon ?? "T" }}
                onSave={(d) => handleUpdate(g.id, d)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-semibold" style={{ background: `${g.color ?? COLORS[0]}20`, color: g.color ?? COLORS[0] }}>
                      {g.icon ?? "G"}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm leading-tight">{g.name}</p>
                      {g.targetDate && <p className="text-xs text-muted-foreground">By {g.targetDate}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(g.id)} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(g.id)} className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <CircularProgress pct={g.percentComplete} color={g.color ?? COLORS[0]} />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">{g.percentComplete.toFixed(0)}%</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{fmt(g.currentAmount)}</p>
                    <p className="text-xs text-muted-foreground">of {fmt(g.targetAmount)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(g.targetAmount - g.currentAmount)} remaining</p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {goals?.length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground">
          <Target size={40} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="font-medium text-foreground">No savings goals yet</p>
          <p className="text-sm mt-1">Create your first goal to start saving</p>
        </div>
      )}
    </div>
  );
}
