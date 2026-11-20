/* Brief detail (#job-<id>): the brief in three blocks (What, Who, Match), save/share/report, sticky Bid through LLD.kycGate.
   Owner: Builder B. Uses LLD.jobkit from jobs.js. React screen (see src/shared/react/view.jsx). */
import { Fragment, useEffect, useRef, useState } from "react";
import { BrandChip, FitChip, Glyph, StatusPill } from "../../ui/brief-card";
import { Skeleton } from "@/shared/react/skeleton";
import { reportAbuse, supportError } from "@/shared/support/api";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD;
const REPORT_REASONS = [
  "Pay looks misleading",
  "Asks to pay or chat outside Linkloom",
  "Inappropriate or unsafe content",
  "Spam or a duplicate brief",
  "Something else",
];
const tried = {}; // brief ids already fetched once from the server

/* a row only renders when it has a value (C4) */
const Kv = ({ rows }) =>
  rows
    .filter(r => r[1])
    .map(([k, v]) => (
      <div key={k} className="kv">
        <dt>{k}</dt>
        <dd>{v}</dd>
      </div>
    ));

function ShareSheet({ url }) {
  const input = useRef(null);
  return (
    <div className="stack">
      <p className="muted">Copy the link and send it to a creator friend.</p>
      <div className="field">
        <label htmlFor="jobShareUrl">Link to this brief</label>
        <input className="input" id="jobShareUrl" readOnly value={url} ref={input} />
      </div>
      <Lq
        className="lq-p"
        data-copy=""
        onClick={() => {
          input.current.focus();
          input.current.select();
          L.toast("Link selected. Copy it with your keyboard or long-press.", "link");
        }}
      >
        Select link
      </Lq>
    </div>
  );
}

function ReportSheet({ j, close }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRadio = useRef(null);
  const submit = async e => {
    e.preventDefault();
    if (!reason) {
      setErr("Pick what the problem is.");
      firstRadio.current && firstRadio.current.focus();
      return;
    }
    const text = details.trim();
    /* the report goes to Linkloom's Moderation queue (super admin) */
    if (L.live) {
      setBusy(true);
      try {
        await reportAbuse({ targetType: "campaign", targetId: j.id, reason, details: text });
      } catch (x) {
        if (!(x && x.code === "ALREADY_REPORTED")) {
          setBusy(false);
          setErr(supportError(x, L.live.errorText));
          return;
        }
      }
    }
    L.store.set(st => {
      st.reports.push({ job: j.id, reason, text, at: new Date().toISOString() });
    }, "job-report");
    close();
    L.toast("Report sent. Our team will look at it.", "flag");
  };
  return (
    <form className="stack job-rep" noValidate onSubmit={submit}>
      <p className="muted">Tell us what is wrong. The brand will not see who reported it.</p>
      <fieldset className="job-rep-set">
        <legend className="t-label">What is the problem?</legend>
        {REPORT_REASONS.map((r, i) => (
          <label key={r} className="check">
            <input
              type="radio"
              name="reason"
              value={r}
              ref={i === 0 ? firstRadio : null}
              checked={reason === r}
              onChange={() => setReason(r)}
            />{" "}
            {r}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="jobRepTx">Anything else? (optional)</label>
        <textarea
          className="textarea"
          id="jobRepTx"
          maxLength={300}
          placeholder="For example: they asked for my number in the brief"
          value={details}
          onChange={e => setDetails(e.target.value)}
        />
      </div>
      <p className="err" id="jobRepErr" aria-live="polite">
        {err}
      </p>
      <div className="row wrap">
        <Lq className="lq-p" type="submit" disabled={busy}>
          Send report
        </Lq>
        <Lq className="lq-s" data-cancel="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}

function JobScreen({ param: id }) {
  const K = L.jobkit;
  const s = K.ensure();
  const j = K.job(id);
  const [, redraw] = useState(0);
  const root = useRef(null);
  const fetching = !j && L.live && !L.live.guest && !tried[id];
  useEffect(() => {
    if (!fetching) return;
    /* a link to a brief that isn't in the open list (closed, or opened from a notification) */
    tried[id] = true;
    const done = () => L.current()?.name === "job" && L.current()?.param === id && redraw(n => n + 1);
    L.live.fetchJob(id).then(done, done);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!j || !root.current) return;
    K.mo("count", root.current.querySelector("[data-budget]"), j.budget, L.inr);
    K.mo("stagger", L.$$(".job-blk, .job-deal", root.current));
  }, [!!j]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      // the jobs list restores scroll and focus only when we go straight back to it
      s.jobsUI.fromJob = location.hash === "#jobs" && j ? j.id : null;
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const unsub = useRef(null);
  useEffect(() => {
    unsub.current = L.store.on(why => why === "job-report" && redraw(n => n + 1));
    return () => unsub.current && unsub.current();
  }, []);

  if (fetching) return <Skeleton label="Loading the brief" slowNote={false} />; // F4: page-shaped placeholder, not a blank area
  if (!j)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
          <p className="t-h2">This brief is no longer open.</p>
          <p className="muted">The brand may have closed it or picked a creator.</p>
          <Lq as="a" className="lq-p" href="#jobs">
            See open briefs
          </Lq>
        </div>
      </div>
    );

  const dl = K.daysTo(j.deadline),
    bid = K.openBid(j.id);
  const prev = K.bidsFor(j.id).find(b => b.status === "withdrawn");
  const fac = K.factors(j);
  const pay = L.payout(j.budget);
  const verified = s.kyc.status === "verified";
  const reported = s.reports.some(r => r.job === j.id);
  const saved = K.isSaved(j.id);
  const act = bid && bid.status === "accepted" ? s.active.find(a => a.job === j.id) : null;
  const mineHref = act ? "#work-" + act.id : "#bids";
  const mineLabel = act ? "Open the deal" : "See it in My Bids";
  const bidNow = e => {
    K.mo("press", e.currentTarget);
    L.kycGate(j.id);
  };

  const whatRows = [
    ["Usage rights", j.usage],
    ["Post by", j.deadline ? `${L.fmtDate(j.deadline, { year: true })} · ${K.daysTxt(dl)}` : ""],
  ];
  const whoRows = [
    ["Audience", j.min],
    ["Languages", (j.languages || []).join(", ")],
    ["City", j.remote ? "Any city, shoot from home" : j.city ? j.city + ", shoot in the city" : ""],
  ];
  const hasWhat = whatRows.some(r => r[1]),
    hasWho = whoRows.some(r => r[1]);
  const dels = (j.deliverables || []).filter(Boolean);
  /* the left column: What, Who, Match, split by a hairline plus space */
  const blocks = [
    (j.brief || dels.length || hasWhat) && (
      <section className="job-blk" aria-labelledby="jobWhatH">
        <h2 className="job-blk-h" id="jobWhatH">
          What the brand wants
        </h2>
        {j.brief ? <p className="job-brief">{j.brief}</p> : null}
        {dels.length ? (
          <div className="job-sub">
            <h3 className="t-eyebrow muted">Deliverables</h3>
            <ol className="job-dels">
              {dels.map((d, i) => (
                <li key={i}>
                  <span className="job-n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {hasWhat ? (
          <dl className="job-kv">
            <Kv rows={whatRows} />
          </dl>
        ) : null}
      </section>
    ),
    hasWho && (
      <section className="job-blk" aria-labelledby="jobWhoH">
        <h2 className="job-blk-h" id="jobWhoH">
          Who it's for
        </h2>
        <dl className="job-kv">
          <Kv rows={whoRows} />
        </dl>
      </section>
    ),
    fac.length && (
      <section className="job-blk" aria-labelledby="jobFitH">
        <div className="job-blk-top">
          <h2 className="job-blk-h" id="jobFitH">
            Why it is a match
          </h2>
          <span className="job-fit-pct">
            <FitChip match={j.match} />
          </span>
        </div>
        <ul className="job-fit">
          {fac.map((f, i) => (
            <li key={i} className={f.ok ? "is-ok" : "is-no"}>
              <span className="job-fit-i" aria-hidden="true">
                <Icon n={f.ok ? "check" : "minus"} />
              </span>
              <span className="job-fit-k">{f.k}</span>
              <span className="job-fit-v">{f.txt}</span>
              <span className="sr-only">{f.ok ? "fits" : "does not fit"}</span>
            </li>
          ))}
        </ul>
      </section>
    ),
  ].filter(Boolean);

  const share = async () => {
    const url = location.href.split("#")[0] + "#job-" + j.id;
    try {
      if (navigator.share) {
        await navigator.share({ title: j.title, text: `${j.brand} is hiring on Linkloom`, url });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      L.toast("Link copied");
      return;
    } catch (e) {}
    openReactSheet({ title: "Share this brief", render: () => <ShareSheet url={url} /> });
  };

  return (
    <div className="view-in job" ref={root}>
      <a className="btn-q job-back" href="#jobs">
        <Icon n="back" />
        All briefs
      </a>
      <div className="job-layout">
        <article className="job-main" aria-labelledby="jobH">
          <header className="job-h">
            <div className="job-src">
              {j.brandId ? (
                <>
                  <a
                    className="job-brandlink"
                    href={`#brand-${j.brandId}`}
                    title={`View ${j.brand}'s profile`}
                  >
                    <BrandChip j={j} />
                  </a>
                  <Lq as="a" className="lq-s lq-sm job-brandbtn" href={`#brand-${j.brandId}`}>
                    View brand
                  </Lq>
                </>
              ) : (
                <BrandChip j={j} />
              )}
              <span className="jobs-plat">
                <Glyph p={j.platform} />
                <span>
                  {K.platName(j.platform)} {j.format}
                  {j.category ? ` · ${j.category}` : ""}
                </span>
              </span>
            </div>
            <h1 className="t-h1" id="jobH">
              {j.title}
            </h1>
            <p className="muted t-small">
              Posted {L.ago(j.posted)} · <span className="sample">Sample brief</span>
            </p>
            <div className="job-tools" role="group" aria-label="Brief actions">
              <button
                className="chip job-save"
                type="button"
                aria-pressed={String(saved)}
                onClick={e => {
                  const t = e.currentTarget;
                  const on = K.toggleSave(j.id, document.createElement("div")); // React redraws this button itself
                  redraw(n => n + 1);
                  K.stitch && K.stitch(t, on);
                }}
              >
                <Icon n="bookmark" />
                <span>{saved ? "Saved" : "Save"}</span>
              </button>
              <button className="chip job-share" type="button" onClick={share}>
                <Icon n="link" />
                <span>Share</span>
              </button>
              <button
                className="chip job-report"
                type="button"
                aria-disabled={reported ? "true" : undefined}
                onClick={() =>
                  !reported &&
                  openReactSheet({
                    title: "Report this brief",
                    render: close => <ReportSheet j={j} close={close} />,
                  })
                }
              >
                <Icon n="flag" />
                <span>{reported ? "Reported" : "Report"}</span>
              </button>
            </div>
          </header>

          {blocks.map((b, i) => (
            <Fragment key={i}>
              {i ? <div className="ll-hairline" aria-hidden="true"></div> : null}
              {b}
            </Fragment>
          ))}
        </article>

        <aside className="job-side" aria-label="Budget and bid">
          <div className="job-deal card">
            <p className="job-lab">Budget</p>
            <p className="t-money job-budget" data-budget="">
              {L.inr(j.budget)}
            </p>
            <p className="jobs-loc">
              <Icon n="pin" />
              <span>{K.where(j)}</span>
            </p>
            <dl className="jobs-meta">
              <div>
                <dt>Deadline</dt>
                <dd>{L.fmtDate(j.deadline)}</dd>
              </div>
              <div>
                <dt>Bids so far</dt>
                <dd>{j.bids}</dd>
              </div>
            </dl>
            <p className="help">Live count. Withdrawn bids are not included.</p>
            <p className="job-payline">
              Bid the full budget and you receive <b className="num">{L.inr(pay.net)}</b>, the agreed price.{" "}
              <span className="muted">Tax as per confirmed rules.</span>
            </p>
            {bid ? (
              <div className="job-mine">
                <p className="row wrap">
                  <StatusPill status={bid.status} />
                  <span className="t-small">
                    You bid <b className="num">{L.inr(bid.price)}</b> on {L.fmtDate(bid.sent)}
                  </span>
                </p>
                <p className="help">
                  {j.status === "hired"
                    ? "You're hired on this brief. Work and chat live in Active deals."
                    : bid.note || ""}
                </p>
                <Lq as="a" className="lq-p job-bid-btn" href={mineHref}>
                  {mineLabel}
                </Lq>
              </div>
            ) : (
              <>
                {prev ? (
                  <p className="help job-prev">You withdrew a {L.inr(prev.price)} bid. You can bid again.</p>
                ) : null}
                <Lq className="lq-p job-bid-btn" data-bidnow="" onClick={bidNow}>
                  Bid on this brief
                </Lq>
                <p className="job-kyc help">
                  <Icon n={verified ? "check" : "shield"} />
                  {verified
                    ? "ID verified. You can send bids."
                    : "ID is checked once, at your first bid. Brands never see it."}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
      <div className="job-sticky dark" role="region" aria-label="Bid on this brief">
        <div className="job-sticky-t">
          <p className="t-money">{L.inr(j.budget)}</p>
          <p className="jobs-loc">
            <Icon n="pin" />
            <span>{K.where(j)}</span>
          </p>
        </div>
        {bid ? (
          <Lq as="a" className="lq-p" href={mineHref}>
            {mineLabel}
          </Lq>
        ) : (
          <Lq className="lq-p" data-bidnow="" onClick={bidNow}>
            Bid on this brief
          </Lq>
        )}
      </div>
    </div>
  );
}

L.register("job", {
  title: id => {
    const j = L.jobkit && L.jobkit.job(id);
    return j ? j.title : "Brief";
  },
  crumb: id => {
    const j = L.jobkit && L.jobkit.job(id);
    return `<a href="#jobs">Find briefs</a> / ${j ? L.esc(j.title) : "Brief"}`;
  },
  nav: "jobs",
  Component: JobScreen,
});
