import { motion } from "framer-motion";
import { Calendar, MapPin, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface StoryDay {
  date: string;
  total: number;
  count: number;
  weather?: { icon?: string; label?: string; temp?: number } | null;
  items: Array<any>;
}

export default function StoryTab({ story, fmtHome, trackerColor }: { story: StoryDay[]; fmtHome: (n: number) => string; trackerColor: string }) {
  if (story.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-12 text-center">
        <Calendar size={28} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">Your trip story will appear here</p>
        <p className="text-xs text-muted-foreground">Add transactions and photos and we'll build a daily timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {story.map((day, idx) => (
        <motion.div
          key={day.date}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.04 }}
          className="relative"
        >
          {/* Day header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white font-semibold" style={{ background: trackerColor }}>
              <span className="text-[10px] uppercase opacity-90 leading-none">{new Date(day.date).toLocaleDateString(undefined, { month: "short" })}</span>
              <span className="text-lg leading-none mt-0.5">{new Date(day.date).getDate()}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{new Date(day.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {day.weather?.icon && <span>{day.weather.icon} {day.weather.label}{day.weather.temp != null ? `, ${Math.round(day.weather.temp)}°C` : ""}</span>}
                <span>· {day.count} stop{day.count === 1 ? "" : "s"} · <strong className="text-foreground">{fmtHome(day.total)}</strong></span>
              </p>
            </div>
          </div>

          {/* Day items */}
          <div className="ml-4 pl-6 border-l-2 border-dashed border-border space-y-3">
            {day.items.map((it: any) => (
              <div key={it.id} className="bg-card border border-card-border rounded-xl p-3 hover:shadow-sm transition relative">
                <div className="absolute -left-[33px] top-4 w-3 h-3 rounded-full ring-4 ring-background" style={{ background: it.categoryColor || trackerColor }} />
                <div className="flex gap-3">
                  {it.photoUrl && (
                    <img
                      src={it.photoUrl.startsWith("http") ? it.photoUrl : `${BASE}/api/storage${it.photoUrl}`}
                      alt=""
                      className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                          {it.merchant || it.description || "Unnamed"} {it.mood && <span>{it.mood}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {it.occurredAt && <span>{new Date(it.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>}
                          {it.categoryName && <span>· {it.categoryName}</span>}
                          {it.vendorAddress && <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {it.vendorAddress.split(",").slice(0, 2).join(",")}</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{fmtHome(it.amount)}</p>
                        {it.originalAmount && it.originalCurrency && (
                          <p className="text-[10px] text-muted-foreground">{it.originalCurrency} {it.originalAmount.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                    {it.items && it.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {it.items.slice(0, 4).map((line: any, i: number) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {line.qty && line.qty > 1 ? `${line.qty}× ` : ""}{line.name}
                          </span>
                        ))}
                        {it.items.length > 4 && <span className="text-[11px] text-muted-foreground">+{it.items.length - 4}</span>}
                      </div>
                    )}
                    {it.companions && it.companions.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1"><Users size={10} /> {it.companions.join(", ")}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
