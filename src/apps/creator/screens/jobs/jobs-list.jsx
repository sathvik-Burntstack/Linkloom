/* Find briefs (#jobs). Owner: Builder B. React screen (see src/shared/react/view.jsx).
   The filters, count and notes are React; the brief cards are the shared HTML card (ui/brief-card.js, also on Home),
   kept as an island that is wired once (save, hide, swipe) and then shown, hidden and re-ordered in place. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq } from "@/shared/react/view";
import { BriefCard } from "../../ui/brief-card";

const L = window.LLD;
const BUDGETS = [0, 500000, 1000000, 2000000, 4000000];
const SORTS = {
  match: "Best match",
  budget: "Highest budget",
  deadline: "Deadline soonest",
  newest: "Newest",
  bids: "Fewest bids",
};
function filtered(ui) {
  const K = L.jobkit,
    q = ui.q.trim().toLowerCase();
  let list = K.openJobs().filter(
    j =>
      (!q ||
        [j.title, j.brand, j.category, j.city, j.format, K.platName(j.platform)]
          .join(" ")
          .toLowerCase()
          .includes(q)) &&
      (!ui.city || (ui.city === "remote" ? j.remote : j.city === ui.city)) &&
      (!ui.platform || j.platform === ui.platform) &&
      (!ui.category || j.category === ui.category) &&
      (!ui.minBudget || j.budget >= ui.minBudget) &&
      (!ui.savedOnly || K.isSaved(j.id)),
  );
  const hiddenCount = list.filter(j => K.isHidden(j.id)).length;
  if (!ui.showHidden) list = list.filter(j => !K.isHidden(j.id));
  const by =
    {
      match: (a, b) => b.match - a.match,
      budget: (a, b) => b.budget - a.budget,
      deadline: (a, b) => (a.deadline > b.deadline ? 1 : -1),
      newest: (a, b) => (b.posted > a.posted ? 1 : -1),
      bids: (a, b) => a.bids - b.bids,
    }[ui.sort] || ((a, b) => b.match - a.match);
  return { list: list.sort(by), hiddenCount };
}
const activeCount = ui =>
  ["q", "city", "platform", "category", "minBudget", "savedOnly"].filter(
    k => !!(typeof ui[k] === "string" ? ui[k].trim() : ui[k]),
  ).length;
const budgetLabel = p => (p ? L.inr(p) + "+" : "Any");

function JobsScreen() {
  const K = L.jobkit,
    s = K.ensure(),
    ui = s.jobsUI;
  const [, redraw] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [fOpen, setFOpen] = useState(false);
  /* the line under the list: the hidden count, or a note after hiding ({ undo: id }) or undoing ("back") */
  const note = useRef(null);
  const listEl = useRef(null),
    qEl = useRef(null),
    cards = useRef(null),
    qT = useRef(0);
  const pool = K.openJobs();
  const cities = [...new Set(pool.filter(j => !j.remote).map(j => j.city))].sort();
  const cats = [...new Set(pool.map(j => j.category))].filter(Boolean).sort();
  const open = pool.length;
  const { list: vis, hiddenCount } = filtered(ui);
  const ids = vis.map(j => j.id);
  const n = activeCount(ui);

  /* every open brief's card, drawn once: filters only show, hide and reorder them, and the wiring, swipe and save
     stitch change them directly */
  const cardEls = useMemo(() => pool.map(j => <BriefCard key={j.id} j={j} ctx="list" />), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* show, hide and order the card nodes to match the filters */
  const placeCards = () => {
    const { list: v } = filtered(ui),
      keep = v.map(j => j.id);
    cards.current.forEach((c, id) => {
      c.hidden = !keep.includes(id);
      c.classList.toggle("is-hidden-job", K.isHidden(id));
    });
    keep.forEach(id => listEl.current.append(cards.current.get(id)));
  };
  const apply = (animate = true, after = null) => {
    const mutate = () => {
      note.current = after;
      flushSync(() => redraw(x => x + 1));
      placeCards();
    };
    animate ? K.flip(mutate, [...cards.current.values()]) : mutate();
    K.persistUI();
  };
  const set = (k, v) => {
    ui[k] = v;
    apply();
  };
  const hide = id => {
    K.setHidden(id, true);
    apply(true, { undo: id });
  };

  useLayoutEffect(() => {
    const list = listEl.current;
    cards.current = new Map(L.$$(".jobs-card", list).map(c => [c.dataset.id, c]));
    const wired = K.wire(list, {
      onHide: id => apply(true, { undo: id }),
      onSave: () => {
        if (ui.savedOnly) apply();
      },
    });
    placeCards();
    K.persistUI();
    K.mo("stagger", L.$$(".jobs-card:not([hidden])", list));
    // coming back from a job: restore scroll and focus that card
    if (ui.fromJob) {
      const back = ui.fromJob,
        y = ui.scrollY || 0;
      ui.fromJob = null;
      requestAnimationFrame(() =>
        setTimeout(() => {
          window.scrollTo({ top: y, behavior: "auto" });
          const a = list.querySelector(`.jobs-card[data-id="${back}"] .jobs-card-link`);
          a && a.focus({ preventScroll: true });
        }, 30),
      );
    }
    const onScroll = () => {
      ui.scrollY = window.scrollY;
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      wired.cleanup();
      removeEventListener("scroll", onScroll);
      clearTimeout(qT.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onNet = () => setOnline(navigator.onLine);
    addEventListener("online", onNet);
    addEventListener("offline", onNet);
    return () => {
      removeEventListener("online", onNet);
      removeEventListener("offline", onNet);
    };
  }, []);

  const clear = () => {
    if (!activeCount(ui)) return;
    Object.assign(ui, { q: "", city: "", platform: "", category: "", minBudget: 0, savedOnly: false });
    qEl.current.value = "";
    apply();
    L.toast("Filters cleared", "filter");
    qEl.current.focus();
  };
  const nt = note.current;
  const clearLab = n ? `Clear filters (${n})` : "Clear filters";

  return (
    <div className="view-in jobs">
      <header className="jobs-head">
        <div className="jobs-head-t">
          <h1 className="t-h1">Find briefs</h1>
          <p className="muted">
            {open
              ? `${open} ${open === 1 ? "brand wants" : "brands want"} creators this week. Bid on the ones that fit you.`
              : "No open briefs right now. New ones arrive most days."}{" "}
            <span className="sample">Sample data</span>
          </p>
        </div>
        <div className="jobs-search">
          <label className="sr-only" htmlFor="jobsQ">
            Search briefs
          </label>
          <Icon n="search" />
          <input
            className="input"
            id="jobsQ"
            type="search"
            autoComplete="off"
            placeholder="Search brand, product, city"
            defaultValue={ui.q}
            ref={qEl}
            onChange={e => {
              clearTimeout(qT.current);
              const v = e.target.value;
              qT.current = setTimeout(() => set("q", v), 140);
            }}
          />
        </div>
      </header>
      <div className="jobs-layout">
        <aside className={`jobs-filters${fOpen ? " is-open" : ""}`} id="jobsFilters" aria-label="Filters">
          <div className="jobs-f-h">
            <p className="t-label">Filters</p>
            <Lq className="lq-s lq-sm jobs-clear" data-clear="" aria-disabled={String(!n)} onClick={clear}>
              {clearLab}
            </Lq>
          </div>
          <div className="field">
            <label htmlFor="jobsCity">City</label>
            <select
              className="select"
              id="jobsCity"
              value={ui.city}
              onChange={e => set("city", e.target.value)}
            >
              <option value="">All cities</option>
              {cities.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="remote">Any city · remote</option>
            </select>
          </div>
          <div className="field">
            <span className="lab" id="jobsPlatL">
              Platform
            </span>
            <div className="seg jobs-seg" role="group" aria-labelledby="jobsPlatL">
              {[
                ["", "All"],
                ["instagram", "Instagram", "ig"],
                ["youtube", "YouTube", "yt"],
              ].map(([v, t, ic]) => (
                <button
                  key={v}
                  type="button"
                  data-plat={v}
                  aria-pressed={String(v === ui.platform)}
                  onClick={e => {
                    const b = e.currentTarget;
                    set("platform", v);
                    K.settle(b);
                  }}
                >
                  {ic ? <Icon n={ic} /> : null}
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="field" hidden={!cats.length}>
            <span className="lab" id="jobsCatL">
              Category
            </span>
            <div className="chips" role="group" aria-labelledby="jobsCatL">
              {cats.map(c => (
                <button
                  key={c}
                  className="chip"
                  type="button"
                  data-cat={c}
                  aria-pressed={String(c === ui.category)}
                  onClick={e => {
                    const b = e.currentTarget;
                    set("category", ui.category === c ? "" : c);
                    if (ui.category) K.settle(b);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="lab" id="jobsMinL">
              Minimum budget
            </span>
            <div className="chips" role="group" aria-labelledby="jobsMinL">
              {BUDGETS.map(b => (
                <button
                  key={b}
                  className="chip"
                  type="button"
                  data-min={b}
                  aria-pressed={String(b === ui.minBudget)}
                  onClick={e => {
                    const t = e.currentTarget;
                    set("minBudget", b);
                    K.settle(t);
                  }}
                >
                  {budgetLabel(b)}
                </button>
              ))}
            </div>
          </div>
          <label className="check jobs-saved-only">
            <input
              type="checkbox"
              id="jobsSaved"
              checked={!!ui.savedOnly}
              onChange={e => set("savedOnly", e.target.checked)}
            />{" "}
            Saved briefs only
          </label>
        </aside>
        <section className="jobs-results" aria-label="Briefs">
          <div className="jobs-bar">
            <p className="jobs-count" id="jobsCount" aria-live="polite">
              <b>{ids.length}</b> of {open} briefs
              {ui.sort !== "match" ? ` · ${SORTS[ui.sort]}` : " · Best match first"}
            </p>
            <Lq
              className="lq-s lq-sm jobs-ftoggle"
              aria-expanded={String(fOpen)}
              aria-controls="jobsFilters"
              onClick={() => setFOpen(o => !o)}
            >
              {n ? `Filters · ${n}` : "Filters"}
            </Lq>
            <div className="jobs-sort">
              <label className="sr-only" htmlFor="jobsSort">
                Sort briefs
              </label>
              <select
                className="select"
                id="jobsSort"
                value={ui.sort}
                onChange={e => set("sort", e.target.value)}
              >
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="jobs-live help">
            <Icon n="info" />
            Bid counts are live and leave out withdrawn bids.
          </p>
          <p className="jobs-offline" role="status" hidden={online}>
            <Icon n="alert" />
            You are offline. These are the briefs from your last visit.
          </p>
          <div
            className="jobs-list"
            id="jobsList"
            ref={listEl}
            hidden={!ids.length}
            onKeyDown={e => {
              // keyboard shortcuts on a focused card: S saves, H hides
              const c = e.target.closest(".jobs-card");
              if (!c || e.altKey || e.ctrlKey || e.metaKey) return;
              if (e.key === "s" || e.key === "S") {
                e.preventDefault();
                K.toggleSave(c.dataset.id, listEl.current);
              }
              if (e.key === "h" || e.key === "H") {
                e.preventDefault();
                hide(c.dataset.id);
              }
            }}
          >
            {cardEls}
          </div>
          <div className="empty jobs-empty" hidden={ids.length > 0}>
            <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
            <p className="t-h2">No briefs match that.</p>
            <p className="muted">Try a lower minimum budget or another city.</p>
            <Lq className="lq-p" data-clear="" onClick={clear}>
              Clear filters
            </Lq>
          </div>
          <p className="jobs-hidden-line" aria-live="polite">
            {nt === "back" ? (
              "Back in your list."
            ) : nt && nt.undo ? (
              <>
                Hidden “{K.job(nt.undo).title}”.{" "}
                <button
                  className="btn-q"
                  type="button"
                  data-undo={nt.undo}
                  onClick={() => {
                    K.setHidden(nt.undo, false);
                    apply(true, "back");
                  }}
                >
                  Undo
                </button>
              </>
            ) : hiddenCount ? (
              <>
                {hiddenCount} hidden {hiddenCount === 1 ? "brief" : "briefs"} ·{" "}
                <button
                  className="btn-q"
                  type="button"
                  data-showhidden=""
                  onClick={() => set("showHidden", !ui.showHidden)}
                >
                  {ui.showHidden ? "Hide them again" : "Show"}
                </button>
              </>
            ) : null}
          </p>
        </section>
      </div>
    </div>
  );
}

L.register("jobs", { title: "Find briefs", nav: "jobs", Component: JobsScreen });
