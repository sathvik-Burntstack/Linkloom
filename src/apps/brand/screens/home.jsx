/* Home (#home, Builder A): IST greeting, then section panels 48px apart.
   - A brand with no briefs yet: "Post your first brief" (the one primary button), then creators for you.
   - A returning brand: "Needs you" first (new bids, deliveries, accepted invitations, derived from bids and deals),
     the ink numbers card (only once a number is above 0), a quieter "Post a brief", then creators for you.
   Also owns the notifications sheet opened by the #bell button (attached on load).
   React screen (see src/shared/react/view.jsx); counted numbers are elements left to the motion layer. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet, Photo } from "@/shared/react/view";
import { lowestRate, RATE_ON_REQUEST } from "./creator-rates";
import { REVIEW_TIME } from "../kyc";

const L = window.LLD,
  { esc, icon, store } = L;
const mo = (k, ...a) => {
  const f = L.motion && L.motion[k];
  if (typeof f === "function") {
    try {
      return f(...a);
    } catch (e) {}
  }
};
const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];
const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];
const first = n =>
  String(n || "")
    .trim()
    .split(/\s+/)[0] || "";
/* small avatars carry one letter (two-letter initials like "AI" read as a label); large ones carry two */
const Av = ({ c, cls = "" }) => {
  const n = c ? c.name : "?";
  return (
    <span className={`home-av ${c && c.tone === "b" ? "is-b" : ""} ${cls}`} aria-hidden="true">
      <Photo src={c && c.avatarUrl}>{cls.includes("lg") ? L.initials(n) : n.trim()[0].toUpperCase()}</Photo>
    </span>
  );
};
const dayTxt = d =>
  d === 0
    ? "today"
    : d === 1
      ? "tomorrow"
      : d < 0
        ? `${-d} ${d === -1 ? "day" : "days"} late`
        : `${d} days left`;

/* ---------- notification kinds (the spec's list, plus the ones other flows add) ---------- */
const KIND = {
  accepted: ["check", "Invitation accepted", "ok"],
  declined: ["close", "Invitation declined", "err"],
  rejected: ["close", "Invitation declined", "err"],
  bid: ["bids", "New bid", "brand"],
  message: ["chat", "New message", "plain"],
  delivery: ["upload", "Delivery submitted", "info"],
  paid: ["lock", "Payment successful", "escrow"],
  escrow: ["lock", "Payment successful", "escrow"],
  funded: ["lock", "Payment successful", "escrow"],
  payment: ["coin", "Payment released", "escrow"],
  release: ["coin", "Payment released", "escrow"],
  released: ["coin", "Payment released", "escrow"],
  refund: ["refund", "Refund", "info"],
  refunded: ["refund", "Refund", "info"],
  revision: ["edit", "Revision", "warn"],
  review: ["star", "Review", "plain"],
  invite: ["send", "Invitation sent", "plain"],
  invited: ["send", "Invitation sent", "plain"],
  cancelled: ["close", "Invitation cancelled", "plain"],
  canceled: ["close", "Invitation cancelled", "plain"],
  submitted: ["upload", "Delivery submitted", "info"],
  approved: ["check", "Work approved", "ok"],
  job: ["brief", "Brief", "plain"],
  closed: ["brief", "Brief closed", "plain"],
  posted: ["brief", "Brief posted", "plain"],
};
const kindOf = k =>
  KIND[String(k || "").toLowerCase()] || ["bell", "Update", "plain"]; /* unknown kinds still read sensibly */

/* the sample data has no "declined" or "payment successful" notice yet; add them once so every kind in the spec appears */
(function seed() {
  const n = (LLD_DATA.notifications = LLD_DATA.notifications || []);
  if (!n.some(x => x.kind === "declined" || x.kind === "rejected"))
    n.push({
      id: "n6",
      kind: "declined",
      text: "Meher Gill declined your invitation for Wedding-season glow Reel. Nothing was charged.",
      at: "2026-10-28T13:05:00+05:30",
      go: "#creator-cr6",
      read: true,
    });
  if (!n.some(x => ["paid", "escrow", "funded"].includes(x.kind)))
    n.push({
      id: "n7",
      kind: "paid",
      text: "Payment successful. ₹16,000 is held in escrow for Sunscreen reapplication, office day.",
      at: "2026-10-24T15:30:00+05:30",
      go: "#campaign-c1",
      read: true,
    });
})();

/* ---------- notifications sheet (#bell) ---------- */
function bellLabel() {
  const b = document.getElementById("bell");
  if (!b) return;
  const n = LLD_DATA.notifications.filter(x => !x.read).length;
  b.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
}
const UI = () => (LLD_DATA.ui.home = LLD_DATA.ui.home || { nfilter: "all" });
function groupOf(at) {
  const d = -L.daysLeft(at.slice(0, 10));
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "This week" : "Earlier";
}
const sheetQ = q => document.querySelector(".sheet " + q);
function Notifications({ close }) {
  const s = LLD_DATA,
    ui = UI();
  const [, redraw] = useState(0);
  const [liveMsg, setLiveMsg] = useState(null);
  const keep = useRef(false),
    quiet = useRef(false),
    focusTo = useRef(null);
  const all = [...s.notifications].sort((a, b) => L.D(b.at) - L.D(a.at));
  const unread = all.filter(n => !n.read).length;
  if (ui.nfilter === "unread" && !unread && !keep.current) ui.nfilter = "all";
  const list = ui.nfilter === "unread" ? all.filter(n => !n.read) : all;
  const groups = [];
  list.forEach(n => {
    const g = groupOf(n.at);
    let G = groups.find(x => x.g === g);
    if (!G) groups.push((G = { g, items: [] }));
    G.items.push(n);
  });
  useLayoutEffect(() => {
    if (!quiet.current) mo("stagger", L.$$(".sheet .home-nt li"));
    quiet.current = false;
    keep.current = false;
    if (focusTo.current) {
      const f = focusTo.current();
      f && f.focus();
      focusTo.current = null;
    }
  });
  const paint = (o = {}) => {
    keep.current = !!o.keep;
    quiet.current = !!o.quiet;
    flushSync(() => redraw(n => n + 1));
  };
  const setF = f => {
    ui.nfilter = f;
    focusTo.current = () => sheetQ(`[data-f="${ui.nfilter}"]`);
    setLiveMsg(null);
    paint({ keep: true });
  };
  const allRead = () => {
    L.store.set(st => st.notifications.forEach(n => (n.read = true)), "notif-read-all");
    focusTo.current = () => sheetQ(".home-nt-i");
    setLiveMsg(null);
    paint({ quiet: true });
    L.toast("All marked as read", "check");
  };
  const mark = (n, e) => {
    const li = e.currentTarget.closest("li"),
      nextFocus = li && (li.nextElementSibling || li.previousElementSibling);
    L.store.set(() => {
      n.read = true;
    }, "notif-read");
    const keepId = nextFocus && nextFocus.dataset.li;
    focusTo.current = () =>
      (keepId && sheetQ(`[data-li="${keepId}"] .home-nt-i`)) ||
      sheetQ(`[data-n="${n.id}"]`) ||
      sheetQ(".home-nt-i") ||
      sheetQ('[data-f="all"]');
    setLiveMsg("Marked as read");
    paint({ quiet: true, keep: true });
  };
  const open = n => {
    L.store.set(() => {
      n.read = true;
    }, "notif-read");
    close(true);
    if (n.go) L.go(n.go);
  };
  if (!all.length)
    return (
      <div className="empty home-nt-empty">
        <img src="assets/step-01-envelope.svg" width="140" height="103" alt="" />
        <p className="t-h2">You're all caught up.</p>
        <p className="muted">Bids, accepted invitations, deliveries and payments land here.</p>
      </div>
    );
  return (
    <>
      <div className="home-nt-h">
        <div className="seg home-nt-seg" role="group" aria-label="Show">
          <button
            type="button"
            data-f="all"
            aria-pressed={String(ui.nfilter === "all")}
            onClick={() => setF("all")}
          >
            All
          </button>
          <button
            type="button"
            data-f="unread"
            aria-pressed={String(ui.nfilter === "unread")}
            onClick={() => setF("unread")}
          >
            Unread
            {unread ? (
              <>
                {" "}
                <span className="num">{unread}</span>
              </>
            ) : null}
          </button>
        </div>
        <Lq
          className="lq-s lq-sm"
          data-allread=""
          disabled={!unread}
          aria-disabled={unread ? undefined : "true"}
          onClick={allRead}
        >
          <Icon n="check" className="ic" />
          Mark all read
        </Lq>
      </div>
      <p className="sr-only" aria-live="polite" data-ntlive="">
        {liveMsg || (unread ? `${unread} unread` : "All caught up")}
      </p>
      {list.length ? (
        groups.map(G => (
          <section key={G.g} className="home-nt-g" aria-label={G.g}>
            <h3 className="t-eyebrow">{G.g}</h3>
            <ul className="home-nt">
              {G.items.map(n => {
                const [ic, label, tone] = kindOf(n.kind);
                return (
                  <li key={n.id} className={n.read ? "" : "is-unread"} data-li={n.id}>
                    <button className="home-nt-i" type="button" data-n={n.id} onClick={() => open(n)}>
                      <span className={`home-nt-ic is-${tone}`} aria-hidden="true">
                        <Icon n={ic} />
                      </span>
                      <span className="home-nt-t">
                        <span className="home-nt-txt">{n.text}</span>
                        <span className="home-nt-at">
                          {label} · {L.ago(n.at)}
                          {n.read ? null : <span className="sr-only">, unread</span>}
                        </span>
                      </span>
                      <span className="home-nt-dot" aria-hidden="true"></span>
                    </button>
                    {n.read ? null : (
                      <button
                        className="ibtn home-nt-mark"
                        type="button"
                        data-mark={n.id}
                        aria-label={`Mark as read: ${n.text}`}
                        title="Mark as read"
                        onClick={e => mark(n, e)}
                      >
                        <Icon n="check" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      ) : (
        <div className="home-nt-none">
          <p className="t-h3">No unread notifications</p>
          <p className="muted">You've seen everything.</p>
          <Lq className="lq-s lq-sm" data-f="all" onClick={() => setF("all")}>
            Show all
          </Lq>
        </div>
      )}
      <p className="home-nt-foot sample">Sample notifications</p>
    </>
  );
}
function openNotifications() {
  openReactSheet({ title: "Notifications", render: close => <Notifications close={close} /> });
}
L.openNotifications = openNotifications;
const bell = document.getElementById("bell");
if (bell && !bell.dataset.wired) {
  bell.dataset.wired = "1";
  bell.addEventListener("click", openNotifications);
  bell.setAttribute("aria-haspopup", "dialog");
}
store.on(bellLabel);
bellLabel();

/* ---------- greeting by IST time ---------- */
function greeting(now) {
  let h = 12;
  try {
    h =
      Number(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(
          now,
        ),
      ) % 24;
  } catch (e) {}
  return h < 4
    ? "Up late"
    : h < 12
      ? "Good morning"
      : h < 17
        ? "Good afternoon"
        : h < 23
          ? "Good evening"
          : "Up late";
}

/* budget: escrow paid in this budget window and not refunded */
function budget(s) {
  const b = s.budget || { total: 0, label: "" };
  const from = b.from || "2026-10-01",
    to = b.to || "2026-12-31";
  const used = s.payments
    .filter(p => p.kind === "escrow" && p.status !== "refunded" && p.date >= from && p.date <= to)
    .reduce((n, p) => n + p.amount, 0);
  const owed = s.campaigns.filter(c => c.stage === "accepted").reduce((n, c) => n + c.price, 0); // accepted, not paid yet
  return { total: b.total, label: b.label, used, owed, left: Math.max(0, b.total - used) };
}

/* creators worth a look: not already working with you, ranked on fit with your industry */
function picks(s) {
  const busy = new Set(
    s.campaigns.filter(c => [...LIVE, "accepted", "invited"].includes(c.stage)).map(c => c.creator),
  );
  const ind = String(s.me.industry || "").toLowerCase();
  const score = c =>
    (c.categories.some(x => x.toLowerCase() === ind) ? 4 : 0) +
    (c.verified ? 1 : 0) +
    (c.availability === "open" ? 1 : 0) +
    (c.rating || 3.5) +
    (s.favorites.includes(c.id) ? 0.3 : 0);
  return s.creators
    .filter(c => !busy.has(c.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 4);
}

const lifted = new WeakSet();

function HomeScreen() {
  const [, redraw] = useState(0);
  const first_ = useRef(true);
  const root = useRef(null);
  useEffect(() => {
    let raf = 0;
    const off = store.on(why => {
      if (/^notif/.test(String(why))) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => redraw(n => n + 1));
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, []);
  const s = store.s,
    now = L.today(),
    st = L.brandStats ? L.brandStats() : { hired: 0, hiredIds: [], active: [] };
  const bud = budget(s),
    held = L.heldInEscrow();

  useLayoutEffect(() => {
    const el = root.current;
    const initial = first_.current;
    first_.current = false;
    if (initial) {
      el.querySelectorAll(".home-nums [data-n]").forEach(d => {
        const n = +d.dataset.n;
        if (n) mo("count", d, n, v => String(Math.round(v)));
        else d.textContent = "0";
      });
      const h = el.querySelector("[data-inr]");
      if (h) +h.dataset.inr ? mo("count", h, +h.dataset.inr, L.inr) : (h.textContent = L.inr(0));
      mo("stagger", L.$$(".home-obj, .home-wait", el));
      mo("stagger", L.$$(".home-cr-list>li", el));
      const bar = el.querySelector(".home-bud-bar");
      bar && bar.classList.add("is-in");
    } else {
      el.querySelectorAll(".home-nums [data-n]").forEach(d => (d.textContent = d.dataset.n));
      const h = el.querySelector("[data-inr]");
      if (h) h.textContent = L.inr(+h.dataset.inr);
      el.querySelectorAll(".home-bud-bar").forEach(b => b.classList.add("is-in", "is-now"));
    }
    mo(
      "lift",
      L.$$(".home-cr", el).filter(n => !lifted.has(n) && lifted.add(n)),
    );
  });

  /* ---- needs you: real objects derived from bids and deals. Only the first action is the screen's primary ---- */
  let primed = false;
  const cta = () => (primed ? "lq-s lq-sm" : ((primed = true), "lq-p lq-sm"));
  const objs = [];
  s.campaigns
    .filter(c => c.stage === "submitted")
    .forEach(c => {
      const cr = L.creator(c.creator) || {},
        dl = c.deliveries || [],
        d = dl[dl.length - 1];
      const left = (c.revisionsIncluded || 0) - (c.revisionsUsed || 0);
      objs.push(
        <li key={"d" + c.id} className="home-obj home-del">
          <div className="home-obj-top">
            <span className="pill pill-info">
              <Icon n="upload" />
              Delivery to verify
            </span>
            {d ? <span className="home-due">Sent {L.ago(d.at)}</span> : null}
          </div>
          <p className="home-from">
            <Av c={cr} />
            <span>
              <b>{cr.name}</b> sent {dl.length > 1 ? "a new version" : "the final cut"}
            </span>
          </p>
          {d && d.note ? <blockquote className="home-quote">“{d.note}”</blockquote> : null}
          <p className="home-job">{c.title}</p>
          {d && d.file ? (
            <p className="home-file">
              <Icon n="file" />
              {d.file}
            </p>
          ) : null}
          <div className="home-obj-act">
            <Lq as="a" className={cta()} href={`#campaign-${c.id}`}>
              Review delivery
            </Lq>
            <span className="pill pill-escrow">
              <Icon n="lock" />
              {L.inr(c.price)} in escrow
            </span>
          </div>
          <p className="home-obj-foot">
            Approve to release the money, or ask for a revision.
            {c.revisionsIncluded
              ? ` ${left} of ${c.revisionsIncluded} revision${c.revisionsIncluded === 1 ? "" : "s"} left.`
              : ""}
          </p>
        </li>,
      );
    });
  const openJobs = s.jobs
    .filter(j => j.status === "open")
    .map(j => ({ j, fresh: s.bids.filter(b => b.job === j.id && b.status === "new") }))
    .filter(x => x.fresh.length)
    .sort((a, b) => b.fresh.length - a.fresh.length);
  if (openJobs.length) {
    /* the range only over real prices: Math.min() of nothing is Infinity */
    const { j, fresh } = openJobs[0],
      prices = fresh.map(b => Number(b.price)).filter(p => Number.isFinite(p) && p > 0),
      lo = prices.length ? Math.min(...prices) : 0,
      hi = prices.length ? Math.max(...prices) : 0;
    const crs = fresh.map(b => L.creator(b.creator)).filter(Boolean);
    objs.push(
      <li key="bids" className="home-obj home-bids">
        <div className="home-obj-top">
          <span className="pill pill-violet">
            <Icon n="bids" />
            New bids
          </span>
          {j.deadline ? (
            <span className="home-due">
              <Icon n="clock" />
              Post by {L.fmtDate(j.deadline)}
            </span>
          ) : null}
        </div>
        <p className="home-obj-t">
          {fresh.length} new bid{fresh.length === 1 ? "" : "s"} on {j.title}
        </p>
        {crs.length ? (
          <div className="home-stack">
            <span className="home-avs">
              {crs.slice(0, 3).map(c => (
                <Av key={c.id} c={c} />
              ))}
            </span>
            <span>{crs.map(c => first(c.name)).join(" and ")} bid since yesterday</span>
          </div>
        ) : null}
        <dl className="home-mini">
          {prices.length ? (
            <div>
              <dt>New bids</dt>
              <dd className="t-money">{lo === hi ? L.inr(lo) : `${L.inr(lo)}–${L.inr(hi).slice(1)}`}</dd>
            </div>
          ) : null}
          {j.budget ? (
            <div>
              <dt>Your budget</dt>
              <dd className="t-money">{L.inr(j.budget)}</dd>
            </div>
          ) : null}
          <div>
            <dt>All bids</dt>
            <dd className="t-money">{Math.max(j.bids || 0, fresh.length)}</dd>
          </div>
        </dl>
        <ul className="home-bidrows">
          {fresh
            .slice()
            .sort((a, b) => L.D(b.sent) - L.D(a.sent))
            .slice(0, 3)
            .map(b => {
              const c = L.creator(b.creator) || { name: "Creator" };
              return (
                <li key={b.id}>
                  <Av c={c} />
                  <span className="home-bidrow-t">
                    <b>{c.name}</b>
                    <span>
                      {b.price ? L.inr(b.price) : "Price not given"}
                      {b.postDate ? ` · posts by ${L.fmtDate(b.postDate)}` : ""}
                    </span>
                  </span>
                  <Lq
                    className="lq-s lq-sm"
                    data-viewbid={b.id}
                    data-job={j.id}
                    onClick={() => {
                      /* View bid: open the brief at that bid (job.js scrolls to it and outlines it) */
                      if (L.bk) L.bk.ui("job").focusBid = b.id;
                      L.go("#job-" + j.id);
                    }}
                  >
                    <Icon n="eye" className="ic" />
                    View bid
                  </Lq>
                </li>
              );
            })}
        </ul>
        <div className="home-obj-act">
          <Lq as="a" className={cta()} href={`#job-${j.id}`}>
            Compare bids
          </Lq>
          {fresh.length > 3 ? (
            <Lq as="a" className="lq-s lq-sm" href={`#job-${j.id}`}>
              All {fresh.length} bids
            </Lq>
          ) : null}
          {openJobs[1] ? (
            <Lq as="a" className="lq-s lq-sm" href={`#job-${openJobs[1].j.id}`}>
              +{openJobs[1].fresh.length} on {openJobs[1].j.title}
            </Lq>
          ) : null}
        </div>
      </li>,
    );
  }
  s.campaigns
    .filter(c => c.stage === "accepted")
    .forEach(c => {
      const cr = L.creator(c.creator) || {},
        acc = (c.log || []).find(x => x[1] === "accepted");
      objs.push(
        <li key={"p" + c.id} className="home-obj home-pay">
          <p className="home-pay-l">
            {cr.name} accepted{acc ? ` ${L.ago(acc[0])}` : ""}
          </p>
          <p className="t-money home-pay-v">{L.inr(c.price)}</p>
          <p className="home-pay-s">
            Pay into escrow to start <b>{c.title}</b>. Chat opens once it's paid.
          </p>
          <div className="home-obj-act">
            <Lq
              className={cta()}
              data-pay={c.id}
              onClick={() =>
                typeof L.payEscrow === "function" ? L.payEscrow(c.id) : L.go("#campaign-" + c.id)
              }
            >
              <Icon n="lock" className="ic" />
              Pay into escrow
            </Lq>
            <Lq as="a" className="lq-s lq-sm" href={`#campaign-${c.id}`}>
              Details
            </Lq>
          </div>
          <p className="ll-trust home-trust">
            <Icon n="lock" />
            Linkloom holds it until you approve the work.
          </p>
          {bud.total ? (
            <p className="home-pay-b">
              Leaves {L.inr(Math.max(0, bud.left - c.price))} of your {bud.label} budget.
            </p>
          ) : null}
        </li>,
      );
    });

  /* waiting on creators: nothing for you to do, but worth knowing */
  const waits = [];
  s.campaigns
    .filter(c => c.stage === "revision")
    .forEach(c => {
      const cr = L.creator(c.creator) || {},
        th = s.threads.find(t => t.id === c.thread),
        last = th && [...th.messages].reverse().find(m => m.from === "creator");
      waits.push(
        <li key={"r" + c.id} className="home-wait">
          <Av c={cr} />
          <div className="home-wait-t">
            <p>
              <b>{cr.name}</b> is working on your revision{" "}
              <span className="pill pill-warn">
                Revision {c.revisionsUsed} of {c.revisionsIncluded}
              </span>
            </p>
            <p className="home-wait-s">
              {c.title} · due {L.fmtDate(c.due)}, {dayTxt(L.daysLeft(c.due))}
              {last ? ` · “${last.text}”` : ""}
            </p>
          </div>
          <div className="home-wait-a">
            {th ? (
              <Lq as="a" className="lq-s lq-sm" href={`#chat-${th.id}`}>
                <Icon n="chat" className="ic" />
                Message
              </Lq>
            ) : null}
            <Lq as="a" className="lq-s lq-sm" href={`#campaign-${c.id}`}>
              Open
              <Icon n="arrow" className="ic" />
            </Lq>
          </div>
        </li>,
      );
    });
  s.campaigns
    .filter(c => c.stage === "invited")
    .forEach(c => {
      const cr = L.creator(c.creator) || {},
        inv = (c.log || []).find(x => x[1] === "invited");
      waits.push(
        <li key={"i" + c.id} className="home-wait">
          <Av c={cr} />
          <div className="home-wait-t">
            <p>
              <b>{cr.name}</b> hasn't replied to your invitation{" "}
              <span className="pill pill-paper">
                <Icon n="clock" />
                Pending
              </span>
            </p>
            <p className="home-wait-s">
              {c.title} · {L.inr(c.price)}
              {inv ? ` · sent ${L.ago(inv[0])}` : ""} · nothing is charged until {first(cr.name)} accepts and
              you pay
            </p>
          </div>
          <div className="home-wait-a">
            <Lq as="a" className="lq-s lq-sm" href={`#campaign-${c.id}`}>
              View or cancel
              <Icon n="arrow" className="ic" />
            </Lq>
          </div>
        </li>,
      );
    });

  const crs = picks(s);
  const hiredCr = st.hiredIds.map(id => L.creator(id)).filter(Boolean);
  const act = st.active,
    review = act.filter(c => c.stage === "submitted").length,
    rev = act.filter(c => c.stage === "revision").length;
  const actNote =
    [
      review && `${review} to review`,
      rev && `${rev} in revision`,
      act.length - review - rev > 0 && `${act.length - review - rev} in progress`,
    ]
      .filter(Boolean)
      .join(" · ") || "None running right now";
  const pct = bud.total ? Math.min(100, (bud.used / bud.total) * 100) : 0,
    opct = bud.total ? Math.min(100 - pct, (bud.owed / bud.total) * 100) : 0;

  /* who this is: a brand with no briefs and no deals yet gets "Post your first brief" and no zeros */
  const posted = s.jobs.filter(j => j.status !== "draft"),
    open = s.jobs.filter(j => j.status === "open"),
    draft = s.jobs.find(j => j.status === "draft");
  const isNew = !posted.length && !s.campaigns.length;
  const showNums = st.hired > 0 || act.length > 0 || held > 0;
  const n = k => WORDS[Math.min(k, 5)];
  const lede = isNew
    ? "Post a brief, and creators who fit will bid with a price and a date."
    : objs.length
      ? `${n(objs.length)} ${objs.length === 1 ? "needs" : "need"} you today${waits.length ? `, and ${n(waits.length).toLowerCase()} ${waits.length === 1 ? "is" : "are"} with creators` : ""}.`
      : waits.length
        ? `Nothing needs you right now. ${n(waits.length)} ${waits.length === 1 ? "is" : "are"} with creators.`
        : open.length
          ? `You're all caught up. ${open.length === 1 ? "One brief is" : `${open.length} briefs are`} taking bids.`
          : "You're all caught up.";

  /* needs you: the actions, then what is with creators; a quiet line while open briefs wait for bids */
  let needs = null;
  if (objs.length || waits.length || open.length) {
    const withOnly = !objs.length && waits.length;
    const quiet = open.length ? (
      <div className="home-quiet-row">
        <p className="home-quiet">
          {open.length === 1 ? (
            <>
              No new bids yet on <b>{open[0].title}</b>. Bids land here as creators send them.
            </>
          ) : (
            `No new bids yet on your ${open.length} open briefs. Bids land here as creators send them.`
          )}
        </p>
        <Lq as="a" className="lq-s lq-sm" href={open.length === 1 ? `#job-${open[0].id}` : "#jobs"}>
          {open.length === 1 ? "View brief" : "See briefs"}
          <Icon n="arrow" className="ic" />
        </Lq>
      </div>
    ) : null;
    needs = (
      <section key="needs" className="ll-panel home-sec home-today" aria-labelledby="homeTodayH">
        <div className="ll-panel-head">
          <div>
            <h2 className="ll-panel-h" id="homeTodayH">
              {withOnly ? "With creators" : "Needs you"}
            </h2>
            {withOnly ? (
              <p className="ll-panel-sub">Nothing needs you right now. These are waiting on the creator.</p>
            ) : null}
          </div>
        </div>
        {objs.length ? (
          <ul className={`home-strip home-strip-${Math.min(objs.length, 3)}`}>{objs}</ul>
        ) : withOnly ? null : (
          quiet
        )}
        {waits.length ? (
          <div className="home-waits">
            {objs.length ? <h3 className="t-eyebrow">With creators</h3> : null}
            <ul>{waits}</ul>
          </div>
        ) : null}
      </section>
    );
  }

  /* post a brief: the primary action for a new brand (or when nothing else needs you), quieter otherwise */
  const post = (
    <section
      key="post"
      className={`ll-panel home-sec home-post${isNew ? " is-first" : ""}`}
      aria-labelledby="homePostH"
    >
      {isNew ? (
        <img className="home-post-img" src="assets/step-01-envelope.svg" width="112" height="82" alt="" />
      ) : null}
      <div className="home-post-t">
        <h2 className="ll-panel-h" id="homePostH">
          {isNew ? "Post your first brief" : "Post a brief"}
          <span className="home-post-time"> · takes about 3 minutes</span>
        </h2>
        <p className="ll-panel-sub">
          {isNew
            ? "Say what you need and what you'll pay. Creators who fit bid with a price and a date, and you pay into escrow only when you hire."
            : "Need another creator? Creators who fit bid with a price and a date."}
        </p>
        {draft ? (
          <Lq as="a" className="lq-s lq-sm home-post-draft" href={`#post-${draft.id}`}>
            <Icon n="edit" className="ic" />
            Finish your draft: {draft.title || "Untitled brief"}
          </Lq>
        ) : null}
      </div>
      <Lq as="a" className={cta().replace(" lq-sm", "")} href="#post">
        <Icon n="plus" className="ic" />
        Post a brief
      </Lq>
    </section>
  );

  /* business check: where it stands, on Home, so nobody has to dig into #kyc to find out */
  const kyc = s.kyc || {},
    kst = String(kyc.status || "not_started"),
    kSteps = kyc.steps || {},
    kDone = ["pan", "id", "bank"].filter(k => kSteps[k] && kSteps[k].done).length;
  const KYC_CARD = {
    not_started: [
      "pill-paper",
      "Not started",
      "Verify your business",
      "Needed before you post a brief, send an offer or pay into escrow. 3 steps, about 4 minutes.",
      "Start verification",
    ],
    in_progress: [
      "pill-info",
      `${kDone} of 3 done`,
      "Finish verifying your business",
      "Needed before you post a brief, send an offer or pay into escrow. Pick up where you left off.",
      "Continue verification",
    ],
    pending: [
      "pill-info",
      "Under review",
      "We're checking your business",
      REVIEW_TIME + " You'll get a notification when it's done.",
      "See status",
    ],
    rejected: [
      "pill-err",
      "Needs a fix",
      "Your verification needs a fix",
      kyc.rejectionReason
        ? String(kyc.rejectionReason)
        : "One detail didn't match. Fix it and send it again.",
      "Fix it",
    ],
  };
  const kc = KYC_CARD[kst];
  const kycCard = kc ? (
    <section key="kyc" className={`ll-panel home-sec home-kyc is-${kst}`} aria-labelledby="homeKycH">
      <span className="home-kyc-ic" aria-hidden="true">
        <Icon n={kst === "rejected" ? "alert" : kst === "pending" ? "clock" : "shield"} />
      </span>
      <div className="home-kyc-t">
        <p className="home-kyc-top">
          <span className={`pill ${kc[0]}`}>{kc[1]}</span>
          <span className="t-eyebrow">Business check</span>
        </p>
        <h2 className="ll-panel-h" id="homeKycH">
          {kc[2]}
        </h2>
        <p className="ll-panel-sub">{kc[3]}</p>
      </div>
      <Lq as="a" className="lq-s" href="#kyc">
        {kst === "pending" ? null : <Icon n="lock" className="ic" />}
        {kc[4]}
      </Lq>
    </section>
  ) : null;

  /* the ink numbers card: only once there is something to count */
  const nums = showNums ? (
    <section key="nums" className="home-band" aria-label={`${s.me.brand} at a glance`}>
      <dl className="home-nums">
        <div>
          <dt>Creators hired</dt>
          <dd className="t-money" data-n={st.hired}></dd>
          <p className="home-num-s">
            {hiredCr.length ? (
              <>
                <span className="home-avs">
                  {hiredCr.slice(0, 3).map(c => (
                    <Av key={c.id} c={c} />
                  ))}
                </span>
                {hiredCr.map(c => c.name).join(" and ")}
              </>
            ) : (
              "Paid through escrow"
            )}
          </p>
        </div>
        <div>
          <dt>Active deals</dt>
          <dd className="t-money" data-n={act.length}></dd>
          <p className="home-num-s">{actNote}</p>
        </div>
        <div>
          <dt>Held in escrow</dt>
          <dd className="t-money" data-inr={held}></dd>
          <p className="home-num-s">
            <span className="pill pill-escrow">
              <Icon n="lock" />
              Released only when you approve
            </span>
          </p>
        </div>
      </dl>
      {bud.total ? (
        <div className="home-bud">
          <div className="home-bud-h">
            <p>
              <b>Budget used</b> · {bud.label}
            </p>
            <p className="num">
              <b>{L.inr(bud.used)}</b> of {L.inr(bud.total)}
            </p>
          </div>
          <div
            className="home-bud-bar"
            role="img"
            aria-label={`${Math.round(pct)}% of the ${bud.label} budget used${bud.owed ? `, ${L.inr(bud.owed)} more to pay for accepted invitations` : ""}`}
          >
            <i style={{ width: `${pct.toFixed(2)}%` }}></i>
            {bud.owed ? <i className="is-owed" style={{ width: `${opct.toFixed(2)}%` }}></i> : null}
          </div>
          <p className="home-bud-s">
            <span className="num">{L.inr(bud.left)}</span> left
            {bud.owed ? (
              <>
                {" "}
                · <span className="home-key"></span>
                {L.inr(bud.owed)} more once you pay accepted invitations
              </>
            ) : null}
          </p>
          <Lq as="a" className="lq-s lq-sm home-bud-a" href="#reports">
            <Icon n="chart" className="ic" />
            Spending report
          </Lq>
        </div>
      ) : null}
    </section>
  ) : null;

  /* creators for you: name and badge, niches, followers and engagement, then the price at the same size */
  const crCard = (c, i) => {
    const top = [...(c.platforms || [])].sort((a, b) => b.followers - a.followers)[0] || {
        p: "instagram",
        followers: 0,
        er: 0,
      },
      rate = lowestRate(c.rates);
    const saved = s.favorites.includes(c.id),
      inCart = s.cart.includes(c.id);
    const cats = c.categories || [];
    return (
      <li key={c.id}>
        <a className="home-cr" href={`#creator-${c.id}`}>
          {i === 0 ? (
            <span className="t-note home-note" aria-hidden="true">
              worth a look
            </span>
          ) : null}
          <div className="home-cr-top">
            <Av c={c} cls="lg" />
            <span className="home-cr-tags">
              {saved ? (
                <span className="pill pill-line">
                  <Icon n="bookmark" />
                  Saved
                </span>
              ) : null}
              {inCart ? (
                <span className="pill pill-line">
                  <Icon n="cart" />
                  In cart
                </span>
              ) : null}
            </span>
          </div>
          <p className="home-cr-n">
            <b>{c.name}</b>
            {c.verified ? (
              <span className="home-cr-v" title="Verified">
                <Icon n="verified" />
                <span className="sr-only">, verified</span>
              </span>
            ) : null}
          </p>
          <p className="home-cr-h">{[c.handle, c.city].filter(Boolean).join(" · ")}</p>
          {cats.length ? (
            <ul className="home-cr-niche" aria-label="Niches">
              {cats.slice(0, 2).map(x => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : null}
          <dl className="home-cr-st">
            <div>
              <dt>{top.p === "youtube" ? "Subscribers" : "Followers"}</dt>
              <dd>
                <Icon n={top.p === "youtube" ? "yt" : "ig"} />
                {top.followers > 0 ? L.compact(top.followers) : "—"}
              </dd>
            </div>
            <div>
              <dt>Engagement</dt>
              <dd>{top.er > 0 ? `${top.er}%` : "—"}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>
                {c.rating ? (
                  <>
                    <Icon n="star" />
                    {c.rating}
                  </>
                ) : (
                  "New"
                )}
              </dd>
            </div>
          </dl>
          <p className="home-cr-f">
            {rate ? (
              <>
                <span>From</span>
                <b className="num">{L.inr(rate.price)}</b>
                <span>per {rate.fmt}</span>
              </>
            ) : (
              <span>{RATE_ON_REQUEST}</span>
            )}
          </p>
        </a>
      </li>
    );
  };
  const creators = (
    <section key="crs" className="ll-panel home-sec home-crs" aria-labelledby="homeCrH">
      <div className="ll-panel-head">
        <div>
          <h2 className="ll-panel-h" id="homeCrH">
            Creators for you
          </h2>
          <p className="ll-panel-sub">
            Ranked on {(s.me.industry || "your industry").toLowerCase()}, verification, availability and
            rating.
          </p>
        </div>
        {crs.length ? (
          <a className="ll-panel-more" href="#creators" aria-label="See all creators">
            See all →
          </a>
        ) : null}
      </div>
      {crs.length ? (
        <ul className="home-cr-list">{crs.map(crCard)}</ul>
      ) : (
        <div className="home-quiet-row">
          <p className="home-quiet">You're working with everyone we'd suggest.</p>
          <Lq as="a" className="lq-s lq-sm" href="#creators">
            <Icon n="search" className="ic" />
            Search all creators
          </Lq>
        </div>
      )}
    </section>
  );

  return (
    <div className="view-in home" ref={root}>
      <header className="home-hi">
        <h1 className="home-greet">
          {greeting(now)}, {first(s.me.name)}.
        </h1>
        <p className="home-lede">
          {lede} <span className="sample">Sample data</span>
        </p>
        {kst === "verified" ? (
          <p className="home-verified">
            <span className="pill pill-ok">
              <Icon n="verified" />
              Business verified
            </span>
            <span>You can post briefs, send offers and hire with escrow.</span>
          </p>
        ) : null}
      </header>
      <div className="ll-stack home-secs">
        {kycCard}
        {isNew ? [post, creators] : [needs, nums, post, creators]}
      </div>
    </div>
  );
}

L.register("home", { title: "Home", nav: "home", Component: HomeScreen });
