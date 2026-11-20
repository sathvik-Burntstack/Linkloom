/* Home (#home): IST greeting, the ID check as one slim bar, "what needs you today" strip of real objects,
   then the "Briefs for you" and "Your bids" panels. Brief cards come from ui/brief-card, shared with #jobs.
   Also owns the notifications sheet opened by the #bell button in the top bar. Owner: Builder B.
   React screen (see src/shared/react/view.jsx). The brief grid is an island: React owns its box and the jobs kit's
   card markup and swipe/save/hide wiring run inside it, as on #jobs, until the brief card moves to React. */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BEST_FIT_MIN, BriefCard, StatusPill } from "../../ui/brief-card";
import { KYC_AFTER_ACCEPT, kycOwed, kycWaitText, openKyc } from "../../core/kyc-gate";
import { storedUser } from "@/shared/api/client";
import { firstTime } from "@/shared/ux";
import { Icon, Lq, openReactSheet, Photo } from "@/shared/react/view";

const L = window.LLD,
  esc = L.esc;
const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];

/* ---------- notifications sheet (#bell) ---------- */
function bellLabel() {
  const b = document.getElementById("bell");
  if (!b) return;
  const n = LLD_DATA.notifications.filter(x => !x.read).length;
  b.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
}
function Notifications({ close }) {
  const s = LLD_DATA;
  const [, redraw] = useState(0);
  useEffect(() => {
    L.jobkit && L.jobkit.mo("stagger", L.$$(".sheet .home-nt-i"));
  }, []);
  const list = [...s.notifications].sort((a, b) => L.D(b.at) - L.D(a.at));
  const unread = list.filter(n => !n.read).length;
  const allRead = () => {
    L.store.set(st => st.notifications.forEach(n => (n.read = true)), "notif-read-all");
    L.live && L.live.readAllNotifications().catch(() => undefined);
    flushSync(() => redraw(n => n + 1));
    L.toast("All marked as read");
    const first = document.querySelector(".sheet .home-nt-i");
    first && first.focus();
  };
  const open = n => {
    if (!n.read && L.live) L.live.readNotification(n.id).catch(() => undefined);
    L.store.set(() => {
      n.read = true;
    }, "notif-read");
    close(true);
    if (n.go) L.go(n.go);
  };
  return (
    <>
      {list.length ? (
        <>
          <div className="home-nt-h">
            <p className="t-small muted" aria-live="polite">
              {unread ? `${unread} unread` : "All caught up"}
            </p>
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
          <ul className="home-nt">
            {list.map(n => (
              <li key={n.id}>
                <button
                  className={`home-nt-i${n.read ? "" : " is-unread"}`}
                  type="button"
                  data-n={n.id}
                  onClick={() => open(n)}
                >
                  <span className="home-nt-dot" aria-hidden="true"></span>
                  <span className="home-nt-t">
                    <span>{n.text}</span>
                    <span className="home-nt-at">
                      {L.ago(n.at)}
                      {n.read ? null : <span className="sr-only">, unread</span>}
                    </span>
                  </span>
                  <Icon n="chevron" />
                </button>
              </li>
            ))}
          </ul>
          <p className="home-nt-foot sample">Sample notifications</p>
        </>
      ) : (
        <div className="empty home-nt-empty">
          <img src="assets/step-01-envelope.svg" width="140" height="103" alt="" />
          <p className="t-h2">You are all caught up.</p>
          <p className="muted">Bid updates, revision requests and payouts land here.</p>
        </div>
      )}
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
L.store.on(bellLabel);
bellLabel();

/* ---------- greeting by IST time ---------- */
/* hour of the app clock in IST */
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

/* ---------- ID check: one slim bar (C1), or a waiting card while it is under review ---------- */
/* The check has three steps on #kyc: PAN, identity proof, payout. Live data carries kyc.steps; the sample derives it. */
const KYC_TOTAL = 3;
function kycDone(k) {
  const st = k.steps;
  if (st) return [st.pan, st.id, st.bank].filter(Boolean).length;
  const payout =
    k.payoutMethod === "bank" ? !!(k.bank && k.bank.acc && k.bank.ifsc && k.bank.holder) : !!k.upi;
  return [!!(k.pan && k.panName), !!k.idDone, payout].filter(Boolean).length;
}
/* time left on the ID review: the API's estimate when it sends one, otherwise our promise (same words as #kyc) */
// TODO(backend): automatic PAN check so most reviews finish within 2 hours; expose an ETA on GET /v1/kyc/
// (for example "reviewEtaAt", the ISO time the review should be done), copied onto kyc.reviewEtaAt by live/creator mapKyc.
const reviewLeft = k => kycWaitText(k);
function KycBar({ k }) {
  if (k.status === "verified") return null;
  if (k.status === "under_review")
    return (
      <section className="home-kyc-wait" aria-labelledby="homeKycH">
        <span className="home-kyc-ic" aria-hidden="true">
          <Icon n="clock" />
        </span>
        <div className="home-kyc-wait-t">
          <p className="home-kyc-wait-h" id="homeKycH">
            We're checking your ID · {reviewLeft(k)}
          </p>
          <p className="t-small muted">
            Meanwhile, keep browsing collabs. We'll tell you the moment it's done.
          </p>
        </div>
        <Lq as="a" className="lq-s lq-sm" href="#jobs">
          Browse collabs
        </Lq>
      </section>
    );
  let tone = "",
    ic = "shield",
    main,
    rest,
    cta = "Continue",
    prog = null;
  if (k.status === "action_needed") {
    tone = " is-warn";
    ic = "alert";
    main = "One detail in your ID check needs fixing";
    rest = k.note || "Fix it to keep bidding.";
    cta = "Fix it";
  } else if (k.status === "rejected") {
    tone = " is-err";
    ic = "alert";
    main = "Your ID check was not approved";
    rest = k.note || "See what to change and try again.";
    cta = "See why";
  } else {
    const done = Math.min(kycDone(k), KYC_TOTAL),
      left = KYC_TOTAL - done;
    // progress only once something is done: a new creator never sees "0 of 3"
    if (done)
      prog = (
        <span className="home-kyc-prog">
          <span className="home-kyc-meter" aria-hidden="true">
            {Array.from({ length: KYC_TOTAL }, (_, i) => (
              <i key={i} className={i < done ? "is-done" : undefined}></i>
            ))}
          </span>
          {done} of {KYC_TOTAL} done
        </span>
      );
    if (!left) {
      main = "Your ID check is ready to send";
      rest = "send it for review";
    } else {
      const mins = Math.max(1, Math.round((4 * left) / KYC_TOTAL));
      main = `${left} ${left === 1 ? "step" : "steps"} to your first payout`;
      rest = `about ${mins} ${mins === 1 ? "minute" : "minutes"}`;
    }
  }
  return (
    <section className={`home-kyc-bar${tone}`} aria-label="ID check">
      <Icon n={ic} />
      <p className="home-kyc-bar-t" title={main + " · " + rest}>
        <b>{main}</b>
        <span> · {rest}</span>
      </p>
      {prog}
      <p className="ll-trust">
        <Icon n="lock" />
        Encrypted. Never shown to brands.
      </p>
      <Lq as="a" className="lq-s lq-sm home-kyc-go" href="#kyc">
        {cta}
        <Icon n="arrow" className="ic" />
      </Lq>
    </section>
  );
}

/* ---------- the best moment: first deal confirmed, first payout ---------- */
/* Shown on the visit after it happens, once per account and device (shared/ux firstTime). It stays for the rest of
   that visit until it is dismissed or its button is used. Only for a creator's real first: an account with more than
   one deal or payout never sees it, so turning this on doesn't congratulate old hands. */
let cheerNow = null,
  cheerDone = false;
const BID_WORD = {
  submitted: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
  completed: "Completed",
};
function cheerFor(s) {
  const u = storedUser();
  const uid = (u && u.id) || s.me.handle || "anon";
  /* first payout: the one deal approved and its money released */
  const paid = (s.ledger || []).filter(x => x.status === "paid");
  if (paid.length === 1) {
    const x = paid[0];
    return {
      key: `${uid}-first-payout`,
      ic: "coin",
      title: "Your first payout is in!",
      text: `${L.inr(x.amount)} from ${x.brand} was released to you.${s.payoutsEnabled === false ? " It's kept in your Linkloom balance until bank withdrawals open." : ""}`,
      cta: "See earnings",
      href: "#earnings",
    };
  }
  if (paid.length > 1) return null;
  /* first deal: one accepted bid or one hire (direct offers become deals without a bid) */
  const won = s.bids.filter(b => b.status === "accepted" || b.status === "completed");
  const deals = new Set([...s.active.map(a => a.job || "o:" + a.id), ...won.map(b => b.job)]);
  if (deals.size !== 1) return null;
  const a = s.active[0] || null,
    b = won[0] || null;
  if (a && (a.pay === "released" || a.stage === "approved")) return null; // already done: the payout moment covers it
  const j = b ? L.jobkit.job(b.job) : null;
  const brand = a ? a.brand : (j && j.brand) || (b && b.brand) || "The brand";
  const title = a ? a.title : (j && j.title) || (b && b.title) || "the collab";
  if (b && b.status === "accepted" && kycOwed())
    /* C10 trial: the bid went out before the ID check, so the deal waits on it */
    return {
      key: `${uid}-first-deal-kyc`,
      ic: "shield",
      title: "Your first deal is one step away",
      text: KYC_AFTER_ACCEPT,
      cta: "Verify ID",
      kyc: true,
    };
  return {
    key: `${uid}-first-deal`,
    ic: "check",
    title: "Your first deal is confirmed!",
    text: a
      ? `${brand} hired you for ${title}. The money is in escrow, so you can start.`
      : `${brand} picked your bid for ${title}. You can start once they pay into escrow.`,
    cta: a ? "Open the deal" : "See your bid",
    href: a ? "#work-" + a.id : "#bids",
  };
}
function bestMoment(s) {
  if (cheerDone) return null;
  if (cheerNow) return cheerNow;
  if (import.meta.env.VITE_TEST_HOOKS || !s.session.signedIn) return null; // never in the parity build or for guests
  const c = cheerFor(s);
  if (!c || !firstTime(c.key)) return null;
  return (cheerNow = c);
}

/* ---------- "Briefs for you": the brief cards, wired by the jobs kit (save, hide, swipe, keys) ----------
   Each paint draws fresh cards (keyed by the paint count) and keeps them until the next one, since the wiring,
   swipe and save stitch change the card nodes directly. */
function BriefGrid({ lead }) {
  const K = L.jobkit;
  const box = useRef(null);
  const [paintN, setPaintN] = useState(0);
  const [note, setNote] = useState(null);
  const wired = useRef(null);
  const paint = () => flushSync(() => setPaintN(n => n + 1));
  const cards = useMemo(() => {
    const all = K.openJobs()
      .filter(j => !K.isHidden(j.id) && !K.openBid(j.id))
      .sort((a, b) => b.match - a.match);
    // the big card is only for a real best fit (C5); otherwise four equal cards
    const feat = all.length && all[0].match >= BEST_FIT_MIN ? all[0] : null;
    const rest = all.slice(feat ? 1 : 0, feat ? 3 : 4);
    const anyOpen = K.openJobs().length > 0;
    if (!feat && !rest.length)
      return (
        <div className="empty home-empty" key={paintN}>
          <img src="assets/step-04-orbit.svg" width="160" height="117" alt="" />
          <p className="t-h2">No new matches right now.</p>
          <p className="muted">
            {anyOpen
              ? "You have bid on or hidden every collab that fits. New ones arrive most days."
              : "New collabs arrive most days. The ones that fit you will show up here."}
          </p>
          {anyOpen ? (
            <Lq as="a" className={lead ? "lq-p" : "lq-s"} href="#jobs">
              See all collabs
            </Lq>
          ) : null}
        </div>
      );
    return (
      <Fragment key={paintN}>
        {feat ? (
          <div className="home-feat">
            <BriefCard j={feat} variant="feature" ctx="home" primary={lead} />
          </div>
        ) : null}
        <div className="home-more">
          {rest.map((j, i) => (
            <BriefCard key={j.id} j={j} ctx="home" primary={lead && !feat && i === 0} />
          ))}
        </div>
      </Fragment>
    );
  }, [paintN]); // eslint-disable-line react-hooks/exhaustive-deps
  function hidden(id) {
    const j = K.job(id);
    K.flip(
      () => paint(),
      () => L.$$(".jobs-card", box.current),
    );
    setNote({ id, title: j.title });
  }
  useLayoutEffect(() => {
    const grid = box.current;
    if (wired.current) {
      wired.current.cleanup();
      grid.classList.add("is-settled"); // match rings fill once per visit, not on every repaint
    }
    wired.current = K.wire(grid, { onHide: id => hidden(id) });
  }, [paintN]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    K.mo("stagger", L.$$(".jobs-card", box.current));
    return () => wired.current && wired.current.cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onKey = e => {
    const c = e.target.closest(".jobs-card");
    if (!c || e.altKey || e.ctrlKey || e.metaKey || e.target.matches("input,textarea")) return;
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      K.toggleSave(c.dataset.id, box.current);
    }
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      K.setHidden(c.dataset.id, true);
      hidden(c.dataset.id);
    }
  };
  return (
    <>
      <div className="home-match-grid" id="homeGrid" ref={box} onKeyDown={onKey}>
        {cards}
      </div>
      <p className="home-hidden" aria-live="polite">
        {note === "back" ? (
          "Back in your matches."
        ) : note ? (
          <>
            Hidden “{note.title}”.{" "}
            <button
              className="btn-q"
              type="button"
              data-unhide={note.id}
              onClick={() => {
                K.setHidden(note.id, false);
                K.flip(
                  () => paint(),
                  () => L.$$(".jobs-card", box.current),
                );
                setNote("back");
              }}
            >
              Undo
            </button>
          </>
        ) : null}
      </p>
    </>
  );
}

function HomeScreen() {
  const K = L.jobkit,
    s = K.ensure(),
    now = L.today(); // the app clock, same one the top bar shows
  const [cheer, setCheer] = useState(() => bestMoment(s));
  const root = useRef(null);
  const readyEl = useRef(null);
  const first = s.me.name.split(/\s+/)[0];
  let when = "";
  try {
    const tz = { timeZone: "Asia/Kolkata" };
    const day = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", ...tz })
      .format(now)
      .replace(",", "");
    const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, ...tz })
      .format(now)
      .replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase());
    when = `${day} · ${time} IST`;
  } catch (e) {}
  void when;

  /* one primary button per screen: the first real ask on the page gets it, everything after is outlined */
  let primaryUsed = false;
  const prim = () => (primaryUsed ? "lq-s lq-sm" : ((primaryUsed = true), "lq-p lq-sm"));
  /* the best moment comes first and takes the one primary button and the one coloured block */
  const cheerBtn = cheer ? prim().replace(" lq-sm", "") : "";

  const revisions = s.active.filter(a => a.stage === "revision");
  const reviews = s.active.filter(a => a.stage === "review");
  const pending = s.ledger.filter(x => x.status === "pending").reduce((n, x) => n + x.amount, 0);
  const objs = [];
  revisions.forEach(a => {
    const dl = K.daysTo(a.due),
      th = s.threads.find(t => t.id === a.thread);
    objs.push(
      <li key={"r" + a.id} className="home-obj home-rev">
        <div className="home-obj-top">
          <span className="pill pill-warn">Revision requested</span>
          <span className="home-due">
            <Icon n="clock" />
            Due {L.fmtDate(a.due)} · {K.daysTxt(dl)}
          </span>
        </div>
        <p className="home-from">
          <span className="jobs-bi" aria-hidden="true">
            <Photo src={a.logo || (th && th.logo)}>{th ? th.bi : L.initials(a.brand)}</Photo>
          </span>
          {a.brand} asked
        </p>
        <blockquote className="home-quote">“{a.revision || "Please take another look."}”</blockquote>
        <p className="home-job">{a.title}</p>
        <div className="home-obj-act">
          <Lq as="a" className={prim()} href={`#work-${a.id}`}>
            Open the deal
          </Lq>
          {th ? (
            <Lq as="a" className="lq-s lq-sm" href={`#chat-${th.id}`}>
              Reply
            </Lq>
          ) : null}
        </div>
      </li>,
    );
  });
  reviews.forEach(a => {
    const up = a.uploads && a.uploads[a.uploads.length - 1];
    objs.push(
      <li key={"v" + a.id} className="home-obj home-review">
        <div className="home-obj-top">
          <span className="pill pill-info">In review</span>
          {up ? <span className="home-due">Sent {L.ago(up.at)}</span> : null}
        </div>
        <p className="home-obj-t">{a.brand} is reviewing your final cut</p>
        <p className="home-job">{a.title}</p>
        <ol className="home-track" aria-label="Stage">
          <li className="is-done">Kickoff</li>
          <li className="is-done">Upload</li>
          <li className="is-now" aria-current="step">
            Review
          </li>
        </ol>
        <div className="home-obj-act">
          <span className="pill pill-escrow">
            <Icon n="lock" />
            {L.inr(a.price)} in escrow
          </span>
          <Lq as="a" className="lq-s lq-sm" href={`#work-${a.id}`}>
            See status
            <Icon n="arrow" className="ic" />
          </Lq>
        </div>
      </li>,
    );
  });
  if (s.readyToWithdraw > 0)
    objs.push(
      <li key="money" className={`home-obj home-money ${cheer ? "is-quiet" : "ink-card dark"}`}>
        <p className="home-money-l">Ready to withdraw</p>
        <p className="t-money home-money-v" data-ready="" ref={readyEl}></p>
        <p className="home-money-s">
          Cleared funds only.{pending ? ` ${L.inr(pending)} still pending is not included.` : ""}
        </p>
        <div className="home-obj-act">
          <Lq as="a" className={prim()} href="#earnings">
            Withdraw
          </Lq>
          <span className="home-money-to">to UPI or bank</span>
        </div>
      </li>,
    );

  /* the lede only says nothing needs you when that is true: no open work, no money waiting, ID check done */
  const myBids = [...s.bids].sort((a, b) => L.D(b.sent) - L.D(a.sent));
  /* deals still being made (not approved, not cancelled): "nothing needs you" would not be true then (C1) */
  const working = s.active.filter(a => a.stage !== "approved" && a.pay !== "released");
  const lede = objs.length
    ? `${WORDS[Math.min(objs.length, 5)]} ${objs.length === 1 ? "needs" : "need"} you today.`
    : cheer
      ? "Good news since your last visit."
      : working.length
        ? `${working.length === 1 ? "Your deal is" : `${working.length} deals are`} in progress. Find the next collab while you work.`
        : s.kyc.status === "verified"
          ? "Nothing needs you right now. A good day to find a new collab."
          : myBids.length
            ? "Here are the collabs that fit you best."
            : "Find a collab that fits you and send your first bid.";
  const lead = !primaryUsed; // nothing above needs you, so the top brief's Bid is the one primary button

  /* Your bids: the latest three that are still in play */
  const shownBids = myBids.filter(b => b.status !== "withdrawn").slice(0, 3);
  const bidRow = b => {
    const j = K.job(b.job);
    const brand = j ? j.brand : b.brand || "Brand",
      title = j ? j.title : b.title || "Collab";
    const act = b.status === "accepted" ? s.active.find(a => a.job === b.job) : null;
    return (
      <li key={b.id}>
        <a className="home-bid" href={act ? "#work-" + act.id : "#bids"}>
          <span className="jobs-bi" aria-hidden="true">
            <Photo src={j && j.logo}>{j ? j.bi : L.initials(brand)}</Photo>
          </span>
          <span className="home-bid-t">
            <span className="home-bid-n">{title}</span>
            <span className="home-bid-s">
              {brand} · sent {L.fmtDate(b.sent)}
            </span>
          </span>
          <span className="home-bid-p">{L.inr(b.price)}</span>
          {b.status === "viewed" && b.shortlisted ? (
            <span className="pill pill-info">
              <Icon n="flag" />
              Shortlisted
            </span>
          ) : (
            <StatusPill status={b.status} label={BID_WORD[b.status] || ""} />
          )}
        </a>
      </li>
    );
  };

  useEffect(() => {
    K.mo("stagger", L.$$(".home-obj", root.current));
    L.$$(".home-obj", root.current).forEach(o => K.mo("press", o));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (readyEl.current) K.mo("count", readyEl.current, s.readyToWithdraw, L.inr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    cheerDone = true;
    flushSync(() => setCheer(null));
    const h = root.current.querySelector(".home-greet");
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
  };
  const cheerGo = e => {
    cheerDone = true;
    if (cheer.kyc) {
      e.preventDefault();
      openKyc("#bids");
    }
  };

  return (
    <div className={`view-in home${cheer ? " has-cheer" : ""}`} ref={root}>
      <header className="home-hi">
        <h1 className="home-greet">
          {greeting(now)}, {first}.
        </h1>
        <p className="home-lede">
          {lede} <span className="sample">Sample data</span>
        </p>
      </header>

      {cheer ? (
        <section className="ll-cheer home-cheer" aria-labelledby="homeCheerH">
          <span className="ll-cheer-ic" aria-hidden="true">
            <Icon n={cheer.ic} />
          </span>
          <p className="ll-cheer-t">
            <b id="homeCheerH">{cheer.title}</b>
            <span>{cheer.text}</span>
          </p>
          {cheer.kyc ? (
            <Lq className={cheerBtn} data-cheer-go="" onClick={cheerGo}>
              <Icon n="shield" />
              {cheer.cta}
            </Lq>
          ) : (
            <Lq as="a" className={cheerBtn} href={cheer.href} data-cheer-go="" onClick={cheerGo}>
              {cheer.cta}
            </Lq>
          )}
          <button className="ll-cheer-x" type="button" data-cheer-x="" aria-label="Dismiss" onClick={dismiss}>
            <Icon n="close" />
          </button>
        </section>
      ) : null}
      {cheer && cheer.kyc ? null : <KycBar k={s.kyc} />}

      <div className="ll-stack home-stack">
        {objs.length ? (
          <section className="home-today" aria-labelledby="homeTodayH">
            <h2 className="sr-only" id="homeTodayH">
              What needs you today
            </h2>
            <ul className="home-strip">{objs}</ul>
          </section>
        ) : null}

        <section className="ll-panel home-panel home-match" aria-labelledby="homeMatchH">
          <div className="ll-panel-head">
            <div>
              <h2 className="ll-panel-h" id="homeMatchH">
                Collabs for you
              </h2>
              <p className="ll-panel-sub">Ranked on platform, niche, language, city, budget and deadline.</p>
            </div>
            <a className="ll-panel-more" href="#jobs" aria-label="See all collabs">
              See all →
            </a>
          </div>
          <p className="home-hint help">
            <Icon n="info" />
            Swipe a collab right to save it, left to hide it. The buttons do the same.
          </p>
          <BriefGrid lead={lead} />
        </section>

        <section className="ll-panel home-panel home-bids" aria-labelledby="homeBidsH">
          <div className="ll-panel-head">
            <h2 className="ll-panel-h" id="homeBidsH">
              Your bids
            </h2>
            {myBids.length ? (
              <a className="ll-panel-more" href="#bids" aria-label="See all your bids">
                See all →
              </a>
            ) : null}
          </div>
          {shownBids.length ? (
            <ul className="home-bids-list">{shownBids.map(bidRow)}</ul>
          ) : (
            <p className="home-bids-none">
              {myBids.length
                ? "No bids in play right now. Your earlier bids are in My bids."
                : "No bids yet. Pick a collab above and send your first bid. It takes about a minute."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

L.register("home", { title: "Home", nav: "home", Component: HomeScreen });
