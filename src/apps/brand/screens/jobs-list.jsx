/* Briefs (#jobs): the brand's briefs as slips in three groups (Taking bids, Drafts, Hired and closed), with tab
   filters, close and delete. Uses the brand kit (LLD.bk) from jobs.js. React screen (see src/shared/react/view.jsx). */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq } from "@/shared/react/view";
import { Glyph, StatusPill } from "./kit";

const L = window.LLD;
const S = () => window.LLD_DATA;
const K = () => L.bk;
const TABS = [
  ["all", "All"],
  ["open", "Open"],
  ["drafts", "Drafts"],
  ["closed", "Closed"],
];
const inTab = (j, t) =>
  t === "all" ||
  (t === "open" && j.status === "open") ||
  (t === "drafts" && j.status === "draft") ||
  (t === "closed" && (j.status === "closed" || j.status === "hired"));
const GROUPS = [
  { key: "open", title: "Taking bids", has: j => j.status === "open" },
  { key: "drafts", title: "Drafts", has: j => j.status === "draft" },
  { key: "closed", title: "Hired and closed", has: j => j.status === "hired" || j.status === "closed" },
];

/* rail: Drafted → Published → Bids in → Hired; a job closed without a hire ends on its own node */
function Rail({ j }) {
  const steps = ["Drafted", "Published", "Bids in", "Hired"];
  if (j.status === "closed" && !j.hired) {
    const reached = ["Drafted", "Published"].concat(j.bids ? ["Bids in"] : []);
    return (
      <ol className="jl-rail is-withdrawn" aria-label="Progress">
        {reached.map(t => (
          <li key={t} className="is-done">
            <span>{t}</span>
          </li>
        ))}
        <li className="is-end" aria-current="step">
          <span>Closed, no hire</span>
        </li>
      </ol>
    );
  }
  const at = j.status === "draft" ? 0 : j.status === "open" ? (j.bids ? 2 : 1) : 3;
  const allDone = j.status === "closed";
  return (
    <ol className={`jl-rail${allDone ? " is-all" : ""}`} aria-label="Progress">
      {steps.map((t, i) => (
        <li
          key={t}
          className={i < at || allDone ? "is-done" : i === at ? "is-now" : "is-next"}
          aria-current={i === at ? "step" : undefined}
        >
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function Slip({ j, onClose, onDel }) {
  const k_ = K();
  const listed = k_.bidsFor(j.id),
    nNew = listed.filter(b => b.status === "new").length,
    nShort = listed.filter(b => b.status === "shortlisted").length;
  const c = S().campaigns.find(x => x.job === j.id),
    k = j.hired ? k_.cr(j.hired) : c ? k_.cr(c.creator) : null;
  const dl = k_.daysTo(j.deadline),
    draft = j.status === "draft";
  let note = "";
  if (j.status === "open" && j.review === "pending")
    note =
      "In review. Our team checks every collab before creators see it; it shows up for creators once it's approved.";
  else if (j.status === "open" && j.review === "rejected")
    note = `Not approved, so creators can't see it.${j.reviewReason ? ` Reason: ${j.reviewReason}.` : ""} Edit the collab and save it to send it for review again.`;
  else if (j.status === "open")
    note = j.bids
      ? `${j.bids} bid${j.bids === 1 ? "" : "s"} so far${nNew ? `, ${nNew} new` : ""}${nShort ? `, ${nShort} shortlisted` : ""}. Bids stay open until you hire or close the collab.`
      : "Published. Creators who match will start bidding soon.";
  else if (draft) note = "Only you can see this. Publish it when the collab is ready.";
  else if (j.status === "hired")
    note = k ? `You hired ${k.name}. The work and payment live in Deals.` : "Hired. The work lives in Deals.";
  else note = k ? `Closed after hiring ${k.name}.` : "Closed without a hire.";
  /* one primary per screen: the header's "Post a brief"; every slip action is secondary */
  let acts;
  if (j.status === "open")
    acts = (
      <>
        <Lq as="a" className="lq-s lq-sm" href={`#job-${j.id}`}>
          {j.bids ? `See ${j.bids} bid${j.bids === 1 ? "" : "s"}` : "Open collab"}
        </Lq>
        <Lq as="a" className="lq-s lq-sm" href={`#post-${j.id}`}>
          <Icon n="edit" />
          Edit
        </Lq>
        <Lq className="lq-s lq-sm" data-close={j.id} onClick={() => onClose(j.id)}>
          Close collab
        </Lq>
      </>
    );
  else if (draft)
    acts = (
      <>
        <Lq as="a" className="lq-s lq-sm" href={`#post-${j.id}`}>
          Continue editing
        </Lq>
        <Lq as="a" className="lq-s lq-sm" href={`#job-${j.id}`}>
          <Icon n="eye" />
          Preview
        </Lq>
        <Lq className="lq-s lq-sm" data-del={j.id} onClick={() => onDel(j.id)}>
          <Icon n="trash" />
          Delete
        </Lq>
      </>
    );
  else
    acts = (
      <>
        {c ? (
          <Lq as="a" className="lq-s lq-sm" href={`#campaign-${c.id}`}>
            Open deal
          </Lq>
        ) : null}
        <Lq as="a" className="lq-s lq-sm" href={`#job-${j.id}`}>
          View collab
        </Lq>
        {j.status === "hired" ? (
          <Lq className="lq-s lq-sm" data-close={j.id} onClick={() => onClose(j.id)}>
            Close listing
          </Lq>
        ) : null}
        {!c ? (
          <Lq className="lq-s lq-sm" data-del={j.id} onClick={() => onDel(j.id)}>
            <Icon n="trash" />
            Delete
          </Lq>
        ) : null}
      </>
    );
  const st =
    j.status === "open" && j.review ? (
      <StatusPill map={k_.JST} k={j.review === "rejected" ? "rejected" : "review"} />
    ) : j.status === "open" && nNew ? (
      <>
        <StatusPill map={k_.JST} k="open" />
        <span className="pill pill-butter jl-new">{nNew} new</span>
      </>
    ) : (
      <StatusPill map={k_.JST} k={j.status} />
    );
  return (
    <article className={`jl-slip is-${j.status}`} data-id={j.id} aria-labelledby={`jt-${j.id}`}>
      <div className="jl-stub">
        <p className="jl-stub-l">Budget</p>
        <p className="jl-price t-money">{L.inr(j.budget)}</p>
        <p className="jl-stub-d">{draft ? "Not posted yet" : "Posted " + L.fmtDate(j.posted)}</p>
      </div>
      <div className="jl-body">
        <div className="jl-top">
          <span className="bk-plat">
            <Glyph p={j.platform} />
            <span>{k_.platLine(j)}</span>
          </span>
          <span className="row jl-pills">{st}</span>
        </div>
        <h3 className="jl-t" id={`jt-${j.id}`}>
          <a href={`#${draft ? "post" : "job"}-${j.id}`}>{j.title}</a>
        </h3>
        <dl className="bk-meta jl-meta">
          <div>
            <dt>Deadline</dt>
            <dd>
              {L.fmtDate(j.deadline)}
              {j.status === "open" || draft ? (
                <>
                  {" "}
                  <span className="muted">· {k_.daysTxt(dl)}</span>
                </>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Bids</dt>
            <dd>
              {j.bids || 0}
              {nNew ? (
                <>
                  {" "}
                  <span className="muted">· {nNew} new</span>
                </>
              ) : null}
            </dd>
          </div>
          <div className="jl-meta-w">
            <dt>Where</dt>
            <dd>{k_.where(j)}</dd>
          </div>
        </dl>
        <Rail j={j} />
        <p className="jl-note">{note}</p>
        <div className="jl-acts">{acts}</div>
      </div>
    </article>
  );
}

function JobsScreen() {
  const k_ = K();
  const u = k_.ui("jobs");
  if (!TABS.some(t => t[0] === u.tab)) u.tab = "all";
  const [, redraw] = useState(0);
  const [live, setLive] = useState("");
  const root = useRef(null);
  const jobs = S().jobs;
  const count = t => jobs.filter(j => inTab(j, t)).length;
  /* counts only for the states that have something in them: a new brand sees the next step, not a row of zeros */
  const summary = () => {
    if (!jobs.length)
      return "Post a collab and creators who fit bid on it. Your collabs and their bids show up here.";
    const n = t => count(t),
      nNew = S().bids.filter(b => b.status === "new" && (k_.job(b.job) || {}).status === "open").length;
    const parts = [
      n("open") && `${n("open")} open`,
      n("drafts") && `${n("drafts")} draft${n("drafts") === 1 ? "" : "s"}`,
      n("closed") && `${n("closed")} hired or closed`,
    ].filter(Boolean);
    return `${parts.join(", ")}.${nNew ? ` ${nNew} new bid${nNew === 1 ? "" : "s"} to look at.` : ""}`;
  };
  const refresh = (animate, msg) => {
    const mutate = () => flushSync(() => redraw(n => n + 1));
    animate ? k_.flip(mutate, () => L.$$(".jl-slip", root.current)) : mutate();
    if (msg) setLive(msg);
  };
  const pickTab = t => {
    u.tab = t;
    refresh(true, `Showing ${u.tab === "all" ? "all" : u.tab} collabs`);
    const same = root.current.querySelector(`.jl-filter [data-tab="${u.tab}"]`);
    same && same.focus();
  };
  const onClose = id => k_.closeJob(id, () => refresh(true, "Collab closed"));
  const onDel = id => k_.deleteJob(id, () => refresh(true, "Collab deleted"));
  useEffect(() => {
    k_.mo("stagger", L.$$(".jl-slip", root.current));
    if (u.justSaved) {
      const id = u.justSaved;
      u.justSaved = null;
      const n = root.current.querySelector(`.jl-slip[data-id="${id}"]`);
      if (n) {
        n.classList.add("is-new");
        requestAnimationFrame(() => {
          n.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
          k_.mo("celebrate", n);
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ps = (S().pitches || []).filter(p => p.status !== "declined"),
    nNewP = ps.filter(p => !p.read).length;
  let board;
  if (!jobs.length)
    board = (
      <div className="empty jl-empty">
        <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
        <p className="t-h2">No collabs yet.</p>
        <p className="muted">
          Post a collab and creators who fit will bid on it. It takes about three minutes.
        </p>
        <Lq as="a" className="lq-p" href="#post">
          Post a collab
        </Lq>
      </div>
    );
  else {
    const list = jobs.filter(j => inTab(j, u.tab));
    if (!list.length) {
      const m = {
        open: ["No open collabs.", "Publish a draft or post a new collab to start getting bids."],
        drafts: ["No drafts.", "Save a collab as a draft when it is not ready yet."],
        closed: ["Nothing closed yet.", "Collabs you hire on or close show up here."],
      }[u.tab];
      board = (
        <div className="empty jl-empty">
          <p className="t-h2">{m[0]}</p>
          <p className="muted">{m[1]}</p>
          <div className="row wrap jl-empty-cta">
            <Lq className="lq-s" data-tab="all" onClick={() => pickTab("all")}>
              Show all collabs
            </Lq>
          </div>
        </div>
      );
    } else {
      const by = (a, b) =>
        (a.status === "draft" ? 0 : 1) - (b.status === "draft" ? 0 : 1) ||
        String(b.posted || "9").localeCompare(String(a.posted || "9")) ||
        a.deadline.localeCompare(b.deadline);
      board = GROUPS.map(g => {
        const rows = list.filter(g.has).sort(by);
        if (!rows.length) return null;
        return (
          <section key={g.key} className="jl-group" aria-labelledby={`jg-${g.key}`}>
            <h2 className="jl-gh" id={`jg-${g.key}`}>
              <span className="t-h2">{g.title}</span>
              <span className="jl-gn num">{rows.length}</span>
            </h2>
            <div className="jl-list">
              {rows.map(j => (
                <Slip key={j.id} j={j} onClose={onClose} onDel={onDel} />
              ))}
            </div>
          </section>
        );
      });
    }
  }

  return (
    <div className="view-in jl" ref={root}>
      <header className="jl-head">
        <div className="jl-head-t">
          <h1 className="t-h1">Collabs</h1>
          <p className="muted" id="jlSum">
            {summary()} <span className="sample">Sample data</span>
          </p>
        </div>
        <div className="row wrap jl-head-a">
          {ps.length ? (
            <Lq as="a" className="lq-s" href="#pitches">
              <Icon n="send" />
              Pitches
              {nNewP ? (
                <>
                  {" "}
                  <span className="jl-cn">{nNewP} new</span>
                </>
              ) : null}
            </Lq>
          ) : null}
          <Lq as="a" className="lq-p" href="#post" data-post="" hidden={!jobs.length}>
            <Icon n="plus" />
            Post a collab
          </Lq>
        </div>
      </header>
      <div className="chips jl-filter" role="group" aria-label="Show collabs" hidden={!jobs.length}>
        {jobs.length
          ? TABS.map(([k, n]) => (
              <button
                key={k}
                className="chip"
                type="button"
                data-tab={k}
                aria-pressed={String(u.tab === k)}
                onClick={() => pickTab(k)}
              >
                {n} <span className="jl-cn">{count(k)}</span>
              </button>
            ))
          : null}
      </div>
      <p className="sr-only" id="jlLive" aria-live="polite">
        {live}
      </p>
      <div className="jl-board" id="jlBoard">
        {board}
      </div>
    </div>
  );
}

L.register("jobs", { title: "Collabs", nav: "jobs", Component: JobsScreen });
