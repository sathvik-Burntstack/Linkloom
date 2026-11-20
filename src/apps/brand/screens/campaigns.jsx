/* Brand side · Campaigns (#campaigns) and one campaign (#campaign-<id>). Builder C. The pay sheet is in pay.jsx.
   Mirrors the creator Active jobs list and work page (ticket list, stage rail with a money lane, a "now" panel, paperwork).
   Stages: invited → accepted → funded → in_progress → submitted → revision → approved → released, or declined / cancelled / refunded.
   Colour is meaning: violet = your move (the brand), coral = the creator's move, plum = money held in escrow.
   React screens (see src/shared/react/view.jsx). */
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq } from "@/shared/react/view";
import { Cav, CrMini, Glyph, Ver } from "./kit";
import { previewDelivery } from "./pay";

const L = window.LLD,
  esc = L.esc;
const S = () => window.LLD_DATA;
const K = () => L.bk;

const STAGES = [
  { k: "invited", n: "Invited", nJob: "Bid" },
  { k: "accepted", n: "Accepted" },
  { k: "funded", n: "Paid in" },
  { k: "in_progress", n: "In progress" },
  { k: "submitted", n: "Delivered" },
  { k: "revision", n: "Revision" },
  { k: "approved", n: "Approved" },
  { k: "released", n: "Released" },
];
const LONG = {
  invited: "Invitation sent, waiting for the creator",
  accepted: "Accepted, waiting for your payment",
  funded: "Paid into escrow, creator is starting",
  in_progress: "Creator is making the content",
  submitted: "Delivered, waiting for your review",
  revision: "Revision asked, creator is on it",
  approved: "Approved, release the payment",
  released: "Paid and complete",
  declined: "Creator declined the invitation",
  cancelled: "You cancelled the invitation",
  refunded: "Refunded to you",
};
const ENDS = { declined: "Declined", cancelled: "Cancelled", refunded: "Refunded" };
const HELD = ["funded", "in_progress", "submitted", "revision", "approved"];
const who = c =>
  ({
    accepted: "you",
    submitted: "you",
    approved: "you",
    released: c.review ? "done" : "you",
    invited: "creator",
    funded: "creator",
    in_progress: "creator",
    revision: "creator",
  })[c.stage] || "done";
const WhoPill = ({ c }) =>
  ({
    you: <span className="pill pill-violet">Your move</span>,
    creator: <span className="pill pill-coral">Creator’s move</span>,
    done: <span className="pill pill-ok">Done</span>,
  })[who(c)];
/* where an ended campaign stopped on the rail */
const reached = c =>
  c.stage === "refunded"
    ? c.refundedFrom
      ? STAGES.findIndex(x => x.k === c.refundedFrom)
      : c.funded
        ? 2
        : 1
    : 0;
const ix = c => {
  const i = STAGES.findIndex(x => x.k === c.stage);
  return i >= 0 ? i : reached(c);
};
const isEnd = c => !!ENDS[c.stage];
const payState = c =>
  c.stage === "released"
    ? "released"
    : c.stage === "refunded"
      ? "refunded"
      : HELD.includes(c.stage)
        ? "held"
        : "none";
/* the lock icon with its shackle as its own path, so it can swing shut (CSS .cg-shackle) */
const LockIc = () => (
  <svg
    className=""
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path className="cg-shackle" d="M7 11V8a5 5 0 0 1 10 0v3" />
    <path d="M5 11h14v10H5z" />
  </svg>
);
const PayPill = ({ c }) =>
  ({
    none: <span className="pill pill-line">{c.stage === "accepted" ? "Not paid yet" : "Nothing paid"}</span>,
    held: (
      <span className="pill pill-escrow cg-lockin">
        <LockIc />
        In escrow
      </span>
    ),
    released: (
      <span className="pill pill-ok">
        <Icon n="check" />
        Released
      </span>
    ),
    refunded: (
      <span className="pill pill-paper">
        <Icon n="refund" />
        Refunded
      </span>
    ),
  })[payState(c)];
const logAt = (c, kind) => {
  const e = (c.log || []).filter(x => x[1] === kind).pop();
  return e ? e[0] : null;
};
const log = (c, kind) => {
  (c.log = c.log || []).push([K().nowISO(), kind]);
};
const thread = c =>
  S().threads.find(t => t.id === c.thread) || S().threads.find(t => t.campaign === c.id) || null;
/* deliverable lines: the cart's structured items when present ({platform, format, count, notes}), else the plain strings */
const dlItems = (c, j) =>
  Array.isArray(c.items) && c.items.length
    ? c.items.map(it => ({
        p: it.platform || c.platform,
        t: `${it.count || 1} ${it.format || c.format || "post"}${(it.count || 1) > 1 && !/s$/.test(it.format || "") ? "s" : ""} on ${K().plat(it.platform || c.platform)}`,
        sub: it.notes || "",
      }))
    : ((c.deliverables && c.deliverables.length ? c.deliverables : j ? j.deliverables : []) || []).map(x => ({
        t: x,
        sub: "",
      }));
const deal = c => {
  const j = c.job ? K().job(c.job) : null;
  return {
    brief: j ? j.brief : null,
    usage: j ? j.usage : null,
    languages: j ? j.languages : null,
    deliverables: (c.deliverables && c.deliverables.length ? c.deliverables : j ? j.deliverables : []) || [],
    items: dlItems(c, j),
  };
};
const due = c => {
  if (c.stage === "released") return c.released ? "Paid " + L.fmtDate(c.released) : "Paid";
  if (isEnd(c)) return ENDS[c.stage] + (c[c.stage] ? " " + L.fmtDate(c[c.stage]) : "");
  if (!c.due) return "No date set";
  const n = K().daysTo(c.due);
  return n < 0
    ? `${-n} day${n === -1 ? "" : "s"} late`
    : n === 0
      ? "Due today"
      : `Due ${L.fmtDate(c.due)} · ${n} day${n === 1 ? "" : "s"} left`;
};
const next = c => {
  const k = K().cr(c.creator),
    f = K().first(k),
    d = c.deliveries || [];
  return (
    {
      invited: `Waiting for ${f} to accept. Nothing is paid until then.`,
      accepted: `${f} accepted. Pay ${L.inr(c.price)} into escrow to start.`,
      funded: `${f} has the brief and is starting.`,
      in_progress: `${f} is making it. ${c.due ? "Due " + L.fmtDate(c.due) + "." : ""}`,
      submitted: `v${d.length || 1} is in. Approve it or ask for a revision.`,
      revision: `You asked: “${c.revisionNote || "see chat"}”`,
      approved: `Approved. Release ${L.inr(c.price)} to ${f}.`,
      released: c.review ? `You rated ${f} ${c.review.rating} of 5.` : `Paid. Rate and review ${f}.`,
      declined: c.declineNote ? `${f} declined: “${c.declineNote}”` : `${f} declined. Nothing was paid.`,
      cancelled: "You cancelled before it was accepted. Nothing was paid.",
      refunded: c.refundReason || "Escrow returned in full.",
    }[c.stage] || ""
  );
};
const order = c => ({ you: 0, creator: 1, done: 2 })[who(c)];
const sorted = list =>
  [...list].sort((x, y) => order(x) - order(y) || String(x.due || "").localeCompare(String(y.due || "")));
const campPays = c => S().payments.filter(p => p.campaign === c.id);

/* ====================================================================================
   #campaigns: one ticket per hire, grouped by whose move it is
   ==================================================================================== */
const FILTERS = [
  ["all", "All"],
  ["you", "Your move"],
  ["creator", "Creator’s move"],
  ["done", "Done"],
];
const GROUPS = [
  ["you", "Your move"],
  ["creator", "Creator’s move"],
  ["done", "Done"],
];

function Ticket({ c }) {
  const k = K().cr(c.creator),
    i = ix(c),
    t = thread(c),
    w = who(c),
    used = (c.revisionsUsed || 0) > 0,
    end = isEnd(c);
  const late = !end && c.stage !== "released" && c.due && K().daysTo(c.due) < 0;
  return (
    <li className={`cg-tk${end ? " is-ended" : ""}`} data-who={w} data-id={c.id}>
      <div className="cg-tk-a">
        <Cav c={k} />
        <div className="cg-tk-tx">
          <p className="cg-tk-brand">
            {k.name}
            <span aria-hidden="true">·</span>
            <Glyph p={c.platform} />
            <span>{c.format || ""}</span>
            <span aria-hidden="true">·</span>
            <span>{c.source === "job" ? "From a brief" : "Direct invite"}</span>
          </p>
          <h3 className="cg-tk-t">
            <a className="cg-tk-link" href={`#campaign-${c.id}`}>
              {c.title}
            </a>
          </h3>
          <p className="cg-tk-next">{next(c)}</p>
        </div>
      </div>
      <div className="cg-tk-rail">
        <ol className="cg-mini" aria-label={LONG[c.stage] || c.stage}>
          {STAGES.map((st, n) => {
            const skip = st.k === "revision" && !used && n !== i;
            const cls = end
              ? n < i || (n === i && c.stage === "refunded")
                ? "is-done"
                : n === i
                  ? "is-end"
                  : "is-off"
              : n < i && !skip
                ? "is-done"
                : n === i
                  ? "is-now"
                  : "";
            return <li key={n} className={`${cls}${skip && !end ? " is-skip" : ""}`}></li>;
          })}
        </ol>
        <p className="cg-tk-stage">
          <WhoPill c={c} />
          <span>{LONG[c.stage] || ""}</span>
        </p>
      </div>
      <div className="cg-tk-m">
        <p className="t-money cg-tk-price">{L.inr(c.price)}</p>
        <PayPill c={c} />
        <p className={`cg-tk-due${late ? " is-late" : ""}`}>
          <Icon n="clock" />
          <span>{due(c)}</span>
        </p>
      </div>
      {t ? (
        <a
          className="cg-tk-chat"
          href={`#chat-${t.id}`}
          aria-label={`Chat with ${k.name}${t.unread ? `, ${t.unread} unread` : ""}`}
        >
          <Icon n="chat" />
          {t.unread ? <b>{t.unread}</b> : null}
        </a>
      ) : null}
    </li>
  );
}

function DealsList() {
  const s = S(),
    u = K().ui("camps");
  const [f, setF] = useState(FILTERS.some(x => x[0] === u.f) ? u.f : "all");
  const root = useRef(null),
    heldEl = useRef(null);
  const list = sorted(s.campaigns),
    held = L.heldInEscrow();
  useLayoutEffect(() => {
    if (!root.current || !list.length) return;
    K().mo("count", heldEl.current, held, L.inr);
    K().mo(
      "stagger",
      L.$$(".cg-tk", root.current).filter(r => !r.closest("[hidden]")),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.campaigns.length)
    return (
      <div className="view-in cg">
        <header className="cg-head">
          <div className="cg-head-t">
            <h1 className="t-h1">Deals</h1>
          </div>
        </header>
        <div className="empty cg-empty">
          <img src="assets/trust-lock-coin.svg" width="200" height="140" alt="" />
          <p className="t-h2">No deals yet</p>
          <p className="muted">
            When you hire from a brief or a creator accepts your invitation, it lands here with its stage,
            payment and chat.
          </p>
          <div className="row wrap cg-empty-cta">
            <Lq as="a" className="lq-p" href="#creators">
              Find creators
            </Lq>
            <Lq as="a" className="lq-s" href="#post">
              Post a brief
            </Lq>
          </div>
        </div>
      </div>
    );
  const count = k => (k === "all" ? list.length : list.filter(c => who(c) === k).length);
  const groups = GROUPS.map(([k, n]) => [k, n, list.filter(c => who(c) === k)]).filter(g => g[2].length);
  const shown = groups.filter(([k]) => f === "all" || k === f).length;
  return (
    <div className="view-in cg" ref={root}>
      <header className="cg-head">
        <div className="cg-head-t">
          <h1 className="t-h1">Deals</h1>
          <p className="muted">
            Every hire, from your briefs and direct invitations.{" "}
            {count("you")
              ? `${count("you")} need${count("you") === 1 ? "s" : ""} you.`
              : "Nothing needs you right now."}{" "}
            <span className="sample">Sample data</span>
          </p>
        </div>
        {held ? (
          <div className="cg-held">
            <span className="cg-coin" aria-hidden="true">
              ₹
            </span>
            <p>
              <span className="cg-held-l">Held in escrow</span>
              <b className="t-money" data-held="" ref={heldEl}>
                {L.inr(held)}
              </b>
            </p>
            <p className="t-note cg-held-note" aria-hidden="true">
              released only when you approve
            </p>
          </div>
        ) : null}
      </header>
      <div className="seg cg-seg" role="group" aria-label="Filter deals">
        {FILTERS.map(([k, n]) => (
          <button
            key={k}
            type="button"
            data-f={k}
            aria-pressed={String(k === f)}
            onClick={() => {
              if (k === f) return;
              u.f = k;
              K().flip(() => flushSync(() => setF(k)), L.$$(".cg-tk", root.current));
            }}
          >
            {n}
            <span className="cg-seg-n">{count(k)}</span>
          </button>
        ))}
      </div>
      <div className="cg-groups">
        {groups.map(([k, n, rows]) => (
          <section
            key={k}
            className="cg-group"
            data-g={k}
            aria-labelledby={`cgg-${k}`}
            hidden={!(f === "all" || k === f)}
          >
            <h2 className="jl-gh" id={`cgg-${k}`}>
              <span className="t-h2">{n}</span>
              <span className="jl-gn num">{rows.length}</span>
            </h2>
            <ol className="cg-list">
              {rows.map(c => (
                <Ticket key={c.id} c={c} />
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="cg-none muted" hidden={shown > 0}>
        Nothing here right now.
      </p>
    </div>
  );
}
L.register("campaigns", { title: "Deals", nav: "campaigns", Component: DealsList });

/* ====================================================================================
   #campaign-<id>: the production board for one hire
   ==================================================================================== */
const LOGT = {
  invited: () => "Invitation sent",
  accepted: c =>
    c.source === "job" ? `Bid confirmed at ${L.inr(c.price)}` : `Accepted at ${L.inr(c.price)}`,
  funded: c => `${L.inr(c.price)} paid into escrow`,
  in_progress: () => "Work started",
  submitted: () => "Delivery received",
  revision: () => "Revision asked",
  approved: () => "Delivery approved",
  released: c => `${L.inr(c.price)} released to the creator`,
  declined: () => "Invitation declined",
  cancelled: () => "You cancelled the invitation",
  invite: () => "Invitation sent",
  sent: () => "Invitation sent",
  refunded: c => `${L.inr(c.price)} refunded to you`,
  reviewed: () => "You left a review",
};

function Rail({ c, from }) {
  const cur = ix(c),
    end = isEnd(c),
    used = c.revisionsUsed || 0,
    inc = c.revisionsIncluded || 1;
  const pull0 = Math.max(0, Math.min(from == null ? cur - 1 : from, cur - 1));
  const dateOf = {
    invited: logAt(c, "invited"),
    accepted: logAt(c, "accepted"),
    funded: logAt(c, "funded") || c.funded,
    in_progress: logAt(c, "in_progress"),
    submitted: logAt(c, "submitted") || ((c.deliveries || [])[0] || {}).at,
    revision: logAt(c, "revision"),
    approved: logAt(c, "approved"),
    released: logAt(c, "released") || c.released,
  };
  const ahead = {
    accepted: "Creator accepts",
    funded: "You pay in",
    in_progress: "Creator starts",
    submitted: c.due ? "Due " + L.fmtDate(c.due) : "Delivery",
    approved: "You approve",
    released: "You release",
  };
  const nodes = (end ? STAGES.slice(0, cur + 1) : STAGES).map((st, i) => {
    let cls = i < cur ? "is-done" : i === cur && !end ? "is-now" : i === cur ? "is-done" : "is-next",
      sub,
      state = i < cur || (end && i === cur) ? "done" : i === cur ? "current stage" : "not yet";
    if (i <= cur && dateOf[st.k]) sub = (i === cur && !end ? "Now · " : "") + L.fmtDate(dateOf[st.k]);
    else if (i === cur && !end) sub = "Now";
    else if (i < cur && st.k === "invited" && c.source === "job") sub = "From your brief";
    else sub = i < cur ? "Done" : ahead[st.k] || "";
    if (st.k === "revision" && i !== cur) {
      if (used) {
        sub = `${used} of ${inc} used`;
        if (i > cur) cls = "is-next is-used";
      } else {
        cls = (i < cur ? "is-done" : "is-next") + " is-skip";
        sub = i < cur ? "Not needed" : "Only if needed";
        state = i < cur ? "not needed" : "only if needed";
      }
    }
    const name = st.k === "invited" && c.source === "job" ? st.nJob : st.n;
    const pull = !end && i >= pull0 && i < cur;
    const now = i === cur && !end;
    return (
      <li
        key={i}
        className={`cw-node ${cls}${pull ? " is-pull" : ""}`}
        style={pull ? { "--k": i - pull0 } : now ? { "--k": Math.max(0, cur - pull0) } : undefined}
        aria-current={now ? "step" : undefined}
      >
        <span className="cw-nh">
          <span className="cw-n" aria-hidden="true">
            0{i + 1}
          </span>
          <span className="cw-nt">
            {name}
            <span className="sr-only">, {state}</span>
          </span>
        </span>
        <span className="cw-rl" aria-hidden="true">
          <i></i>
        </span>
        <span className="cw-nd">{sub}</span>
      </li>
    );
  });
  if (end)
    nodes.push(
      <li key="end" className={`cw-node is-end is-${c.stage}`} aria-current="step">
        <span className="cw-nh">
          <span className="cw-n" aria-hidden="true">
            —
          </span>
          <span className="cw-nt">
            {ENDS[c.stage]}
            <span className="sr-only">, where it ended</span>
          </span>
        </span>
        <span className="cw-rl" aria-hidden="true">
          <i>
            <Icon n={c.stage === "refunded" ? "refund" : "close"} />
          </i>
        </span>
        <span className="cw-nd">
          {c[c.stage] ? L.fmtDate(c[c.stage]) : c.stage === "cancelled" ? "By you" : "By the creator"}
        </span>
      </li>,
    );
  return (
    <ol className="cw-rail" style={{ "--n": 8 }}>
      {nodes}
    </ol>
  );
}

function Money({ c }) {
  const st = payState(c),
    f = K().first(K().cr(c.creator));
  const fund = logAt(c, "funded") || c.funded,
    rel = logAt(c, "released") || c.released,
    ref = c.refunded;
  const inTxt =
    st === "none"
      ? c.stage === "accepted"
        ? "Your move: pay to start"
        : "After the creator accepts"
      : "Paid " + (fund ? L.fmtDate(fund) : "");
  return (
    <div className="cw-money" data-pay={st}>
      <div
        className={`cw-mn cw-mn-in${st === "none" ? (c.stage === "accepted" ? " is-now" : "") : " is-done"}`}
      >
        <span className="cw-mdot" data-slot="in" aria-hidden="true"></span>
        <b>Paid in</b>
        <span>{inTxt}</span>
      </div>
      <div className={`cw-mn cw-mn-hold${st === "held" ? " is-now" : st === "none" ? "" : " is-done"}`}>
        <span className="cw-mdot" data-slot="hold" aria-hidden="true"></span>
        <b>Held in escrow</b>
        <span>
          {st === "held"
            ? "Since " + L.fmtDate(fund || K().nowISO()) + " · by Linkloom"
            : st === "none"
              ? "Linkloom holds it while the work happens"
              : st === "released"
                ? "Until you approved"
                : "Until the refund"}
        </span>
        <span className="cw-band" aria-hidden="true"></span>
      </div>
      <div className={`cw-mn cw-mn-out${st === "released" || st === "refunded" ? " is-now" : ""}`}>
        <span className="cw-mdot" data-slot="out" aria-hidden="true"></span>
        <b>{st === "refunded" ? "Refunded to you" : "Released to " + f}</b>
        <span>
          {st === "released"
            ? L.fmtDate(rel || K().nowISO())
            : st === "refunded"
              ? ref
                ? L.fmtDate(ref)
                : "In full"
              : "When you approve"}
        </span>
      </div>
    </div>
  );
}

const STARS = ["Poor", "Fair", "Good", "Very good", "Great"];
function ReviewForm({ c, k, onSaved, onCancel }) {
  const r = c.review || {};
  const [rating, setRating] = useState(r.rating || 0);
  const [text, setText] = useState(r.text || "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const f = K().first(k);
  const submit = async e => {
    e.preventDefault();
    if (!rating) {
      setErr("Pick a rating from 1 to 5 stars.");
      box.current.querySelector("input[name=rate]").focus();
      return;
    }
    if (L.live) {
      setBusy(true);
      try {
        await L.live.review(c.id, rating, text.trim());
      } catch (er) {
        setBusy(false);
        setErr(L.live.errorText(er));
        return;
      }
    }
    onSaved(rating, text.trim());
  };
  return (
    <form className="cw-review" noValidate onSubmit={submit} ref={box}>
      <fieldset className="cw-rate">
        <legend className="t-label">How was working with {f}?</legend>
        <div className="cw-stars" role="radiogroup">
          {STARS.map((t, i) => (
            <label key={i} className="cw-star">
              <input
                type="radio"
                name="rate"
                value={i + 1}
                checked={rating === i + 1}
                onChange={() => setRating(i + 1)}
              />
              <span className="cw-star-i">
                <Icon n="star" />
              </span>
              <small>{t}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="cwRvTx">
          Your review <span className="muted">(shows on {f}’s profile)</span>
        </label>
        <textarea
          className="textarea"
          id="cwRvTx"
          maxLength={400}
          rows={3}
          placeholder="Was it on time, on brief, easy to work with? What did your audience think?"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <p className="help num" id="cwRvN">
          {text.length} / 400
        </p>
      </div>
      <p className="err" id="cwRvErr" aria-live="polite">
        {err}
      </p>
      <div className="row wrap">
        <Lq className="lq-p" type="submit" disabled={busy}>
          {c.review ? "Update review" : "Save review"}
        </Lq>
        {c.review ? (
          <Lq className="lq-s" data-rvcancel="" onClick={onCancel}>
            Cancel
          </Lq>
        ) : null}
      </div>
      <p className="help">
        Your rating counts toward {f}’s average, which brands filter by in creator search.
      </p>
    </form>
  );
}
const StarsRow = ({ n }) => (
  <span className="cw-starrow" aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} className={i <= n ? "is-on" : ""}>
        <Icon n="star" />
      </span>
    ))}
  </span>
);

function NowPanel({ c, ui, act }) {
  const k = K().cr(c.creator),
    f = K().first(k),
    t = thread(c),
    d = c.deliveries || [],
    last = d[d.length - 1];
  const [vErr, setVErr] = useState({ msg: "", invalid: false });
  const [busy, setBusy] = useState("");
  const vn = useRef(null);
  const head = title => (
    <div className="cw-now-h">
      <WhoPill c={c} />
      <h2 className="t-h2" id="cwNowH">
        {title}
      </h2>
    </div>
  );
  const Sample = ({ children }) => (
    <div className="bk-sample" role="group" aria-label="Sample controls for the creator side">
      <p>
        <span className="sample">Sample</span> Creator side, for this demo
      </p>
      <div className="row wrap">{children}</div>
    </div>
  );
  const cr = (kind, label) => (
    <Lq className="lq-s lq-sm" data-cr={kind} onClick={() => act.creatorSide(kind)}>
      {label}
    </Lq>
  );
  const chatBtn = t ? (
    <Lq as="a" className="lq-s lq-sm" href={`#chat-${t.id}`}>
      <Icon n="chat" />
      Chat with {f}
    </Lq>
  ) : null;
  const revMeter = () => {
    const inc = c.revisionsIncluded || 1,
      used = c.revisionsUsed || 0;
    return (
      <p className="cw-revs">
        <span className="cw-revs-d" aria-hidden="true">
          {Array.from({ length: inc }, (_, i) => (
            <i key={i} className={i < used ? "is-used" : ""}></i>
          ))}
        </span>
        <span>
          Revisions used{" "}
          <b className="num">
            {used} of {inc}
          </b>{" "}
          included
        </span>
      </p>
    );
  };
  switch (c.stage) {
    case "invited":
      return (
        <>
          {head(`Waiting for ${f} to accept`)}
          <p className="cw-now-p">
            You invited {f} on {L.fmtDate(logAt(c, "invited") || K().nowISO())} for {L.inr(c.price)}. Creators
            usually answer within two days. Nothing is paid until {f} accepts, so you can still cancel.
          </p>
          <div className="row wrap">
            <Lq className="lq-s" data-cancelinv="" onClick={act.cancelInvite}>
              Cancel invitation
            </Lq>
          </div>
          <Sample>
            {cr("accept", "Accept the invitation")}
            {cr("decline", "Decline it")}
          </Sample>
        </>
      );
    case "accepted":
      return (
        <>
          {head("Pay into escrow to start")}
          <p className="cw-now-p">
            {f} {c.source === "job" ? "is confirmed" : "accepted"}. Pay the agreed price into escrow. Linkloom
            holds it, {f} sees it is paid and starts, and it is released only when you approve.
          </p>
          <p className="cw-due">
            <span className="t-money" data-amt="">
              {L.inr(c.price)}
            </span>
            <span className="muted">No platform fee. Taxes as per confirmed rules.</span>
          </p>
          <Lq className="lq-p" data-payescrow="" onClick={() => L.payEscrow(c.id)}>
            <Icon n="lock" />
            Pay {L.inr(c.price)} into escrow
          </Lq>
          <p className="ll-trust">
            <Icon n="lock" />
            Held safely until you approve.
          </p>
          <p className="help cw-chatlock">
            <Icon n="chat" />
            Chat with {f} opens once you pay.
          </p>
        </>
      );
    case "funded":
    case "in_progress":
      return (
        <>
          {head(c.stage === "funded" ? `${f} is starting` : `${f} is making it`)}
          <p className="cw-now-p">
            {L.inr(c.price)} is held in escrow. {c.due ? `The delivery is due ${L.fmtDate(c.due)}. ` : ""}You
            get a notification when it is in.
          </p>
          <div className="row wrap">{chatBtn}</div>
          <Sample>
            {c.stage === "funded" ? cr("start", "Start work") : null}
            {cr("deliver", "Submit a delivery")}
          </Sample>
        </>
      );
    case "submitted": {
      const inc = c.revisionsIncluded || 1,
        used = c.revisionsUsed || 0,
        canRev = used < inc;
      const note = () => (vn.current ? vn.current.value.trim() : "");
      return (
        <>
          {head("Review the delivery")}
          {last ? (
            <div className="cw-dv is-cur">
              <span className="cw-v">v{last.v}</span>
              <span className="cw-dv-n">
                <b>{last.file}</b>
                <span className="muted">{L.fmtDate(last.at) + ", " + K().time(last.at)}</span>
              </span>
              <Lq className="lq-s lq-sm" data-openfile={last.v} onClick={() => act.openFile(last)}>
                <Icon n="download" className="ic" />
                Open
              </Lq>
            </div>
          ) : null}
          {last && last.note ? (
            <figure className="cw-note">
              <blockquote className="cw-quote">
                <p>“{last.note}”</p>
              </blockquote>
              <figcaption>
                <Cav c={k} />
                <span>
                  <b>{k.name}</b>
                  <span className="muted">Note with v{last.v}</span>
                </span>
              </figcaption>
            </figure>
          ) : null}
          {revMeter()}
          <div className={`field cw-vnote${vErr.msg ? " is-err" : ""}`} id="fVnote">
            <label htmlFor="cwVnote">
              Note for {f} <span className="muted">(needed for a revision)</span>
            </label>
            <textarea
              className="textarea"
              id="cwVnote"
              rows={3}
              maxLength={300}
              placeholder="What should change? Be specific: the hook, a line, a frame."
              aria-describedby="cwVnoteErr"
              aria-invalid={vErr.invalid ? "true" : undefined}
              defaultValue={ui.vnote || ""}
              ref={vn}
              onInput={e => {
                ui.vnote = e.currentTarget.value;
                if (e.currentTarget.value.trim()) setVErr(x => ({ msg: "", invalid: x.invalid }));
              }}
            />
            <p className="err" id="cwVnoteErr">
              {vErr.msg}
            </p>
          </div>
          <div className="row wrap cw-verify">
            <Lq
              className="lq-p"
              data-approve=""
              disabled={busy === "approve"}
              onClick={() => {
                if (L.live) setBusy("approve");
                act.approve(note(), () => setBusy(""));
              }}
            >
              <Icon n="check" />
              Approve delivery
            </Lq>
            <Lq
              className="lq-s"
              data-revise=""
              disabled={!canRev || busy === "revise"}
              aria-disabled={canRev ? undefined : "true"}
              onClick={() => {
                const n = note();
                if (n.length < 8) {
                  flushSync(() =>
                    setVErr({
                      msg: n
                        ? "Say a little more, so the creator knows exactly what to change."
                        : `Tell ${f} what to change.`,
                      invalid: true,
                    }),
                  );
                  vn.current.focus();
                  K().mo("shake", vn.current.closest(".field"));
                  return;
                }
                if (L.live) setBusy("revise");
                act.revise(n, () => setBusy(""));
              }}
            >
              Request revision
            </Lq>
          </div>
          <p className="help">
            {canRev
              ? "Approving does not pay yet. You release the payment as the next step."
              : `All ${inc} included revision${inc === 1 ? " is" : "s are"} used. Approve, or talk to ${f} in chat about more changes.`}
          </p>
        </>
      );
    }
    case "revision":
      return (
        <>
          {head("Revision asked")}
          <figure className="cw-note is-you">
            <blockquote className="cw-quote">
              <p>“{c.revisionNote || "See chat for the changes."}”</p>
            </blockquote>
            <figcaption>
              <span className="avatar v" aria-hidden="true">
                {L.initials(S().me.brand)}
              </span>
              <span>
                <b>You</b>
                <span className="muted">
                  {logAt(c, "revision")
                    ? L.fmtDate(logAt(c, "revision")) + ", " + K().time(logAt(c, "revision"))
                    : ""}{" "}
                  · on v{(last || {}).v || 1}
                </span>
              </span>
            </figcaption>
          </figure>
          {revMeter()}
          <p className="cw-now-p">{f} is working on it. The next version shows up here for you to review.</p>
          <div className="row wrap">{chatBtn}</div>
          <Sample>{cr("deliver", "Send the next version")}</Sample>
        </>
      );
    case "approved":
      return (
        <>
          {head(`Release ${L.inr(c.price)} to ${f}`)}
          <p className="cw-now-p">
            You approved v{(last || {}).v || 1} on {L.fmtDate(logAt(c, "approved") || K().nowISO())}.
            Releasing moves the money from escrow to {f}. This can’t be undone.
          </p>
          <Lq className="lq-p" data-release="" onClick={act.askRelease}>
            <Icon n="lock" className="ic" />
            Release payment
          </Lq>
        </>
      );
    case "released": {
      const showRev = c.review && !ui.editReview;
      const top = (
        <>
          {head(showRev ? "Done. Thank you." : `Rate and review ${f}`)}
          <p className="cw-now-p">
            {L.inr(c.price)} was released to {f} on{" "}
            {L.fmtDate(logAt(c, "released") || c.released || K().nowISO())}.
            {c.views ? ` The post has ${L.compact(c.views)} views so far.` : ""}
          </p>
          {c.liveUrl ? (
            <p className="cw-file-now">
              <Icon n="link" />
              <span>
                <b>Live post</b>
                <span className="muted">{c.liveUrl}</span>
              </span>
            </p>
          ) : null}
        </>
      );
      if (showRev)
        return (
          <>
            {top}
            <div className="cw-myrev">
              <StarsRow n={c.review.rating} />
              <p className="cw-myrev-t">
                {c.review.text ? (
                  "“" + c.review.text + "”"
                ) : (
                  <span className="muted">No written review.</span>
                )}
              </p>
              <p className="help">Your review · {L.fmtDate(c.review.at)}</p>
              <Lq className="lq-s lq-sm" data-editrev="" onClick={act.editReview}>
                <Icon n="edit" className="ic" />
                Edit review
              </Lq>
            </div>
          </>
        );
      return (
        <>
          {top}
          <ReviewForm c={c} k={k} onSaved={act.saveReview} onCancel={act.cancelReview} />
        </>
      );
    }
    case "refunded": {
      const p = campPays(c).find(x => x.kind === "refund");
      return (
        <>
          {head("Refunded")}
          <figure className="cw-note">
            <blockquote className="cw-quote">
              <p>“{c.refundReason || "Escrow returned in full."}”</p>
            </blockquote>
            <figcaption>
              <span className="cw-sys" aria-hidden="true">
                <Icon n="refund" />
              </span>
              <span>
                <b>Refund reason</b>
                <span className="muted">{c.refunded ? L.fmtDate(c.refunded, { year: true }) : ""}</span>
              </span>
            </figcaption>
          </figure>
          <dl className="cw-kv">
            <div className="kv">
              <dt>Returned to you</dt>
              <dd>{L.inr(c.price)}</dd>
            </div>
            {p ? (
              <>
                <div className="kv">
                  <dt>To</dt>
                  <dd>{p.method}</dd>
                </div>
                <div className="kv">
                  <dt>Credit note</dt>
                  <dd>{p.invoice}</dd>
                </div>
              </>
            ) : null}
          </dl>
          <Lq as="a" className="lq-s" href={`#payments${p ? "-" + p.id : ""}`}>
            See it in payments
          </Lq>
        </>
      );
    }
    case "declined":
      return (
        <>
          {head(`${f} declined`)}
          {c.declineNote ? (
            <figure className="cw-note">
              <blockquote className="cw-quote">
                <p>“{c.declineNote}”</p>
              </blockquote>
              <figcaption>
                <Cav c={k} />
                <span>
                  <b>{k.name}</b>
                  <span className="muted">{c.declined ? L.fmtDate(c.declined) + " · " : ""}Their note</span>
                </span>
              </figcaption>
            </figure>
          ) : null}
          <p className="cw-now-p">
            {f} could not take this one on. Nothing was paid, so there is nothing to refund.
          </p>
          <div className="row wrap">
            <Lq as="a" className="lq-p" href="#creators">
              Find similar creators
            </Lq>
            <Lq as="a" className="lq-s" href={`#creator-${k.id}`}>
              View {f}’s profile
            </Lq>
          </div>
        </>
      );
    case "cancelled":
      return (
        <>
          {head("Invitation cancelled")}
          <p className="cw-now-p">
            You cancelled this invitation{c.cancelled ? " on " + L.fmtDate(c.cancelled) : ""}, before {f}{" "}
            accepted. Nothing was paid.
          </p>
          <div className="row wrap">
            <Lq as="a" className="lq-s" href={`#creator-${k.id}`}>
              Invite {f} again
            </Lq>
          </div>
        </>
      );
    default:
      return head(LONG[c.stage] || c.stage);
  }
}

function Campaign({ c }) {
  const [, redraw] = useState(0);
  const ui = useRef({}).current;
  const P = useRef({ seen: null, noPull: false, first: true, coin: null });
  const root = useRef(null),
    board = useRef(null);
  const from = P.current.seen;
  const paint = (o = {}) => {
    P.current.noPull = !!o.noPull;
    flushSync(() => redraw(n => n + 1));
  };
  const set = (fn, why) => L.store.set(st => fn(c, st), why);

  useLayoutEffect(() => {
    /* the coin is a plain element (not React's): it sits in the money slot that matches the payment, or hides */
    if (!P.current.coin) {
      const coin = document.createElement("span");
      coin.className = "cw-coin";
      coin.setAttribute("aria-hidden", "true");
      coin.textContent = "₹";
      P.current.coin = coin;
    }
    const coin = P.current.coin,
      st = payState(c),
      slot =
        st === "none" ? null : root.current.querySelector(`[data-slot="${st === "held" ? "hold" : "out"}"]`);
    coin.hidden = !slot;
    const home = slot || board.current;
    if (coin.parentNode !== home) home.append(coin);
    /* the rail: a thread pulls from the stage you left to the one you reached (once per advance) */
    const prev = P.current.seen,
      seen = ix(c),
      w = who(c);
    if (prev != null && prev < seen && !P.current.noPull) {
      const nodes = L.$$(".cw-node", root.current),
        a = nodes[prev] && nodes[prev].querySelector(".cw-rl i"),
        b = nodes[seen] && nodes[seen].querySelector(".cw-rl i");
      a && b && K().mo("pull", a, b, { color: w === "you" ? "violet" : w === "done" ? "ink" : "coral" });
    }
    P.current.seen = seen;
    P.current.noPull = false;
    if (P.current.first) {
      P.current.first = false;
      K().mo("stagger", L.$$(".cw-node", root.current));
    }
  });
  useLayoutEffect(() => {
    let lockT = 0;
    if (payState(c) === "held" && !L.RM) {
      const p = root.current.querySelector(".cw-head-m .pill-escrow");
      p && (lockT = setTimeout(() => K().mo("lock", p), 420));
    }
    const off = L.store.on(why => {
      if (why === "escrow-paid") paint();
    });
    return () => {
      clearTimeout(lockT);
      off();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const k = K().cr(c.creator),
    f = K().first(k);

  /* ---------- what the brand does ---------- */
  const release = () => {
    const at = K().nowISO(),
      t = thread(c),
      inv = K().nextInvoice();
    set((x, st) => {
      st.payments.forEach(p => {
        if (p.campaign === x.id && p.kind === "escrow" && p.status === "held") p.status = "released";
      });
      st.payments.unshift({
        id: "p" + Date.now().toString(36),
        date: K().todayISO(),
        kind: "release",
        campaign: x.id,
        creator: x.creator,
        amount: x.price,
        status: "released",
        method: "From escrow",
        invoice: inv,
      });
      x.stage = "released";
      x.released = at;
      log(x, "released");
      if (t)
        st.threads
          .find(y => y.id === t.id)
          .messages.push({
            from: "system",
            kind: "released",
            text: `${L.inr(x.price)} released to ${k.name}.`,
            at,
          });
    }, "payment-released");
    K().notify("payment", `${L.inr(c.price)} released to ${k.name} for ${c.title}`, "#payments");
    paint({ noPull: true });
    K().mo("celebrate", board.current);
    L.toast(`${L.inr(c.price)} released to ${f}`, "check");
  };
  const act = {
    cancelInvite() {
      K().confirm({
        title: "Cancel this invitation?",
        yes: "Cancel invitation",
        no: "Keep it",
        danger: true,
        mini: <CrMini c={k} price={c.price} line={c.title} />,
        bullets: [
          `${f} is told the invitation was withdrawn.`,
          "Nothing was paid, so there is nothing to refund.",
          `You can invite ${f} again later.`,
        ],
        onYes() {
          const done = () => {
            set(x => {
              x.stage = "cancelled";
              x.cancelled = K().nowISO();
              log(x, "cancelled");
            }, "invite-cancelled");
          };
          if (L.live && c.offerId) {
            L.live.withdrawOffer(c.offerId).then(
              () => {
                done();
                L.toast("Invitation cancelled", "check");
                paint();
              },
              e => L.toast(L.live.errorText(e), "alert"),
            );
            return;
          }
          done();
          K().notify(
            "cancelled",
            `You cancelled the invitation to ${k.name} for ${c.title}.`,
            "#campaign-" + c.id,
          );
          L.toast("Invitation cancelled", "check");
          paint();
        },
      });
    },
    openFile(dv) {
      if (!L.live) return L.toast("Sample file. In the live app it opens the video here.", "file");
      previewDelivery(dv);
    },
    approve(note, failed) {
      if (L.live) {
        const t = thread(c);
        (note && t ? L.live.sendMessage(t.id, note).catch(() => undefined) : Promise.resolve())
          .then(() => L.live.approve(c.id))
          .then(
            () => L.live.refresh(),
            er => {
              failed();
              throw er;
            },
          )
          .then(
            () => {
              ui.vnote = "";
              L.toast(`Approved. ${L.inr(c.price)} is released to ${f}.`, "check");
              L.route();
            },
            er => L.toast(L.live.errorText(er), "alert"),
          );
        return;
      }
      const t = thread(c),
        at = K().nowISO(),
        v = (c.deliveries || []).slice(-1)[0];
      set((x, st) => {
        x.stage = "approved";
        log(x, "approved");
        if (t) {
          const tt = st.threads.find(y => y.id === t.id);
          note && tt.messages.push({ from: "brand", text: note, at });
          tt.messages.push({
            from: "system",
            kind: "approved",
            text: `You approved v${v ? v.v : 1}. Release the payment next.`,
            at,
          });
        }
      }, "delivery-approved");
      ui.vnote = "";
      L.toast(`Approved. Release ${L.inr(c.price)} when you are ready.`, "check");
      paint();
    },
    revise(note, failed) {
      const t = thread(c),
        at = K().nowISO();
      const mark = () =>
        set((x, st) => {
          x.stage = "revision";
          x.revisionsUsed = (x.revisionsUsed || 0) + 1;
          x.revisionNote = note;
          log(x, "revision");
          if (!L.live && t)
            st.threads.find(y => y.id === t.id).messages.push({ from: "brand", text: note, at });
        }, "revision-asked");
      if (L.live) {
        L.live.requestRevision(c.id, note).then(
          () => {
            mark();
            ui.vnote = "";
            L.toast(`Revision sent to ${f}`, "send");
            paint();
            void L.live.refresh();
          },
          er => {
            failed();
            L.toast(L.live.errorText(er), "alert");
          },
        );
        return;
      }
      mark();
      ui.vnote = "";
      L.toast(`Revision sent to ${f}`, "send");
      paint();
    },
    askRelease() {
      K().confirm({
        title: `Release ${L.inr(c.price)} to ${f}?`,
        yes: "Release payment",
        no: "Not yet",
        mini: <CrMini c={k} price={c.price} line={c.title} />,
        bullets: [
          `${f} receives ${L.inr(c.price)}, the agreed price, in full.`,
          "It leaves escrow now and can’t be undone.",
          "The release appears in Payments with its invoice.",
        ],
        onYes() {
          release();
        },
      });
    },
    editReview() {
      ui.editReview = true;
      paint({ noPull: true });
      const r =
        root.current.querySelector(".cw-review input[name=rate]:checked") ||
        root.current.querySelector(".cw-review input[name=rate]");
      r && r.focus();
    },
    cancelReview() {
      ui.editReview = false;
      paint({ noPull: true });
    },
    saveReview(rating, text) {
      const old = c.review ? c.review.rating : null;
      set((x, st) => {
        x.review = { rating, text, at: K().todayISO() };
        if (old == null) log(x, "reviewed");
        /* reviews feed the creator's average, which the rating filter in search reads */
        const cc = st.creators.find(y => y.id === x.creator);
        if (cc) {
          const n = cc.reviews || 0,
            avg = cc.rating || 0;
          if (old == null) {
            cc.rating = Math.round(((avg * n + rating) / (n + 1)) * 10) / 10;
            cc.reviews = n + 1;
          } else if (n) cc.rating = Math.round(((avg * n - old + rating) / n) * 10) / 10;
        }
      }, "review-saved");
      ui.editReview = false;
      L.toast(old == null ? `Review saved. It now counts in ${f}’s rating.` : "Review updated", "check");
      paint({ noPull: true });
      K().mo("bump", root.current.querySelector(".cw-starrow"));
    },
    /* sample controls: what the creator does on their side, so the whole flow can be walked here */
    creatorSide(kind) {
      const at = K().nowISO(),
        t = thread(c);
      if (kind === "accept") {
        set(x => {
          x.stage = "accepted";
          log(x, "accepted");
        }, "invite-accepted");
        K().notify(
          "accepted",
          `${k.name} accepted your invitation. Pay into escrow to start.`,
          "#campaign-" + c.id,
        );
        L.toast(`${f} accepted`, "check");
      } else if (kind === "decline") {
        set(x => {
          x.stage = "declined";
          x.declined = at;
          log(x, "declined");
        }, "invite-declined");
        K().notify("declined", `${k.name} declined your invitation for ${c.title}.`, "#campaign-" + c.id);
        L.toast(`${f} declined`, "close");
      } else if (kind === "start") {
        set(x => {
          x.stage = "in_progress";
          log(x, "in_progress");
        }, "work-started");
      } else if (kind === "deliver") {
        const n = (c.deliveries || []).length + 1,
          slug = c.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 28);
        const file = `${slug}-v${n}.${c.format === "Carousel" ? "zip" : "mp4"}`,
          note =
            n === 1
              ? "First cut. Product is on screen in the first 3 s."
              : "Changed as you asked. Everything else is the same.";
        set((x, st) => {
          (x.deliveries = x.deliveries || []).push({ v: n, file, at, note });
          x.stage = "submitted";
          log(x, "submitted");
          if (t) {
            const tt = st.threads.find(y => y.id === t.id);
            tt.messages.push({ from: "creator", file: { name: file, size: "52 MB" }, text: note, at });
            tt.unread = (tt.unread || 0) + 1;
          }
        }, "delivery-submitted");
        K().notify("delivery", `${k.name} submitted v${n} for ${c.title}`, "#campaign-" + c.id);
        L.toast(`v${n} is in. Review it here.`, "file");
      }
      paint();
    },
  };

  const d = deal(c),
    t = thread(c),
    last = t && t.messages.filter(m => m.from !== "system").slice(-1)[0];
  const pays = campPays(c),
    dv = c.deliveries || [],
    w = who(c),
    ps = payState(c);
  const late = !isEnd(c) && c.stage !== "released" && c.due && K().daysTo(c.due) < 0;
  const okDl = c.stage === "released" || c.stage === "approved";

  return (
    <div className="view-in cw" data-who={w} ref={root}>
      <a className="btn-q cw-back" href="#campaigns">
        <Icon n="back" />
        <span>Deals</span>
      </a>
      <header className="cw-head">
        <div className="cw-head-t">
          <p className="cw-brand">
            <Cav c={k} />
            <span>
              <b>
                {k.name}
                <Ver c={k} />
              </b>
              <span className="muted">
                <Glyph p={c.platform} />
                {K().plat(c.platform)} {c.format || ""} ·{" "}
                {c.source === "job" ? "hired from a brief" : "direct invite"}
              </span>
            </span>
            <span className="sample">Sample</span>
          </p>
          <h1 className="t-h1">{c.title}</h1>
        </div>
        <div className="cw-head-m">
          <p className="cw-price">
            <span className="t-money" data-price="">
              {L.inr(c.price)}
            </span>
            <span className="muted">agreed price · no platform fee</span>
          </p>
          <div className="row wrap">
            <PayPill c={c} />
            {t ? (
              <Lq as="a" className="lq-s lq-sm" href={`#chat-${t.id}`}>
                <Icon n="chat" />
                Chat{t.unread ? ` · ${t.unread} new` : ""}
              </Lq>
            ) : (
              <span className="pill pill-line cw-chat-off">
                <Icon n="lock" />
                Chat opens after payment
              </span>
            )}
          </div>
        </div>
      </header>

      <section className="card cw-board" aria-labelledby="cwBoardH" ref={board}>
        <h2 className="sr-only" id="cwBoardH">
          Where this deal stands
        </h2>
        <div className="cw-lane">
          <p className="cw-lane-h">Work</p>
          <Rail c={c} from={from} />
        </div>
        <div className="cw-lane cw-lane-m">
          <p className="cw-lane-h">
            Money <span>tracked apart from the work</span>
          </p>
          <Money c={c} />
          <p className="cw-money-note">
            {
              {
                none:
                  c.stage === "accepted"
                    ? `Nothing has moved yet. Pay ${L.inr(c.price)} into escrow and ${f} starts.`
                    : "Nothing is paid before the creator accepts.",
                held: `${L.inr(c.price)} sits with Linkloom. It goes to ${f} only when you approve, and back to you if the work is not delivered.`,
                released: `Released on your approval. ${f} received the agreed price in full.`,
                refunded: "Returned to you in full. No fee was kept.",
              }[ps]
            }
          </p>
        </div>
      </section>

      <div className="cw-grid">
        <div className="cw-main">
          <section className="card cw-now" aria-labelledby="cwNowH" aria-live="polite">
            <NowPanel key={c.stage + (ui.editReview ? "+edit" : "")} c={c} ui={ui} act={act} />
          </section>
          <section className="ll-panel cw-sec" aria-labelledby="cwBriefH">
            <div className="ll-panel-head">
              <div>
                <h2 className="ll-panel-h" id="cwBriefH">
                  {c.source === "job" ? "Brief" : "What you asked for"}
                </h2>
              </div>
            </div>
            <p className="cw-brief">
              {d.brief
                ? d.brief
                : c.source === "job"
                  ? "The brief was agreed when you confirmed the bid. Changes since then are in the chat."
                  : `A direct invitation for one ${(c.format || "post").toLowerCase()} on ${K().plat(c.platform)}.`}
            </p>
            <dl className="cw-facts">
              <div>
                <dt>Platform</dt>
                <dd>{K().plat(c.platform) + " " + (c.format || "")}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{c.due ? L.fmtDate(c.due, { year: true }) : "—"}</dd>
              </div>
              <div>
                <dt>Revisions</dt>
                <dd>{c.revisionsIncluded || 1} included</dd>
              </div>
              {d.usage ? (
                <div>
                  <dt>Usage rights</dt>
                  <dd>{d.usage}</dd>
                </div>
              ) : null}
            </dl>
            {d.items.length ? (
              <ol className="cw-dl">
                {d.items.map((x, i) => (
                  <li key={i} className={okDl ? "is-ok" : ""}>
                    <span className="cw-dl-n" aria-hidden="true">
                      0{i + 1}
                    </span>
                    <span className="cw-dl-t">
                      {x.p ? <Glyph p={x.p} /> : null}
                      <span>
                        {x.t}
                        {x.sub ? <span className="muted">{x.sub}</span> : null}
                      </span>
                    </span>
                    {okDl ? <span className="pill pill-ok">Approved</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {c.job ? (
              <Lq as="a" className="lq-s lq-sm" href={`#job-${c.job}`}>
                Open the brief
                <Icon n="arrow" className="ic" />
              </Lq>
            ) : null}
          </section>
          <section className="ll-panel cw-sec" aria-labelledby="cwFilesH">
            <div className="ll-panel-head">
              <div>
                <h2 className="ll-panel-h" id="cwFilesH">
                  Deliveries
                </h2>
                <p className="ll-panel-sub">Every version {f} sends, newest first</p>
              </div>
            </div>
            {dv.length ? (
              <ol className="cw-files">
                {dv
                  .slice()
                  .reverse()
                  .map((x, i) => (
                    <li key={x.v}>
                      <span className="cw-v">v{x.v}</span>
                      <span className="cw-files-n">
                        <b>{x.file}</b>
                        <span className="muted">
                          {L.fmtDate(x.at) + ", " + K().time(x.at)}
                          {x.note ? " · " + x.note : ""}
                        </span>
                      </span>
                      {i === 0 ? <span className="pill pill-paper">Latest</span> : null}
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="muted cw-files-none">
                {c.stage === "released"
                  ? "Delivered and approved before this sample started."
                  : "Nothing delivered yet. Each version the creator sends shows up here."}
              </p>
            )}
          </section>
        </div>

        <aside className="cw-side" aria-label="Payment and details">
          <div className="cw-slip ink-card">
            <p className="cw-slip-h">
              {
                {
                  none: "To pay into escrow",
                  held: "In escrow",
                  released: "Paid to " + f,
                  refunded: "Refunded to you",
                }[ps]
              }
            </p>
            <p className="cw-slip-amt">
              <span className="t-money" data-slipamt="">
                {L.inr(c.price)}
              </span>
            </p>
            <dl className="cw-slip-rows">
              <div>
                <dt>Agreed price</dt>
                <dd>{L.inr(c.price)}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>As per confirmed rules</dd>
              </div>
            </dl>
            <p className="cw-slip-s">No platform fee. You are on the Brand plan.</p>
            {pays.length ? (
              <ul className="cw-inv">
                {pays.map(p => (
                  <li key={p.id}>
                    <a href={`#payments-${p.id}`}>
                      <Icon n="file" />
                      <span>
                        <b>{p.invoice}</b>
                        <span>
                          {{ escrow: "Escrow payment", release: "Release", refund: "Refund" }[p.kind] ||
                            p.kind}{" "}
                          · {L.fmtDate(p.date)}
                        </span>
                      </span>
                      <Icon n="download" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cw-slip-s">The invoice appears here once you pay.</p>
            )}
          </div>
          {t ? (
            <a className="cw-chat" href={`#chat-${t.id}`}>
              <Cav c={k} />
              <span className="cw-chat-t">
                <b>Chat with {f}</b>
                <span className="muted">
                  {last
                    ? (last.from === "brand" ? "You: " : "") +
                      (last.text || (last.file ? last.file.name : ""))
                    : "Say hello"}
                </span>
              </span>
              {t.unread ? (
                <span className="cw-chat-n" aria-label={`${t.unread} unread`}>
                  {t.unread}
                </span>
              ) : (
                <Icon n="chevron" />
              )}
            </a>
          ) : (
            <div className="cw-chat is-locked">
              <span className="cw-lockic" aria-hidden="true">
                <Icon n="lock" />
              </span>
              <span className="cw-chat-t">
                <b>Chat opens after payment</b>
                <span className="muted">
                  {isEnd(c)
                    ? "This deal closed before any payment."
                    : c.stage === "invited"
                      ? `Once ${f} accepts and you pay into escrow, you can message and share files here.`
                      : `Pay into escrow and you can message ${f} and share files here.`}
                </span>
              </span>
            </div>
          )}
          {String(c.id).startsWith("offer-") ? null : (
            <Lq as="a" className="lq-s cw-help" href={`#support-new-${c.id}`}>
              <Icon n="info" className="ic" />
              Get help with this deal
            </Lq>
          )}
          <section className="ll-panel cw-sec" aria-labelledby="cwDatesH">
            <div className="ll-panel-head">
              <div>
                <h2 className="ll-panel-h" id="cwDatesH">
                  Dates
                </h2>
              </div>
            </div>
            <dl>
              <div className="kv">
                <dt>{c.source === "job" ? "Hired" : "Invited"}</dt>
                <dd>{L.fmtDate(logAt(c, "invited") || logAt(c, "accepted") || c.funded || K().nowISO())}</dd>
              </div>
              <div className="kv">
                <dt>Paid into escrow</dt>
                <dd>{c.funded ? L.fmtDate(c.funded) : "—"}</dd>
              </div>
              <div className="kv">
                <dt>Due</dt>
                <dd className={late ? "cw-late" : ""}>
                  {c.due ? L.fmtDate(c.due) + (late ? " · late" : "") : "—"}
                </dd>
              </div>
              <div className="kv">
                <dt>{c.stage === "refunded" ? "Refunded" : "Released"}</dt>
                <dd>{c.released ? L.fmtDate(c.released) : c.refunded ? L.fmtDate(c.refunded) : "—"}</dd>
              </div>
            </dl>
          </section>
          {(c.log || []).length ? (
            <section className="ll-panel cw-sec" aria-labelledby="cwLogH">
              <div className="ll-panel-head">
                <div>
                  <h2 className="ll-panel-h" id="cwLogH">
                    Log
                  </h2>
                  <p className="ll-panel-sub">What happened on this deal, newest first</p>
                </div>
              </div>
              <ol className="cw-log">
                {c.log
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <li key={i}>
                      <span>{(LOGT[e[1]] || (() => e[1]))(c)}</span>
                      <time dateTime={e[0]}>{L.fmtDate(e[0]) + ", " + K().time(e[0])}</time>
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function CampaignScreen({ param: id }) {
  const c = S().campaigns.find(x => x.id === id);
  if (!c)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-05-stamp.svg" width="200" height="146" alt="" />
          <p className="t-h2">This deal isn’t here</p>
          <p className="muted">The link may be old. Your other deals are safe.</p>
          <Lq as="a" className="lq-p" href="#campaigns">
            Back to deals
          </Lq>
        </div>
      </div>
    );
  return <Campaign key={c.id} c={c} />;
}

L.register("campaign", {
  title: p => {
    const c = S().campaigns.find(x => x.id === p);
    return c ? c.title : "Deal";
  },
  crumb: p => {
    const c = S().campaigns.find(x => x.id === p),
      k = c && L.creator(c.creator);
    return '<a href="#campaigns">Deals</a>' + (k ? " / " + esc(k.name) : "");
  },
  nav: "campaigns",
  Component: CampaignScreen,
});
