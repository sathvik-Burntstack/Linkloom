/* Brand side · One job (#job-<id>): the brief, then the bids received. Builder C.
   Mirrors the creator job page (main column + sticky deal card). Flow a–c: view bids → shortlist / decline / compare up to 3 →
   Confirm creator (creates a campaign at stage 'accepted') → LLD.payEscrow opens the pay sheet.
   React screen (see src/shared/react/view.jsx). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";
import { Cav, CrChip, CrMini, Glyph, StatusPill, Ver } from "./kit";
import { PitchCard } from "./pitches";

const L = window.LLD,
  esc = L.esc;
const S = () => window.LLD_DATA;
const SORTS = {
  newest: "Newest first",
  low: "Price, low to high",
  high: "Price, high to low",
  reach: "Most followers",
  rating: "Highest rated",
  soon: "Earliest post date",
};
const FILTERS = ["new", "viewed", "shortlisted", "declined"];
const MAXCMP = 3;

function Compare({ j, ids, vsBudget, fol, onHire, onShort }) {
  const K = L.bk;
  const [, redraw] = useState(0);
  useEffect(() => {
    K.mo("stagger", L.$$(".sheet .jd-cmp-r"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = ids.map(b => S().bids.find(x => x.id === b)).filter(Boolean);
  const low = Math.min(...list.map(b => b.price)),
    best = Math.max(...list.map(b => K.cr(b.creator).rating || 0));
  const reach = Math.max(...list.map(b => fol(K.cr(b.creator))));
  const cols = list.map(b => ({ b, c: K.cr(b.creator) }));
  const Row = ({ label, children }) => (
    <div className="jd-cmp-r">
      <p className="jd-cmp-l">{label}</p>
      {children}
    </div>
  );
  const Cell = ({ top, children }) => <div className={`jd-cmp-c${top ? " is-top" : ""}`}>{children}</div>;
  const lead = d => {
    if (!d) return "—";
    const n = K.daysTo(j.deadline) - K.daysTo(d);
    return (
      <>
        {L.fmtDate(d)}
        <span className="muted">{n > 0 ? ` · ${n} day${n === 1 ? "" : "s"} early` : " · on the day"}</span>
      </>
    );
  };
  return (
    <div className="jd-cmp" style={{ "--n": cols.length }}>
      <div className="jd-cmp-r jd-cmp-head">
        {cols.map(({ b, c }) => (
          <div key={b.id} className="jd-cmp-c">
            <Cav c={c} />
            <p className="jd-cmp-n">
              {c.name}
              <Ver c={c} />
            </p>
            <p className="help">{c.handle}</p>
            <StatusPill map={K.BST} k={b.status} />
          </div>
        ))}
      </div>
      <Row label="Bid">
        {cols.map(({ b }) => (
          <Cell key={b.id} top={b.price === low}>
            <span className="t-money jd-cmp-price">{L.inr(b.price)}</span>
            {b.price === low ? <span className="jd-cmp-tag">Lowest</span> : null}
          </Cell>
        ))}
      </Row>
      <Row label={"Against your budget of " + L.inr(j.budget)}>
        {cols.map(({ b }) => (
          <Cell key={b.id}>{vsBudget(b.price)}</Cell>
        ))}
      </Row>
      <Row label={`${K.plat(j.platform)} followers`}>
        {cols.map(({ b, c }) => {
          const p = K.pf(c, j.platform);
          return (
            <Cell key={b.id} top={p && p.followers === reach}>
              {p ? (
                <>
                  {L.compact(p.followers)}
                  {p.er > 0 ? <span className="muted"> · {p.er}% ER</span> : null}
                </>
              ) : (
                "—"
              )}
            </Cell>
          );
        })}
      </Row>
      <Row label="Average views">
        {cols.map(({ b, c }) => {
          const p = K.pf(c, j.platform);
          return <Cell key={b.id}>{p ? L.compact(p.avgViews) : "—"}</Cell>;
        })}
      </Row>
      <Row label="Expected views">
        {cols.map(({ b }) => (
          <Cell key={b.id}>{b.views ? L.compact(b.views) : <span className="muted">Not given</span>}</Cell>
        ))}
      </Row>
      <Row label="Post date">
        {cols.map(({ b }) => (
          <Cell key={b.id}>{lead(b.postDate)}</Cell>
        ))}
      </Row>
      <Row label="Rating">
        {cols.map(({ b, c }) => (
          <Cell key={b.id} top={c.rating && c.rating === best}>
            {c.rating ? (
              <>
                <Icon n="star" />
                {Number(c.rating).toFixed(1)}
                <span className="muted"> · {c.reviews}</span>
              </>
            ) : (
              <span className="muted">No reviews yet</span>
            )}
          </Cell>
        ))}
      </Row>
      <Row label="City">
        {cols.map(({ b, c }) => (
          <Cell key={b.id}>{c.city}</Cell>
        ))}
      </Row>
      <Row label="Speaks your languages">
        {cols.map(({ b, c }) => {
          const m = (j.languages || []).filter(l => (c.languages || []).includes(l));
          return (
            <Cell key={b.id}>{m.length ? m.join(", ") : <span className="muted">None of them</span>}</Cell>
          );
        })}
      </Row>
      <Row label="Their note">
        {cols.map(({ b }) => (
          <Cell key={b.id}>
            <span className="jd-cmp-pitch">“{b.pitch || ""}”</span>
          </Cell>
        ))}
      </Row>
      <div className="jd-cmp-r jd-cmp-foot">
        {cols.map(({ b, c }) => (
          <div key={b.id} className="jd-cmp-c">
            <Lq className="lq-p lq-sm" data-chire={b.id} onClick={() => onHire(b.id)}>
              <Icon n="lock" className="ic" />
              Confirm {K.first(c)}
            </Lq>
            <button
              className="chip"
              type="button"
              data-cshort={b.id}
              aria-pressed={String(b.status === "shortlisted")}
              onClick={() => {
                onShort(b);
                flushSync(() => redraw(n => n + 1));
                const pl = document.querySelectorAll(".sheet .jd-cmp-head [data-pill]")[
                  cols.findIndex(x => x.b.id === b.id)
                ];
                pl && K.mo("bump", pl);
              }}
            >
              <Icon n="bookmark" />
              <span>{b.status === "shortlisted" ? "Shortlisted" : "Shortlist"}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobScreen({ param: id }) {
  const K = L.bk,
    j = K.job(id);
  const u = K.ui("job");
  const [, redraw] = useState(0);
  const [live, setLive] = useState("");
  const root = useRef(null),
    budgetEl = useRef(null);
  const focusBid = useRef(null);
  if (focusBid.current === null) {
    u.sort = SORTS[u.sort] ? u.sort : "newest";
    u.f = u.f || "";
    /* arriving from "View bid" on Home: show every bid so the one asked for is on screen */
    focusBid.current = u.focusBid || "";
    u.focusBid = "";
    if (focusBid.current) u.f = "";
    u.cmp = u.cmp || {};
  }
  const draw = () => flushSync(() => redraw(n => n + 1));
  useEffect(() => L.store.on(why => why === "escrow-paid" && redraw(n => n + 1)), []);
  useLayoutEffect(() => {
    if (!j || !root.current) return;
    K.mo("count", budgetEl.current, j.budget, L.inr);
    K.mo("stagger", L.$$(".jd-sec, .jd-deal, .jd-bid", root.current));
    const fb = focusBid.current;
    if (fb) {
      const k = L.$$(".jd-bid", root.current).find(x => x.dataset.id === fb);
      if (k)
        setTimeout(() => {
          k.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
          k.setAttribute("tabindex", "-1");
          k.focus({ preventScroll: true });
          k.classList.add("is-focus");
          setTimeout(() => k.classList.remove("is-focus"), 2600);
        }, 120);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!j)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
          <p className="t-h2">This collab is gone.</p>
          <p className="muted">It may have been deleted. Your other collabs are safe.</p>
          <Lq as="a" className="lq-p" href="#jobs">
            See all collabs
          </Lq>
        </div>
      </div>
    );

  const cmp = () =>
    (u.cmp[j.id] = (u.cmp[j.id] || []).filter(b =>
      S().bids.some(x => x.id === b && x.status !== "declined"),
    ));
  const bids = () => K.bidsFor(j.id);
  const canHire = () => j.status === "open";
  const fol = c => {
    const p = K.pf(c, j.platform);
    return p ? p.followers : 0;
  };
  const sorted = list => {
    const by = {
      newest: (a, b) => L.D(b.sent) - L.D(a.sent),
      low: (a, b) => a.price - b.price,
      high: (a, b) => b.price - a.price,
      reach: (a, b) => fol(K.cr(b.creator)) - fol(K.cr(a.creator)),
      rating: (a, b) => (K.cr(b.creator).rating || 0) - (K.cr(a.creator).rating || 0),
      soon: (a, b) => String(a.postDate).localeCompare(String(b.postDate)),
    }[u.sort];
    const rank = b => (b.status === "hired" ? 0 : b.status === "declined" ? 2 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b) || by(a, b));
  };
  const vsBudget = p =>
    p === j.budget
      ? "On budget"
      : p < j.budget
        ? `${L.inr(j.budget - p)} under budget`
        : `${L.inr(p - j.budget)} over budget`;
  const refreshBids = (animate = true, msg) => {
    animate ? K.flip(draw, () => L.$$(".jd-bid", root.current)) : draw();
    msg && setLive(msg);
  };
  const setBid = (bid, fn, why) =>
    L.store.set(s => {
      const b = s.bids.find(x => x.id === bid);
      b && fn(b);
    }, why);
  const seen = bid => {
    const b = S().bids.find(x => x.id === bid);
    if (b && b.status === "new") setBid(bid, x => (x.status = "viewed"), "bid-viewed");
  };
  const focus = sel => {
    const n = root.current.querySelector(sel);
    n && n.focus();
  };

  const onShort = (bid, btn) => {
    const b = S().bids.find(x => x.id === bid),
      on = b.status !== "shortlisted";
    const card = btn.closest(".jd-bid"),
      pl = card && card.querySelector("[data-pill]");
    const swap = () => {
      setBid(bid, x => (x.status = on ? "shortlisted" : "viewed"), "bid-shortlist");
      draw();
    };
    const apply = () => {
      refreshBids(false, on ? `${K.cr(b.creator).name} shortlisted` : "Removed from shortlist");
      focus(`[data-short="${bid}"]`);
    };
    if (pl && L.motion.morph && !L.RM) {
      K.mo("morph", pl, swap); // the pill morphs while React draws its new state
      setTimeout(apply, 340);
    } else {
      swap();
      apply();
    }
  };
  const onCmp = bid => {
    const list = cmp(),
      i = list.indexOf(bid);
    if (i >= 0) list.splice(i, 1);
    else if (list.length >= MAXCMP) {
      L.toast(`Compare up to ${MAXCMP} bids. Remove one first.`, "info");
      K.mo("shake", root.current.querySelector("#jdTray"));
      return;
    } else {
      list.push(bid);
      seen(bid);
    }
    refreshBids(false);
    focus(`[data-cmp="${bid}"]`);
    setLive(`${list.length} of ${MAXCMP} picked to compare`);
  };

  /* ---------- confirm creator → campaign at 'accepted' → pay sheet ---------- */
  function hire(bid) {
    const b = S().bids.find(x => x.id === bid);
    if (!b || !canHire()) return;
    if (L.live && L.needKyc("#job-" + j.id)) return;
    const c = K.cr(b.creator),
      others = bids().filter(x => x.id !== bid && K.OPEN_BID.includes(x.status)).length;
    K.confirm({
      title: `Hire ${c.name}?`,
      yes: `Confirm ${K.first(c)}`,
      no: "Not yet",
      mini: (
        <CrMini c={c} price={b.price} line={`${j.title} · post by ${L.fmtDate(b.postDate || j.deadline)}`} />
      ),
      bullets: [
        `A deal starts at Accepted for ${L.inr(b.price)}, the agreed price.`,
        `Next you pay ${L.inr(b.price)} into escrow. Linkloom holds it until you approve the work.`,
        `Chat with ${K.first(c)} opens once you pay. No platform fee.`,
      ],
      extra: others ? (
        <label className="check jd-close-others">
          <input type="checkbox" defaultChecked data-closeothers="" />
          {` Close the collab and decline the other ${others} open bid${others === 1 ? "" : "s"}`}
        </label>
      ) : null,
      trust: "Held safely until you approve.",
      onYes(body) {
        if (L.live) {
          L.live.selectBid(j.id, bid).then(
            () => {
              const camp = S().campaigns.find(x => x.job === j.id && x.creator === b.creator);
              L.toast(`${c.name} confirmed`, "check");
              L.go(camp ? "#campaign-" + camp.id : "#campaigns");
            },
            e => {
              if (L.live.isKycRequired(e)) return L.kycGate("#job-" + j.id);
              L.toast(L.live.errorText(e), "alert");
            },
          );
          return;
        }
        const closeOthers = !!(body.querySelector("[data-closeothers]") || { checked: true }).checked;
        const cid = "c" + Date.now().toString(36),
          at = K.nowISO();
        L.store.set(s => {
          const x = s.bids.find(y => y.id === bid);
          x.status = "hired";
          const jj = s.jobs.find(y => y.id === j.id);
          if (closeOthers) {
            jj.status = "hired";
            jj.hired = b.creator;
            s.bids.forEach(y => {
              if (y.job === j.id && y.id !== bid && K.OPEN_BID.includes(y.status)) {
                y.status = "declined";
                y.closedWithJob = true;
              }
            });
          }
          s.campaigns.unshift({
            id: cid,
            creator: b.creator,
            source: "job",
            job: j.id,
            title: j.title,
            platform: j.platform,
            format: j.format,
            price: b.price,
            stage: "accepted",
            revisionsIncluded: 2,
            revisionsUsed: 0,
            due: b.postDate || j.deadline,
            thread: null,
            deliverables: (j.deliverables || []).slice(),
            deliveries: [],
            log: [[at, "accepted"]],
          });
        }, "creator-confirmed");
        u.cmp[j.id] = [];
        draw();
        setLive(`${c.name} confirmed. Pay into escrow to start.`);
        setTimeout(() => L.payEscrow && L.payEscrow(cid), L.RM ? 0 : 120);
      },
    });
  }
  const compare = () => {
    if (cmp().length < 2) return;
    openReactSheet({
      title: "Compare bids",
      wide: true,
      render: close => (
        <Compare
          j={j}
          ids={cmp().slice()}
          vsBudget={vsBudget}
          fol={fol}
          onHire={bid => {
            close(true);
            hire(bid);
          }}
          onShort={b => {
            const on = b.status !== "shortlisted";
            setBid(b.id, x => (x.status = on ? "shortlisted" : "viewed"), "bid-shortlist");
            refreshBids(false);
          }}
        />
      ),
    });
  };

  /* ---------- the bid cards ---------- */
  const bidCard = b => {
    const c = K.cr(b.creator),
      p = K.pf(c, j.platform),
      inCmp = cmp().includes(b.id),
      c0 = b.status === "hired" && S().campaigns.find(x => x.job === j.id && x.creator === b.creator);
    /* bid actions stay secondary: the confirm sheet carries the one primary (and the trust line) */
    let acts = [];
    if (b.status === "hired") {
      if (c0)
        acts.push(
          <Lq key="deal" as="a" className="lq-s lq-sm" href={`#campaign-${c0.id}`}>
            Open deal
          </Lq>,
        );
    } else if (b.status === "declined") {
      if (canHire())
        acts.push(
          <Lq
            key="undo"
            className="lq-s lq-sm"
            data-undo={b.id}
            onClick={() => {
              setBid(
                b.id,
                x => {
                  x.status = "viewed";
                  delete x.closedWithJob;
                },
                "bid-undo",
              );
              refreshBids(true, "Decline undone");
            }}
          >
            Undo decline
          </Lq>,
        );
    } else if (canHire()) {
      acts.push(
        <Lq key="hire" className="lq-s lq-sm" data-hire={b.id} onClick={() => hire(b.id)}>
          <Icon n="lock" className="ic" />
          Confirm {K.first(c)}
        </Lq>,
        <button
          key="short"
          className="chip jd-short"
          type="button"
          data-short={b.id}
          aria-pressed={String(b.status === "shortlisted")}
          onClick={e => onShort(b.id, e.currentTarget)}
        >
          <Icon n="bookmark" />
          <span>{b.status === "shortlisted" ? "Shortlisted" : "Shortlist"}</span>
        </button>,
        <button
          key="cmp"
          className="chip jd-cmp-t"
          type="button"
          data-cmp={b.id}
          aria-pressed={String(inCmp)}
          onClick={() => onCmp(b.id)}
        >
          <Icon n={inCmp ? "check" : "plus"} />
          <span>Compare</span>
        </button>,
        <Lq
          key="decline"
          className="lq-s lq-sm"
          data-decline={b.id}
          onClick={() => {
            setBid(b.id, x => (x.status = "declined"), "bid-declined");
            u.cmp[j.id] = cmp().filter(x => x !== b.id);
            refreshBids(true, `${c.name}’s bid declined`);
            L.toast(`Declined. ${K.first(c)} is told kindly.`, "check");
          }}
        >
          Decline
        </Lq>,
      );
    }
    if (b.status === "new" && canHire())
      acts.push(
        <Lq
          key="seen"
          className="lq-s lq-sm jd-seen"
          data-seen={b.id}
          onClick={() => {
            seen(b.id);
            refreshBids(false, "Marked as viewed");
          }}
        >
          <Icon n="eye" className="ic" />
          Mark as viewed
        </Lq>,
      );
    /* the lock line closes the actions of a bid that can still be confirmed (Confirm leads to escrow) */
    if (acts.some(x => x.key === "hire"))
      acts.push(
        <p key="trust" className="ll-trust jd-trust">
          <Icon n="lock" />
          Held safely until you approve.
        </p>,
      );
    return (
      <article key={b.id} className={`jd-bid is-${b.status}`} data-id={b.id} aria-labelledby={`jb-${b.id}`}>
        <div className="jd-bid-h">
          <a
            className="jd-bid-who"
            href={`#creator-${c.id}`}
            data-prof={b.id}
            id={`jb-${b.id}`}
            onClick={() => seen(b.id)}
          >
            <CrChip c={c} sub={`${c.handle} · ${c.city}`} />
          </a>
          <StatusPill map={K.BST} k={b.status} />
        </div>
        <div className="jd-bid-g">
          <div className="jd-bid-p">
            <p className="jd-lab">Bid</p>
            <p className="t-money jd-bid-price">{L.inr(b.price)}</p>
            <p className={`jd-bid-vs${b.price > j.budget ? " is-over" : ""}`}>{vsBudget(b.price)}</p>
          </div>
          <dl className="bk-meta jd-bid-m">
            <div>
              <dt>{p ? K.plat(p.p) : "Followers"}</dt>
              <dd>
                {p ? (
                  <>
                    {L.compact(p.followers)}
                    {p.er > 0 ? (
                      <>
                        {" "}
                        <span className="muted">· {p.er}% ER</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>
                {c.rating ? (
                  <>
                    {Number(c.rating).toFixed(1)} <span className="muted">· {c.reviews} reviews</span>
                  </>
                ) : (
                  <span className="muted">New</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Post date</dt>
              <dd>{b.postDate ? L.fmtDate(b.postDate) : "—"}</dd>
            </div>
            <div>
              <dt>Expected views</dt>
              <dd>{b.views ? L.compact(b.views) : <span className="muted">Not given</span>}</dd>
            </div>
          </dl>
        </div>
        <blockquote className="jd-pitch">
          <p>“{b.pitch || "No note."}”</p>
        </blockquote>
        {(b.links || []).length ? (
          <ul className="jd-links">
            {b.links.map((x, i) => (
              <li key={i}>
                <Icon n="link" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="jd-sent">
          Sent {L.ago(b.sent)}
          {b.closedWithJob ? " · declined when the collab closed" : ""}
        </p>
        {acts.length ? <div className="jd-acts">{acts}</div> : null}
      </article>
    );
  };

  const all = bids();
  const hiddenCount = Math.max(0, (j.bids || 0) - all.length);
  const counts = FILTERS.reduce((o, k) => ((o[k] = all.filter(b => b.status === k).length), o), {});
  let bidsBlock;
  if (j.status === "draft")
    bidsBlock = (
      <div className="empty jd-empty">
        <p className="t-h2">No bids on a draft.</p>
        <p className="muted">Publish the collab and creators who fit can bid on it.</p>
        <Lq as="a" className="lq-p" href={`#post-${j.id}`}>
          Finish and publish
        </Lq>
      </div>
    );
  else if (!all.length) {
    const c = K.campOfJob(j.id),
      k = c && K.cr(c.creator);
    bidsBlock = (
      <div className="empty jd-empty">
        {j.bids ? (
          <>
            <p className="t-h2">{j.bids} bids came in.</p>
            <p className="muted">
              {k
                ? `You hired ${k.name}. The other bids closed with the collab.`
                : "They closed with the collab."}
            </p>
            {c ? (
              <Lq as="a" className="lq-s" href={`#campaign-${c.id}`}>
                Open deal
              </Lq>
            ) : null}
          </>
        ) : (
          <>
            <p className="t-h2">No bids yet.</p>
            <p className="muted">
              New collabs usually get their first bids within a day. You get a notification for each one.
            </p>
          </>
        )}
      </div>
    );
  } else {
    const list = sorted(u.f ? all.filter(b => b.status === u.f) : all);
    const pickF = f => {
      u.f = f;
      refreshBids(true, u.f ? `Showing ${K.BST[u.f].label.toLowerCase()} bids` : "Showing all bids");
      focus(`.jd-filter [data-f="${u.f}"]`);
    };
    bidsBlock = (
      <>
        <div className="jd-tools">
          <div className="chips jd-filter" role="group" aria-label="Filter bids">
            <button
              className="chip"
              type="button"
              data-f=""
              aria-pressed={String(!u.f)}
              onClick={() => pickF("")}
            >
              All <span className="jl-cn">{all.length}</span>
            </button>
            {FILTERS.map(k => (
              <button
                key={k}
                className="chip"
                type="button"
                data-f={k}
                aria-pressed={String(u.f === k)}
                disabled={!counts[k]}
                onClick={() => pickF(k)}
              >
                {K.BST[k].label} <span className="jl-cn">{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="field jd-sort">
            <label className="sr-only" htmlFor="jdSort">
              Sort bids
            </label>
            <select
              className="select"
              id="jdSort"
              value={u.sort}
              onChange={e => {
                u.sort = e.target.value;
                refreshBids(true, "Sorted by " + SORTS[u.sort].toLowerCase());
              }}
            >
              {Object.entries(SORTS).map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="jd-bids" id="jdBids">
          {list.length ? (
            list.map(bidCard)
          ) : (
            <p className="muted jd-none">No {K.BST[u.f].label.toLowerCase()} bids.</p>
          )}
        </div>
        {hiddenCount ? (
          <p className="help jd-more">
            {all.length} of {j.bids} bids are shown in this sample.{" "}
            <span className="sample">Sample data</span>
          </p>
        ) : null}
      </>
    );
  }

  const c = K.campOfJob(j.id),
    n = k => all.filter(b => b.status === k).length;
  const ids = cmp();
  const pitches = (S().pitches || []).filter(p => p.job === j.id && p.status !== "declined");
  const banner =
    j.status === "draft" ? (
      <p className="jd-banner">
        <Icon n="edit" />
        <span>This is a draft. Creators can’t see it yet.</span>
      </p>
    ) : j.status === "closed" ? (
      <p className="jd-banner">
        <Icon n="close" />
        <span>Closed{j.closedAt ? " on " + L.fmtDate(j.closedAt) : ""}. Creators can no longer bid.</span>
      </p>
    ) : null;
  const folTxt = j.minFollowers ? L.compact(j.minFollowers) + "+ followers" : "No minimum";

  return (
    <div className="view-in jd" ref={root}>
      <a className="btn-q jd-back" href="#jobs">
        <Icon n="back" />
        All collabs
      </a>
      <div className="jd-layout">
        <article className="jd-main" aria-labelledby="jdH">
          <header className="jd-h">
            <div className="bk-src">
              <span className="bk-plat">
                <Glyph p={j.platform} />
                <span>
                  {[[K.plat(j.platform), j.format].filter(Boolean).join(" "), j.category]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <StatusPill map={K.JST} k={j.status} />
            </div>
            <h1 className="t-h1" id="jdH">
              {j.title}
            </h1>
            <p className="muted t-small">
              {j.posted ? "Posted " + L.ago(j.posted) : "Not posted yet"}
              <span className="sample"> · Sample collab</span>
            </p>
            <div className="jd-tools-h" role="group" aria-label="Collab actions">
              {j.status === "open" || j.status === "draft" ? (
                <a className="chip" href={`#post-${j.id}`}>
                  <Icon n="edit" />
                  <span>Edit</span>
                </a>
              ) : null}
              {j.status === "open" || j.status === "hired" ? (
                <button
                  className="chip"
                  type="button"
                  data-closejob=""
                  onClick={() => K.closeJob(j.id, () => draw())}
                >
                  <Icon n="close" />
                  <span>{j.status === "hired" ? "Close listing" : "Close collab"}</span>
                </button>
              ) : null}
              {S().campaigns.some(x => x.job === j.id) ? null : (
                <button
                  className="chip"
                  type="button"
                  data-deljob=""
                  onClick={() => K.deleteJob(j.id, () => L.go("#jobs"))}
                >
                  <Icon n="trash" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </header>
          {banner}
          <section className="jd-sec jd-brief-sec card" aria-labelledby="jdBriefH">
            <h2 className="t-eyebrow muted" id="jdBriefH">
              Collab details
            </h2>
            <p className="jd-brief">{j.brief || "No details yet."}</p>
            <dl className="cw-facts jd-facts">
              <div>
                <dt>Followers</dt>
                <dd>{folTxt}</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>{(j.languages || []).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{j.remote ? "Any city" : j.city}</dd>
              </div>
              <div>
                <dt>Usage</dt>
                <dd>{j.usage || "—"}</dd>
              </div>
            </dl>
            <ol className="jd-dels">
              {(j.deliverables || []).map((d, i) => (
                <li key={i}>
                  <span className="jd-n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="jd-sec jd-bids-sec" aria-labelledby="jdBidsH">
            <div className="row between wrap">
              <h2 className="t-h2" id="jdBidsH">
                Bids received
              </h2>
              {canHire() && all.length ? (
                <p className="help">Shortlist the ones you like, compare up to {MAXCMP}, then confirm one.</p>
              ) : null}
            </div>
            <div id="jdBidsBox">{bidsBlock}</div>
          </section>
          {/* creators' pitches that name this brief (from the brand profile); the full list lives in #pitches */}
          {pitches.length ? (
            <section className="jd-sec jd-pitches" id="jdPitches" aria-labelledby="jdPitchH">
              <div className="jd-pitches-h">
                <h2 className="t-h2" id="jdPitchH">
                  Pitches about this collab <span className="jl-cn">{pitches.length}</span>
                </h2>
                <Lq as="a" className="lq-s lq-sm" href={`#pitches-${j.id}`}>
                  See {pitches.length > 2 ? "all " + pitches.length : pitches.length === 1 ? "it" : "both"} in
                  Pitches
                </Lq>
              </div>
              {pitches.slice(0, 2).map(p => (
                <PitchCard key={p.id} p={p} compact onChange={() => redraw(x => x + 1)} />
              ))}
            </section>
          ) : null}
        </article>
        <aside className="jd-side" aria-label="Budget and bids">
          <div className="jd-deal card">
            <p className="jd-lab">Budget</p>
            <p className="t-money jd-budget" data-budget="" ref={budgetEl}>
              {L.inr(j.budget)}
            </p>
            <p className="bk-loc">
              <Icon n="pin" />
              <span>{K.where(j)}</span>
            </p>
            <dl className="bk-meta">
              <div>
                <dt>Live by</dt>
                <dd>{L.fmtDate(j.deadline)}</dd>
              </div>
              <div>
                <dt>Bids</dt>
                <dd>{j.bids || 0}</dd>
              </div>
            </dl>
            {all.length ? (
              <ul className="jd-tally">
                {FILTERS.map(k => (
                  <li key={k} className={`is-${k}`}>
                    <span className="dot" aria-hidden="true"></span>
                    {K.BST[k].label}
                    <b className="num">{n(k)}</b>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="jd-payline">
              You pay the agreed price into escrow when you confirm a creator. No platform fee.{" "}
              <span className="muted">Taxes as per confirmed rules.</span>
            </p>
            {c ? (
              <Lq as="a" className="lq-p jd-side-btn" href={`#campaign-${c.id}`}>
                Open deal
              </Lq>
            ) : null}
            {j.status === "open" || j.status === "draft" ? (
              <Lq as="a" className="lq-s jd-side-btn" href={`#post-${j.id}`}>
                <Icon n="edit" />
                {j.status === "draft" ? "Continue editing" : "Edit collab"}
              </Lq>
            ) : null}
          </div>
        </aside>
      </div>
      <p className="sr-only" id="jdLive" aria-live="polite">
        {live}
      </p>
      <div
        className="jd-tray dark"
        id="jdTray"
        role="region"
        aria-label="Compare bids"
        hidden={!ids.length || !canHire()}
      >
        <p className="jd-tray-t">
          <span className="jd-tray-av">
            {ids.map((b, i) => (
              <Cav key={i} c={K.cr(S().bids.find(x => x.id === b).creator)} />
            ))}
          </span>
          <span>
            <b>
              {ids.length} of {MAXCMP}
            </b>{" "}
            picked to compare
          </span>
        </p>
        <div className="row">
          <Lq
            className="lq-s lq-sm jd-tray-x"
            data-clearcmp=""
            onClick={() => {
              u.cmp[j.id] = [];
              refreshBids(false, "Compare cleared");
            }}
          >
            Clear
          </Lq>
          <Lq
            className="lq-p lq-sm"
            data-opencmp=""
            disabled={ids.length < 2}
            aria-disabled={ids.length < 2 ? "true" : undefined}
            onClick={compare}
          >
            {ids.length < 2 ? "Pick one more" : "Compare " + ids.length}
          </Lq>
        </div>
      </div>
    </div>
  );
}

L.register("job", {
  title: id => {
    const j = L.bk && L.bk.job(id);
    return j ? j.title : "Collab";
  },
  crumb: id => {
    const j = L.bk && L.bk.job(id);
    return `<a href="#jobs">Collabs</a> / ${j ? esc(j.title) : "Collab"}`;
  },
  nav: "jobs",
  Component: JobScreen,
});
