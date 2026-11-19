/* My Bids (#bids): bid slips in three tabs, each slip with its own progress rail.
   Tabs (C8): Active (sent, viewed, shortlisted), Won (accepted), Closed (not selected, withdrawn, completed). A tab
   with nothing in it is hidden, except Active. The Filter menu narrows to one exact status.
   Statuses: submitted, viewed (+ shortlisted, a flag from the live layer), accepted, rejected, withdrawn (shows who),
   completed (feedback). Owner: Builder B. Open direct offers show under the header (live/creator-offers.jsx).
   React screen (see src/shared/react/view.jsx).
   TODO(backend): record brand view/shortlist/decline on bids and send a notification the same day. */
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { KYC_AFTER_ACCEPT, kycOwed, openKyc } from "../../core/kyc-gate";
import { DirectOffers } from "../../live/creator-offers";
import { fromHtml, Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD;
/* the exact statuses the Filter menu offers; "shortlisted" is a viewed bid the brand shortlisted */
const KINDS = ["submitted", "viewed", "shortlisted", "accepted", "rejected", "withdrawn", "completed"];
const TABS = [
  { key: "active", title: "Active", kinds: ["submitted", "viewed", "shortlisted"] },
  { key: "won", title: "Won", kinds: ["accepted"] },
  { key: "closed", title: "Closed", kinds: ["rejected", "withdrawn", "completed"] },
];
const LABEL = {
  submitted: "Sent",
  viewed: "Viewed",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
  completed: "Completed",
};
const kindOf = b => (b.status === "viewed" && b.shortlisted ? "shortlisted" : b.status);
const tabOf = k => TABS.find(t => t.kinds.includes(k)) || TABS[0];
const WHO = { you: "you", brand: "the brand", linkloom: "Linkloom, under the cancellation rule" };

/* rail: Sent → Viewed (or Shortlisted) → Accepted → Completed, with a branch end for rejected and withdrawn */
function Rail({ b }) {
  const steps = ["Sent", b.shortlisted ? "Shortlisted" : "Viewed", "Accepted", "Completed"];
  const at = { submitted: 0, viewed: 1, accepted: 2, completed: 3 }[b.status];
  if (at !== undefined)
    return (
      <ol className="bids-rail" aria-label="Progress">
        {steps.map((t, i) => (
          <li
            key={t}
            className={i < at ? "is-done" : i === at ? "is-now" : "is-next"}
            aria-current={i === at ? "step" : undefined}
          >
            <span>{t}</span>
          </li>
        ))}
      </ol>
    );
  const by = b.by || "you";
  const end =
    b.status === "rejected"
      ? "Not selected"
      : by === "you"
        ? "Withdrawn by you"
        : `Cancelled by ${WHO[by] || by}`;
  const reached = b.status === "rejected" ? ["Sent", "Viewed"] : ["Sent"];
  return (
    <ol className={`bids-rail is-${b.status}`} aria-label="Progress">
      {reached.map(t => (
        <li key={t} className="is-done">
          <span>{t}</span>
        </li>
      ))}
      <li className="is-end" aria-current="step">
        <span>{end}</span>
      </li>
    </ol>
  );
}

const BrandChip = ({ m }) => (
  <span className="jobs-brand">
    <span className="jobs-bi" aria-hidden="true">
      {m.bi}
    </span>
    <span className="jobs-bn">{m.brand}</span>
  </span>
);

function WithdrawSheet({ b, m, close, done }) {
  const [busy, setBusy] = useState(false);
  const yes = async () => {
    if (L.live) {
      setBusy(true);
      try {
        await L.live.withdrawBid(b);
      } catch (er) {
        setBusy(false);
        L.toast(L.live.errorText(er), "alert");
        return;
      }
    }
    L.store.set(st => {
      const x = st.bids.find(y => y.id === b.id);
      x.status = "withdrawn";
      x.by = "you";
      x.at = L.today().toISOString();
      x.note = "You withdrew this bid.";
      const jj = st.jobs.find(y => y.id === x.job);
      if (jj && jj.bids > 0) jj.bids -= 1; // live count leaves out withdrawn bids
    }, "bid-withdrawn");
    close();
    done(`Bid to ${m.brand} withdrawn`);
    L.toast("Bid withdrawn", "check");
  };
  return (
    <div className="stack bids-sheet">
      <div className="bids-mini">
        <BrandChip m={m} />
        <p className="t-money bids-mini-p">{L.inr(b.price)}</p>
        <p className="t-small muted">{m.title}</p>
      </div>
      <ul className="bids-conseq">
        <li>{m.brand} sees it as withdrawn by you.</li>
        <li>You can bid again while the brief is open.</li>
        <li>Nothing is charged. No money has moved yet.</li>
      </ul>
      <div className="row wrap">
        <Lq className="lq-p" data-yes="" disabled={busy} onClick={yes}>
          Withdraw bid
        </Lq>
        <Lq className="lq-s" data-no="" onClick={() => close()}>
          Keep my bid
        </Lq>
      </div>
    </div>
  );
}

const RATE_LABELS = ["Poor", "Fair", "Good", "Very good", "Great"];
function FeedbackSheet({ b, m, s, close, done }) {
  const [rate, setRate] = useState(0);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const firstRate = useRef(null);
  const submit = async e => {
    e.preventDefault();
    if (!rate) {
      setErr("Pick a rating from 1 to 5.");
      firstRate.current && firstRate.current.focus();
      return;
    }
    if (L.live) {
      const order = s.active.find(a => a.job === b.job);
      if (order) {
        setBusy(true);
        try {
          await L.live.reviewOrder(order.id, rate, text.trim());
        } catch (er) {
          setBusy(false);
          setErr(L.live.errorText(er));
          return;
        }
      }
    }
    L.store.set(st => {
      st.bids.find(y => y.id === b.id).feedback = {
        rating: rate,
        text: text.trim(),
        at: L.today().toISOString(),
      };
    }, "bid-feedback");
    close();
    done(`Feedback sent to ${m.brand}`);
    L.toast("Feedback sent", "check");
  };
  return (
    <form className="stack bids-fbform" noValidate onSubmit={submit}>
      <p className="muted">
        {m.title} is approved and closed. Tell other creators what working with {m.brand} was like.
      </p>
      <fieldset className="bids-rate">
        <legend className="t-label">How was working with them?</legend>
        <div className="bids-stars">
          {RATE_LABELS.map((t, i) => (
            <label key={t} className="bids-star">
              <input
                type="radio"
                name="rate"
                value={i + 1}
                ref={i === 0 ? firstRate : null}
                checked={rate === i + 1}
                onChange={() => setRate(i + 1)}
              />
              <span className="t-money">{i + 1}</span>
              <small>{t}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="bidsFbTx">What went well, or what could be better? (optional)</label>
        <textarea
          className="textarea"
          id="bidsFbTx"
          maxLength={300}
          placeholder="Clear brief, quick approvals, paid on time…"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <p className="help num" id="bidsFbN">
          {text.length} / 300
        </p>
      </div>
      <p className="err" id="bidsFbErr" aria-live="polite">
        {err}
      </p>
      <div className="row wrap">
        <Lq className="lq-p" type="submit" disabled={busy}>
          Send feedback
        </Lq>
        <Lq className="lq-s" data-no="" onClick={() => close()}>
          Later
        </Lq>
      </div>
    </form>
  );
}

function BidsScreen() {
  const K = L.jobkit,
    s = K.ensure();
  s.bidsUI = s.bidsUI || { status: "" };
  const ui = s.bidsUI;
  /* ui.status is the exact status from the Filter menu (a KINDS value); ui.tab the tab it sits in */
  if (ui.status && !KINDS.includes(ui.status)) ui.status = "";
  if (!TABS.some(t => t.key === ui.tab)) ui.tab = ui.status ? tabOf(ui.status).key : "active";
  const [, redraw] = useState(0);
  const [live, setLive] = useState("");
  const root = useRef(null);
  const justSent = useRef(s.justSent);

  const info = b => {
    const j = K.job(b.job);
    return {
      brand: j ? j.brand : b.brand || "Brand",
      bi: j ? j.bi : L.initials(b.brand || "B"),
      title: j ? j.title : b.title || "Brief",
      platform: j ? j.platform : b.platform || "instagram",
      format: j ? j.format : b.format || "",
      job: j,
    };
  };
  const counts = () => KINDS.reduce((o, k) => ((o[k] = s.bids.filter(b => kindOf(b) === k).length), o), {});
  const tabCount = (t, c = counts()) => t.kinds.reduce((n, k) => n + c[k], 0);
  /* Active always shows; Won and Closed only once they have something in them */
  const shownTabs = (c = counts()) => TABS.filter(t => t.key === "active" || tabCount(t, c) > 0);
  const summary = () => {
    const c = counts();
    const parts = [
      [tabCount(TABS[0], c), "waiting on brands"],
      [tabCount(TABS[1], c), "won"],
      [tabCount(TABS[2], c), "closed"],
    ].filter(([n]) => n > 0);
    return parts.length ? parts.map(([n, t]) => `${n} ${t}`).join(" · ") : "Bids you send show up here.";
  };

  if (s.justSent) {
    ui.tab = "active"; // a bid just sent is waiting on the brand: open where it is
    ui.status = "";
  }
  if (!shownTabs().some(t => t.key === ui.tab)) ui.tab = "active";

  /** Changes what is shown, animating the slips from where they were (FLIP), and announces it. */
  const refresh = (change, msg, animate = true) => {
    const mutate = () =>
      flushSync(() => {
        change && change();
        if (!shownTabs().some(t => t.key === ui.tab)) ui.tab = "active";
        redraw(n => n + 1);
      });
    animate ? K.flip(mutate, () => L.$$(".bids-slip", root.current)) : mutate();
    if (msg) setLive(msg);
  };
  const pickTab = (key, focus) => {
    const t = TABS.find(x => x.key === key);
    refresh(() => {
      ui.tab = key;
      ui.status = "";
    }, `Showing ${t.title.toLowerCase()} bids`);
    const same = root.current.querySelector(`.bids-tabs [data-tab="${key}"]`);
    if (same && focus) {
      same.focus();
      K.settle && K.settle(same);
    }
  };
  const onTabKey = e => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const all = L.$$(".bids-tabs [data-tab]", root.current);
    const i = all.indexOf(e.currentTarget);
    const n =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? all.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
    e.preventDefault();
    pickTab(all[n].dataset.tab, true);
  };

  useEffect(() => {
    K.mo("stagger", L.$$(".bids-slip", root.current));
    // a bid that was just sent: bring it into view and mark the moment once
    const id = justSent.current;
    if (!id) return;
    s.justSent = null;
    const n = root.current.querySelector(`.bids-slip[data-id="${id}"]`);
    if (!n) return;
    n.classList.add("is-new");
    const b = s.bids.find(x => x.id === id),
      m = b && info(b);
    setLive(m ? `Bid sent to ${m.brand}` : "Bid sent");
    L.toast(m ? `Bid sent to ${m.brand}` : "Bid sent", "send");
    requestAnimationFrame(() => {
      n.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
      K.mo("celebrate", n);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const withdraw = b => {
    const m = info(b);
    openReactSheet({
      title: "Withdraw this bid?",
      render: close => <WithdrawSheet b={b} m={m} close={close} done={msg => refresh(null, msg)} />,
    });
  };
  const feedback = b => {
    const m = info(b);
    openReactSheet({
      title: "Feedback for " + m.brand,
      render: close => (
        <FeedbackSheet b={b} m={m} s={s} close={close} done={msg => refresh(null, msg, false)} />
      ),
    });
  };
  const similar = cat => {
    Object.assign(s.jobsUI, { q: "", city: "", platform: "", minBudget: 0, savedOnly: false, category: cat });
    K.persistUI();
    L.go("#jobs");
  };

  function slip(b) {
    const m = info(b),
      act = s.active.find(a => a.job === b.job);
    const thread = act && s.threads.find(t => t.id === act.thread);
    const by = b.by || "you";
    let note = b.note || "";
    if (b.status === "withdrawn")
      note =
        by === "you"
          ? `You withdrew this bid${b.at ? " on " + L.fmtDate(b.at) : ""}.`
          : `Cancelled by ${WHO[by] || by}${b.at ? " on " + L.fmtDate(b.at) : ""}.`;
    /* C10 trial: the bid went out before the ID check, so an accepted bid waits on it */
    const owed = b.status === "accepted" && kycOwed();
    if (owed) note = KYC_AFTER_ACCEPT;
    const msgBtn = thread ? (
      <Lq as="a" className="lq-s lq-sm" href={`#chat-${thread.id}`}>
        <Icon n="chat" className="ic" />
        Message {m.brand}
      </Lq>
    ) : null;
    let actions = null;
    if (b.status === "submitted" || b.status === "viewed")
      actions = (
        <>
          <Lq className="lq-s lq-sm" data-withdraw={b.id} onClick={() => withdraw(b)}>
            Withdraw bid
          </Lq>
          {m.job ? (
            <Lq as="a" className="lq-s lq-sm" href={`#job-${m.job.id}`}>
              View brief
            </Lq>
          ) : null}
        </>
      );
    else if (owed)
      actions = (
        <>
          <Lq className="lq-p lq-sm" data-verify="" onClick={() => openKyc("#bids")}>
            <Icon n="shield" />
            Verify ID
          </Lq>
          {msgBtn}
        </>
      );
    else if (b.status === "accepted")
      actions = (
        <>
          <Lq as="a" className="lq-p lq-sm" href={act ? "#work-" + act.id : "#active"}>
            Open your deal
          </Lq>
          {msgBtn}
        </>
      );
    else if (b.status === "completed")
      actions = (
        <>
          {b.feedback ? (
            <p className="bids-fb">
              <Icon n="check" />
              You rated {m.brand} {b.feedback.rating}/5
            </p>
          ) : (
            <Lq className="lq-p lq-sm" data-feedback={b.id} onClick={() => feedback(b)}>
              Leave feedback
            </Lq>
          )}
          <Lq as="a" className="lq-s lq-sm" href="#earnings">
            See payout
          </Lq>
        </>
      );
    else if (b.status === "rejected")
      actions = (
        <Lq
          className="lq-s lq-sm"
          data-similar={m.job ? m.job.category : ""}
          onClick={() => similar(m.job ? m.job.category : "")}
        >
          Find similar briefs
          <Icon n="arrow" className="ic" />
        </Lq>
      );
    else if (b.status === "withdrawn" && m.job)
      actions = (
        <Lq as="a" className="lq-s lq-sm" href={`#job-${m.job.id}`}>
          Open brief to bid again
        </Lq>
      );
    return (
      <article
        key={b.id}
        className={`bids-slip is-${b.status}`}
        data-id={b.id}
        data-status={b.status}
        aria-labelledby={`bt-${b.id}`}
      >
        <div className="bids-stub">
          <p className="bids-stub-l">Your bid</p>
          <p className="bids-price t-money">{L.inr(b.price)}</p>
          <p className="bids-stub-d">Sent {L.fmtDate(b.sent)}</p>
        </div>
        <div className="bids-body">
          <div className="bids-top">
            <BrandChip m={m} />
            {b.shortlisted && b.status === "viewed" ? (
              <span className="pill pill-info">
                <Icon n="flag" />
                Shortlisted
              </span>
            ) : (
              fromHtml(
                K.pill(
                  b.status,
                  b.status === "withdrawn"
                    ? by === "you"
                      ? "Withdrawn by you"
                      : "Cancelled"
                    : LABEL[b.status] || "",
                ),
              )
            )}
          </div>
          <h3 className="bids-t" id={`bt-${b.id}`}>
            {m.title}
          </h3>
          <p className="bids-sub">
            {fromHtml(K.glyph(m.platform))}
            <span>
              {K.platName(m.platform)} {m.format}
              {b.postDate ? ` · post date ${L.fmtDate(b.postDate)}` : ""}
            </span>
          </p>
          <Rail b={b} />
          <p className="bids-note">{note}</p>
          <div className="bids-acts">{actions}</div>
        </div>
      </article>
    );
  }

  function board() {
    if (!s.bids.length)
      return (
        <div className="empty bids-empty">
          <img src="assets/step-02-plane.svg" width="72" height="72" alt="" />
          <p className="t-h2">No bids yet.</p>
          <p className="muted">Find a brief that fits and send your first bid. It takes about a minute.</p>
          <Lq as="a" className="lq-p" href="#jobs">
            Find briefs
          </Lq>
        </div>
      );
    const tab = TABS.find(t => t.key === ui.tab) || TABS[0];
    const list = s.bids
      .filter(b => (ui.status ? kindOf(b) === ui.status : tab.kinds.includes(kindOf(b))))
      .sort((a, b) => L.D(b.sent) - L.D(a.sent));
    if (!list.length)
      return ui.status ? (
        <div className="empty bids-empty">
          <p className="t-h2">No {LABEL[ui.status].toLowerCase()} bids.</p>
          <Lq
            className="lq-s"
            data-kind=""
            onClick={() => {
              refresh(() => (ui.status = ""), "Showing every status");
              const sel = root.current.querySelector("[data-kindsel]");
              sel && sel.focus();
            }}
          >
            Show every {tab.title.toLowerCase()} bid
          </Lq>
        </div>
      ) : (
        <div className="empty bids-empty">
          <img src="assets/step-02-plane.svg" width="72" height="72" alt="" />
          <p className="t-h2">No bids waiting on brands.</p>
          <p className="muted">
            Your other bids are under{" "}
            {shownTabs()
              .filter(t => t.key !== "active")
              .map(t => t.title)
              .join(" and ")}
            . Find a brief that fits and send a new one.
          </p>
          <Lq as="a" className="lq-p" href="#jobs">
            Find briefs
          </Lq>
        </div>
      );
    return <div className="bids-list">{list.map(slip)}</div>;
  }

  const c = counts();
  return (
    <div className="view-in bids" ref={root}>
      <header className="bids-head">
        <div className="bids-head-t">
          <h1 className="t-h1">My bids</h1>
          <p className="muted" id="bidsSum">
            {summary()} <span className="sample">Sample data</span>
          </p>
        </div>
        <Lq as="a" className="lq-s" href="#jobs">
          <Icon n="search" />
          Find more briefs
        </Lq>
      </header>
      <DirectOffers />
      {s.bids.length ? (
        <div className="bids-bar">
          <div className="chips bids-tabs" role="tablist" aria-label="Bids by stage">
            {shownTabs(c).map(t => (
              <button
                key={t.key}
                className="chip bids-tab"
                type="button"
                role="tab"
                id={`bids-tab-${t.key}`}
                data-tab={t.key}
                aria-selected={String(ui.tab === t.key)}
                aria-controls="bidsBoard"
                tabIndex={ui.tab === t.key ? 0 : -1}
                onClick={() => pickTab(t.key, true)}
                onKeyDown={onTabKey}
              >
                {t.title} <span className="bids-cn">{tabCount(t, c)}</span>
              </button>
            ))}
          </div>
          <div className="bids-filter">
            <label className="bids-fl" htmlFor="bidsKind">
              Filter
            </label>
            <select
              className="select bids-kind"
              id="bidsKind"
              data-kindsel=""
              value={ui.status}
              onChange={e => {
                const k = e.target.value;
                refresh(
                  () => {
                    ui.status = k;
                    if (k) ui.tab = tabOf(k).key;
                  },
                  k ? `Showing ${LABEL[k].toLowerCase()} bids` : "Showing every status",
                );
              }}
            >
              <option value="">Any status</option>
              {KINDS.map(k => (
                <option key={k} value={k} disabled={!c[k]}>
                  {LABEL[k]} · {c[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <p className="sr-only" id="bidsLive" aria-live="polite">
        {live}
      </p>
      <div
        className="bids-board"
        id="bidsBoard"
        {...(s.bids.length ? { role: "tabpanel", "aria-labelledby": `bids-tab-${ui.tab}` } : {})}
      >
        {board()}
      </div>
    </div>
  );
}

L.register("bids", { title: "My bids", nav: "bids", Component: BidsScreen });
