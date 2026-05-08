import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Loader2, MapPin, Plus, Trash2, Upload, X, Users, Smile } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  trackerId: number;
  tracker: any;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const MOODS = ["😍", "😋", "🤩", "😊", "😐", "😬", "😩", "🥰", "🍷", "🌅", "🎉"];

export default function HolidayQuickAdd({ trackerId, tracker, open, onClose, onSaved }: Props) {
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorLat, setVendorLat] = useState<number | null>(null);
  const [vendorLng, setVendorLng] = useState<number | null>(null);
  const [geoSuggestions, setGeoSuggestions] = useState<any[]>([]);
  const [geoSearch, setGeoSearch] = useState("");
  const [showGeoDropdown, setShowGeoDropdown] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [originalAmount, setOriginalAmount] = useState<string>("");
  const [originalCurrency, setOriginalCurrency] = useState<string>(tracker?.foreignCurrency ?? "");
  const [tipAmount, setTipAmount] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [items, setItems] = useState<Array<{ name: string; qty: number; price: number }>>([]);
  const [mood, setMood] = useState<string>("");
  const [companions, setCompanions] = useState<string>("");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setPhotoUrl(null); setMerchant(""); setVendorAddress(""); setVendorLat(null); setVendorLng(null);
      setAmount(""); setOriginalAmount(""); setOriginalCurrency(tracker?.foreignCurrency ?? "");
      setTipAmount(""); setDate(tracker?.startDate ?? new Date().toISOString().slice(0, 10));
      setTime(""); setItems([]); setMood(""); setCompanions(""); setDescription("");
      setGeoSearch(""); setGeoSuggestions([]);
    }
  }, [open, tracker]);

  // Load accounts + categories once
  useEffect(() => {
    fetch(`${BASE}/api/accounts`).then((r) => r.json()).then((d) => {
      setAccounts(d);
      if (d.length > 0 && accountId == null) setAccountId(d[0].id);
    });
    fetch(`${BASE}/api/categories`).then((r) => r.json()).then(setCategories);
  }, []);

  // Live geocode search
  useEffect(() => {
    if (!geoSearch.trim() || geoSearch.length < 3) { setGeoSuggestions([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(geoSearch)}`);
      if (r.ok) setGeoSuggestions(await r.json());
    }, 400);
    return () => clearTimeout(t);
  }, [geoSearch]);

  if (!open) return null;

  const handlePhoto = async (file: File) => {
    setScanning(true);
    try {
      // 1) Upload to object storage
      setUploading(true);
      const urlReq = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (urlReq.ok) {
        const { uploadURL, objectPath } = await urlReq.json();
        const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (putRes.ok) {
          setPhotoUrl(objectPath);
        } else {
          // Surface a non-blocking warning; AI scan can still proceed
          console.warn("Photo upload failed", putRes.status);
          alert("Photo upload failed — receipt will be scanned but not attached.");
        }
      }
      setUploading(false);

      // 2) AI scan
      const fd = new FormData();
      fd.append("receipt", file);
      const scan = await fetch(`${BASE}/api/ai/scan-receipt-rich`, { method: "POST", body: fd });
      if (scan.ok) {
        const r = await scan.json();
        if (r.merchant) setMerchant(r.merchant);
        if (r.amount) setAmount(String(r.amount));
        if (r.currency && r.currency !== tracker?.homeCurrency) {
          setOriginalCurrency(r.currency);
          if (r.amount) setOriginalAmount(String(r.amount));
        }
        if (r.tipAmount) setTipAmount(String(r.tipAmount));
        if (r.date) setDate(r.date);
        if (r.time) setTime(r.time);
        if (Array.isArray(r.items) && r.items.length > 0) {
          setItems(r.items.map((it: any) => ({ name: it.name ?? String(it), qty: it.qty ?? 1, price: it.price ?? 0 })));
        }
        if (r.address) {
          setVendorAddress(r.address);
          // auto-geocode
          const q = [r.merchant, r.address, r.city, r.country].filter(Boolean).join(", ");
          const g = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(q)}`);
          if (g.ok) {
            const hits = await g.json();
            if (hits[0]) { setVendorLat(hits[0].lat); setVendorLng(hits[0].lng); }
          }
        } else if (r.merchant && r.city) {
          const g = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(`${r.merchant}, ${r.city}`)}`);
          if (g.ok) {
            const hits = await g.json();
            if (hits[0]) { setVendorLat(hits[0].lat); setVendorLng(hits[0].lng); setVendorAddress(hits[0].display); }
          }
        }
        // Try to match category
        if (r.category && categories.length) {
          const m = categories.find((c) => c.name.toLowerCase().includes(r.category.toLowerCase()));
          if (m) setCategoryId(m.id);
        }
      }
    } finally {
      setScanning(false);
      setUploading(false);
    }
  };

  const pickGeoSuggestion = (g: any) => {
    setVendorLat(g.lat); setVendorLng(g.lng); setVendorAddress(g.display);
    setShowGeoDropdown(false); setGeoSearch("");
  };

  const save = async () => {
    if (!amount || !accountId) return;
    setSaving(true);
    try {
      const occurredAt = time && date ? new Date(`${date}T${time}:00`).toISOString() : null;
      const fxRate = originalAmount && Number(originalAmount) > 0 ? Number(amount) / Number(originalAmount) : null;
      const body: any = {
        amount: Number(amount),
        accountId,
        categoryId,
        date,
        type: "expense",
        description: description || merchant || null,
        merchant: merchant || null,
        vendorAddress: vendorAddress || null,
        vendorLat, vendorLng,
        items: items.length > 0 ? items : null,
        photoUrl,
        mood: mood || null,
        companions: companions ? companions.split(",").map((s) => s.trim()).filter(Boolean) : null,
        occurredAt,
        tipAmount: tipAmount ? Number(tipAmount) : null,
      };
      if (originalAmount && originalCurrency) {
        body.originalAmount = Number(originalAmount);
        body.originalCurrency = originalCurrency;
        body.fxRate = fxRate;
      }
      const r = await fetch(`${BASE}/api/trackers/${trackerId}/quick-add`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (r.ok) { onSaved(); onClose(); }
    } finally { setSaving(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center" onClick={onClose}>
        <motion.div
          initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="bg-background w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-background border-b border-border px-5 py-3 flex items-center justify-between z-10">
            <p className="text-base font-semibold text-foreground">Add a memory</p>
            <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
          </div>

          <div className="p-5 space-y-4">
            {/* Receipt drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition relative overflow-hidden"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handlePhoto(f); }}
            >
              {photoUrl ? (
                <div className="relative">
                  <img src={`${BASE}/api/storage${photoUrl}`} alt="receipt" className="max-h-48 mx-auto rounded-lg" />
                  <button onClick={(e) => { e.stopPropagation(); setPhotoUrl(null); }} aria-label="Remove photo" className="absolute top-1 right-1 bg-white/90 rounded-full p-1"><X size={14} /></button>
                </div>
              ) : scanning ? (
                <div className="py-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  {uploading ? "Uploading…" : "Reading your receipt…"}
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center gap-2">
                  <Camera size={28} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Drop a receipt photo or tap to upload</p>
                  <p className="text-xs text-muted-foreground">We'll fill in the vendor, amount, items and location for you.</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
            </div>

            {/* Vendor + address */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vendor / restaurant">
                <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className="input" placeholder="e.g. Trattoria da Mario" />
              </Field>
              <Field label="Date">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
              </Field>
            </div>

            {/* Address with live geocode search */}
            <div className="relative">
              <Field label="Where? (search a place to pin on the map)">
                <input
                  value={vendorAddress}
                  onChange={(e) => { setVendorAddress(e.target.value); setGeoSearch(e.target.value); setShowGeoDropdown(true); }}
                  onFocus={() => setShowGeoDropdown(true)}
                  className="input pr-9" placeholder="Address, neighbourhood, or landmark"
                />
                {vendorLat && vendorLng && <MapPin size={14} className="absolute right-3 top-9 text-emerald-500" />}
              </Field>
              {showGeoDropdown && geoSuggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {geoSuggestions.map((g, i) => (
                    <button key={i} type="button" onClick={() => pickGeoSuggestion(g)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-xs flex items-start gap-2 border-b border-border last:border-0">
                      <MapPin size={11} className="mt-0.5 text-muted-foreground" />
                      <span className="text-foreground">{g.display}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Amount + currency */}
            <div className="grid grid-cols-3 gap-3">
              <Field label={`Amount (${tracker?.homeCurrency ?? "home"})`}>
                <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0.00" />
              </Field>
              <Field label="Original amount">
                <input type="number" step="0.01" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} className="input" placeholder="optional" />
              </Field>
              <Field label="Currency">
                <input maxLength={3} value={originalCurrency} onChange={(e) => setOriginalCurrency(e.target.value.toUpperCase())} className="input" placeholder="EUR" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Time (optional)">
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
              </Field>
              <Field label="Tip">
                <input type="number" step="0.01" value={tipAmount} onChange={(e) => setTipAmount(e.target.value)} className="input" placeholder="0" />
              </Field>
              <Field label="Account">
                <select value={accountId ?? ""} onChange={(e) => setAccountId(Number(e.target.value))} className="input">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Category">
              <select value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)} className="input">
                <option value="">— pick category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>

            {/* Mood */}
            <Field label={<span className="flex items-center gap-1.5"><Smile size={12} /> How was it?</span>}>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button key={m} type="button" onClick={() => setMood(mood === m ? "" : m)}
                    className={`text-xl w-9 h-9 rounded-lg border transition ${mood === m ? "bg-primary/10 border-primary" : "border-border hover:bg-muted"}`}>{m}</button>
                ))}
              </div>
            </Field>

            {/* Companions */}
            <Field label={<span className="flex items-center gap-1.5"><Users size={12} /> Who were you with? (comma-separated)</span>}>
              <input value={companions} onChange={(e) => setCompanions(e.target.value)} className="input" placeholder="e.g. Sam, Jess" />
            </Field>

            {/* Items list (compact editable) */}
            <Field label="What did you get? (optional)">
              <div className="space-y-1.5">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input value={it.name} onChange={(e) => { const n = [...items]; n[i].name = e.target.value; setItems(n); }} className="input flex-1" placeholder="Item" />
                    <input type="number" min={1} value={it.qty} onChange={(e) => { const n = [...items]; n[i].qty = Number(e.target.value); setItems(n); }} className="input w-16" />
                    <input type="number" step="0.01" value={it.price} onChange={(e) => { const n = [...items]; n[i].price = Number(e.target.value); setItems(n); }} className="input w-24" placeholder="Price" />
                    <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove item" className="px-2 text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setItems([...items, { name: "", qty: 1, price: 0 }])}
                  className="text-xs text-primary font-medium flex items-center gap-1 mt-1"><Plus size={12} /> Add item</button>
              </div>
            </Field>

            <Field label="Notes (optional)">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input resize-none" placeholder="Anything to remember about this?" />
            </Field>
          </div>

          <div className="sticky bottom-0 bg-background border-t border-border px-5 py-3 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border">Cancel</button>
            <button onClick={save} disabled={!amount || !accountId || saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save memory
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}
