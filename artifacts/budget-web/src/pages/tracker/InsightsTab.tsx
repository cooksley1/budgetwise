import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Award, AlertTriangle, Sparkles, Clock, MapPin, DollarSign, Heart } from "lucide-react";

interface Insights {
  total: number;
  transactionCount: number;
  uniqueVendors: number;
  peakHour: { hour: number; total: number; count: number } | null;
  topVendor: { name: string; total: number; visits: number } | null;
  cheapest: { name: string; amount: number; date: string } | null;
  splurge: { name: string; amount: number; date: string } | null;
  mostVisited: { name: string; visits: number; total: number } | null;
  dccLeak: number | null;
  tipAvgPct: number | null;
  velocity: { spentPerDay: number; projectedTotal: number; budgetTotal: number; daysElapsed: number; daysTotal: number } | null;
  badges: Array<{ emoji: string; title: string; sub: string }>;
}

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

export default function InsightsTab({ data, fmtHome, trackerColor }: { data: Insights; fmtHome: (n: number) => string; trackerColor: string }) {
  if (data.transactionCount === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-12 text-center">
        <Sparkles size={28} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Insights unlock as you spend</p>
        <p className="text-xs text-muted-foreground">Add a few transactions and we'll surface patterns you might miss.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Badges */}
      {data.badges.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Award size={12} /> Achievements</p>
          <div className="flex flex-wrap gap-2">
            {data.badges.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 bg-card border border-card-border rounded-full px-3 py-1.5"
              >
                <span className="text-lg leading-none">{b.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{b.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{b.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Velocity gauge */}
      {data.velocity && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2"><TrendingUp size={14} className="text-primary" /> Daily velocity</p>
            <p className={`text-xs font-medium ${data.velocity.projectedTotal > data.velocity.budgetTotal ? "text-red-500" : "text-emerald-600"}`}>
              {data.velocity.projectedTotal > data.velocity.budgetTotal ? <TrendingDown size={11} className="inline" /> : <TrendingUp size={11} className="inline" />}
              {" "}Projected: {fmtHome(data.velocity.projectedTotal)} / {fmtHome(data.velocity.budgetTotal)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            You're spending {fmtHome(data.velocity.spentPerDay)}/day across {data.velocity.daysElapsed} of {data.velocity.daysTotal} days.
          </p>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (data.velocity.daysElapsed / data.velocity.daysTotal) * 100)}%`, background: `${trackerColor}30` }} />
            <div className={`absolute inset-y-0 left-0 ${data.velocity.projectedTotal > data.velocity.budgetTotal ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (data.total / data.velocity.budgetTotal) * 100)}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>{fmtHome(data.total)} so far</span>
            <span>{fmtHome(data.velocity.budgetTotal)} budget</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.peakHour && (
          <InsightCard icon={<Clock size={14} />} accent="amber" title="Peak spending hour"
            body={<><strong className="text-foreground text-base">{hourLabel(data.peakHour.hour)}–{hourLabel((data.peakHour.hour + 1) % 24)}</strong><span className="block mt-1">{fmtHome(data.peakHour.total)} across {data.peakHour.count} transaction{data.peakHour.count === 1 ? "" : "s"}. Looks like a {data.peakHour.hour < 11 ? "breakfast" : data.peakHour.hour < 15 ? "lunch" : data.peakHour.hour < 19 ? "afternoon" : "dinner / drinks"} habit.</span></>} />
        )}
        {data.topVendor && (
          <InsightCard icon={<MapPin size={14} />} accent="emerald" title="Top vendor"
            body={<><strong className="text-foreground text-base">{data.topVendor.name}</strong><span className="block mt-1">{fmtHome(data.topVendor.total)} over {data.topVendor.visits} visit{data.topVendor.visits === 1 ? "" : "s"}.</span></>} />
        )}
        {data.splurge && (
          <InsightCard icon={<DollarSign size={14} />} accent="violet" title="Biggest splurge"
            body={<><strong className="text-foreground text-base">{data.splurge.name}</strong><span className="block mt-1">{fmtHome(data.splurge.amount)} on {new Date(data.splurge.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</span></>} />
        )}
        {data.cheapest && (
          <InsightCard icon={<Heart size={14} />} accent="cyan" title="Cheapest gem"
            body={<><strong className="text-foreground text-base">{data.cheapest.name}</strong><span className="block mt-1">Just {fmtHome(data.cheapest.amount)} — bargain on {new Date(data.cheapest.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</span></>} />
        )}
        {data.mostVisited && data.mostVisited.visits >= 3 && (
          <InsightCard icon={<Sparkles size={14} />} accent="pink" title="Your local spot"
            body={<><strong className="text-foreground text-base">{data.mostVisited.name}</strong><span className="block mt-1">{data.mostVisited.visits} visits totalling {fmtHome(data.mostVisited.total)}. You've found your favourite.</span></>} />
        )}
        {data.dccLeak && (
          <InsightCard icon={<AlertTriangle size={14} />} accent="red" title="Heads up: card markup"
            body={<><strong className="text-foreground text-base">~{fmtHome(data.dccLeak)} likely lost</strong><span className="block mt-1">Some transactions were charged in your home currency abroad — typically banks add a ~3% markup. Always pay in the local currency at the terminal.</span></>} />
        )}
        {data.tipAvgPct != null && (
          <InsightCard icon={<Sparkles size={14} />} accent="amber" title="Your tipping pattern"
            body={<><strong className="text-foreground text-base">{data.tipAvgPct.toFixed(0)}% average</strong><span className="block mt-1">Across the trip. {data.tipAvgPct > 18 ? "Generous!" : data.tipAvgPct < 8 ? "Lean side." : "Pretty standard."}</span></>} />
        )}
        <InsightCard icon={<MapPin size={14} />} accent="blue" title="Variety"
          body={<><strong className="text-foreground text-base">{data.uniqueVendors} unique places</strong><span className="block mt-1">Across {data.transactionCount} transactions. {data.uniqueVendors / Math.max(1, data.transactionCount) > 0.7 ? "You're an explorer!" : "Some favourites in the mix."}</span></>} />
      </div>
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
};

function InsightCard({ icon, accent, title, body }: { icon: React.ReactNode; accent: string; title: string; body: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${ACCENTS[accent]}`}>{icon}</div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
