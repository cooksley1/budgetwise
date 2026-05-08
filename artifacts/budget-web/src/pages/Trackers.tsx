import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Plane, Coffee, Hammer, Heart, GraduationCap, Trash2, Calendar, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ICONS: Record<string, React.ReactNode> = {
  plane: <Plane size={18} />,
  coffee: <Coffee size={18} />,
  hammer: <Hammer size={18} />,
  heart: <Heart size={18} />,
  graduationcap: <GraduationCap size={18} />,
};

const ICON_OPTIONS = [
  { key: "plane", label: "Trip" },
  { key: "coffee", label: "Coffee" },
  { key: "hammer", label: "Project" },
  { key: "heart", label: "Family" },
  { key: "graduationcap", label: "Education" },
];

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "NZD", "CAD", "JPY", "SGD", "CHF", "INR"];

interface Tracker {
  id: number;
  name: string;
  type: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  homeCurrency: string;
  foreignCurrency: string | null;
  dailyBudget: number | null;
  color: string;
  icon: string;
  totalSpent: number;
  transactionCount: number;
}

type FormData = {
  name: string;
  type: "trip" | "theme";
  description: string;
  startDate: string;
  endDate: string;
  homeCurrency: string;
  foreignCurrency: string;
  dailyBudget: string;
  color: string;
  icon: string;
};

function TrackerForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const { register, handleSubmit, watch, setValue } = useForm<FormData>({
    defaultValues: {
      name: "",
      type: "trip",
      description: "",
      startDate: "",
      endDate: "",
      homeCurrency: "USD",
      foreignCurrency: "",
      dailyBudget: "",
      color: COLORS[0],
      icon: "plane",
    },
  });
  const [saving, setSaving] = useState(false);
  const watchType = watch("type");
  const watchColor = watch("color");
  const watchIcon = watch("icon");

  const submit = async (data: FormData) => {
    setSaving(true);
    try {
      await fetch(`${BASE}/api/trackers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          description: data.description || null,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          homeCurrency: data.homeCurrency,
          foreignCurrency: data.foreignCurrency || null,
          dailyBudget: data.dailyBudget ? parseFloat(data.dailyBudget) : null,
          color: data.color,
          icon: data.icon,
        }),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4 p-4 bg-muted/40 rounded-xl border border-border">
      {/* Type selector */}
      <div className="grid grid-cols-2 gap-2">
        {["trip", "theme"].map((t) => (
          <label key={t} className={`cursor-pointer p-3 rounded-lg border-2 text-center text-sm font-medium transition-colors ${
            watchType === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-border"
          }`}>
            <input type="radio" {...register("type")} value={t} className="sr-only" />
            {t === "trip" ? "🧳 Trip / Event" : "📊 Theme / Recurring"}
            <p className="text-xs font-normal mt-0.5 opacity-75">
              {t === "trip" ? "Time-bounded with dates" : "Ongoing tracking"}
            </p>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
          <input {...register("name", { required: true })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder={watchType === "trip" ? "e.g. Italy holiday" : "e.g. Coffee tracker"} />
        </div>

        {watchType === "trip" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start date</label>
              <input {...register("startDate")} type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">End date</label>
              <input {...register("endDate")} type="date" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            </div>
          </>
        )}

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Home currency</label>
          <select {...register("homeCurrency")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {watchType === "trip" && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Foreign currency</label>
            <select {...register("foreignCurrency")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
              <option value="">— None —</option>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div className={watchType === "trip" ? "col-span-2" : ""}>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {watchType === "trip" ? "Daily budget (optional, in home currency)" : "Monthly target (optional)"}
          </label>
          <input {...register("dailyBudget")} type="number" step="0.01" placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
          <input {...register("description")} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Optional notes" />
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Icon</label>
          <div className="flex gap-2 flex-wrap">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setValue("icon", opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs transition-colors ${
                  watchIcon === opt.key ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-border"
                }`}
              >
                {ICONS[opt.key]} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue("color", c)}
                className={`w-7 h-7 rounded-full transition-transform ${watchColor === c ? "scale-125 ring-2 ring-offset-2 ring-primary" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-medium disabled:opacity-60">
          {saving ? "Creating…" : "Create tracker"}
        </button>
      </div>
    </form>
  );
}

export default function Trackers() {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`${BASE}/api/trackers`);
    setTrackers(await res.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this tracker? Transactions will not be removed, just untagged.")) return;
    await fetch(`${BASE}/api/trackers/${id}`, { method: "DELETE" });
    load();
  };

  const fmt = (n: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);

  const trips = trackers.filter((t) => t.type === "trip");
  const themes = trackers.filter((t) => t.type === "theme");

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Trackers</h1>
          <p className="text-muted-foreground text-sm mt-1">Group spending by trip, event, or recurring theme</p>
        </div>
        <button onClick={() => setAdding(!adding)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New tracker
        </button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <TrackerForm onSave={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading trackers…</div>
      ) : trackers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Plane size={40} strokeWidth={1.5} className="mx-auto mb-3" />
          <p className="font-medium text-foreground">No trackers yet</p>
          <p className="text-sm mt-1">Create your first tracker to start grouping spending</p>
        </div>
      ) : (
        <div className="space-y-6">
          {trips.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Plane size={14} /> Trips & Events
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trips.map((t, i) => <TrackerCard key={t.id} tracker={t} idx={i} onDelete={handleDelete} fmt={fmt} />)}
              </div>
            </section>
          )}
          {themes.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp size={14} /> Themes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {themes.map((t, i) => <TrackerCard key={t.id} tracker={t} idx={i} onDelete={handleDelete} fmt={fmt} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TrackerCard({ tracker, idx, onDelete, fmt }: { tracker: Tracker; idx: number; onDelete: (id: number) => void; fmt: (n: number, c?: string) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className="bg-card border border-card-border rounded-xl p-5 hover:shadow-md transition-shadow group"
    >
      <Link href={`/trackers/${tracker.id}`}>
        <div className="cursor-pointer space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${tracker.color}20`, color: tracker.color }}>
                {ICONS[tracker.icon] ?? <Plane size={18} />}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{tracker.name}</p>
                {tracker.startDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar size={10} />
                    {new Date(tracker.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {tracker.endDate && ` → ${new Date(tracker.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(tracker.id); }}
              aria-label={`Delete tracker ${tracker.name}`}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-opacity"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-2xl font-bold text-foreground">{fmt(tracker.totalSpent, tracker.homeCurrency)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tracker.transactionCount} transaction{tracker.transactionCount !== 1 ? "s" : ""}
              {tracker.foreignCurrency && tracker.foreignCurrency !== tracker.homeCurrency && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{tracker.foreignCurrency} → {tracker.homeCurrency}</span>
              )}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
