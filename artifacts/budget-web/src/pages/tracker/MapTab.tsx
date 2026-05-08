import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Camera, MapPin, Users } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Point {
  id: number;
  lat: number;
  lng: number;
  title: string;
  address?: string | null;
  amount: number;
  currency: string;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  date: string;
  occurredAt?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  photoUrl?: string | null;
  mood?: string | null;
  items?: Array<{ name: string; qty?: number; price?: number }> | null;
  companions?: string[] | null;
  weather?: { icon?: string; label?: string; temp?: number } | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍴", drinks: "🍷", coffee: "☕", restaurant: "🍽️",
  shopping: "🛍️", groceries: "🛒",
  transport: "🚖", lodging: "🏨", hotel: "🏨",
  activities: "🎟️", entertainment: "🎭",
  default: "📍",
};

function pickEmoji(name?: string | null): string {
  if (!name) return CATEGORY_EMOJI["default"];
  const n = name.toLowerCase();
  for (const k of Object.keys(CATEGORY_EMOJI)) if (n.includes(k)) return CATEGORY_EMOJI[k];
  return CATEGORY_EMOJI["default"];
}

// Hex color whitelist — prevents CSS/HTML injection via user-controlled tracker.color
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
function safeColor(c: string | undefined | null, fallback = "#10b981"): string {
  return c && HEX_RE.test(c) ? c : fallback;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}
function buildIcon(color: string, emoji: string): L.DivIcon {
  const c = safeColor(color);
  const e = escapeHtml(emoji);
  return L.divIcon({
    className: "",
    html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:2.5px solid white;box-shadow:0 3px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:18px;line-height:1;">${e}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function FitToBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 14); return; }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

export default function MapTab({ points, trackerColor, fmtHome }: { points: Point[]; trackerColor: string; fmtHome: (n: number) => string }) {
  const [showPath, setShowPath] = useState(true);
  const [activeDate, setActiveDate] = useState<string | "all">("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredPoints = useMemo(
    () => (activeDate === "all" ? points : points.filter((p) => p.date === activeDate)),
    [points, activeDate],
  );

  const dates = useMemo(() => {
    const set = new Set(points.map((p) => p.date));
    return [...set].sort();
  }, [points]);

  // Build path: order points by occurredAt within each day (or by date if no time)
  const pathByDay = useMemo(() => {
    const result: Array<{ date: string; coords: [number, number][] }> = [];
    for (const d of dates) {
      const dayPoints = points
        .filter((p) => p.date === d)
        .sort((a, b) => {
          const ta = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
          const tb = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
          return ta - tb;
        });
      if (dayPoints.length >= 2) {
        result.push({ date: d, coords: dayPoints.map((p) => [p.lat, p.lng] as [number, number]) });
      }
    }
    return result;
  }, [points, dates]);

  if (points.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-12 text-center">
        <MapPin size={32} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground mb-1">No places on the map yet</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Add transactions with a vendor address (drop a receipt photo and we'll geocode it for you), or pin places manually from the Transactions tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setActiveDate("all")} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${activeDate === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-muted"}`}>
          All days ({points.length})
        </button>
        {dates.map((d) => {
          const count = points.filter((p) => p.date === d).length;
          return (
            <button key={d} onClick={() => setActiveDate(d)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${activeDate === d ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:bg-muted"}`}>
              {new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {count}
            </button>
          );
        })}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={showPath} onChange={(e) => setShowPath(e.target.checked)} className="accent-primary" />
          Show daily path
        </label>
      </div>

      <div ref={containerRef} className="rounded-xl overflow-hidden border border-card-border" style={{ height: 540 }}>
        <MapContainer center={[filteredPoints[0]?.lat ?? 0, filteredPoints[0]?.lng ?? 0]} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToBounds points={filteredPoints} />
          {showPath && pathByDay
            .filter((p) => activeDate === "all" || p.date === activeDate)
            .map((p, i) => (
              <Polyline key={p.date + i} positions={p.coords} pathOptions={{ color: safeColor(trackerColor), weight: 3, opacity: 0.55, dashArray: "6 6" }} />
            ))}
          {filteredPoints.map((p) => {
            const color = p.categoryColor || trackerColor;
            const emoji = pickEmoji(p.categoryName || p.title);
            return (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={buildIcon(color, emoji)}>
                <Popup minWidth={240} maxWidth={300}>
                  <div className="space-y-2">
                    {p.photoUrl && (
                      <img src={p.photoUrl.startsWith("http") ? p.photoUrl : `${BASE}/api/storage${p.photoUrl}`} alt="" className="w-full h-36 object-cover rounded-md" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900">{p.title}</p>
                        {p.address && <p className="text-xs text-gray-500 truncate">{p.address}</p>}
                      </div>
                      {p.mood && <span className="text-xl leading-none">{p.mood}</span>}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{p.occurredAt && ` · ${new Date(p.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}</span>
                      {p.weather?.icon && <span>{p.weather.icon} {p.weather.temp != null ? `${Math.round(p.weather.temp)}°` : ""}</span>}
                    </div>
                    <div className="flex items-baseline justify-between border-t pt-2">
                      <span className="text-xs text-gray-500">{p.categoryName ?? "Spending"}</span>
                      <span className="text-base font-bold" style={{ color }}>{fmtHome(p.amount)}</span>
                    </div>
                    {p.originalAmount && p.originalCurrency && p.originalCurrency !== p.currency && (
                      <p className="text-xs text-gray-500 -mt-1 text-right">{p.originalCurrency} {p.originalAmount.toFixed(2)}</p>
                    )}
                    {p.items && p.items.length > 0 && (
                      <ul className="text-xs text-gray-700 space-y-0.5 border-t pt-2">
                        {p.items.slice(0, 6).map((it, i) => (
                          <li key={i} className="flex justify-between gap-2">
                            <span className="truncate">{it.qty && it.qty > 1 ? `${it.qty}× ` : ""}{it.name}</span>
                            {it.price != null && <span className="text-gray-500">{it.price.toFixed(2)}</span>}
                          </li>
                        ))}
                        {p.items.length > 6 && <li className="text-gray-400">+ {p.items.length - 6} more</li>}
                      </ul>
                    )}
                    {p.companions && p.companions.length > 0 && (
                      <p className="text-xs text-gray-600 flex items-center gap-1.5"><Users size={12} /> {p.companions.join(", ")}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
