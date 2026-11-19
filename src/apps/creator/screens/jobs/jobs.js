/* The brief kit (LLD.jobkit) used by Find briefs (jobs-list.jsx), Home, Job detail, Bid and My Bids.
   Owner: Builder B. The card markup is ui/brief-card.js (shared with Home); classes are .jobs-*. */
import { briefCard } from "../../ui/brief-card";

(() => {
  const L = window.LLD,
    esc = L.esc;
  const S = () => window.LLD_DATA;
  const UI_DEFAULT = {
    q: "",
    city: "",
    platform: "",
    category: "",
    minBudget: 0,
    sort: "match",
    savedOnly: false,
    showHidden: false,
  };
  const SS_KEY = "ll.jobsUI";

  /* ---------- state defaults (screens never assume data.js was extended) ---------- */
  function ensure() {
    const s = S();
    s.jobsUI = Object.assign({}, UI_DEFAULT, s.jobsUI || {});
    s.hiddenJobs = s.hiddenJobs || [];
    s.reports = s.reports || [];
    s.bidDrafts = s.bidDrafts || {};
    s.saved = s.saved || [];
    s.bidRules = Object.assign(
      { minPaise: 100000, overBudgetPct: 25, whyMin: 40, whyMax: 500, maxLinks: 5 },
      s.bidRules || {},
    );
    return s;
  }
  ensure();
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) Object.assign(S().jobsUI, JSON.parse(raw), { fromJob: null });
  } catch (e) {}
  const persistUI = () => {
    try {
      const { fromJob, scrollY, ...keep } = S().jobsUI;
      sessionStorage.setItem(SS_KEY, JSON.stringify(keep));
    } catch (e) {}
  };

  /* motion calls never break a screen */
  const mo = (fn, ...a) => {
    try {
      return L.motion[fn] && L.motion[fn](...a);
    } catch (e) {
      return null;
    }
  };
  const flip = (mutate, nodes) => {
    let done = false;
    const m = () => {
      done = true;
      mutate();
    };
    try {
      L.motion.flip(m, nodes);
    } catch (e) {}
    if (!done) mutate();
  };

  /* ---------- lookups ---------- */
  const job = id => S().jobs.find(j => j.id === id) || null;
  const bidsFor = id =>
    S()
      .bids.filter(b => b.job === id)
      .sort((a, b) => L.D(b.sent) - L.D(a.sent));
  const LIVE = ["submitted", "viewed", "accepted", "completed", "rejected"]; // a bid in any of these blocks a new bid on the same job
  const openBid = id => bidsFor(id).find(b => LIVE.includes(b.status)) || null;
  const isSaved = id => S().saved.includes(id);
  const isHidden = id => S().hiddenJobs.includes(id);
  const platName = p => (p === "youtube" ? "YouTube" : "Instagram");
  const glyph = p => L.icon(p === "youtube" ? "yt" : "ig");
  const where = j => (j.remote ? "Any city · remote" : j.city);
  const todayISO = () => L.today().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const daysTxt = n => (n < 0 ? "passed" : n === 0 ? "today" : n === 1 ? "1 day left" : n + " days left");
  const daysShort = n => (n < 0 ? "passed" : n === 0 ? "today" : n === 1 ? "1 day" : n + " days");
  /* calendar days in IST from today (core daysLeft rounds part-days up) */
  const daysTo = iso =>
    Math.round(
      (new Date(String(iso).slice(0, 10) + "T12:00:00+05:30") - new Date(todayISO() + "T12:00:00+05:30")) /
        864e5,
    );
  const brandInitials = j => j.bi || L.initials(j.brand || "");

  const STATUS = {
    submitted: { label: "Submitted", pill: "pill-line", ic: "send" },
    viewed: { label: "Viewed", pill: "pill-info", ic: "eye" },
    accepted: { label: "Accepted", pill: "pill-ok", ic: "check" },
    rejected: { label: "Rejected", pill: "pill-err", ic: "alert" },
    withdrawn: { label: "Withdrawn", pill: "pill-paper", ic: "back" },
    completed: { label: "Completed", pill: "pill-butter", ic: "check" },
  };
  /* status pill with its icon; error pills always carry the alert icon */
  const pill = (status, label) => {
    const m = STATUS[status] || STATUS.submitted;
    return `<span class="pill ${m.pill}">${L.icon(m.ic)}${esc(label || m.label)}</span>`;
  };
  const openJobs = () => S().jobs.filter(j => j.status !== "hired"); // hired jobs live in Active jobs, not in discovery

  /* follower requirement like "Min 50K followers" -> 50000 */
  const minFollowers = j => {
    const m = /([\d.]+)\s*([KkLl])?/.exec(j.min || "");
    if (!m) return 0;
    const n = parseFloat(m[1]);
    return Math.round(n * (/[Kk]/.test(m[2] || "") ? 1e3 : /[Ll]/.test(m[2] || "") ? 1e5 : 1));
  };

  /* Best Match breakdown: the six things the ranking looks at, checked against the profile */
  function factors(j) {
    const me = S().me,
      pf = me.platforms[j.platform];
    const need = minFollowers(j),
      have = pf ? pf.followers : 0;
    const langs = j.languages.filter(l => me.languages.includes(l));
    const catHit =
      me.categories.includes(j.category) || (j.reasons || []).some(r => /lifestyle|beauty|overlap/i.test(r));
    const cityHit = j.remote || j.city === me.city;
    const geo = (me.audienceGeo || []).find(g => g[0] === j.city);
    const myBids = S().bids.filter(b => b.status !== "withdrawn");
    const avg = myBids.length
      ? Math.round(myBids.reduce((n, b) => n + b.price, 0) / myBids.length / 10000) * 10000
      : 0;
    const dl = daysTo(j.deadline);
    /* a line only exists when the brief asks for it: no category or language on the brief, no line (C4) */
    return [
      {
        k: "Platform",
        ok: !!pf && have >= need,
        txt: pf
          ? need
            ? `${platName(j.platform)} ${L.compact(have)} · brand asks ${L.compact(need)}+`
            : `You post on ${platName(j.platform)}`
          : `You have not added ${platName(j.platform)}`,
      },
      j.category && {
        k: "Category",
        ok: catHit,
        txt: me.categories.includes(j.category)
          ? `${j.category} is one of your niches`
          : catHit
            ? `${j.category}, close to your niches`
            : `${j.category} is outside your niches`,
      },
      j.languages.length > 0 && {
        k: "Language",
        ok: langs.length > 0,
        txt: langs.length ? langs.join(" or ") : "No shared language",
      },
      {
        k: "City",
        ok: cityHit,
        txt: j.remote
          ? "Open to any city"
          : cityHit
            ? `${j.city}${geo ? `, ${geo[1]}% of your audience` : ""}`
            : `${j.city}${geo ? `, ${geo[1]}% of your audience` : ""}`,
      },
      {
        k: "Budget",
        ok: !avg || j.budget >= avg * 0.8,
        txt: avg ? `${L.inr(j.budget)} vs your average bid ${L.inr(avg)}` : L.inr(j.budget),
      },
      { k: "Deadline", ok: dl >= 7, txt: `${L.fmtDate(j.deadline)}, ${daysTxt(dl)}` },
    ].filter(Boolean);
  }

  /* match % chip with a 12px ring that fills to the score once (CSS, see .jobs-ring) */
  const pct = m =>
    `<span class="jobs-pct" style="--m:${Number(m) || 0}"><svg class="jobs-ring" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" pathLength="100"/><circle class="jobs-ring-v" cx="8" cy="8" r="6" pathLength="100" style="stroke-dashoffset:${100 - (Number(m) || 0)}"/></svg><b>${Number(m) || 0}%</b> match</span>`;

  /* ---------- the brief card: one component for Home and #jobs, see ui/brief-card.ts ---------- */
  function brandChip(j) {
    return `<span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(brandInitials(j))}</span><span class="jobs-bn">${esc(j.brand)}</span></span>`;
  }
  const card = (j, o = {}) => briefCard(j, o);

  /* ---------- save / hide ---------- */
  function setSaved(id, on) {
    L.store.set(s => {
      s.saved = s.saved.filter(x => x !== id);
      if (on) s.saved.push(id);
    }, "job-save");
    L.live && L.live.saveJobs(S().saved, S().hiddenJobs);
  }
  function syncSaveButtons(root, id) {
    const on = isSaved(id),
      j = job(id);
    L.$$(`.jobs-card[data-id="${id}"]`, root).forEach(c => {
      c.classList.toggle("is-saved", on);
      const b = c.querySelector(".jobs-save");
      if (b) {
        b.setAttribute("aria-pressed", on);
        b.setAttribute("aria-label", `${on ? "Saved" : "Save"}: ${j ? j.title : ""}`);
        const l = b.querySelector(".jobs-act-l");
        if (l) l.textContent = on ? "Saved" : "Save";
        stitch(b, on);
      }
    });
  }
  /* the bookmark is sewn shut when saved: dashed stroke closes, then fills (CSS .is-stitch) */
  function stitch(btn, on) {
    if (!btn) return;
    btn.classList.remove("is-stitch");
    if (!on || L.RM) return;
    void btn.offsetWidth;
    btn.classList.add("is-stitch");
    const off = () => {
      btn.classList.remove("is-stitch");
      btn.removeEventListener("animationend", off);
    };
    btn.addEventListener("animationend", off);
    setTimeout(off, 900);
  }
  /* a chosen filter chip lands with a slight overshoot (CSS .is-settle, translate only so the global press scale stays free) */
  function settle(btn) {
    if (!btn || L.RM) return;
    btn.classList.remove("is-settle");
    void btn.offsetWidth;
    btn.classList.add("is-settle");
    const off = () => {
      btn.classList.remove("is-settle");
      btn.removeEventListener("animationend", off);
    };
    btn.addEventListener("animationend", off);
    setTimeout(off, 700);
  }
  function toggleSave(id, root, force) {
    const on = force === undefined ? !isSaved(id) : force;
    setSaved(id, on);
    syncSaveButtons(root || document, id);
    L.toast(on ? "Saved to your list" : "Removed from saved", on ? "bookmark" : "close");
    return on;
  }
  function setHidden(id, on) {
    L.store.set(s => {
      s.hiddenJobs = s.hiddenJobs.filter(x => x !== id);
      if (on) s.hiddenJobs.push(id);
    }, "job-hide");
    L.live && L.live.saveJobs(S().saved, S().hiddenJobs);
  }

  /* wire every card inside root: buttons, swipe (right = save, left = hide), press, keyboard shortcuts */
  function wire(root, { onHide, onSave } = {}) {
    const detach = [];
    const onClick = e => {
      const c = e.target.closest(".jobs-card");
      if (!c) return;
      const id = c.dataset.id;
      if (e.target.closest(".jobs-save")) {
        e.preventDefault();
        const on = toggleSave(id, root);
        onSave && onSave(id, on, c);
      } else if (e.target.closest(".jobs-hide")) {
        e.preventDefault();
        setHidden(id, true);
        onHide && onHide(id, c);
      } else if (e.target.closest("[data-bid]")) {
        e.preventDefault();
        L.kycGate(id);
      }
    };
    root.addEventListener("click", onClick);
    const attach = c => {
      if (c.dataset.wired) return;
      c.dataset.wired = "1";
      const id = c.dataset.id;
      const off = mo("swipe", c, {
        rightLabel: "Save",
        leftLabel: "Hide",
        rightIcon: "bookmark",
        leftIcon: "close",
        rightTone: "butter",
        leftTone: "ink",
        hint: c === root.querySelector(".jobs-card"),
        onRight: () => {
          const on = toggleSave(id, root, true);
          onSave && onSave(id, on, c);
        },
        onLeft: () => {
          setHidden(id, true);
          onHide && onHide(id, c);
        },
      });
      if (typeof off === "function") detach.push(off);
      mo("press", c);
    };
    L.$$(".jobs-card", root).forEach(attach);
    return {
      attach,
      cleanup: () => {
        root.removeEventListener("click", onClick);
        detach.forEach(f => {
          try {
            f();
          } catch (e) {}
        });
      },
    };
  }

  L.jobkit = {
    ensure,
    job,
    openJobs,
    pill,
    pct,
    stitch,
    settle,
    bidsFor,
    openBid,
    isSaved,
    isHidden,
    platName,
    glyph,
    where,
    todayISO,
    daysTxt,
    daysShort,
    daysTo,
    STATUS,
    factors,
    minFollowers,
    brandChip,
    card,
    wire,
    toggleSave,
    setHidden,
    mo,
    flip,
    persistUI,
  };
})();
