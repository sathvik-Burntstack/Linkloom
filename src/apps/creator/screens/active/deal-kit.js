/* The deal kit (window.LLD_C) shared by the creator's Builder C screens: Active deals and the deal board
   (active.jsx), Messages, Earnings and Home read these at render time. Owned by Builder C.
   Work status (a.stage, six stages) and payment status (a.pay: 'escrow' | 'released') are separate fields on purpose:
   "completed" never implies "paid". Money is integer paise. */
const L = window.LLD;
const C = (window.LLD_C = window.LLD_C || {});

/* ---------- helpers shared by the Builder C screens (messages, earnings and home use these at render time) ---------- */
const T0 = Date.now();
C.now = () =>
  import.meta.env.VITE_TEST_HOOKS ? new Date(L.today().getTime() + (Date.now() - T0)) : new Date(); // the parity build pins "today" and lets it tick
C.iso = () => C.now().toISOString();
C.key = d => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD in IST
C.today = () => C.key(C.now());
C.addDays = (ymd, n) => {
  const d = new Date(ymd + "T12:00:00+05:30");
  d.setDate(d.getDate() + n);
  return C.key(d);
};
C.time = s =>
  L.D(s).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
C.dayDiff = s => Math.round((Date.parse(C.today()) - Date.parse(C.key(L.D(s)))) / 864e5);
C.day = s => {
  const n = C.dayDiff(s);
  return n === 0 ? "Today" : n === 1 ? "Yesterday" : L.fmtDate(s);
};
C.when = s => {
  const n = C.dayDiff(s);
  return n === 0 ? C.time(s) : n === 1 ? "Yesterday" : L.fmtDate(s);
};
C.days = ymd => Math.round((Date.parse(String(ymd).slice(0, 10)) - Date.parse(C.key(L.today()))) / 864e5); // whole IST calendar days from the sample today
C.bi = brand => {
  const s = L.store.s,
    x = s.threads.find(t => t.brand === brand && t.bi) || s.jobs.find(j => j.brand === brand && j.bi);
  return (x && x.bi) || L.initials(brand);
};
/** The brand's logo link, from its chat or one of its briefs; "" when none is known. */
C.logo = brand => {
  const s = L.store.s,
    x =
      s.active.find(a => a.brand === brand && a.logo) ||
      s.threads.find(t => t.brand === brand && t.logo) ||
      s.jobs.find(j => j.brand === brand && j.logo);
  return (x && x.logo) || "";
};
C.plat = p => (p === "youtube" ? "YouTube" : "Instagram");
C.sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
C.press = root => L.$$(".lq-p,.lq-coral,[data-press]", root).forEach(b => L.motion.press(b));
C.STAGES = [
  { k: "kickoff", n: "Accepted", long: "Accepted, awaiting kickoff" },
  { k: "in_progress", n: "In progress", long: "Promotion in progress" },
  { k: "submitted", n: "Submitted", long: "Content uploaded, submitted for review" },
  { k: "revision", n: "Revision", long: "Revision requested" },
  { k: "review", n: "Brand review", long: "Completed, awaiting brand review" },
  { k: "approved", n: "Approved", long: "Approved by the brand" },
];
C.ix = a =>
  Math.max(
    0,
    C.STAGES.findIndex(x => x.k === a.stage),
  );
C.who = a =>
  a.stage === "approved"
    ? "done"
    : a.awaitingPay || a.stage === "review" || (a.stage === "submitted" && !a.draftOk)
      ? "brand"
      : "you";
/* the pills, the payout slip and the offline banner are React components in deal-ui.jsx */
C.deal = a => {
  const j = L.store.s.jobs.find(x => x.id === a.job) || {};
  return {
    platform: j.platform,
    format: j.format,
    brief: j.brief,
    usage: j.usage,
    languages: j.languages,
    deliverables: j.deliverables,
    ...a,
  };
};
C.threadFor = a =>
  L.store.s.threads.find(t => t.id === a.thread) || L.store.s.threads.find(t => t.job === a.id);
C.revUsed = a => (a.log || []).filter(e => e.kind === "revision").length || (a.revision ? 1 : 0);
C.next = a => {
  const d = C.deal(a);
  switch (a.stage) {
    case "kickoff":
      return `Start work. Draft due ${L.fmtDate(a.draftDue || a.due)}.`;
    case "in_progress":
      return `Upload your ${(d.format || "content").toLowerCase()} by ${L.fmtDate(a.draftDue || a.due)}.`;
    case "submitted":
      return a.draftOk ? "Draft OKed. Post it and add the live link." : `${a.brand} is reviewing your draft.`;
    case "revision":
      return `Changes asked: “${a.revision || "see the brand’s note"}”`;
    case "review":
      return `${a.brand} is doing the final check.`;
    default:
      return "Approved. Your payout is clearing.";
  }
};
C.due = a => {
  if (a.stage === "approved") return "Approved";
  const n = C.days(a.due);
  return n < 0
    ? `${-n} day${n === -1 ? "" : "s"} late`
    : n === 0
      ? "Due today"
      : `Due ${L.fmtDate(a.due)} · ${n} day${n === 1 ? "" : "s"} left`;
};
