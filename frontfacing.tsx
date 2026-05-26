import { useState, useEffect, useCallback, type CSSProperties } from "react";

const C = {
  forest: "#1B5E20", forestLight: "#2E7D32", forestDark: "#082014",
  gold: "#C9A84C", goldLight: "#F2B705",
  charcoal: "#1C1C2E", dark: "#0A0F0D", darkCard: "#111A14",
  cream: "#F5F5F0", white: "#FFFFFF", muted: "#8A9A8E", border: "#1E2E22",
};

function useWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

function Nav({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  const w = useWidth();
  const mob = w < 768;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const h = () => setScrolled(window.scrollY > 40); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  useEffect(() => { if (!mob) setOpen(false); }, [mob]);
  const links = [
    { id: "how", label: "How It Works" },
    { id: "traders", label: "For Traders" },
    { id: "aggregators", label: "For Aggregators" },
    { id: "protection", label: "Protection" },
    { id: "join", label: "Join" },
  ];
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, transition: "all 0.3s", background: scrolled || open ? "rgba(10,15,13,0.97)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: mob ? "14px 20px" : "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${C.forest}, ${C.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, color: C.white }}>M</div>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 16 : 18, fontWeight: 600, color: C.white, letterSpacing: 1 }}>MIZIBA <span style={{ color: C.gold, fontWeight: 400 }}>TSCF</span></span>
        </div>
        {mob ? (
          <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", color: C.cream, fontSize: 24, cursor: "pointer", padding: 4 }}>{open ? "✕" : "☰"}</button>
        ) : (
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {links.map(l => (
              <a key={l.id} onClick={() => onNav(l.id)} style={{ color: active === l.id ? C.gold : C.muted, fontSize: 13, textDecoration: "none", cursor: "pointer", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500, transition: "color 0.2s", borderBottom: active === l.id ? `2px solid ${C.gold}` : "2px solid transparent", paddingBottom: 2 }}>{l.label}</a>
            ))}
          </div>
        )}
      </div>
      {mob && open && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
          {links.map(l => (
            <a key={l.id} onClick={() => { onNav(l.id); setOpen(false); }} style={{ color: active === l.id ? C.gold : C.cream, fontSize: 15, padding: "12px 0", borderBottom: `1px solid ${C.border}`, textDecoration: "none", cursor: "pointer", letterSpacing: 0.5, fontWeight: 500 }}>{l.label}</a>
          ))}
        </div>
      )}
    </nav>
  );
}

function Hero({ onNav }: { onNav: (id: string) => void }) {
  const w = useWidth();
  const mob = w < 768;
  const tab = w < 1024;
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 100); }, []);
  return (
    <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 20% 50%, ${C.forest}22 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, ${C.gold}11 0%, transparent 50%)` }} />
      {!mob && <div style={{ position: "absolute", top: "10%", right: "-5%", width: 500, height: 500, borderRadius: "50%", border: `1px solid ${C.border}`, opacity: 0.3 }} />}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: mob ? "100px 20px 60px" : "120px 24px 80px", position: "relative", zIndex: 1, width: "100%" }}>
        <div style={{ maxWidth: 720, opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.22, 1, 0.36, 1)" }}>
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 20, border: `1px solid ${C.gold}44`, background: `${C.gold}11`, marginBottom: mob ? 16 : 24 }}>
            <span style={{ fontSize: mob ? 10 : 12, color: C.gold, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>TradeAxis Secured Commodity Finance</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 36 : tab ? 44 : 56, fontWeight: 700, lineHeight: 1.1, color: C.white, margin: "0 0 20px" }}>
            Trade infrastructure<br /><span style={{ color: C.gold }}>that banks trust.</span>
          </h1>
          <p style={{ fontSize: mob ? 15 : 18, lineHeight: 1.7, color: C.muted, maxWidth: 560, margin: "0 0 32px" }}>
            Structured commodity trade finance for agricultural traders in Ghana. Escrow-protected. Waterfall-settled. Bank principal repaid first.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => onNav("join")} style={{ padding: mob ? "12px 24px" : "14px 32px", background: C.gold, color: C.dark, border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: 0.3 }}>Apply to Trade</button>
            <button onClick={() => onNav("how")} style={{ padding: mob ? "12px 24px" : "14px 32px", background: "transparent", color: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 15, fontWeight: 500, cursor: "pointer" }}>How It Works</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, auto)", gap: mob ? 20 : 48, marginTop: mob ? 48 : 80, opacity: vis ? 1 : 0, transition: "opacity 1s 0.4s" }}>
          {[
            { val: "GHS 102M+", label: "Anchor aggregator revenue" },
            { val: "22 days", label: "Average settlement cycle" },
            { val: "15–25%", label: "Annualised bank yield" },
            { val: "10,000+", label: "Registered farmers" },
          ].map((s, i) => (
            <div key={i} style={{ borderLeft: !mob && i > 0 ? `1px solid ${C.border}` : "none", paddingLeft: !mob && i > 0 ? 48 : 0, borderTop: mob && i >= 2 ? `1px solid ${C.border}` : "none", paddingTop: mob && i >= 2 ? 20 : 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 22 : 28, fontWeight: 700, color: C.white }}>{s.val}</div>
              <div style={{ fontSize: mob ? 10 : 12, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const w = useWidth();
  const mob = w < 768;
  const steps = [
    { tier: "Tier 1", title: "Farmers", desc: "Sell commodity at TradePoint hubs. Paid within 2 hours via mobile money from the aggregator's own capital.", icon: "🌾", note: "No bank exposure" },
    { tier: "Tier 2", title: "Aggregators", desc: "Procure, verify, weigh, and load commodity. JNI AGRI is the anchor aggregator with GHS 102M+ audited revenue.", icon: "⚖️", note: "Supplies commodity" },
    { tier: "Tier 3", title: "Traders", desc: "Independent traders hold the offtake contract and apply for TSCF financing. Deposit 35% cash equity. Receive the bank's 65% facility.", icon: "📋", note: "Bank's borrower", highlight: true },
    { tier: "Tier 4", title: "Offtakers", desc: "Processors and exporters purchase commodity under confirmed contracts. Payment triggers the waterfall — bank repaid first.", icon: "🏭", note: "Triggers settlement" },
  ];
  return (
    <section id="how" style={{ padding: mob ? "64px 20px" : "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: mob ? 40 : 64 }}>
        <span style={{ fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Value Chain</span>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 28 : 40, fontWeight: 700, color: C.white, margin: "12px 0 16px" }}>How TSCF Works</h2>
        <p style={{ fontSize: mob ? 14 : 16, color: C.muted, maxWidth: 520, margin: "0 auto" }}>Four tiers. Clean role separation. Bank capital enters only at loading confirmation and exits through the atomic waterfall.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : w < 1024 ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ background: C.darkCard, borderRadius: 12, padding: mob ? 20 : 28, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.highlight ? C.gold : C.forest }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: C.gold, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{s.tier}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.white, margin: "0 0 6px", fontFamily: "'Playfair Display', serif" }}>{s.title}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: C.muted, margin: "0 0 12px" }}>{s.desc}</p>
            <div style={{ display: "inline-block", padding: "4px 10px", borderRadius: 4, background: s.highlight ? `${C.gold}22` : `${C.forest}33`, fontSize: 11, color: s.highlight ? C.gold : C.forestLight, fontWeight: 600 }}>{s.note}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 28, padding: mob ? "14px 16px" : "20px 32px", background: `${C.forest}22`, borderRadius: 10, border: `1px solid ${C.forest}44` }}>
        <span style={{ fontSize: mob ? 12 : 14, color: C.gold, fontWeight: 600, lineHeight: 1.6 }}>Bank → Escrow → Aggregator (upon loading) → Commodity in transit → Offtaker pays → Waterfall → Bank repaid first</span>
      </div>
    </section>
  );
}

function BenefitGrid({ benefits, mob }: { benefits: { title: string; desc: string }[]; mob: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
      {benefits.map((b, i) => (
        <div key={i} style={{ padding: mob ? 16 : 20, background: C.darkCard, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: C.white, margin: "0 0 4px" }}>{b.title}</h4>
          <p style={{ fontSize: 13, lineHeight: 1.5, color: C.muted, margin: 0 }}>{b.desc}</p>
        </div>
      ))}
    </div>
  );
}

function ForTraders() {
  const w = useWidth();
  const mob = w < 768;
  const benefits = [
    { title: "Access Bank Finance", desc: "Receive 65% of trade capital from a licensed bank through Miziba's structured facility." },
    { title: "Short Tenor", desc: "15–30 day trades. Fast capital cycles mean more trades per season." },
    { title: "Pre-Qualified Buyers", desc: "Trade against verified offtake contracts with pre-screened buyers." },
    { title: "Transparent Settlement", desc: "Every trade settles through the atomic waterfall. You see exactly what you earn." },
  ];
  const reqs = ["Confirmed offtake contract with a pre-qualified buyer", "35% cash equity for each trade", "Completed KYC through TradeAxis", "Valid business registration in Ghana"];
  return (
    <section id="traders" style={{ padding: mob ? "64px 20px" : "100px 24px", background: `linear-gradient(180deg, ${C.dark} 0%, ${C.forestDark} 100%)` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 32 : 64, alignItems: "start" }}>
          <div>
            <span style={{ fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Tier 3 Participant</span>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 28 : 40, fontWeight: 700, color: C.white, margin: "12px 0 16px" }}>For Traders</h2>
            <p style={{ fontSize: mob ? 14 : 16, lineHeight: 1.7, color: C.muted, marginBottom: 24 }}>You hold the offtake contract. You deposit the equity. The bank funds the rest through a structure that protects everyone.</p>
            <BenefitGrid benefits={benefits} mob={mob} />
          </div>
          <div style={{ background: C.darkCard, borderRadius: 16, padding: mob ? 24 : 36, border: `1px solid ${C.border}` }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.white, margin: "0 0 20px", fontFamily: "'Playfair Display', serif" }}>Requirements to Trade</h3>
            {reqs.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: `${C.forest}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ color: C.forestLight, fontSize: 12, fontWeight: 700 }}>✓</span>
                </div>
                <span style={{ fontSize: 14, color: C.cream, lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
            <div style={{ marginTop: 20, padding: 14, background: `${C.gold}11`, borderRadius: 8, border: `1px solid ${C.gold}33` }}>
              <div style={{ fontSize: 11, color: C.gold, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Your Protection</div>
              <div style={{ fontSize: 13, color: C.cream, lineHeight: 1.5 }}>Your 35% equity is at risk only after the bank is fully repaid. The waterfall protects the bank first, then you receive the residual margin.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ForAggregators() {
  const w = useWidth();
  const mob = w < 768;
  const benefits = [
    { title: "Guaranteed Offtake", desc: "Supply loaded commodity to traders with confirmed buyers." },
    { title: "Fast Reimbursement", desc: "Paid from escrow upon loading confirmation. Working capital freed." },
    { title: "Scale Operations", desc: "Access a pipeline of financed traders who need your commodity." },
    { title: "Full Audit Trail", desc: "Every transaction documented with TradePoint verification and TRRs." },
  ];
  return (
    <section id="aggregators" style={{ padding: mob ? "64px 20px" : "100px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 32 : 64, alignItems: "start" }}>
          <div style={{ background: C.darkCard, borderRadius: 16, padding: mob ? 24 : 36, border: `1px solid ${C.border}`, order: mob ? 1 : 1 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.white, margin: "0 0 20px", fontFamily: "'Playfair Display', serif" }}>Anchor Aggregator</h3>
            <div style={{ padding: 16, background: `${C.forest}22`, borderRadius: 10, border: `1px solid ${C.forest}44`, marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: C.forestLight, fontWeight: 600, marginBottom: 2 }}>JNI AGRI Limited</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.white, fontFamily: "'Playfair Display', serif" }}>GHS 102M+</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Audited FY2025 Revenue</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[{ val: "6+", l: "Years" }, { val: "6", l: "Hubs" }, { val: "10K+", l: "Farmers" }, { val: "Zero", l: "Defaults" }].map((s, i) => (
                <div key={i} style={{ padding: 10, background: C.dark, borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: C.gold, fontFamily: "'Playfair Display', serif" }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ order: mob ? 0 : 0 }}>
            <span style={{ fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Tier 2 Participant</span>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 28 : 40, fontWeight: 700, color: C.white, margin: "12px 0 16px" }}>For Aggregators</h2>
            <p style={{ fontSize: mob ? 14 : 16, lineHeight: 1.7, color: C.muted, marginBottom: 24 }}>You procure, verify, and load. The platform connects you to financed traders with confirmed buyers.</p>
            <BenefitGrid benefits={benefits} mob={mob} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Protection() {
  const w = useWidth();
  const mob = w < 768;
  const layers = [
    { n: "1", name: "Offtake Lock", live: true, d: "Confirmed buyer at locked price before capital deployed" },
    { n: "2", name: "Escrow Isolation", live: true, d: "Bank capital ringfenced at Escrow Bank" },
    { n: "3", name: "Equity Cushion", live: true, d: "Trader deposits 35% cash as first-loss" },
    { n: "4", name: "Waterfall Priority", live: true, d: "Bank principal and fee returned first" },
    { n: "5", name: "Real-Time Portal", live: true, d: "GPS tracking, escrow status, settlement" },
    { n: "6", name: "Insurance Stack", live: false, d: "Trade credit + transit + storage insurance" },
    { n: "7", name: "DFI Guarantee", live: false, d: "50–75% partial credit guarantee" },
  ];
  return (
    <section id="protection" style={{ padding: mob ? "64px 20px" : "100px 24px", background: `linear-gradient(180deg, ${C.dark} 0%, ${C.charcoal} 100%)` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: mob ? 32 : 56 }}>
          <span style={{ fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>De-Risking Architecture</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 28 : 40, fontWeight: 700, color: C.white, margin: "12px 0 16px" }}>Multi-Layer Protection</h2>
          <p style={{ fontSize: mob ? 14 : 16, color: C.muted, maxWidth: 480, margin: "0 auto" }}>Every risk has a structural answer. Layers 1–5 are fully operational.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : w < 1024 ? "repeat(4, 1fr)" : "repeat(7, 1fr)", gap: 10 }}>
          {layers.map((l, i) => (
            <div key={i} style={{ background: C.darkCard, borderRadius: 10, padding: mob ? 14 : 20, border: `1px solid ${l.live ? C.forest + "66" : C.gold + "33"}`, textAlign: "center", gridColumn: mob && i === 6 ? "1 / -1" : undefined }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: l.live ? `${C.forest}44` : `${C.gold}22`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: 14, fontWeight: 700, color: l.live ? C.forestLight : C.gold, fontFamily: "'Playfair Display', serif" }}>{l.n}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 4 }}>{l.name}</div>
              <div style={{ fontSize: 11, lineHeight: 1.4, color: C.muted, marginBottom: 8, minHeight: mob ? "auto" : 36 }}>{l.d}</div>
              <div style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, background: l.live ? `${C.forest}44` : `${C.gold}22`, fontSize: 9, color: l.live ? C.forestLight : C.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{l.live ? "Live" : "In Progress"}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function JoinForm() {
  const w = useWidth();
  const mob = w < 768;
  const [role, setRole] = useState("trader");
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", commodity: "", region: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!form.name || !form.company || !form.phone) return;
    setLoading(true);
    try {
      localStorage.setItem(`tscf-${role}-${Date.now()}`, JSON.stringify({ ...form, role, ts: new Date().toISOString() }));
    } catch {
      /* ignore quota / private mode */
    }
    setSubmitted(true); setLoading(false);
  };
  const inp: CSSProperties = { width: "100%", padding: "12px 14px", background: C.dark, border: `1px solid ${C.border}`, borderRadius: 8, color: C.cream, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" };
  const valid = form.name && form.company && form.phone;
  if (submitted) return (
    <section id="join" style={{ padding: mob ? "64px 20px" : "100px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${C.forest}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>✓</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 24 : 32, fontWeight: 700, color: C.white, margin: "0 0 12px" }}>Application Received</h2>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.6 }}>Thank you, {form.name}. We will contact you within 48 hours.</p>
        <button onClick={() => { setSubmitted(false); setForm({ name: "", company: "", phone: "", email: "", commodity: "", region: "", message: "" }); }} style={{ marginTop: 20, padding: "10px 24px", background: "transparent", color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: 8, fontSize: 14, cursor: "pointer" }}>Submit Another</button>
      </div>
    </section>
  );
  return (
    <section id="join" style={{ padding: mob ? "64px 20px" : "100px 24px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: mob ? 28 : 48 }}>
          <span style={{ fontSize: 12, color: C.gold, letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>Get Started</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: mob ? 28 : 40, fontWeight: 700, color: C.white, margin: "12px 0 16px" }}>Join the Platform</h2>
          <p style={{ fontSize: mob ? 14 : 16, color: C.muted }}>Apply as a trader or aggregator. We review every application within 48 hours.</p>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 24, background: C.darkCard, borderRadius: 10, padding: 4, flexDirection: mob ? "column" : "row" }}>
          {[
            { key: "trader", label: "I'm a Trader", sub: "I hold offtake contracts and need trade finance" },
            { key: "aggregator", label: "I'm an Aggregator", sub: "I procure and supply commodity to traders" },
          ].map(r => (
            <button key={r.key} onClick={() => setRole(r.key)} style={{ flex: 1, padding: "14px 16px", background: role === r.key ? C.forest : "transparent", border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: role === r.key ? C.white : C.muted }}>{r.label}</div>
              <div style={{ fontSize: 11, color: role === r.key ? C.cream + "aa" : C.muted + "88", marginTop: 2 }}>{r.sub}</div>
            </button>
          ))}
        </div>
        <div style={{ background: C.darkCard, borderRadius: 16, padding: mob ? 20 : 36, border: `1px solid ${C.border}` }}>
          {[
            [{ l: "Full Name *", k: "name", ph: "Your full name" }, { l: "Company *", k: "company", ph: "Company name" }],
            [{ l: "Phone *", k: "phone", ph: "+233 55 011 1550" }, { l: "Email", k: "email", ph: "you@company.com", t: "email" }],
          ].map((row, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {row.map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>{f.l}</label>
                  <input style={inp} value={form[f.k as keyof typeof form]} onChange={e => setForm({ ...form, [f.k]: e.target.value })} placeholder={f.ph} type={f.t || "text"} />
                </div>
              ))}
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Commodity</label>
              <select style={{ ...inp, appearance: "none" }} value={form.commodity} onChange={e => setForm({ ...form, commodity: e.target.value })}>
                <option value="">Select</option>
                {["Cashew", "Shea", "Sesame", "Sorghum", "Soya", "Multiple"].map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Region</label>
              <select style={{ ...inp, appearance: "none" }} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}>
                <option value="">Select</option>
                {["Northern", "Savannah", "North East", "Upper East", "Upper West", "Bono / Ahafo", "Other"].map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>About your operations</label>
            <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder={role === "trader" ? "Commodities, volumes, current buyers..." : "Sourcing regions, hub locations, farmer network..."} />
          </div>
          <button onClick={handleSubmit} disabled={loading || !valid} style={{ width: "100%", padding: "14px", background: !valid ? C.border : C.gold, color: !valid ? C.muted : C.dark, border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: !valid ? "not-allowed" : "pointer", letterSpacing: 0.3 }}>
            {loading ? "Submitting..." : `Apply as ${role === "trader" ? "Trader" : "Aggregator"}`}
          </button>
          <p style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 10 }}>Fields marked * are required. We respond within 48 hours.</p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const mob = useWidth() < 768;
  return (
    <footer style={{ padding: mob ? "36px 20px 24px" : "48px 24px 32px", borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: mob ? "column" : "row", justifyContent: "space-between", gap: mob ? 24 : 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: `linear-gradient(135deg, ${C.forest}, ${C.gold})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 14, color: C.white }}>M</div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: C.white }}>MIZIBA <span style={{ color: C.gold }}>TSCF</span></span>
          </div>
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 320 }}>Institutionalizing rural trade across West Africa.</p>
        </div>
        <div style={{ textAlign: mob ? "left" : "right" }}>
          <div style={{ fontSize: 13, color: C.cream, fontWeight: 600 }}>Joel NtiAmoah Marfo</div>
          <div style={{ fontSize: 12, color: C.muted }}>Founder & CEO, Miziba Infrastructure Ltd</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>iamjoelmarfo@gmail.com · +233 55 011 1550</div>
        </div>
      </div>
      <div style={{ maxWidth: 1200, margin: "20px auto 0", paddingTop: 16, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: mob ? "column" : "row", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 11, color: C.muted }}>© 2026 Miziba Infrastructure Ltd. All rights reserved.</span>
        <span style={{ fontSize: 11, color: C.muted }}>Accra, Ghana</span>
      </div>
    </footer>
  );
}

export default function TSCFWebsite() {
  const [active, setActive] = useState("");
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { threshold: 0.2 });
    setTimeout(() => document.querySelectorAll("section[id]").forEach(s => obs.observe(s)), 200);
    return () => obs.disconnect();
  }, []);
  const scrollTo = useCallback((id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), []);
  return (
    <div style={{ margin: 0, padding: 0, background: C.dark, color: C.cream, fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Nav active={active} onNav={scrollTo} />
      <Hero onNav={scrollTo} />
      <HowItWorks />
      <ForTraders />
      <ForAggregators />
      <Protection />
      <JoinForm />
      <Footer />
    </div>
  );
}
