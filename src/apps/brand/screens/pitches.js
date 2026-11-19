/* Pitches (#pitches, #pitches-<briefId>): what creators pitched this brand, from the brand profile creators can open.
   One pitch per creator (edited at most once). The brand can only view the creator, message them, or decline;
   a decline lets that creator pitch again after 15 days (the backend enforces every rule). */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const S = () => window.LLD_DATA;
  const K = () => L.bk;
  const TABS = [
    ["all", "All"],
    ["new", "New"],
    ["declined", "Declined"],
  ];
  const ui = { tab: "all" };
  const inTab = (p, t) =>
    t === "all"
      ? p.status !== "declined"
      : t === "new"
        ? !p.read && p.status !== "declined"
        : p.status === "declined";
  const link = u => {
    const href = /^https?:\/\//.test(u) ? u : "https://" + u;
    return `<a class="pt-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${ic("link", "ic")}<span>${esc(u.replace(/^https?:\/\/(www\.)?/, ""))}</span></a>`;
  };
  const when = p => `${L.fmtDate(p.at)}${p.edited ? ` · edited ${esc(L.fmtDate(p.editedAt || p.at))}` : ""}`;

  /** One pitch card; `compact` for the brief page. */
  function card(p, compact) {
    const c = K().cr(p.creator) || { id: p.creator, name: "Creator", handle: "" };
    const about = p.job
      ? `<a class="pt-about" href="#job-${esc(p.job)}">${ic("brief", "ic")}<span>About <b>${esc(p.jobTitle || (K().job(p.job) || {}).title || "a brief")}</b></span></a>`
      : `<span class="pt-about is-general">${ic("chat", "ic")}<span>General pitch</span></span>`;
    const tags = [
      !p.read && p.status !== "declined" ? '<span class="pill pill-violet">New</span>' : "",
      p.edited ? '<span class="pill">Edited</span>' : "",
      p.status === "declined" ? '<span class="pill pill-err">Declined</span>' : "",
    ].join("");
    return `<article class="card pt-card${p.status === "declined" ? " is-declined" : ""}" data-pitch="${esc(p.id)}">
      <div class="pt-top"><a class="pt-who" href="#creator-${esc(c.id)}">${K().crChip(c)}</a><div class="pt-tags">${tags}</div></div>
      <div class="pt-meta">${about}<span class="t-small muted">${when(p)}</span></div>
      <p class="pt-msg${compact ? " is-clamp" : ""}">${esc(p.message)}</p>
      ${p.links.length ? `<div class="pt-links">${p.links.map(link).join("")}</div>` : ""}
      <div class="row wrap pt-acts">
        <a class="lq lq-s lq-sm" href="#creator-${esc(c.id)}">${ic("user", "ic")}View creator</a>
        <button class="lq lq-s lq-sm" type="button" data-pmsg="${esc(p.id)}">${ic("chat", "ic")}Message</button>
        ${p.status === "declined" ? "" : `<button class="lq lq-s lq-sm pt-decline" type="button" data-pdecl="${esc(p.id)}">Decline</button>`}
      </div>
    </article>`;
  }

  /** Message, Decline and read-marking for any element holding pitch cards. */
  function wireCards(root, repaint) {
    root.addEventListener("click", e => {
      const m = e.target.closest("[data-pmsg]"),
        d = e.target.closest("[data-pdecl]");
      if (m) {
        const p = S().pitches.find(x => x.id === m.dataset.pmsg);
        if (!p) return;
        const t = S().threads.find(x => x.creator === p.creator);
        if (t) return L.go("#chat-" + t.id);
        if (!L.live) return L.toast("Sample data. In the live app this opens your chat with them.", "chat");
        m.disabled = true;
        L.live.openChatWith(p.creator).then(
          id => L.go("#chat-" + id),
          er => {
            m.disabled = false;
            L.toast(L.live.errorText(er), "alert");
          },
        );
      } else if (d) {
        const p = S().pitches.find(x => x.id === d.dataset.pdecl);
        if (!p) return;
        const c = K().cr(p.creator) || { name: "this creator" };
        const f = K().first ? K().first(c) : c.name;
        K().confirm({
          title: "Decline this pitch?",
          yes: "Decline pitch",
          no: "Keep it",
          danger: true,
          mini: `<div class="jl-mini">${K().crChip(c)}<p class="t-small muted">${esc(p.job ? "About " + (p.jobTitle || "a brief") : "General pitch")}</p></div>`,
          bullets: [
            `${f} is told you passed on it.`,
            `${f} can pitch you again after 15 days.`,
            "The pitch stays in your Declined tab.",
          ],
          onYes() {
            const done = () => {
              L.toast("Pitch declined", "check");
              repaint();
            };
            if (!L.live) {
              L.store.set(s => {
                const x = s.pitches.find(y => y.id === p.id);
                if (x) x.status = "declined";
              }, "pitch-declined");
              return done();
            }
            L.live.declinePitch(p.id).then(done, er => L.toast(L.live.errorText(er), "alert"));
          },
        });
      }
    });
  }

  /** Marks what the brand has now seen as read (on the server too); the "New" tags stay until the next visit. */
  function markSeen(list) {
    const unread = list.filter(p => !p.read && p.status !== "declined");
    if (!unread.length) return;
    if (L.live) unread.forEach(p => L.live.readPitch(p.id).catch(() => undefined));
    setTimeout(
      () =>
        L.store.set(s => {
          for (const p of s.pitches) if (unread.some(u => u.id === p.id)) p.read = true;
        }, "pitches-read"),
      1500,
    );
  }

  L.pitchCards = { card, wireCards, markSeen };

  L.register("pitches", {
    title: "Pitches",
    nav: "pitches",
    crumb: id => {
      const j = id && K().job(id);
      return j ? `<a href="#pitches">Pitches</a> / ${esc(j.title)}` : "";
    },
    render(el, briefId) {
      const all = () =>
        (S().pitches || [])
          .filter(p => !briefId || p.job === briefId)
          .sort((a, b) => (b.editedAt || b.at).localeCompare(a.editedAt || a.at));
      const j = briefId ? K().job(briefId) : null;
      const count = t => all().filter(p => inTab(p, t)).length;
      const paint = () => {
        const list = all().filter(p => inTab(p, ui.tab));
        const off = L.live && !S().pitchesOn;
        const empty = off
          ? `<div class="empty"><p class="t-h2">Pitches open soon</p><p class="muted">Creators will be able to open your brand profile and pitch you an idea. They show up here, and you get a notification for each one.</p></div>`
          : !all().length
            ? `<div class="empty"><p class="t-h2">No pitches yet</p><p class="muted">Creators can open your brand profile and pitch you once, about one of your briefs or a fresh idea. Each new pitch lands here and in your notifications.</p><a class="lq lq-s" href="#profile">Check your brand profile</a></div>`
            : !list.length
              ? `<div class="empty is-small"><p class="muted">Nothing in ${esc(TABS.find(t => t[0] === ui.tab)[1])}.</p></div>`
              : list.map(p => card(p)).join("");
        el.innerHTML = `<div class="view-in pt">
          <header class="jl-head">
            <div class="jl-head-t"><h1 class="t-h1">${j ? "Pitches about " + esc(j.title) : "Pitches"}</h1>
              <p class="muted">Creators pitch you once from your brand profile, about a brief or a fresh idea. They can edit a pitch once. ${L.live ? "" : '<span class="sample">Sample data</span>'}</p></div>
            ${j ? `<a class="lq lq-s" href="#pitches">All pitches</a>` : ""}
          </header>
          ${off || !all().length ? "" : `<div class="chips jl-filter" role="group" aria-label="Show pitches">${TABS.map(([k, n]) => `<button class="chip" type="button" data-tab="${k}" aria-pressed="${ui.tab === k}">${n} <span class="jl-cn">${count(k)}</span></button>`).join("")}</div>`}
          <div class="pt-list">${empty}</div>
        </div>`;
        L.liquid(el);
        markSeen(list);
      };
      paint();
      el.addEventListener("click", e => {
        const t = e.target.closest("[data-tab]");
        if (!t) return;
        ui.tab = t.dataset.tab;
        paint();
      });
      wireCards(el, paint);
      const off = L.store.on(why => {
        if (/^(live-loaded|live-refresh|pitch-declined)$/.test(why)) paint();
      });
      return () => off && off();
    },
  });
})();
