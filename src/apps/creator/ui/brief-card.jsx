/* The one brief card (C2), used by Home ("Briefs for you") and Find briefs (#jobs), plus the small pieces the creator
   screens share with it: the match chip, the status pill, the brand chip and the platform glyph.
   Bid sits bottom-left, Save and Hide bottom-right, on every card. Save/Hide/Bid clicks are wired by L.jobkit.wire()
   in screens/jobs/jobs.js: .jobs-save toggles saved, .jobs-hide hides, [data-bid] goes through L.kycGate(id).
   The wiring, swipe and save stitch change these nodes directly, so a list draws each card once and keeps it
   (see Home's BriefGrid and Find briefs). Card classes stay .jobs-*; styles in brief-card.css. */
import { LLD as L } from "@/apps/creator/core";
import { Icon, Lq, Photo } from "@/shared/react/view";

import "./brief-card.css";

/** "Best fit" is shown only at this match % or higher (C5). Below it, the plain "60% match" chip. */
export const BEST_FIT_MIN = 75;

export const isBestFit = match => (Number(match) || 0) >= BEST_FIT_MIN;

/** match % chip with a 12px ring that fills to the score once (CSS, see .jobs-ring) */
export function Pct({ m }) {
  const v = Number(m) || 0;
  return (
    <span className="jobs-pct" style={{ "--m": String(v) }}>
      <svg className="jobs-ring" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" pathLength="100" />
        <circle
          className="jobs-ring-v"
          cx="8"
          cy="8"
          r="6"
          pathLength="100"
          style={{ strokeDashoffset: String(100 - v) }}
        />
      </svg>
      <b>{v}%</b> match
    </span>
  );
}

/** Match chip: "Best fit" + "82% match" at or above BEST_FIT_MIN, otherwise just "60% match". Nothing without a score. */
export function FitChip({ match }) {
  const m = Number(match) || 0;
  if (!L.jobkit || !m) return null;
  return (
    <>
      {isBestFit(m) ? <span className="jobs-best">Best fit</span> : null}
      <Pct m={m} />
    </>
  );
}

/** a bid's status pill with its icon; error pills always carry the alert icon */
export function StatusPill({ status, label }) {
  const K = L.jobkit,
    m = K.STATUS[status] || K.STATUS.submitted;
  return (
    <span className={`pill ${m.pill}`}>
      <Icon n={m.ic} />
      {label || m.label}
    </span>
  );
}

export const BrandChip = ({ j }) => (
  <span className="jobs-brand">
    <span className="jobs-bi" aria-hidden="true">
      <Photo src={j.logo}>{j.bi || L.initials(j.brand || "")}</Photo>
    </span>
    <span className="jobs-bn">{j.brand}</span>
  </span>
);

export const Glyph = ({ p }) => <Icon n={p === "youtube" ? "yt" : "ig"} />;

export function BriefCard({ j, variant, ctx, primary }) {
  const K = L.jobkit;
  if (!K) return null;
  const feat = variant === "feature";
  const saved = K.isSaved(j.id),
    mine = K.openBid(j.id),
    dl = K.daysTo(j.deadline);
  const reasons = (j.reasons || []).slice(0, feat ? 3 : 2);
  const tid = `jc-${ctx || "x"}-${j.id}`;
  const fit = !!(Number(j.match) || 0);
  return (
    <article
      className={`jobs-card${feat ? " jobs-card--feature" : ""}${saved ? " is-saved" : ""}`}
      data-id={j.id}
      aria-labelledby={tid}
    >
      <div className="jobs-card-top">
        <BrandChip j={j} />
        <span className="jobs-plat">
          <Glyph p={j.platform} />
          <span>
            {K.platName(j.platform)} {j.format}
          </span>
        </span>
      </div>
      <h3 className="jobs-card-t" id={tid}>
        <a className="jobs-card-link" href={`#job-${j.id}`}>
          {j.title}
        </a>
      </h3>
      {j.category || mine ? (
        <p className="jobs-cat">
          {j.category || null}
          {j.category && mine ? " · " : null}
          {mine ? (
            <StatusPill status={mine.status} label={"You bid · " + K.STATUS[mine.status].label} />
          ) : null}
        </p>
      ) : null}
      <div className="jobs-money">
        {feat ? <p className="jobs-mlab">Budget</p> : null}
        <p className="jobs-price t-money">{L.inr(j.budget)}</p>
        <p className="jobs-loc">
          <Icon n="pin" />
          <span>{K.where(j)}</span>
        </p>
        {feat ? (
          <p className="jobs-net">
            Bid the budget and you receive <b>{L.inr(L.payout(j.budget).net)}</b>, the agreed price.{" "}
            <span>Tax as per confirmed rules.</span>
          </p>
        ) : null}
      </div>
      <dl className="jobs-meta">
        <div>
          <dt>Deadline</dt>
          <dd>
            {L.fmtDate(j.deadline)} <span className="muted">· {K.daysShort(dl)}</span>
          </dd>
        </div>
        <div>
          <dt>Bids</dt>
          <dd>{j.bids ? j.bids : <span className="muted">None yet</span>}</dd>
        </div>
      </dl>
      {fit || reasons.length ? (
        <div className="jobs-match">
          <FitChip match={j.match} />
          {reasons.length ? (
            <ul className="jobs-why" aria-label="Why it matches">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="jobs-acts">
        {/* the Bid slot never moves: an open bid swaps the button for a link to it */}
        {mine ? (
          <Lq as="a" className="lq-s lq-sm jobs-bid" href="#bids">
            See your bid
            <Icon n="arrow" className="ic" />
          </Lq>
        ) : (
          <Lq className={`${primary ? "lq-p" : "lq-s"} lq-sm jobs-bid`} data-bid={j.id}>
            Bid on this
          </Lq>
        )}
        <span className="jobs-acts-grow"></span>
        <button
          className="chip jobs-save"
          type="button"
          aria-pressed={String(saved)}
          aria-label={`${saved ? "Saved" : "Save"}: ${j.title}`}
          title="Save (or swipe right)"
        >
          <Icon n="bookmark" />
          <span className="jobs-act-l">{saved ? "Saved" : "Save"}</span>
        </button>
        <button
          className="chip jobs-hide"
          type="button"
          aria-label={`Hide: ${j.title}`}
          title="Hide (or swipe left)"
        >
          <Icon n="close" />
          <span className="jobs-act-l">Hide</span>
        </button>
      </div>
    </article>
  );
}
