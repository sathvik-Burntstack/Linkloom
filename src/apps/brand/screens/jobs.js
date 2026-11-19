/* Brand side · the Builder C kit (LLD.bk) used by post.js, job.js, campaigns.js and the Briefs screen (jobs-list.jsx).
   Mirrors the creator My bids board: lanes of ticket slips, each with a stub, a status pill and a progress rail.
   Job status: open | draft | hired | closed. Tabs: all, open, drafts, closed (closed also holds hired). Money is integer paise. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const S = () => window.LLD_DATA;

  /* ---------- kit ---------- */
  const ui = k => {
    const s = S();
    s.ui = s.ui || {};
    return (s.ui[k] = s.ui[k] || {});
  };
  const mo = (fn, ...a) => {
    try {
      return (L.motion[fn] && L.motion[fn](...a)) || null;
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
  const todayISO = () => L.today().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const nowISO = () => L.today().toISOString();
  const addDays = (iso, n) => {
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00+05:30");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };
  const daysTo = iso =>
    Math.round(
      (new Date(String(iso).slice(0, 10) + "T12:00:00+05:30") - new Date(todayISO() + "T12:00:00+05:30")) /
        864e5,
    );
  const daysTxt = n =>
    n < 0
      ? n === -1
        ? "1 day ago"
        : -n + " days ago"
      : n === 0
        ? "today"
        : n === 1
          ? "1 day left"
          : n + " days left";
  const time = s =>
    L.D(s).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  const plat = p => (p === "youtube" ? "YouTube" : "Instagram");
  const glyph = p => ic(p === "youtube" ? "yt" : "ig");
  const where = j => (j.remote ? "Any city · remote" : j.city);
  const job = id => S().jobs.find(j => j.id === id) || null;
  const camp = id => S().campaigns.find(c => c.id === id) || null;
  const cr = id =>
    L.creator(id) || {
      id,
      name: "Creator",
      handle: "",
      tone: "c",
      platforms: [],
      languages: [],
      rating: null,
      reviews: 0,
    };
  const first = c => String(c.name || "the creator").split(" ")[0];
  const bidsFor = jid => S().bids.filter(b => b.job === jid);
  const campOfJob = jid =>
    S().campaigns.find(c => c.job === jid && !["cancelled", "declined"].includes(c.stage)) || null;
  /* creators always read in the coral family: full coral, or the subtle coral with a coral ring */
  const cav = (c, cls = "") =>
    `<span class="avatar bk-cav is-${c.tone === "b" ? "b" : "c"}${cls ? " " + cls : ""}" aria-hidden="true">${esc(L.initials(c.name || "?"))}</span>`;
  const ver = c =>
    c.verified
      ? `<span class="bk-ver" title="Verified creator">${ic("verified")}<span class="sr-only">, verified</span></span>`
      : "";
  const crChip = (c, sub) =>
    `<span class="bk-cr">${cav(c)}<span class="bk-cr-t"><b>${esc(c.name)}${ver(c)}</b><span>${esc(sub == null ? c.handle : sub)}</span></span></span>`;
  const pf = (c, p) => (c.platforms || []).find(x => x.p === p) || (c.platforms || [])[0] || null;
  const rating = c =>
    c.rating
      ? `<span class="bk-rate">${ic("star")}<b class="num">${Number(c.rating).toFixed(1)}</b><span class="muted">(${c.reviews})</span></span>`
      : '<span class="bk-rate is-none">No reviews yet</span>';
  const nextInvoice = (prefix = "LL-INV") => {
    const y = todayISO().slice(0, 4),
      re = new RegExp("^" + prefix + "-" + y + "-(\\d+)$");
    const n = S().payments.reduce((m, p) => {
      const x = re.exec(p.invoice || "");
      return x ? Math.max(m, +x[1]) : m;
    }, 0);
    return `${prefix}-${y}-${String(n + 1).padStart(4, "0")}`;
  };
  const notify = (kind, text, go) =>
    L.store.set(
      s =>
        s.notifications.unshift({
          id: "n" + Date.now() + Math.random().toString(36).slice(2, 5),
          kind,
          text,
          at: nowISO(),
          go,
          read: false,
        }),
      "notify",
    );

  const JST = {
    open: { label: "Open", pill: "pill-info", ic: "eye" },
    draft: { label: "Draft", pill: "pill-line", ic: "edit" },
    review: { label: "In review", pill: "pill-warn", ic: "clock" },
    rejected: { label: "Not approved", pill: "pill-err", ic: "alert" },
    hired: { label: "Hired", pill: "pill-ok", ic: "check" },
    closed: { label: "Closed", pill: "pill-paper", ic: "close" },
  };
  const BST = {
    new: { label: "New", pill: "pill-butter", ic: "bell" },
    viewed: { label: "Viewed", pill: "pill-line", ic: "eye" },
    shortlisted: { label: "Shortlisted", pill: "pill-violet", ic: "bookmark" },
    declined: { label: "Declined", pill: "pill-paper", ic: "close" },
    hired: { label: "Hired", pill: "pill-ok", ic: "check" },
  };
  const pill = (map, k, label) => {
    const m = map[k] || Object.values(map)[0];
    return `<span class="pill ${m.pill}" data-pill>${ic(m.ic)}${esc(label || m.label)}</span>`;
  };

  /* "Instagram Reel · Food": only the parts that are filled in, so no dangling "·" */
  const platLine = j =>
    [[plat(j.platform), j.format].filter(Boolean).join(" "), j.category].filter(Boolean).join(" · ");

  /* a confirm sheet in the creator "Withdraw this bid?" pattern: a mini slip, plain consequences, one clear choice */
  function confirm({
    title,
    mini = "",
    bullets = [],
    extra = "",
    yes,
    no = "Keep it",
    danger = false,
    trust = "",
    onYes,
  }) {
    L.openSheet({
      title,
      body: `<div class="stack jl-sheet">${mini}<ul class="jl-conseq">${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>${extra}
        <div class="row wrap"><button class="lq ${danger ? "lq-p bk-danger" : "lq-p"}" type="button" data-yes>${trust ? ic("lock", "ic") : ""}${esc(yes)}</button><button class="lq lq-s" type="button" data-no>${esc(no)}</button></div>${trust ? `<p class="ll-trust">${ic("lock")}${esc(trust)}</p>` : ""}</div>`,
      onMount(b, close) {
        b.querySelector("[data-no]").addEventListener("click", () => close());
        b.querySelector("[data-yes]").addEventListener("click", () => {
          const r = onYes && onYes(b);
          if (r !== false) close();
        });
      },
    });
  }
  const jobMini =
    j => `<div class="jl-mini"><span class="bk-plat">${glyph(j.platform)}<span>${esc(platLine(j))}</span></span>
    <p class="t-money jl-mini-p">${L.inr(j.budget)}</p><p class="t-small muted">${esc(j.title)}</p></div>`;
  const OPEN_BID = ["new", "viewed", "shortlisted"];

  function closeJob(id, after) {
    const j = job(id);
    if (!j) return;
    const open = bidsFor(id).filter(b => OPEN_BID.includes(b.status)).length;
    const c = campOfJob(id),
      k = c && cr(c.creator);
    confirm({
      title: "Close this brief?",
      mini: jobMini(j),
      yes: "Close brief",
      no: "Keep it open",
      bullets: [
        c
          ? `Your deal with ${k.name} carries on. Only the listing closes.`
          : "Creators can no longer find it or bid on it.",
        open
          ? `${open} open bid${open === 1 ? " is" : "s are"} declined, and ${open === 1 ? "that creator is" : "those creators are"} told the brief closed.`
          : "No open bids are waiting on you.",
        "Nothing is charged. It stays under Closed with its history.",
      ],
      onYes() {
        if (L.live && j.status !== "draft") {
          L.live.closeJob(id).then(applyClose, e => L.toast(L.live.errorText(e), "alert"));
          return;
        }
        applyClose();
      },
    });
    function applyClose() {
      L.store.set(s => {
        const x = s.jobs.find(y => y.id === id);
        if (!x) return;
        x.status = "closed";
        x.closedAt = nowISO();
        s.bids.forEach(b => {
          if (b.job === id && OPEN_BID.includes(b.status)) {
            b.status = "declined";
            b.closedWithJob = true;
          }
        });
      }, "job-closed");
      L.toast("Brief closed", "check");
      after && after();
    }
  }
  function deleteJob(id, after) {
    const j = job(id);
    if (!j) return;
    const c = S().campaigns.find(x => x.job === id);
    if (c) {
      const k = cr(c.creator);
      L.openSheet({
        title: "This brief can’t be deleted",
        body: `<div class="stack jl-sheet">${jobMini(j)}
          <p class="muted">You hired ${esc(k.name)} through it, so it is part of a deal and its invoices. Close the listing instead. It stays in your records.</p>
          <div class="row wrap">${j.status === "closed" ? "" : '<button class="lq lq-p" type="button" data-close-instead>Close brief instead</button>'}<button class="lq lq-s" type="button" data-no>Got it</button></div></div>`,
        onMount(b, close) {
          b.querySelector("[data-no]").addEventListener("click", () => close());
          const ci = b.querySelector("[data-close-instead]");
          ci &&
            ci.addEventListener("click", () => {
              close(true);
              closeJob(id, after);
            });
        },
      });
      return;
    }
    const n = bidsFor(id).length || j.bids || 0,
      draft = j.status === "draft";
    confirm({
      title: draft ? "Delete this draft?" : "Delete this brief?",
      mini: jobMini(j),
      yes: draft ? "Delete draft" : "Delete brief",
      no: "Keep it",
      danger: true,
      bullets: [
        draft
          ? "The draft is removed. Creators never saw it."
          : `It disappears for creators${n ? `, and the ${n} bid${n === 1 ? "" : "s"} on it are withdrawn` : ""}.`,
        "This can’t be undone.",
        "Nothing is charged.",
      ],
      onYes() {
        if (L.live && !draft) {
          /* published briefs stay on record: they are closed, not erased */
          L.live.closeJob(id).then(
            () => {
              L.store.set(s => {
                const x = s.jobs.find(y => y.id === id);
                if (x) x.status = "closed";
              }, "job-closed");
              L.toast("Brief closed and removed from creators' search", "check");
              after && after();
            },
            e => L.toast(L.live.errorText(e), "alert"),
          );
          return;
        }
        L.store.set(s => {
          s.jobs = s.jobs.filter(y => y.id !== id);
          s.bids = s.bids.filter(b => b.job !== id);
        }, "job-deleted");
        L.toast(draft ? "Draft deleted" : "Brief deleted", "trash");
        after && after();
      },
    });
  }

  L.bk = {
    ui,
    mo,
    flip,
    todayISO,
    nowISO,
    addDays,
    daysTo,
    daysTxt,
    time,
    plat,
    glyph,
    where,
    job,
    camp,
    cr,
    first,
    bidsFor,
    campOfJob,
    cav,
    ver,
    crChip,
    pf,
    rating,
    nextInvoice,
    notify,
    JST,
    BST,
    pill,
    confirm,
    jobMini,
    closeJob,
    deleteJob,
    OPEN_BID,
    platLine,
  };
})();
