/* Payments (#payments). Owned by Builder D. The brand-side sibling of the creator Earnings screen.
   Every total is derived from LLD_DATA.payments in integer paise, never typed in:
     paid in   = Σ escrow rows (every status)        released = Σ release rows        refunds = Σ refund rows
     held      = LLD.heldInEscrow() (escrow rows still 'held')  and  paid in − released − refunds === held (shown as a check).
   Subscription model: no platform fee on any row, the creator receives the agreed price; taxes are "as per confirmed rules".
   Each row downloads a printable invoice (.html via Blob) with the brand's billing details. Plans never show a price.
   React screen (see src/shared/react/view.jsx); the invoice stays an HTML document built as a string. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD,
  esc = L.esc,
  M = () => L.motion;
const D = (window.LLD_D = window.LLD_D || {});
const sum = (rows, f = r => r.amount) => rows.reduce((n, r) => n + f(r), 0);
const camp = id => L.store.s.campaigns.find(c => c.id === id);
const first = n => n.split(" ")[0];
const TODAY = L.today().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const FY_START = (() => {
  const y = +TODAY.slice(0, 4),
    m = +TODAY.slice(5, 7);
  return (m >= 4 ? y : y - 1) + "-04-01";
})();
const addDays = (iso, n) => {
  const d = L.D(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

D.money = () => {
  const p = L.store.s.payments,
    k = x => p.filter(r => r.kind === x);
  const paidIn = sum(k("escrow")),
    released = sum(k("release")),
    refunds = sum(k("refund")),
    held = L.heldInEscrow();
  return {
    paidIn,
    released,
    refunds,
    held,
    spent: paidIn - refunds,
    ok: paidIn - released - refunds === held,
  };
};

/* ---------- labels ---------- */
const releaseOf = r => L.store.s.payments.find(x => x.kind === "release" && x.campaign === r.campaign);
const refundOf = r => L.store.s.payments.find(x => x.kind === "refund" && x.campaign === r.campaign);
const Pill = ({ r }) => {
  if (r.kind === "release")
    return (
      <span className="pill pill-ok">
        <Icon n="check" />
        Paid to creator
      </span>
    );
  if (r.kind === "refund")
    return (
      <span className="pill pill-info">
        <Icon n="refund" />
        Refunded
      </span>
    );
  if (r.status === "held")
    return (
      <span className="pill pill-escrow">
        <Icon n="lock" />
        Held in escrow
      </span>
    );
  if (r.status === "released") {
    const x = releaseOf(r);
    return (
      <span className="pill pill-paper">
        <Icon n="check" />
        {`Released${x ? " " + L.fmtDate(x.date) : ""}`}
      </span>
    );
  }
  if (r.status === "refunded") {
    const x = refundOf(r);
    return (
      <span className="pill pill-paper">
        <Icon n="refund" />
        {`Refunded${x ? " " + L.fmtDate(x.date) : ""}`}
      </span>
    );
  }
  return <span className="pill pill-paper">{r.status}</span>;
};
const KINDL = { escrow: "Paid into escrow", release: "Released to creator", refund: "Refund to you" };
const DOC = { escrow: "Invoice", release: "Release invoice", refund: "Credit note" };
const amt = r => (r.kind === "refund" ? "+" : "") + L.inr(r.amount);
const FILTERS = [
  ["all", "All"],
  ["escrow", "Escrow"],
  ["release", "Released"],
  ["refund", "Refunded"],
];
const RANGES = [
  ["30", "30 days"],
  ["90", "90 days"],
  ["fy", "This FY"],
  ["all", "All time"],
];
const rangeFrom = k =>
  k === "30" ? addDays(TODAY, -30) : k === "90" ? addDays(TODAY, -90) : k === "fy" ? FY_START : null; // Indian FY starts 1 April
const paidIn = k => {
  const from = rangeFrom(k),
    rows = L.store.s.payments.filter(r => r.kind === "release" && (!from || r.date >= from));
  const start = from || rows.reduce((a, r) => (a && a < r.date ? a : r.date), null) || TODAY;
  return {
    total: sum(rows),
    n: rows.length,
    label: `${L.fmtDate(start, { year: start.slice(0, 4) !== TODAY.slice(0, 4) })} – ${L.fmtDate(TODAY, { year: true })}`,
  };
};

/* ---------- the printable invoice (also used by reports and anyone else via LLD_D.invoice) ---------- */
D.invoiceHTML = r => {
  const st = L.store.s,
    me = st.me,
    b = me.billing || {},
    c = camp(r.campaign) || {},
    cr = L.creator(r.creator) || {},
    plan = st.plan;
  const doc = DOC[r.kind] || "Invoice",
    when = L.fmtDate(r.date, { year: true });
  const plat =
    c.platform === "youtube" ? "YouTube" : c.platform === "instagram" ? "Instagram" : c.platform || "";
  const line =
    r.kind === "refund"
      ? `Refund of escrow · ${c.title || ""}`
      : r.kind === "release"
        ? `Released from escrow to ${cr.name || "the creator"} · ${c.title || ""}`
        : `Agreed price, held in escrow · ${c.title || ""}`;
  const totalL =
    r.kind === "refund" ? "Refunded to you" : r.kind === "release" ? "Paid to creator" : "Total paid";
  const note =
    r.kind === "refund"
      ? (c.refundReason || "The escrow was returned to you in full.") +
        " The refund goes back to the original payment method."
      : r.kind === "release"
        ? `Released on your approval. ${cr.name || "The creator"} receives the agreed price in full.`
        : "Linkloom holds this amount in escrow. It is released to the creator only when you approve the delivery, and refunded if the creator rejects after payment or does not deliver.";
  const x = s => esc(s == null ? "" : s);
  const stTxt =
    { held: "Held in escrow", released: "Released", refunded: "Refunded" }[r.status] || r.status || "";
  const stCls = r.status === "released" ? "ok" : r.status === "refunded" ? "butter" : "violet";
  const live = !!L.live;
  /* the date picker's look: a deep-ink card with a violet glow, Figtree text, Faculty Glyphic headings, round pills,
     violet for the brand's own money and butter for the date (the calendar's "today" ring) */
  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${x(doc)} ${x(r.invoice)} · Linkloom</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Faculty+Glyphic&family=Figtree:wght@400;500;600;700&display=swap">
<style>
:root{--ink:#0a0a12;--text:#121212;--slate:#5b5b66;--rule:#e7e6ef;--paper:#f8f8f8;--violet:#8981ee;--violet-deep:#5a4fd0;--violet-sub:#ecebfd;--butter:#ffef85;--sans:"Figtree","Helvetica Neue",Arial,sans-serif;--display:"Faculty Glyphic","Iowan Old Style",Georgia,serif}
*{box-sizing:border-box}html{background:var(--paper)}body{margin:0;padding:40px 16px;font:15px/1.5 var(--sans);color:var(--text);-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,p{margin:0}.num{font-variant-numeric:tabular-nums}
.bar{max-width:800px;margin:0 auto 16px;display:flex;justify-content:flex-end}
.bar button{min-height:44px;padding:0 24px;border:0;border-radius:999px;background:var(--violet);color:var(--ink);font:600 14px/20px var(--sans);cursor:pointer;box-shadow:0 10px 24px -14px rgba(90,79,208,.8)}
.bar button:hover{background:#9b94f2}.bar button:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.inv{max-width:800px;margin:0 auto;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(10,10,18,.35),0 0 0 1px rgba(10,10,18,.04)}
.top{position:relative;padding:36px 40px 32px;color:#fefefe;background:radial-gradient(120% 90% at 0% 0%,rgba(137,129,238,.38),transparent 60%),radial-gradient(80% 80% at 100% 100%,rgba(137,129,238,.14),transparent 60%),var(--ink)}
.top-row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:10px;font:600 24px/1 var(--sans);letter-spacing:-.02em}
.logo i{display:inline-block;width:26px;height:16px;position:relative}.logo i:before,.logo i:after{content:"";position:absolute;top:0;width:16px;height:16px;border-radius:50%;border:2.5px solid var(--violet)}.logo i:before{left:0}.logo i:after{left:10px;border-color:#eb6273}
.tag{margin-top:10px;font-size:13px;color:rgba(254,254,254,.62)}
.doc{text-align:right}.doc h1{font:400 40px/1.05 var(--display);letter-spacing:-.02em}
.chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(254,254,254,.08);font:600 13px/1 var(--sans);color:#fefefe}
.chip span{font-weight:500;color:rgba(254,254,254,.62)}
.chip.date{background:transparent;box-shadow:inset 0 0 0 1.5px var(--butter)}
.amt{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:28px;padding-top:24px;border-top:1px solid rgba(254,254,254,.1)}
.amt .k{color:rgba(254,254,254,.58)}.amt b{display:block;font:400 44px/1 var(--display);letter-spacing:-.02em;color:#fefefe}
.pill{display:inline-flex;align-items:center;padding:6px 14px;border-radius:999px;font:600 13px/1 var(--sans)}
.pill.violet{background:var(--violet);color:var(--ink)}.pill.ok{background:#7ed6a5;color:var(--ink)}.pill.butter{background:var(--butter);color:var(--ink)}
.body{padding:32px 40px 36px}
.k{margin-bottom:8px;font-weight:700;font-size:11px;line-height:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.box{padding:18px 20px;border-radius:18px;background:var(--paper)}
.box p{font-size:14px;line-height:21px}.box p b{font-size:15px;color:var(--text)}
table{width:100%;margin-top:28px;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{padding:0 0 12px;text-align:left;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate);border-bottom:1px solid var(--rule)}
th:last-child,td:last-child{text-align:right}td{padding:16px 0;border-bottom:1px solid var(--rule);vertical-align:top}td small{display:block;color:var(--slate);font-size:13px}
tr.tot td{border-bottom:0;padding-top:20px;font-weight:600}
tr.tot td:last-child{padding-top:14px}tr.tot td:last-child span{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--violet);color:var(--ink);font:400 26px/1 var(--display);letter-spacing:-.02em}
.note{display:flex;gap:12px;margin-top:28px;padding:16px 20px;border-radius:18px;background:var(--violet-sub);color:#2e2770;font-size:14px;line-height:20px}
.note:before{content:"";flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--violet-deep)}
.foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:28px;padding-top:18px;border-top:1px solid var(--rule);font-size:12px;line-height:18px;color:var(--slate)}
@media (max-width:640px){body{padding:16px}.top{padding:24px 20px}.body{padding:24px 20px}.cols{grid-template-columns:1fr}.doc{text-align:left}.chips{justify-content:flex-start}.doc h1{font-size:32px}.amt b{font-size:36px}}
@media print{html,body{background:#fff}body{padding:0;font-size:13px}.bar{display:none}.inv{box-shadow:none;max-width:none;border-radius:18px}@page{size:A4;margin:10mm}.top{padding:22px 26px 20px}.doc h1{font-size:32px}.chips{margin-top:10px}.amt{margin-top:16px;padding-top:14px}.amt b{font-size:32px}.body{padding:18px 26px 20px}.cols{gap:10px}.box{padding:12px 16px;border-radius:14px}.box p{font-size:12.5px;line-height:18px}.box p b{font-size:13.5px}table{margin-top:16px}td{padding:9px 0}td small{font-size:11.5px}tr.tot td{padding-top:12px}tr.tot td:last-child{padding-top:8px}tr.tot td:last-child span{font-size:20px;padding:8px 14px}.note{margin-top:14px;padding:12px 16px;font-size:12.5px;line-height:18px}.foot{margin-top:14px;padding-top:12px;font-size:11px}.inv,.note,.foot,tr{break-inside:avoid}}
</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<main class="inv">
<header class="top">
  <div class="top-row">
    <div><div class="logo"><i aria-hidden="true"></i>linkloom</div><p class="tag">Creator marketplace · escrow-backed deals</p></div>
    <div class="doc"><h1>${x(doc)}</h1>
      <div class="chips"><span class="chip num"><span>No.</span>${x(r.invoice)}</span><span class="chip date num"><span>Date</span>${x(when)}</span></div></div>
  </div>
  <div class="amt"><div><p class="k">${x(totalL)}</p><b class="num">${x(L.inr(r.amount, { dec: true }))}</b></div><span class="pill ${stCls}">${x(stTxt)}</span></div>
</header>
<div class="body">
  <section class="cols">
    <div class="box"><p class="k">Billed to</p><p><b>${x(b.legal || me.brand)}</b>${b.address ? "<br>" + x(b.address) : ""}<br>GSTIN ${x(b.gstin || "not added")}<br>${x(b.email || me.email)}${me.name ? `<br>Attn. ${x(me.name)}${me.role ? ", " + x(me.role) : ""}` : ""}</p></div>
    <div class="box"><p class="k">Creator</p><p><b>${x(cr.name || "")}</b>${cr.handle ? "<br>" + x(cr.handle) : ""}${cr.city || cr.state ? "<br>" + x([cr.city, cr.state].filter(Boolean).join(", ")) : ""}</p></div>
    <div class="box"><p class="k">Deal</p><p><b>${x(c.title || "")}</b><br>${x([plat, c.format].filter(Boolean).join(" · "))}<br>${c.source === "job" ? "Hired from a brief" : "Direct hire"} · ${x((c.id || "").toUpperCase())}</p></div>
    <div class="box"><p class="k">Payment</p><p><b>${x(KINDL[r.kind] || "")}</b>${r.method ? "<br>" + x(r.method) : ""}<br>Payment ID <span class="num">${x(String(r.id || "").toUpperCase())}</span></p></div>
  </section>
  <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
    <tr><td>${x(line)}<small>Agreed price</small></td><td>${x(L.inr(r.amount, { dec: true }))}</td></tr>
    <tr><td>Platform fee<small>Linkloom runs on a subscription</small></td><td>No platform fee</td></tr>
    <tr><td>Taxes</td><td>As per confirmed rules</td></tr>
    <tr class="tot"><td>${x(totalL)}</td><td><span>${x(L.inr(r.amount, { dec: true }))}</span></td></tr>
  </tbody></table>
  <p class="note">${x(note)}</p>
  <footer class="foot"><span>${plan ? x(plan.name + " · renews " + L.fmtDate(plan.renews, { year: true })) + ". " : ""}No per-deal fee.</span><span>Computer-generated document${live ? "" : ". Sample data"}. support@linkloom.in</span></footer>
</div>
</main></body></html>`;
};
D.downloadInvoice = r => {
  try {
    const blob = new Blob([D.invoiceHTML(r)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${r.invoice}.html`;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

/* the ink slip (creator Earnings' payout slip, brand words) */
const Slip = ({ r }) => {
  const c = camp(r.campaign) || {},
    cr = L.creator(r.creator) || {};
  const head =
    r.kind === "escrow" ? "Escrow payment" : r.kind === "release" ? "Release to creator" : "Refund";
  const netL =
    r.kind === "escrow"
      ? "You paid"
      : r.kind === "release"
        ? `Paid to ${first(cr.name || "creator")}`
        : "Back to you";
  return (
    <div className="earnings-slip-w">
      <article className="earnings-slip dark" aria-label={head}>
        <header className="earnings-slip-h">
          <span>{head}</span>
          <Pill r={r} />
        </header>
        <p className="earnings-slip-who">
          <b>{cr.name || ""}</b>
          <span>{c.title || ""}</span>
        </p>
        <dl className="earnings-slip-rows">
          <div>
            <dt>Agreed price</dt>
            <dd>{L.inr(r.amount, { dec: true })}</dd>
          </div>
          <div>
            <dt>Platform fee</dt>
            <dd>No platform fee</dd>
          </div>
          <div>
            <dt>Taxes</dt>
            <dd>As per confirmed rules</dd>
          </div>
          <div>
            <dt>{r.kind === "refund" ? "Back to" : "Method"}</dt>
            <dd>{r.method}</dd>
          </div>
        </dl>
        <div className="earnings-slip-net">
          <span>{netL}</span>
          <span className="earnings-slip-amt">{amt(r)}</span>
        </div>
        {r.kind === "refund" && c.refundReason ? <p className="earnings-slip-why">{c.refundReason}</p> : null}
        <p className="earnings-slip-f">{`${DOC[r.kind]} ${r.invoice} · ${L.fmtDate(r.date, { year: true })}`}</p>
        <Lq className="lq-s pay-slip-dl" data-dl={r.id}>
          <Icon n="download" className="ic" />
          {`Download ${DOC[r.kind].toLowerCase()}`}
        </Lq>
      </article>
    </div>
  );
};
const feed = n => {
  if (!n) return;
  if (n.matches(".earnings-slip-w") && n.firstElementChild) n = n.firstElementChild;
  M().print ? M().print(n) : M().reveal(n);
};
/* below 1180px the slip column is hidden (payments.css), so a row opens its slip in a sheet */
const narrow = () => matchMedia("(max-width:1180px)").matches;

/* ---------- the screen (React) ---------- */
const DateBlock = ({ d }) => (
  <span className="earnings-date">
    <b>{L.D(d).toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</b>
    <span>{L.D(d).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span>
  </span>
);

function PaymentsScreen({ param }) {
  const s = L.store.s,
    ui = s.ui.pay || (s.ui.pay = {});
  /* deep link #payments-<paymentId> (from a campaign's invoice list): open that slip with every row visible */
  const deep = useRef(false);
  if (!deep.current) {
    deep.current = true;
    if (param && s.payments.some(x => x.id === param)) {
      ui.pick = param;
      ui.filter = "all";
      ui.range = "all";
    }
  }
  const rows = [...s.payments].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const [range, setRange] = useState(RANGES.some(r => r[0] === ui.range) ? ui.range : "fy");
  const [f, setF] = useState(FILTERS.some(x => x[0] === ui.filter) ? ui.filter : "all");
  const [pick, setPick] = useState(rows.find(r => r.id === ui.pick) ? ui.pick : rows[0] && rows[0].id);
  const [done, setDone] = useState({}); // row download buttons showing their check
  const root = useRef(null),
    heldEl = useRef(null),
    totalEl = useRef(null);
  const E = rows.length ? paidIn(range) : null;

  /** Invoice download from any [data-dl] button: rows, the slip, the refund cards and the phone sheet. */
  const onDl = e => {
    const b = e.target.closest("[data-dl]");
    if (!b) return;
    const r = s.payments.find(x => x.id === b.dataset.dl);
    if (!r) return;
    if (!D.downloadInvoice(r)) {
      L.toast("The invoice could not be made. Try again.", "alert");
      return;
    }
    if (b.classList.contains("pay-dl")) {
      setDone(x => ({ ...x, [r.id]: true }));
      requestAnimationFrame(() => M().check && M().check(b));
      setTimeout(() => setDone(x => ({ ...x, [r.id]: false })), 2400);
    }
    const sl = b.closest(".earnings-slip");
    sl && M().bump && M().bump(sl, 1.01);
    L.toast(`${DOC[r.kind]} ${r.invoice} downloaded`, "check");
  };
  useEffect(() => {
    if (!rows.length) return;
    const onSheetDl = e => e.target.closest(".sheet [data-dl]") && onDl(e);
    document.addEventListener("click", onSheetDl);
    M().count(heldEl.current, D.money().held, p => L.inr(p).slice(1));
    M().stagger(L.$$(".pay-row", root.current).filter(r => !r.hidden));
    const lk = L.$(".pay-hero-l svg", root.current);
    const t = lk && setTimeout(() => M().lock && lk.isConnected && M().lock(lk, { color: "plum" }), 500);
    return () => {
      document.removeEventListener("click", onSheetDl);
      clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (E && totalEl.current) M().count(totalEl.current, E.total, L.inr);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows.length)
    return (
      <div className="view-in earnings">
        <h1 className="t-h1">Payments</h1>
        <div className="empty earnings-empty">
          <img src="assets/step-06-coins.svg" width="220" height="160" alt="" />
          <p className="t-h2">No payments yet</p>
          <p className="muted">
            When a creator accepts and you pay into escrow, the payment shows up here with an invoice you can
            download.
          </p>
          <Lq as="a" className="lq-p" href="#creators">
            Find creators
          </Lq>
        </div>
      </div>
    );

  const m = D.money();
  const live = s.campaigns.filter(c =>
    s.payments.some(p => p.kind === "escrow" && p.status === "held" && p.campaign === c.id),
  ).length;
  const cnt = k => (k === "all" ? rows.length : rows.filter(r => r.kind === k).length);
  const refunds = rows.filter(r => r.kind === "refund");
  const plan = s.plan;
  const shown = r => f === "all" || r.kind === f;
  const billing = s.me.billing || {};

  const pickRow = r => {
    ui.pick = r.id;
    setPick(r.id);
    if (narrow()) {
      openReactSheet({
        title: "Payment slip",
        render: () => (
          <div className="earnings-sheet-slip">
            <Slip r={r} />
          </div>
        ),
      });
      requestAnimationFrame(() => {
        const sh = L.$(".sheet");
        if (sh) {
          L.liquid(sh);
          feed(L.$(".earnings-slip-w", sh));
        }
      });
      return;
    }
    requestAnimationFrame(() => {
      const side = L.$("[data-slip]", root.current);
      L.liquid(side);
      feed(side.firstElementChild);
    });
  };

  return (
    <div className="view-in earnings pay" ref={root} onClick={onDl}>
      <div className="earnings-top">
        <h1 className="t-h1">Payments</h1>
        <span className="sample">Sample data · amounts in ₹</span>
        {plan && plan.renews ? (
          <span className="earnings-plan">
            {plan.name} · renews {L.fmtDate(plan.renews)}
          </span>
        ) : null}
      </div>

      <section className="earnings-hero butter" aria-labelledby="payHeldH">
        <div className="earnings-hero-a">
          <h2 className="earnings-hero-l pay-hero-l" id="payHeldH">
            <Icon n="lock" />
            Held in escrow
          </h2>
          <p className="earnings-ready">
            <span className="earnings-rs">₹</span>
            <span data-held="" ref={heldEl}></span>
          </p>
          <p className="earnings-ready-sub">
            {live ? `For ${live} running deal${live === 1 ? "" : "s"}. ` : ""}Linkloom holds it until you
            approve the work, and refunds it if the creator rejects after payment or doesn’t deliver.
          </p>
          <div className="earnings-cta">
            <Lq as="a" className="lq-p lq-xl" href="#campaigns">
              Review deliveries
            </Lq>
            <span className="earnings-to">No platform fee. Taxes as per confirmed rules.</span>
          </div>
        </div>
        <div className="earnings-recon">
          <p className="earnings-recon-h">How it adds up</p>
          <dl>
            <div>
              <dt>Paid into escrow, all time</dt>
              <dd>{L.inr(m.paidIn)}</dd>
            </div>
            <div>
              <dt>Released to creators</dt>
              <dd>{m.released ? L.inr(-m.released) : "None yet"}</dd>
            </div>
            <div>
              <dt>Refunded to you</dt>
              <dd>{m.refunds ? L.inr(-m.refunds) : "None"}</dd>
            </div>
            <div className="is-total">
              <dt>Held in escrow</dt>
              <dd>{L.inr(m.held)}</dd>
            </div>
          </dl>
          <p className={`earnings-recon-ok${m.ok ? "" : " is-off"}`}>
            <Icon n={m.ok ? "check" : "alert"} />
            <span>
              {m.ok
                ? "Matches your payment history."
                : "Does not match your payment history. Linkloom support has been told."}
            </span>
          </p>
          <p className="t-note earnings-recon-note" aria-hidden="true">
            to the paisa
          </p>
        </div>
      </section>

      <div className="earnings-grid">
        <div className="earnings-main">
          <section className="earnings-total card" aria-labelledby="payTotH">
            <div className="earnings-total-t">
              <h2 className="earnings-sec-h" id="payTotH">
                Total paid to creators
              </h2>
              <p className="t-money earnings-total-n" data-total="" ref={totalEl}></p>
              <p className="earnings-total-r">
                <span data-range="">{E.label}</span> ·{" "}
                <span data-n="">
                  {E.n} release{E.n === 1 ? "" : "s"}
                </span>
              </p>
              <p className="help">
                Agreed prices released on your approval. Money still in escrow is not counted.
              </p>
            </div>
            <div className="seg earnings-range" role="group" aria-label="Date range">
              {RANGES.map(([k, n]) => (
                <button
                  key={k}
                  type="button"
                  data-r={k}
                  aria-pressed={String(k === range)}
                  onClick={() => {
                    ui.range = k;
                    setRange(k);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </section>

          <section className="ll-panel earnings-sec pay-sec" aria-labelledby="payHisH">
            <div className="ll-panel-head">
              <div>
                <h2 className="ll-panel-h" id="payHisH">
                  Payment history
                </h2>
                <p className="ll-panel-sub">Open a row for its slip and invoice</p>
              </div>
            </div>
            <div className="chips earnings-filter" role="group" aria-label="Filter payments">
              {FILTERS.map(([k, n]) => (
                <button
                  key={k}
                  className="chip"
                  type="button"
                  data-f={k}
                  aria-pressed={String(k === f)}
                  onClick={() => {
                    ui.filter = k;
                    M().flip(() => flushSync(() => setF(k)), L.$$(".pay-row", root.current));
                  }}
                >
                  {n} <span className="earnings-chip-n">{cnt(k)}</span>
                </button>
              ))}
            </div>
            <ol className="earnings-list pay-list">
              {rows.map(r => {
                const c = camp(r.campaign) || {},
                  cr = L.creator(r.creator) || {};
                return (
                  <li key={r.id} className="earnings-row pay-row" data-kind={r.kind} hidden={!shown(r)}>
                    <button
                      type="button"
                      className="earnings-row-b pay-row-b"
                      data-pick={r.id}
                      aria-pressed={String(r.id === pick)}
                      aria-label={`${L.fmtDate(r.date, { year: true })}, ${KINDL[r.kind]}, ${cr.name}, ${c.title}, ${amt(r)}. Open payment slip`}
                      onClick={() => pickRow(r)}
                    >
                      <DateBlock d={r.date} />
                      <span className="earnings-what">
                        <b>{cr.name || ""}</b>
                        <span>
                          {KINDL[r.kind]} · {c.title || ""}
                        </span>
                      </span>
                      <span className="earnings-amt">
                        <b className="t-money">{amt(r)}</b>
                      </span>
                      <Pill r={r} />
                    </button>
                    <button
                      type="button"
                      className={`ibtn pay-dl${done[r.id] ? " is-done" : ""}`}
                      data-dl={r.id}
                      aria-label={`Download ${DOC[r.kind].toLowerCase()} ${r.invoice}`}
                      title={`Download ${DOC[r.kind].toLowerCase()}`}
                    >
                      <Icon n={done[r.id] ? "check" : "download"} />
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="earnings-none muted" hidden={rows.some(shown)}>
              Nothing of this kind yet.
            </p>
            <p className="help pay-hint">
              <Icon n="file" />
              <span>
                Each row has an invoice with your billing details: {billing.legal || s.me.brand}, GSTIN{" "}
                {billing.gstin || "not added"}.
              </span>
              <Lq as="a" className="lq-s lq-sm" href="#profile">
                <Icon n="edit" className="ic" />
                Edit billing
              </Lq>
            </p>
          </section>

          <section className="ll-panel earnings-sec pay-sec" aria-labelledby="payRefH">
            <div className="ll-panel-head">
              <div>
                <h2 className="ll-panel-h" id="payRefH">
                  Refunds
                </h2>
                <p className="ll-panel-sub">
                  {refunds.length ? `${L.inr(m.refunds)} back to you` : "None so far"}
                </p>
              </div>
            </div>
            <div className="pay-ref-why">
              <p className="pay-ref-h">When you get a refund</p>
              <ul className="chat-rules pay-rules">
                <li>
                  <Icon n="close" />
                  <span>
                    <b>The creator rejects after you pay.</b> The full agreed price comes back from escrow.
                  </span>
                </li>
                <li>
                  <Icon n="clock" />
                  <span>
                    <b>The creator doesn’t deliver.</b> If nothing arrives by the due date and can’t be fixed,
                    Linkloom returns your escrow in full.
                  </span>
                </li>
                <li>
                  <Icon n="refund" />
                  <span>
                    Refunds go back to the method you paid with, usually in 5 to 7 working days, with a credit
                    note.
                  </span>
                </li>
              </ul>
            </div>
            {refunds.length ? (
              <ol className="pay-refs">
                {refunds.map(r => {
                  const c = camp(r.campaign) || {},
                    cr = L.creator(r.creator) || {};
                  const paid = s.payments.find(x => x.kind === "escrow" && x.campaign === r.campaign);
                  return (
                    <li key={r.id} className="pay-ref">
                      <div className="pay-ref-t">
                        <span className={`avatar msg-av${cr.tone === "b" ? " is-b" : ""}`} aria-hidden="true">
                          {L.initials(cr.name || "?")}
                        </span>
                        <div>
                          <b>{c.title || ""}</b>
                          <span>
                            {cr.name || ""} · paid {paid ? L.fmtDate(paid.date) : ""}, refunded{" "}
                            {L.fmtDate(r.date, { year: true })}
                          </span>
                        </div>
                        <b className="t-money pay-ref-a">+{L.inr(r.amount)}</b>
                      </div>
                      <p className="pay-ref-r">
                        <span className="pill pill-info">
                          <Icon n="refund" />
                          Refunded
                        </span>
                        <span>{c.refundReason || "Escrow returned in full."}</span>
                      </p>
                      <div className="pay-ref-f">
                        <span className="help">
                          {r.method} · Credit note {r.invoice}
                        </span>
                        <Lq className="lq-s lq-sm" data-dl={r.id}>
                          <Icon n="download" className="ic" />
                          Download credit note
                        </Lq>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        </div>

        <aside className="earnings-side" aria-label="Payment slip" aria-live="polite" data-slip="">
          <Slip r={rows.find(r => r.id === pick)} />
        </aside>
      </div>
    </div>
  );
}

L.register("payments", { title: "Payments", nav: "payments", Component: PaymentsScreen });
