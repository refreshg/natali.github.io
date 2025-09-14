
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Calendar, Clock, Scissors, User, ChevronRight, ChevronLeft, Phone, Globe, XCircle, Image as PictureIcon } from "lucide-react";

const SALON = {
  name: "Beauty Salon Natali",
  hours: "Every day 10:00 - 20:00",
  address: "Zakaria Paliashvili Street, 56, Tbilisi",
  phone: "+995 555 80-00-02",
  site: "https://www.natali.ge",
  heroImage:
    "https://images.unsplash.com/photo-1556228720-1932b6b4f4d2?auto=format&fit=crop&w=1400&q=60",
};

const BITRIX_WEBHOOK_URL = "";
const DEMO_MODE = !BITRIX_WEBHOOK_URL;

const SERVICES = [
  { id: "haircut", name: "Haircut", icon: Scissors, duration: 45, price: 50 },
  { id: "color", name: "Hair coloring", icon: Scissors, duration: 120, price: 180 },
  { id: "manicure", name: "Manicure", icon: Scissors, duration: 60, price: 70 },
  { id: "pedicure", name: "Pedicure", icon: Scissors, duration: 75, price: 90 },
];

const MASTERS = [
  { id: "nino", name: "Nino", roles: ["Stylist"], rating: 4.9 },
  { id: "dato", name: "Dato", roles: ["Stylist"], rating: 4.8 },
  { id: "mariam", name: "Mariam", roles: ["Nails"], rating: 4.9 },
];

const TIME_SLOTS = [
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];

const UNAVAILABLE = {
  nino: {
    byDate: { "2025-09-14": ["12:00", "12:30"] },
    byWeekday: { 1: ["10:00"] },
    default: ["15:30"],
  },
  dato: {
    byWeekday: { 6: ["17:00", "17:30"] },
  },
  mariam: { },
};

function getBlockedSlots(masterId, dateISO) {
  const rule = UNAVAILABLE[masterId];
  if (!rule) return [];
  const out = new Set();
  if (rule.default) rule.default.forEach((t) => out.add(t));
  const d = new Date(dateISO + "T00:00:00");
  if (!isNaN(d.getTime()) && rule.byWeekday && rule.byWeekday[d.getDay()]) {
    rule.byWeekday[d.getDay()].forEach((t) => out.add(t));
  }
  if (rule.byDate && rule.byDate[dateISO]) {
    rule.byDate[dateISO].forEach((t) => out.add(t));
  }
  return Array.from(out).filter((t) => TIME_SLOTS.includes(t)).sort();
}

const STEP_LABELS = ["Service", "Master", "Date/Time", "Contact", "Confirm"];

function canProceed(step, state) {
  const { serviceId, masterId, date, time, name, phone, agree } = state;
  if (step === 0) return !!serviceId;
  if (step === 1) return !!masterId;
  if (step === 2) return !!date && !!time;
  if (step === 3) return name.trim().length > 1 && phone.trim().length >= 8 && agree;
  return true;
}

const ROLE_BY_SERVICE = {
  haircut: "Stylist",
  color: "Stylist",
  manicure: "Nails",
  pedicure: "Nails",
};

function filterMastersForService(serviceId) {
  const need = ROLE_BY_SERVICE[serviceId];
  if (!need) return MASTERS;
  return MASTERS.filter((m) => m.roles.includes(need));
}

export default function SalonBookingLanding() {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [masterId, setMasterId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [agree, setAgree] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const service = useMemo(() => SERVICES.find((s) => s.id === serviceId) || null, [serviceId]);
  const filteredMasters = useMemo(() => (service ? filterMastersForService(service.id) : MASTERS), [service]);
  const master = useMemo(() => MASTERS.find((m) => m.id === masterId) || null, [masterId]);

  const blocked = useMemo(() => getBlockedSlots(masterId, date), [masterId, date]);

  useEffect(() => {
    if (time && blocked.includes(time)) setTime("");
  }, [masterId, date]);

  useEffect(() => {
    if (masterId && !filteredMasters.some((m) => m.id === masterId)) {
      setMasterId("");
    }
  }, [serviceId]);

  const canNext = useMemo(
    () => canProceed(step, { serviceId, masterId, date, time, name, phone, agree }),
    [step, serviceId, masterId, date, time, name, phone, agree]
  );

  function next() { setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1)); }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  async function submit() {
    setSending(true);
    setError("");
    try {
      if (DEMO_MODE) {
        await new Promise((r) => setTimeout(r, 700));
        setSent(true);
        setStep(STEP_LABELS.length - 1);
        return;
      }
      const payload = {
        fields: {
          TITLE: `Online Booking: ${service?.name || "Service"} — ${date} ${time}`,
          NAME: name,
          PHONE: [{ VALUE: phone, VALUE_TYPE: "WORK" }],
          COMMENTS: [
            `Service: ${service?.name} (${service?.duration || "?"} min / ${service?.price || "?"} GEL)`,
            `Master: ${master?.name || "Unassigned"}`,
            `When: ${date} ${time}`,
            comment ? `Note: ${comment}` : null,
          ].filter(Boolean).join("\\n"),
          SOURCE_ID: "WEB",
          UF_CRM_BOOKING_DATE: date,
          UF_CRM_BOOKING_TIME: time,
          UF_CRM_BOOKING_SERVICE: service?.name || "",
          UF_CRM_BOOKING_MASTER: master?.name || "",
        },
      };
      const res = await fetch(BITRIX_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSent(true);
      setStep(STEP_LABELS.length - 1);
    } catch (e) {
      console.error(e);
      setError("Could not reach Bitrix webhook (network/URL). Check BITRIX_WEBHOOK_URL or keep Demo Mode.");
    } finally {
      setSending(false);
    }
  }

  const siteHost = (() => { try { return new URL(SALON.site).host; } catch { return SALON.site; } })();

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white text-slate-900">
      <section className="bg-gradient-to-r from-pink-100 to-rose-100 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-6 grid md:grid-cols-2 gap-6 items-center">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-pink-500 text-white grid place-items-center font-bold text-lg shadow-md">N</div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold leading-tight text-pink-800">{SALON.name}</h2>
              <p className="text-slate-700 mt-1">{SALON.hours}</p>
              <p className="text-slate-600 text-sm">{SALON.address}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-700">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-pink-600"/> {SALON.phone}</div>
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-pink-600"/> <a href={SALON.site} target="_blank" className="text-pink-700 font-medium hover:underline">{siteHost}</a></div>
            {DEMO_MODE && (<div className="inline-flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg w-max"><span>Demo Mode</span></div>)}
          </div>
        </div>
      </section>

      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/60 border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">SB</div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Salon Booking</h1>
              <p className="text-xs text-slate-500 -mt-0.5">Online booking for a beauty salon</p>
            </div>
          </div>
          <a href="#book" className="hidden md:inline-flex"><Button className="rounded-2xl px-4 bg-rose-600 hover:bg-rose-700 text-white">Book now</Button></a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight text-pink-800">Pick a service and start</h2>
            <p className="mt-3 text-slate-700">Choose the procedure, then select a master, date and time.</p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {SERVICES.map((s) => (
                <button key={s.id}
                  className={["text-left rounded-2xl border transition p-4 hover:shadow-lg", serviceId === s.id ? "border-pink-600 bg-pink-50" : "border-slate-200 bg-white"].join(" ")}
                  onClick={() => { setServiceId(s.id); setMasterId(""); setStep(1); setTimeout(() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" }), 0); }}>
                  <div className="flex items-center gap-2"><s.icon className="h-5 w-5 text-pink-600"/><div className="font-medium text-slate-900">{s.name}</div></div>
                  <div className="mt-1 text-sm text-slate-600">{s.duration} min • {s.price} GEL</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-pink-800"><PictureIcon className="h-5 w-5 text-pink-600"/> Our space</h3>
            <PhotoCard src={SALON.heroImage} caption={SALON.address} href={SALON.site} />
          </div>
        </div>
      </section>

      <section id="book" className="mx-auto max-w-5xl px-4 py-10">
        <Progress current={step} labels={STEP_LABELS} />

        <div className="mt-6">
          {step === 0 && (
            <Card className="rounded-3xl border-slate-200">
              <CardContent className="p-5">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><Scissors className="h-5 w-5"/> Choose a service</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SERVICES.map((s) => (
                    <button key={s.id} className={["text-left rounded-2xl border transition p-4 hover:shadow-sm", serviceId === s.id ? "border-rose-600 bg-rose-50" : "border-slate-200 bg-white"].join(" ")} onClick={() => setServiceId(s.id)}>
                      <div className="flex items-center gap-3"><s.icon className="h-5 w-5 text-rose-600"/><div className="font-medium">{s.name}</div></div>
                      <div className="mt-2 text-sm text-slate-600">{s.duration} min • {s.price} GEL</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 text-right"><Button className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setStep(1)} disabled={!serviceId}>Next <ChevronRight className="h-4 w-4 ml-1"/></Button></div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="rounded-3xl border-slate-200">
              <CardContent className="p-5">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><User className="h-5 w-5"/> Choose a master</h3>
                {filteredMasters.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMasters.map((m) => (
                      <button key={m.id} className={["text-left rounded-2xl border transition p-4 hover:shadow-sm", masterId === m.id ? "border-rose-600 bg-rose-50" : "border-slate-200 bg-white"].join(" ")} onClick={() => setMasterId(m.id)}>
                        <div className="flex items-center justify-between"><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">★ {m.rating}</div></div>
                        <div className="mt-1 text-sm text-slate-600">{m.roles.join(", ")}</div>
                      </button>
                    ))}
                  </div>
                ) : (<div className="text-sm text-slate-600">No available master for the selected service. Please choose another service.</div>)}
                <div className="mt-4 flex items-center justify-between"><Button variant="outline" className="rounded-2xl border-rose-200 text-rose-700" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1"/> Back</Button><Button className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white" onClick={next} disabled={!masterId}>Next <ChevronRight className="h-4 w-4 ml-1"/></Button></div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="rounded-3xl border-slate-200">
              <CardContent className="p-5">
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><Calendar className="h-5 w-5"/> Date & time</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="text-sm text-slate-600">Pick a date</label>
                    <input type="date" min={new Date().toISOString().split("T")[0]} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-slate-600 flex items-center gap-2"><Clock className="h-4 w-4"/> Available time</label>
                    <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {TIME_SLOTS.map((t) => {
                        const isDisabled = blocked.includes(t);
                        const base = "rounded-xl border px-3 py-2 text-sm";
                        const active = "border-rose-600 bg-rose-50";
                        const idle = "border-slate-200 bg-white hover:shadow-sm";
                        const disabled = "border-slate-200 bg-slate-100 opacity-50 cursor-not-allowed line-through";
                        return (
                          <button key={t} disabled={isDisabled} title={isDisabled ? "Not available for selected master" : undefined}
                            onClick={() => !isDisabled && setTime(t)} className={[base, time === t ? active : isDisabled ? disabled : idle].join(" ")}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between"><Button variant="outline" className="rounded-2xl border-rose-200 text-rose-700" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1"/> Back</Button><Button className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white" onClick={next} disabled={!date || !time}>Next <ChevronRight className="h-4 w-4 ml-1"/></Button></div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="rounded-3xl border-slate-200">
              <CardContent className="p-5">
                <h3 className="text-xl font-semibold mb-3">Contact info</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="text-sm text-slate-600">Name</label><input type="text" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
                  <div><label className="text-sm text-slate-600">Phone</label><input type="tel" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="558 123 456" /></div>
                  <div className="md:col-span-2"><label className="text-sm text-slate-600">Note (optional)</label><textarea className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-600" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. any preferences" /></div>
                  <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={agree} onChange={(e)=>setAgree(e.target.checked)} className="rounded" /> I agree to the processing of my personal data</label>
                </div>
                <div className="mt-4 flex items-center justify-between"><Button variant="outline" className="rounded-2xl border-rose-200 text-rose-700" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1"/> Back</Button><Button className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white" onClick={next} disabled={!name || phone.trim().length < 8 || !agree}>Next <ChevronRight className="h-4 w-4 ml-1"/></Button></div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="rounded-3xl border-slate-200">
              <CardContent className="p-5">
                <h3 className="text-xl font-semibold mb-3">Confirm</h3>
                {!sent ? (
                  <div className="space-y-3 text-slate-700">
                    <SummaryRow label="Service" value={`${service?.name || "-"} · ${service?.duration || "?"}min · ${service?.price || "?"} GEL`} />
                    <SummaryRow label="Master" value={master?.name || "Unassigned"} />
                    <SummaryRow label="When" value={`${date || "-"} ${time || ""}`} />
                    <SummaryRow label="Client" value={`${name || "-"} • ${phone || "-"}`} />
                    {comment && <SummaryRow label="Note" value={comment} />}
                    {error && (<div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl p-2"><XCircle className="h-4 w-4"/> {error}</div>)}
                    <div className="pt-2"><Button disabled={sending || !canNext} onClick={submit} className="rounded-2xl px-5 bg-rose-600 hover:bg-rose-700 text-white">{sending ? "Sending..." : "Book"}</Button></div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto h-12 w-12 rounded-full bg-green-100 grid place-items-center"><Check className="h-6 w-6 text-green-700" /></div>
                    <h4 className="mt-4 text-xl font-semibold">Sent successfully!</h4>
                    <p className="text-slate-600 mt-1">We will contact you to confirm. Thank you!</p>
                  </div>
                )}
                <div className="mt-4"><Button variant="outline" className="rounded-2xl border-rose-200 text-rose-700" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1"/> Back</Button></div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {typeof window !== 'undefined' && window.location.hash.includes('#test') && (
        <section className="mx-auto max-w-5xl px-4 pb-10"><TestPanel/></section>
      )}

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">© {new Date().getFullYear()} {SALON.name} • Built with Tailwind + React</footer>
    </div>
  );
}

function Progress({ current, labels }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {labels.map((label, i) => (
        <div key={label} className="flex-1 flex items-center gap-2">
          <div className={["shrink-0 h-9 px-3 rounded-2xl grid place-items-center text-xs font-medium", i <= current ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"].join(" ")}>{i + 1}</div>
          <div className={["text-xs", i <= current ? "text-slate-900" : "text-slate-500"].join(" ")}>{label}</div>
          {i < labels.length - 1 && <div className="flex-1 h-px bg-slate-200"/>}
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="w-28 text-slate-500">{label}</div>
      <div className="flex-1 font-medium text-slate-800">{value}</div>
    </div>
  );
}

function PhotoCard({ src, caption, href }) {
  const open = () => href && window.open(href, "_blank");
  const fallback1 = "https://images.pexels.com/photos/3993447/pexels-photo-3993447.jpeg?auto=compress&cs=tinysrgb&w=1400";
  const fallback2 = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop stop-color='#fde2e8' offset='0'/><stop stop-color='#fff' offset='1'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/><g fill='#b4235a' opacity='0.25'><circle cx='200' cy='200' r='120'/><circle cx='1400' cy='250' r='160'/><circle cx='800' cy='750' r='180'/></g></svg>");
  const [srcIdx, setSrcIdx] = useState(0);
  const options = [src, fallback1, fallback2];
  const onErr = () => setSrcIdx((i) => Math.min(i + 1, options.length - 1));
  return (
    <Card className="rounded-3xl border-slate-200 overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <div className="relative group">
          <img src={options[srcIdx]} alt={caption || "Salon"} className="w-full aspect-[16/9] md:h-[360px] object-cover" onError={onErr} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-sm">
            <div className="font-medium drop-shadow-sm">{caption}</div>
            {href && (<button onClick={open} className="rounded-xl bg-white/90 text-rose-700 border border-rose-200 px-3 py-1 text-xs">Visit site</button>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TestPanel() {
  const results = [];
  const hairMasters = filterMastersForService("haircut").map((m) => m.id).sort().join(",");
  results.push({ name: "Haircut shows stylist masters", pass: hairMasters === ["dato", "nino"].sort().join(",") });
  const maniMasters = filterMastersForService("manicure").map((m) => m.id).join(",");
  results.push({ name: "Manicure shows nail master", pass: maniMasters === "mariam" });
  const base = { serviceId: "", masterId: "", date: "2025-09-14", time: "12:00", name: "Ana", phone: "55555555", agree: true };
  results.push({ name: "Cannot proceed step0 w/o service", pass: canProceed(0, base) === false });
  results.push({ name: "Proceed step0 with service", pass: canProceed(0, { ...base, serviceId: "haircut" }) === true });
  results.push({ name: "Cannot proceed step1 w/o master", pass: canProceed(1, { ...base, serviceId: "haircut" }) === false });
  results.push({ name: "Proceed step1 with master", pass: canProceed(1, { ...base, serviceId: "haircut", masterId: "nino" }) === true });
  const blocks = getBlockedSlots("nino", "2025-09-14");
  results.push({ name: "Nino has 12:00 blocked on 2025-09-14", pass: blocks.includes("12:00") });
  results.push({ name: "Nino default 15:30 blocked", pass: blocks.includes("15:30") });
  const validPhoto = typeof SALON.heroImage === 'string' && /^(https?:\\/\\/|\\/)\\S+/.test(SALON.heroImage);
  results.push({ name: "Hero image URL looks valid", pass: validPhoto });
  return (
    <Card className="rounded-2xl border-slate-200">
      <CardContent className="p-4">
        <div className="text-sm font-semibold mb-2">Self Tests</div>
        <ul className="space-y-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className={`flex items-center gap-2 ${r.pass ? 'text-green-700' : 'text-red-700'}`}>
              {r.pass ? <Check className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}<span>{r.name}</span>
            </li>
          ))}
        </ul>
        <div className="text-xs text-slate-500 mt-2">Open the page with #test to see these checks.</div>
      </CardContent>
    </Card>
  );
}
