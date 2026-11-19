/* Brand side · Post or edit a brief (#post, #post-<id>). Builder C.
   Five steps, each its own section panel (B3): the brief (title, then the brief text, B5), platform and format, budget
   and date, who can bid, deliverables. A "Step 2 of 5" line on top follows the scroll and jumps to a step on click.
   One Publish button, in a sticky bar at the bottom of the form that also shows the budget (B4). Nothing is preset
   (B6): no category, any city, no languages, no minimum followers.
   Drafts save themselves every few seconds and when the brand leaves (B4); there is no draft endpoint, so a draft lives
   in LLD_DATA.jobs (status "draft") and session.js keeps it on this device. Publish checks everything.
   The working copy lives in LLD_DATA.ui.post[<id>|new].
   React screen (see src/shared/react/view.jsx). The title, brief, budget and date boxes stay uncontrolled (the budget
   regroups its digits as you type and keeps the caret); everything else draws from the working copy. */
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { USAGE_OPTIONS } from "@/shared/live";
import { fromHtml, Icon, Lq } from "@/shared/react/view";

const L = window.LLD,
  esc = L.esc;
const FORMATS = { instagram: ["Reel", "Story", "Carousel"], youtube: ["Video", "Short"] };
const CATS = [
  "Skincare",
  "Beauty",
  "Makeup",
  "Grooming",
  "Lifestyle",
  "Fitness",
  "Science",
  "Tech",
  "Travel",
  "Books",
];
const CITIES = [
  "Mumbai",
  "New Delhi",
  "Bengaluru",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Kochi",
  "Chandigarh",
];
const LANGS = [
  "English",
  "Hindi",
  "Marathi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Gujarati",
  "Punjabi",
  "Urdu",
];
const FOLLOW = [
  [0, "No minimum"],
  [10000, "10K+ followers"],
  [30000, "30K+ followers"],
  [50000, "50K+ followers"],
  [100000, "1L+ followers"],
  [250000, "2.5L+ followers"],
];
/* the API's usage rights choices (shared/live.js): each label is one usage object the API accepts */
const USAGE = USAGE_OPTIONS.map(o => o.label);
const R = {
  titleMin: 8,
  titleMax: 80,
  minBudget: 100000,
  maxBudget: 100000000,
  briefMin: 40,
  briefMax: 600,
  maxDel: 6,
  delMax: 120,
};
/* the five steps: name and the one help line under each panel title */
const STEPS = [
  ["The brief", "A clear title, then what you want made. Creators read this first."],
  ["Platform and format", "Where the post goes and what kind of post it is."],
  ["Budget and date", "What you expect to pay one creator, and the last day the post can go live."],
  [
    "Who can bid",
    "Narrow it only as much as you need. Smaller creators often have the most engaged audiences.",
  ],
  ["Deliverables", "What the creator hands over, one line each, and what you may do with it afterwards."],
];
const NAMES = {
  title: "title",
  brief: "the brief",
  cat: "category",
  budget: "budget",
  deadline: "live-by date",
  city: "city",
  langs: "languages",
  dels: "deliverables",
};
const AUTOSAVE_MS = 4000;
const digits = v =>
  String(v ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
const group = d => (d ? Number(d).toLocaleString("en-IN") : "");

const fromJob = j => ({
  title: j.title || "",
  platform: j.platform || "instagram",
  format: j.format || "Reel",
  category: j.category || "",
  budget: j.budget ? String(Math.round(j.budget / 100)) : "",
  deadline: j.deadline || "",
  remote: j.remote === undefined ? true : !!j.remote,
  city: j.remote ? "" : j.city && j.city !== "Any city" ? j.city : "",
  languages: (j.languages || []).slice(),
  minFollowers: j.minFollowers || 0,
  deliverables: (j.deliverables && j.deliverables.length ? j.deliverables : [""]).slice(),
  usage: j.usage || USAGE[0],
  brief: j.brief || "",
});
/* B6: nothing preset. Choose a category, any city, no languages, no minimum followers. */
const blank = () =>
  fromJob({
    platform: "instagram",
    format: "Reel",
    remote: true,
    languages: [],
    minFollowers: 0,
    deliverables: [""],
    usage: USAGE[0],
  });

function Section({ i, children }) {
  return (
    <section
      className="ll-panel pj-sec"
      id={`pjSec${i}`}
      data-step={i}
      tabIndex={-1}
      aria-labelledby={`pjS${i}`}
    >
      <div className="pj-sec-head">
        <h2 className="ll-panel-h" id={`pjS${i}`}>
          {STEPS[i][0]}
        </h2>
        <p className="ll-panel-sub">{STEPS[i][1]}</p>
      </div>
      {children}
    </section>
  );
}

function PostForm({ id, j }) {
  const K = L.bk,
    u = K.ui("post");
  const key = id || "new";
  const d = u[key] || (u[key] = j ? fromJob(j) : blank());
  const today = K.todayISO(),
    minDate = K.addDays(today, 1),
    maxDate = K.addDays(today, 365);
  const isOpen = j && j.status === "open";
  const [, redraw] = useState(0);
  const draw = () => flushSync(() => redraw(n => n + 1));
  const [cur, setCurS] = useState(0);
  /* the saved line: "init" (the first words), "saving", or "saved" (with the time as a tooltip) */
  const [saved, setSaved] = useState({ st: j && !isOpen ? "saved" : "init", at: "" });
  const st = useRef(null);
  if (!st.current)
    st.current = {
      touched: new Set(),
      poked: new Set(),
      tried: false,
      shown: false,
      furthest: 0,
      cur: 0,
      dirty: false,
      publishing: false,
      focusDel: undefined,
    };
  const S = st.current;
  const root = useRef(null),
    titleIn = useRef(null),
    budgetIn = useRef(null),
    dlIn = useRef(null),
    briefIn = useRef(null),
    catSel = useRef(null),
    citySel = useRef(null),
    delsOl = useRef(null),
    langsBox = useRef(null),
    budgetEl = useRef(null),
    dockEl = useRef(null);
  const cityOpts = !d.city || CITIES.includes(d.city) ? CITIES : [d.city, ...CITIES];
  if (!FORMATS[d.platform].includes(d.format)) d.format = FORMATS[d.platform][0];

  /* the boxes' text, kept in the working copy */
  const sync = () => {
    if (titleIn.current) d.title = titleIn.current.value;
    if (budgetIn.current) d.budget = digits(budgetIn.current.value);
    if (dlIn.current) d.deadline = dlIn.current.value;
    if (briefIn.current) d.brief = briefIn.current.value;
  };
  const readBudget = () => {
    const g = digits(budgetIn.current ? budgetIn.current.value : d.budget);
    return g ? L.rupees(Number(g)) : 0;
  };

  /* ---------- validation ---------- */
  function check(publish) {
    const e = {};
    const t = d.title.trim();
    if (!t)
      e.title = publish
        ? "Give the brief a title creators will understand."
        : "Give the draft a name so you can find it later.";
    else if (publish && t.length < R.titleMin)
      e.title = `Make the title a little longer, at least ${R.titleMin} characters.`;
    if (!publish) return e;
    const br = d.brief.trim();
    if (!br) e.brief = "Write the brief. Two or three sentences is enough.";
    else if (br.length < R.briefMin)
      e.brief = `Add ${R.briefMin - br.length} more characters. Say what to show and what to avoid.`;
    /* the category is not sent to the server, so a live brief (which comes back without one) is not held up by it */
    if (!d.category && !isOpen) e.cat = "Choose a category, so the right creators see it.";
    const b = readBudget();
    if (!b) e.budget = "Enter a budget in rupees.";
    else if (b < R.minBudget) e.budget = `The lowest budget on Linkloom is ${L.inr(R.minBudget)}.`;
    else if (b > R.maxBudget)
      e.budget = `Budgets go up to ${L.inr(R.maxBudget)} per brief. Split bigger work into more briefs.`;
    const dl = d.deadline;
    if (!dl) e.deadline = "Pick the last day the post can go live.";
    else if (dl < minDate) e.deadline = `Pick ${L.fmtDate(minDate)} or later, so creators have time.`;
    else if (dl > maxDate) e.deadline = "Pick a date within the next year.";
    if (!d.remote && !d.city) e.city = "Choose the city, or pick Any city.";
    if (!d.deliverables.some(x => x.trim())) e.dels = "Add at least one deliverable.";
    return e;
  }

  /* ---------- live preview: the budget ticks to the new amount (the rest draws from the working copy) ---------- */
  function previewMoney() {
    const b = readBudget();
    [budgetEl.current, dockEl.current].forEach(nd => {
      if (!nd) return;
      if (!b) {
        nd.textContent = "₹ —";
        delete nd.dataset.v;
        return;
      }
      if (+nd.dataset.v !== b) {
        if (nd.dataset.v && !L.RM) K.mo("count", nd, b, L.inr, { duration: 320 });
        else nd.textContent = L.inr(b);
        nd.dataset.v = b;
      }
    });
  }

  /* ---------- autosave (B4): a draft every few seconds and on the way out; never for a live brief ---------- */
  const record = () => ({
    title: d.title.trim(),
    platform: d.platform,
    format: d.format,
    category: d.category,
    budget: readBudget() || (j ? j.budget : 0),
    deadline: d.deadline || (j ? j.deadline : ""),
    city: d.remote ? "Any city" : d.city,
    remote: d.remote,
    languages: d.languages.slice(),
    minFollowers: +d.minFollowers || 0,
    deliverables: d.deliverables.map(x => x.trim()).filter(Boolean),
    usage: d.usage,
    brief: d.brief.trim(),
  });
  const hasContent = () =>
    !!(d.title.trim() || d.brief.trim() || digits(d.budget) || d.deliverables.some(x => x.trim()));
  const draftId = () => (j && j.status === "draft" ? j.id : d._draftId || null);
  function autosave(leaving) {
    if (!S.dirty || isOpen || S.publishing || (!leaving && !(root.current && root.current.isConnected)))
      return;
    sync();
    if (!hasContent()) return;
    S.dirty = false;
    const rec = record();
    L.store.set(s => {
      const x = draftId() && s.jobs.find(y => y.id === draftId());
      if (x) Object.assign(x, rec);
      else {
        d._draftId = "j" + Date.now().toString(36);
        s.jobs.unshift({ id: d._draftId, status: "draft", posted: null, bids: 0, ...rec });
      }
    }, "job-draft");
    if (!leaving)
      setSaved({
        st: "saved",
        at: "Saved " + new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
      });
  }
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;

  const setCur = i => {
    if (i === S.cur) return;
    S.cur = i;
    S.furthest = Math.max(S.furthest, i);
    setCurS(i);
  };
  const changed = () => {
    sync();
    previewMoney();
    S.dirty = true;
    if (!isOpen && hasContent()) setSaved(x => (x.st === "saved" ? { st: "saving", at: x.at } : x));
    if (S.tried || S.touched.size) S.shown = true;
    draw();
  };
  const validate = () => {
    S.shown = true;
    draw();
  };

  useLayoutEffect(() => {
    previewMoney();
    if (j && j.status !== "open") S.touched.add("title");
    K.mo("stagger", L.$$(".pj-sec, .pj-receipt", root.current));
    const secs = L.$$(".pj-sec", root.current);
    let spyRaf = 0;
    const spy = () => {
      spyRaf = 0;
      const line = innerHeight * 0.4;
      let i = 0;
      secs.forEach((s, k) => {
        if (s.getBoundingClientRect().top <= line) i = k;
      });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 8) i = secs.length - 1;
      setCur(i);
    };
    const onScroll = () => {
      if (!spyRaf) spyRaf = requestAnimationFrame(spy);
    };
    addEventListener("scroll", onScroll, { passive: true });
    const timer = setInterval(() => autosaveRef.current(), AUTOSAVE_MS);
    const onHide = () => autosaveRef.current();
    const onVis = () => document.visibilityState === "hidden" && autosaveRef.current();
    addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      sync();
      autosaveRef.current(true);
      /* once it lives in a draft, the draft is the copy: "Post a brief" opens blank next time, and editing the draft
         elsewhere is never overwritten by this stale working copy. A live brief keeps its unsaved edits. */
      if (!isOpen && !S.publishing && draftId()) delete u[key];
      clearInterval(timer);
      removeEventListener("scroll", onScroll);
      removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      if (spyRaf) cancelAnimationFrame(spyRaf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const f = S.focusDel;
    if (f === undefined) return;
    S.focusDel = undefined;
    const i = delsOl.current.querySelector("#pjD" + f);
    i && i.focus();
  });

  function grouped(inp, max) {
    const fromRight = inp.value.length - (inp.selectionEnd ?? inp.value.length);
    inp.value = group(digits(inp.value).slice(0, max));
    const pos = Math.max(0, inp.value.length - fromRight);
    try {
      inp.setSelectionRange(pos, pos);
    } catch (e) {}
  }
  const addDel = () => {
    if (d.deliverables.length < R.maxDel) {
      d.deliverables.push("");
      S.focusDel = d.deliverables.length - 1;
      draw();
    }
  };

  function publish(btn) {
    sync();
    /* a complete brand profile comes first (creators see it); this brief stays as a draft meanwhile */
    if (L.needProfile && L.needProfile(location.hash || "#post")) return;
    S.tried = true;
    S.shown = true;
    const e = check(true);
    draw();
    const keys = Object.keys(e);
    if (keys.length) {
      const f = {
        title: titleIn.current,
        brief: briefIn.current,
        cat: catSel.current,
        budget: budgetIn.current,
        deadline: dlIn.current,
        city: citySel.current,
        langs: langsBox.current.querySelector(".chip"),
        dels: delsOl.current.querySelector("input"),
      }[keys[0]];
      f && f.focus();
      K.mo("shake", f && f.closest(".field"));
      return;
    }
    const rec = record();
    const wasDraft = !j || j.status === "draft";
    const dId = draftId();
    if (L.live && L.needKyc("#post")) return; // drafts save before verifying; publishing needs the business check
    if (L.live) {
      btn && (btn.disabled = true);
      S.publishing = true; // autosave must not start a new draft of what is being published
      L.live.postJob(rec, j && j.status !== "draft" ? j.id : undefined).then(
        nid => {
          S.dirty = false;
          const gone = [dId, draftId()].filter(Boolean);
          L.store.set(s => {
            if (gone.length) s.jobs = s.jobs.filter(y => !gone.includes(y.id));
          }, "job-published");
          return L.live.refresh().then(() => {
            delete u[key];
            K.ui("jobs").justSaved = nid;
            K.ui("jobs").tab = "all";
            const pub = L.store.s.jobs.find(y => y.id === nid);
            L.toast(
              pub && pub.review === "pending"
                ? "Brief sent for review. Creators see it once it's approved."
                : wasDraft
                  ? "Brief published. Creators can bid now."
                  : "Changes saved",
              "check",
            );
            L.go("#jobs");
          });
        },
        er => {
          S.publishing = false;
          btn && (btn.disabled = false);
          if (L.live.isKycRequired(er)) return L.kycGate("#post");
          L.toast(L.live.errorText(er), "alert");
        },
      );
      return;
    }
    let jid = j ? j.id : dId;
    S.dirty = false;
    L.store.set(s => {
      const x = jid && s.jobs.find(y => y.id === jid);
      if (x) {
        Object.assign(x, rec);
        if (x.status === "draft") {
          x.status = "open";
          x.posted = K.nowISO();
        }
      } else {
        jid = "j" + Date.now().toString(36);
        s.jobs.unshift({ id: jid, status: "open", posted: K.nowISO(), bids: 0, ...rec });
      }
    }, "job-published");
    delete u[key];
    K.ui("jobs").justSaved = jid;
    K.ui("jobs").tab = "all";
    L.toast(wasDraft ? "Brief published. Creators can bid now." : "Changes saved", "check");
    L.go("#jobs");
  }

  /* what the form shows: errors only for touched fields until the first Publish, then for all */
  const e = check(true);
  const vis = k => S.tried || S.touched.has(k);
  const msg = k => (vis(k) ? e[k] || "" : "");
  const inv = k => (S.shown ? String(!!msg(k)) : undefined);
  const fcls = (base, k) => `${base}${msg(k) ? " is-err" : ""}`;
  const sumKeys = S.tried ? Object.keys(e) : [];
  const dlHelp =
    S.shown && d.deadline && !e.deadline
      ? `${L.fmtDate(d.deadline, { year: true })}, ${K.daysTo(d.deadline)} days from today.`
      : "The last day the post can go live.";
  /* steps (B3): which one is on screen, which are done; step 4 is valid untouched (any city, no minimum), so it counts
     once the brand has been through it */
  const valid = [!e.title && !e.brief, !e.cat, !e.budget && !e.deadline, !e.city && !e.langs, !e.dels];
  const done = valid.map((v, i) => v && (i !== 3 || S.poked.has(3) || S.furthest > 3));
  const nDone = done.filter(Boolean).length;
  const nDels = d.deliverables.filter(x => x.trim()).length;
  const miss = L.brandMissing ? L.brandMissing() : [];
  const savedLine =
    saved.st === "saving" ? (
      "Saving…"
    ) : saved.st === "saved" ? (
      <>
        <Icon n="check" />
        Draft saved
      </>
    ) : isOpen ? (
      "Creators see changes once you save."
    ) : (
      "Drafts save as you go. Only you can see them."
    );

  return (
    <div className="view-in pj" ref={root}>
      <a className="btn-q pj-back" href={j ? "#job-" + j.id : "#jobs"}>
        <Icon n="back" />
        {j ? "Back to the brief" : "All briefs"}
      </a>
      <header className="pj-h">
        <h1 className="t-h1">{j ? (isOpen ? "Edit brief" : "Finish your draft") : "Post a brief"}</h1>
        <p className="muted t-small">
          {isOpen
            ? `Live since ${L.fmtDate(j.posted)} · ${j.bids} bids so far. Creators who bid see the changes.`
            : "Creators who fit bid with a price, a date and their reasons. You pick, then pay into escrow."}
        </p>
      </header>
      {miss.length ? (
        <section className="ll-panel pj-needprof" role="status" aria-labelledby="pjNeedH">
          <span className="pj-needprof-ic" aria-hidden="true">
            <Icon n="user" />
          </span>
          <div className="pj-needprof-t">
            <h2 className="ll-panel-h" id="pjNeedH">
              Complete your brand profile first
            </h2>
            <p className="ll-panel-sub">
              Creators see your brand before they bid. Add your {L.listWords(miss)}, then publish. You can
              fill in this brief now; it saves as a draft.
            </p>
          </div>
          {/* "Complete profile": remember this brief, so saving the profile comes straight back here */}
          <Lq
            as="a"
            className="lq-s"
            href="#profile-edit"
            data-needprof=""
            onClick={() => {
              try {
                sessionStorage.setItem("ll-brand-profile-return", location.hash || "#post");
              } catch (x) {
                /* no storage: the brand finds the way back */
              }
            }}
          >
            <Icon n="edit" className="ic" />
            Complete profile
          </Lq>
        </section>
      ) : null}
      <div className="pj-layout">
        <div className="pj-main">
          <form
            className="pj-form"
            id="pjForm"
            noValidate
            onSubmit={ev => {
              ev.preventDefault();
              publish(ev.currentTarget.querySelector("[type=submit]"));
            }}
            onFocus={ev => {
              const s = ev.target.closest(".pj-sec");
              if (s) setCur(+s.dataset.step);
            }}
          >
            <nav className="ll-steps pj-steps" aria-label="Steps of the brief">
              <p className="ll-steps-t" id="pjStepT">
                Step {cur + 1} of {STEPS.length} · {STEPS[cur][0]}
                {nDone ? ` · ${nDone} of ${STEPS.length} done` : ""}
              </p>
              <ol className="pj-steps-l">
                {STEPS.map((s, i) => (
                  <li
                    key={i}
                    className={
                      [done[i] ? "is-done" : "", i === cur ? "is-now" : ""].filter(Boolean).join(" ") ||
                      undefined
                    }
                  >
                    <button
                      type="button"
                      className="pj-st"
                      data-goto={i}
                      aria-controls={`pjSec${i}`}
                      aria-current={i === cur ? "step" : undefined}
                      aria-label={`Step ${i + 1} of ${STEPS.length}: ${s[0]}${done[i] ? ", done" : ""}${i === cur ? ", current" : ""}`}
                      onClick={() => {
                        const sec = L.$$(".pj-sec", root.current)[i];
                        sec.scrollIntoView({ behavior: L.RM ? "auto" : "smooth", block: "start" });
                        sec.focus({ preventScroll: true });
                        setCur(i);
                      }}
                    >
                      <span className="pj-st-bar" aria-hidden="true"></span>
                      <span className="pj-st-t">{s[0]}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <Section i={0}>
              <div className={fcls("field", "title")} id="fTitle">
                <label htmlFor="pjTitle">Brief title</label>
                <input
                  className="input"
                  id="pjTitle"
                  maxLength={R.titleMax}
                  autoComplete="off"
                  placeholder="For example: Barrier Repair Serum launch"
                  defaultValue={d.title}
                  aria-describedby="pjTitleErr"
                  aria-invalid={inv("title")}
                  ref={titleIn}
                  onInput={changed}
                  onBlur={ev => {
                    if (ev.target.value.trim()) S.touched.add("title");
                    validate();
                  }}
                />
                <p className="err" id="pjTitleErr">
                  {msg("title")}
                </p>
              </div>
              <div className={fcls("field", "brief")} id="fBrief">
                <div className="pj-why-h">
                  <label id="pjBriefL" htmlFor="pjBrief">
                    The brief
                  </label>
                  <span className="t-note pj-note" aria-hidden="true">
                    creators read this first
                  </span>
                </div>
                <textarea
                  className="textarea"
                  id="pjBrief"
                  maxLength={R.briefMax}
                  rows={5}
                  aria-describedby="pjBriefHelp pjBriefN pjBriefErr"
                  aria-invalid={inv("brief")}
                  placeholder="What the product is, the one thing to say, the feel you want, and anything to avoid. For example: show a real morning routine, no filters."
                  defaultValue={d.brief}
                  ref={briefIn}
                  onInput={changed}
                  onBlur={ev => {
                    if (ev.target.value.trim()) S.touched.add("brief");
                    validate();
                  }}
                />
                <div className="pj-why-f">
                  <p className="help" id="pjBriefHelp">
                    At least {R.briefMin} characters.
                  </p>
                  <p
                    className={`pj-count num${d.brief.length >= R.briefMax - 40 ? " is-near" : ""}`}
                    id="pjBriefN"
                  >
                    {d.brief.length} / {R.briefMax}
                  </p>
                </div>
                <p className="err" id="pjBriefErr">
                  {msg("brief")}
                </p>
              </div>
            </Section>

            <Section i={1}>
              <div className="pj-pair">
                <div className="field">
                  <p className="lab" id="pjPlatL">
                    Platform
                  </p>
                  <div className="seg pj-seg" role="group" aria-labelledby="pjPlatL">
                    {["instagram", "youtube"].map(p => (
                      <button
                        key={p}
                        type="button"
                        data-plat={p}
                        aria-pressed={String(d.platform === p)}
                        onClick={() => {
                          d.platform = p;
                          if (!FORMATS[p].includes(d.format)) d.format = FORMATS[p][0];
                          changed();
                        }}
                      >
                        {fromHtml(K.glyph(p))}
                        {K.plat(p)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={fcls("field", "cat")} id="fCat">
                  <label htmlFor="pjCat">Category</label>
                  <select
                    className={`select${d.category ? "" : " is-ph"}`}
                    id="pjCat"
                    aria-describedby="pjCatErr"
                    aria-invalid={inv("cat")}
                    value={d.category}
                    ref={catSel}
                    onChange={ev => {
                      d.category = ev.target.value;
                      S.touched.add("cat");
                      changed();
                    }}
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {CATS.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <p className="err" id="pjCatErr">
                    {msg("cat")}
                  </p>
                </div>
              </div>
              <div className="field" id="fFormat">
                <p className="lab" id="pjFmtL">
                  Format
                </p>
                <div className="chips" role="group" aria-labelledby="pjFmtL" id="pjFormats">
                  {FORMATS[d.platform].map(f => (
                    <button
                      key={f}
                      className="chip"
                      type="button"
                      data-fmt={f}
                      aria-pressed={String(f === d.format)}
                      onClick={ev => {
                        d.format = f;
                        const b = ev.currentTarget;
                        changed();
                        b.focus();
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <p className="err" id="pjFormatErr"></p>
              </div>
            </Section>

            <Section i={2}>
              <div className={fcls("field", "budget")} id="fBudget">
                <label id="pjBudgetL" htmlFor="pjBudget">
                  Budget
                </label>
                <div className="money-in pj-money">
                  <span aria-hidden="true">₹</span>
                  <input
                    id="pjBudget"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={11}
                    placeholder="15,000"
                    defaultValue={group(d.budget)}
                    aria-describedby="pjBudgetHelp pjBudgetErr"
                    aria-invalid={inv("budget")}
                    ref={budgetIn}
                    onInput={ev => {
                      grouped(ev.currentTarget, 8);
                      changed();
                    }}
                    onBlur={ev => {
                      if (ev.target.value.trim()) S.touched.add("budget");
                      validate();
                    }}
                  />
                  {[
                    [-500, "minus", "Lower by ₹500"],
                    [500, "plus", "Raise by ₹500"],
                  ].map(([n, icn, lab]) => (
                    <button
                      key={n}
                      className="pj-step"
                      type="button"
                      data-step={n}
                      aria-label={lab}
                      onClick={() => {
                        const now = Number(digits(budgetIn.current.value)) || 0;
                        budgetIn.current.value = group(String(Math.max(0, now + n)));
                        S.touched.add("budget");
                        changed();
                      }}
                    >
                      <Icon n={icn} />
                    </button>
                  ))}
                </div>
                <p className="help" id="pjBudgetHelp">
                  What you expect to pay one creator. Creators may bid a little above or below. You pay the
                  agreed price into escrow when you hire. No platform fee.
                </p>
                <p className="err" id="pjBudgetErr">
                  {msg("budget")}
                </p>
              </div>
              <div className={fcls("field pj-date", "deadline")} id="fDeadline">
                <label htmlFor="pjDeadline">Live by</label>
                <input
                  className="input"
                  id="pjDeadline"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  defaultValue={d.deadline}
                  aria-describedby="pjDeadlineHelp pjDeadlineErr"
                  aria-invalid={inv("deadline")}
                  ref={dlIn}
                  onChange={() => {
                    S.touched.add("deadline");
                    changed();
                  }}
                  onBlur={ev => {
                    if (ev.target.value.trim()) S.touched.add("deadline");
                    validate();
                  }}
                />
                <p className="help" id="pjDeadlineHelp">
                  {dlHelp}
                </p>
                <p className="err" id="pjDeadlineErr">
                  {msg("deadline")}
                </p>
              </div>
            </Section>

            <Section i={3}>
              <div className="pj-pair">
                <div className="field">
                  <p className="lab" id="pjWhereL">
                    Where they shoot
                  </p>
                  <div className="seg pj-seg" role="group" aria-labelledby="pjWhereL">
                    {[
                      [true, "Any city"],
                      [false, "In a city"],
                    ].map(([r, t]) => (
                      <button
                        key={t}
                        type="button"
                        data-remote={r ? "1" : "0"}
                        aria-pressed={String(d.remote === r)}
                        onClick={() => {
                          d.remote = r;
                          S.poked.add(3);
                          changed();
                        }}
                      >
                        {r ? null : <Icon n="pin" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={fcls("field", "city")} id="fCity" hidden={d.remote}>
                  <label htmlFor="pjCity">City</label>
                  <select
                    className={`select${d.city ? "" : " is-ph"}`}
                    id="pjCity"
                    aria-describedby="pjCityErr"
                    aria-invalid={inv("city")}
                    value={d.city}
                    ref={citySel}
                    onChange={ev => {
                      d.city = ev.target.value;
                      S.touched.add("city");
                      S.poked.add(3);
                      changed();
                    }}
                  >
                    <option value="" disabled>
                      Choose a city
                    </option>
                    {cityOpts.map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <p className="err" id="pjCityErr">
                    {msg("city")}
                  </p>
                </div>
              </div>
              <div className={fcls("field", "langs")} id="fLangs">
                <p className="lab" id="pjLangL">
                  Languages <span className="pj-opt">optional · leave empty for any language</span>
                </p>
                <div className="chips" role="group" aria-labelledby="pjLangL" id="pjLangs" ref={langsBox}>
                  {LANGS.map(l => {
                    const on = d.languages.includes(l);
                    return (
                      <button
                        key={l}
                        className="chip"
                        type="button"
                        data-lang={l}
                        aria-pressed={String(on)}
                        onClick={ev => {
                          const b = ev.currentTarget;
                          d.languages = on ? d.languages.filter(x => x !== l) : [...d.languages, l];
                          S.touched.add("langs");
                          S.poked.add(3);
                          changed();
                          b.focus();
                        }}
                      >
                        {on ? <Icon n="check" /> : null}
                        {l}
                      </button>
                    );
                  })}
                </div>
                <p className="err" id="pjLangsErr">
                  {msg("langs")}
                </p>
              </div>
              <div className="field pj-date">
                <label htmlFor="pjFollow">Minimum followers</label>
                <select
                  className="select"
                  id="pjFollow"
                  value={String(+d.minFollowers)}
                  onChange={ev => {
                    d.minFollowers = +ev.target.value;
                    S.poked.add(3);
                    changed();
                  }}
                >
                  {FOLLOW.map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
                <p className="help">On the platform you picked.</p>
              </div>
            </Section>

            <Section i={4}>
              <div className={fcls("field", "dels")} id="fDels">
                <p className="lab" id="pjDelL">
                  Deliverables
                </p>
                <ol className="pj-dels" id="pjDels" aria-labelledby="pjDelL" ref={delsOl}>
                  {d.deliverables.map((v, i) => (
                    <li key={i} className="pj-del" data-i={i}>
                      <span className="pj-del-n" aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <label className="sr-only" htmlFor={`pjD${i}`}>
                        Deliverable {i + 1}
                      </label>
                      <input
                        className="input"
                        id={`pjD${i}`}
                        maxLength={R.delMax}
                        autoComplete="off"
                        placeholder={
                          i === 0
                            ? "1 Reel, 30–45 s"
                            : i === 1
                              ? "Product on screen in the first 3 s"
                              : "One line"
                        }
                        value={v}
                        onChange={ev => {
                          d.deliverables[i] = ev.target.value;
                          changed();
                        }}
                        onKeyDown={ev => {
                          if (ev.key === "Enter") {
                            ev.preventDefault();
                            if (ev.currentTarget.value.trim()) addDel();
                          }
                        }}
                      />
                      <button
                        className="ibtn pj-del-x"
                        type="button"
                        data-rmdel={i}
                        aria-label={`Remove deliverable ${i + 1}`}
                        hidden={d.deliverables.length === 1 && !v}
                        onClick={() => {
                          d.deliverables.splice(i, 1);
                          if (!d.deliverables.length) d.deliverables = [""];
                          S.focusDel = Math.min(i, d.deliverables.length - 1);
                          S.touched.add("dels");
                          changed();
                        }}
                      >
                        <Icon n="close" />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="pj-dels-f">
                  <Lq
                    className="lq-s lq-sm"
                    data-adddel=""
                    disabled={d.deliverables.length >= R.maxDel}
                    onClick={addDel}
                  >
                    <Icon n="plus" className="ic" />
                    Add a deliverable
                  </Lq>
                  <span className="help">Up to {R.maxDel}.</span>
                </div>
                <p className="err" id="pjDelsErr">
                  {msg("dels")}
                </p>
              </div>
              <div className="field pj-date">
                <label htmlFor="pjUsage">Usage rights</label>
                <select
                  className="select"
                  id="pjUsage"
                  value={d.usage}
                  onChange={ev => {
                    d.usage = ev.target.value;
                    changed();
                  }}
                >
                  {USAGE.map(x => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <p className="help">What you may do with the content after it goes live.</p>
              </div>
            </Section>

            <div className="pj-bar" role="region" aria-label={isOpen ? "Save changes" : "Publish"}>
              <p className="pj-sum" id="pjSum" aria-live="polite">
                {sumKeys.length ? (
                  <>
                    <Icon n="alert" />
                    <span>
                      Fix {sumKeys.length === 1 ? "one thing" : sumKeys.length + " things"} first:{" "}
                      {sumKeys.map(k => NAMES[k]).join(", ")}.
                    </span>
                  </>
                ) : null}
              </p>
              <p className="pj-bar-t">
                <span>Budget</span>
                <b className="t-money pj-bar-v" data-p="dock" ref={dockEl}></b>
              </p>
              <p className="pj-saved" id="pjSaved" aria-live="polite" title={saved.at || undefined}>
                {savedLine}
              </p>
              <div className="pj-bar-a">
                {isOpen ? (
                  <Lq as="a" className="lq-s" href={`#job-${j.id}`}>
                    Cancel
                  </Lq>
                ) : null}
                <Lq className="lq-p" type="submit">
                  {isOpen ? "Save changes" : "Publish brief"}
                </Lq>
              </div>
            </div>
          </form>
          {j ? (
            <div className="pj-danger" role="group" aria-label="Close or delete">
              <div>
                <p className="t-label">
                  {isOpen ? "Done hiring, or changed your mind?" : "Not needed any more?"}
                </p>
                <p className="help">
                  {isOpen
                    ? "Closing stops new bids and tells the creators who bid."
                    : "Delete the draft. Creators never saw it."}
                </p>
              </div>
              <div className="row wrap">
                {isOpen ? (
                  <Lq
                    className="lq-s lq-sm"
                    data-closejob=""
                    onClick={() =>
                      K.closeJob(j.id, () => {
                        S.dirty = false;
                        delete u[key];
                        L.go("#jobs");
                      })
                    }
                  >
                    Close brief
                  </Lq>
                ) : null}
                <Lq
                  className="lq-s lq-sm"
                  data-deljob=""
                  onClick={() =>
                    K.deleteJob(j.id, () => {
                      S.dirty = false; // the draft is gone: leaving must not save it again
                      delete u[key];
                      L.go("#jobs");
                    })
                  }
                >
                  <Icon n="trash" />
                  {isOpen ? "Delete brief" : "Delete draft"}
                </Lq>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="pj-side" aria-label="Preview">
          <div className="pj-receipt ink-card">
            <p className="pj-rc-h">How creators see it</p>
            <p className="pj-pv-plat" data-p="plat">
              {fromHtml(K.glyph(d.platform))}
              <span>
                {K.plat(d.platform)} {d.format}
                {d.category ? ` · ${d.category}` : ""}
              </span>
            </p>
            <p className={`pj-pv-t${d.title.trim() ? "" : " is-ph"}`} data-p="title">
              {d.title.trim() || "Your brief title"}
            </p>
            <p className="pj-rc-l">Budget</p>
            <p className="pj-rc-net">
              <span className="t-money" data-p="budget" ref={budgetEl}></span>
            </p>
            <dl className="pj-rows">
              <div>
                <dt>Live by</dt>
                <dd data-p="deadline">{d.deadline ? L.fmtDate(d.deadline, { year: true }) : "—"}</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd data-p="where">{d.remote ? "Any city · remote" : d.city || "—"}</dd>
              </div>
              <div>
                <dt>Deliverables</dt>
                <dd data-p="dels">{nDels ? `${nDels} item${nDels === 1 ? "" : "s"}` : "—"}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>As per confirmed rules</dd>
              </div>
            </dl>
            <p className="pj-rc-s">
              The creator you hire receives the agreed price in full. No platform fee.
            </p>
            <span className="pill pill-escrow">
              <Icon n="lock" />
              Paid into escrow when you hire
            </span>
          </div>
          <p className="help pj-side-note">
            <Icon n="info" />
            Your brand name and logo show on the brief. Your billing details never do.
          </p>
        </aside>
      </div>
      <p className="sr-only" id="pjLive" aria-live="polite"></p>
    </div>
  );
}

function PostScreen({ param: id }) {
  const K = L.bk,
    j = id ? K.job(id) : null;
  if (id && !j)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
          <p className="t-h2">This brief is gone.</p>
          <p className="muted">It may have been deleted. Your other briefs are safe.</p>
          <Lq as="a" className="lq-p" href="#jobs">
            See all briefs
          </Lq>
        </div>
      </div>
    );
  if (j && (j.status === "hired" || j.status === "closed")) {
    const c = K.campOfJob(j.id);
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-05-stamp.svg" width="160" height="117" alt="" />
          <p className="t-h2">
            {j.status === "hired"
              ? "You hired on this brief, so it is locked."
              : "This brief is closed, so it can’t be edited."}
          </p>
          <p className="muted">
            {j.status === "hired"
              ? "The creator bid on this brief. Change details with them in the deal chat."
              : "Post a new brief if you need another creator."}
          </p>
          <div className="row wrap pj-locked-cta">
            {c ? (
              <Lq as="a" className="lq-p" href={`#campaign-${c.id}`}>
                Open deal
              </Lq>
            ) : (
              <Lq as="a" className="lq-p" href="#post">
                Post a new brief
              </Lq>
            )}
            <Lq as="a" className="lq-s" href={`#job-${j.id}`}>
              View brief
            </Lq>
          </div>
        </div>
      </div>
    );
  }
  return <PostForm key={id || "new"} id={id} j={j} />;
}

L.register("post", {
  title: id => (id ? "Edit brief" : "Post a brief"),
  crumb: id => {
    const j = id && L.bk.job(id);
    return `<a href="#jobs">Briefs</a> / ${j ? esc(j.title || "Untitled brief") + " / Edit" : "Post a brief"}`;
  },
  nav: "jobs",
  Component: PostScreen,
});
