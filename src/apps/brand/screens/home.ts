// @ts-nocheck
/* Home (#home, Builder A): IST greeting, then section panels 48px apart.
   - A brand with no briefs yet: "Post your first brief" (the one primary button), then creators for you.
   - A returning brand: "Needs you" first (new bids, deliveries, accepted invitations, derived from bids and deals),
     the ink numbers card (only once a number is above 0), a quieter "Post a brief", then creators for you.
   Also owns the notifications sheet opened by the #bell button (attached on load). */
import { lowestRate, RATE_ON_REQUEST } from "./creator-rates";
import { REVIEW_TIME } from "../kyc";

(() => {
  const L = window.LLD,
    { esc, icon, store } = L;
  const mo = (k, ...a) => {
    const f = L.motion && L.motion[k];
    if (typeof f === "function") {
      try {
        return f(...a);
      } catch (e) {}
    }
  };
  const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];
  const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];
  const first = n =>
    String(n || "")
      .trim()
      .split(/\s+/)[0] || "";
  /* small avatars carry one letter (two-letter initials like "AI" read as a label); large ones carry two */
  const avatar = (c, cls = "") => {
    const n = c ? c.name : "?";
    return `<span class="home-av ${c && c.tone === "b" ? "is-b" : ""} ${cls}" aria-hidden="true">${esc(cls.includes("lg") ? L.initials(n) : n.trim()[0].toUpperCase())}</span>`;
  };
  const dayTxt = d =>
    d === 0
      ? "today"
      : d === 1
        ? "tomorrow"
        : d < 0
          ? `${-d} ${d === -1 ? "day" : "days"} late`
          : `${d} days left`;

  /* ---------- notification kinds (the spec's list, plus the ones other flows add) ---------- */
  const KIND = {
    accepted: ["check", "Invitation accepted", "ok"],
    declined: ["close", "Invitation declined", "err"],
    rejected: ["close", "Invitation declined", "err"],
    bid: ["bids", "New bid", "brand"],
    message: ["chat", "New message", "plain"],
    delivery: ["upload", "Delivery submitted", "info"],
    paid: ["lock", "Payment successful", "escrow"],
    escrow: ["lock", "Payment successful", "escrow"],
    funded: ["lock", "Payment successful", "escrow"],
    payment: ["coin", "Payment released", "escrow"],
    release: ["coin", "Payment released", "escrow"],
    released: ["coin", "Payment released", "escrow"],
    refund: ["refund", "Refund", "info"],
    refunded: ["refund", "Refund", "info"],
    revision: ["edit", "Revision", "warn"],
    review: ["star", "Review", "plain"],
    invite: ["send", "Invitation sent", "plain"],
    invited: ["send", "Invitation sent", "plain"],
    cancelled: ["close", "Invitation cancelled", "plain"],
    canceled: ["close", "Invitation cancelled", "plain"],
    submitted: ["upload", "Delivery submitted", "info"],
    approved: ["check", "Work approved", "ok"],
    job: ["brief", "Brief", "plain"],
    closed: ["brief", "Brief closed", "plain"],
    posted: ["brief", "Brief posted", "plain"],
  };
  const kindOf = k =>
    KIND[String(k || "").toLowerCase()] || [
      "bell",
      "Update",
      "plain",
    ]; /* unknown kinds still read sensibly */

  /* the sample data has no "declined" or "payment successful" notice yet; add them once so every kind in the spec appears */
  (function seed() {
    const n = (LLD_DATA.notifications = LLD_DATA.notifications || []);
    if (!n.some(x => x.kind === "declined" || x.kind === "rejected"))
      n.push({
        id: "n6",
        kind: "declined",
        text: "Meher Gill declined your invitation for Wedding-season glow Reel. Nothing was charged.",
        at: "2026-10-28T13:05:00+05:30",
        go: "#creator-cr6",
        read: true,
      });
    if (!n.some(x => ["paid", "escrow", "funded"].includes(x.kind)))
      n.push({
        id: "n7",
        kind: "paid",
        text: "Payment successful. ₹16,000 is held in escrow for Sunscreen reapplication, office day.",
        at: "2026-10-24T15:30:00+05:30",
        go: "#campaign-c1",
        read: true,
      });
  })();

  /* ---------- notifications sheet (#bell) ---------- */
  function bellLabel() {
    const b = document.getElementById("bell");
    if (!b) return;
    const n = LLD_DATA.notifications.filter(x => !x.read).length;
    b.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
  }
  const UI = () => (LLD_DATA.ui.home = LLD_DATA.ui.home || { nfilter: "all" });
  function groupOf(at) {
    const d = -L.daysLeft(at.slice(0, 10));
    return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "This week" : "Earlier";
  }
  function openNotifications() {
    const s = LLD_DATA,
      ui = UI();
    const paint = (body, opts = {}) => {
      const all = [...s.notifications].sort((a, b) => L.D(b.at) - L.D(a.at));
      const unread = all.filter(n => !n.read).length;
      if (ui.nfilter === "unread" && !unread && !opts.keep) ui.nfilter = "all";
      const list = ui.nfilter === "unread" ? all.filter(n => !n.read) : all;
      const groups = [];
      list.forEach(n => {
        const g = groupOf(n.at);
        let G = groups.find(x => x.g === g);
        if (!G) groups.push((G = { g, items: [] }));
        G.items.push(n);
      });
      body.innerHTML = all.length
        ? `<div class="home-nt-h">
          <div class="seg home-nt-seg" role="group" aria-label="Show">
            <button type="button" data-f="all" aria-pressed="${ui.nfilter === "all"}">All</button>
            <button type="button" data-f="unread" aria-pressed="${ui.nfilter === "unread"}">Unread${unread ? ` <span class="num">${unread}</span>` : ""}</button>
          </div>
          <button class="lq lq-s lq-sm" type="button" data-allread ${unread ? "" : 'disabled aria-disabled="true"'}>${icon("check", "ic")}Mark all read</button>
        </div>
        <p class="sr-only" aria-live="polite" data-ntlive>${unread ? `${unread} unread` : "All caught up"}</p>
        ${
          list.length
            ? groups
                .map(
                  G =>
                    `<section class="home-nt-g" aria-label="${esc(G.g)}"><h3 class="t-eyebrow">${esc(G.g)}</h3><ul class="home-nt">${G.items
                      .map(n => {
                        const [ic, label, tone] = kindOf(n.kind);
                        return `<li class="${n.read ? "" : "is-unread"}" data-li="${esc(n.id)}">
            <button class="home-nt-i" type="button" data-n="${esc(n.id)}">
              <span class="home-nt-ic is-${tone}" aria-hidden="true">${icon(ic)}</span>
              <span class="home-nt-t"><span class="home-nt-txt">${esc(n.text)}</span><span class="home-nt-at">${esc(label)} · ${esc(L.ago(n.at))}${n.read ? "" : '<span class="sr-only">, unread</span>'}</span></span>
              <span class="home-nt-dot" aria-hidden="true"></span>
            </button>
            ${n.read ? "" : `<button class="ibtn home-nt-mark" type="button" data-mark="${esc(n.id)}" aria-label="Mark as read: ${esc(n.text)}" title="Mark as read">${icon("check")}</button>`}
          </li>`;
                      })
                      .join("")}</ul></section>`,
                )
                .join("")
            : `<div class="home-nt-none"><p class="t-h3">No unread notifications</p><p class="muted">You've seen everything.</p><button type="button" class="lq lq-s lq-sm" data-f="all">Show all</button></div>`
        }
        <p class="home-nt-foot sample">Sample notifications</p>`
        : `<div class="empty home-nt-empty"><img src="assets/step-01-envelope.svg" width="140" height="103" alt=""><p class="t-h2">You're all caught up.</p><p class="muted">Bids, accepted invitations, deliveries and payments land here.</p></div>`;
      L.liquid(body);
      if (!opts.quiet) mo("stagger", L.$$(".home-nt li", body));
    };
    L.openSheet({
      title: "Notifications",
      body: "",
      onMount(body, close) {
        paint(body);
        body.addEventListener("click", e => {
          const t = e.target.closest("button");
          if (!t) return;
          if (t.dataset.f) {
            ui.nfilter = t.dataset.f;
            paint(body, { keep: true });
            const b = body.querySelector(`[data-f="${ui.nfilter}"]`);
            b && b.focus();
            return;
          }
          if (t.hasAttribute("data-allread")) {
            L.store.set(
              st =>
                st.notifications.forEach(n => {
                  n.read = true;
                }),
              "notif-read-all",
            );
            paint(body, { quiet: true });
            L.toast("All marked as read", "check");
            const f = body.querySelector(".home-nt-i");
            f && f.focus();
            return;
          }
          if (t.dataset.mark) {
            const n = s.notifications.find(x => x.id === t.dataset.mark);
            if (!n) return;
            const li = t.closest("li"),
              nextFocus = li && (li.nextElementSibling || li.previousElementSibling);
            L.store.set(() => {
              n.read = true;
            }, "notif-read");
            const keepId = nextFocus && nextFocus.dataset.li;
            paint(body, { quiet: true, keep: true });
            const live = body.querySelector("[data-ntlive]");
            if (live) live.textContent = "Marked as read";
            const back =
              (keepId && body.querySelector(`[data-li="${keepId}"] .home-nt-i`)) ||
              body.querySelector(`[data-n="${n.id}"]`) ||
              body.querySelector(".home-nt-i") ||
              body.querySelector('[data-f="all"]');
            back && back.focus();
            return;
          }
          if (t.dataset.n) {
            const n = s.notifications.find(x => x.id === t.dataset.n);
            if (!n) return;
            L.store.set(() => {
              n.read = true;
            }, "notif-read");
            close(true);
            if (n.go) L.go(n.go);
          }
        });
      },
    });
  }
  L.openNotifications = openNotifications;
  const bell = document.getElementById("bell");
  if (bell && !bell.dataset.wired) {
    bell.dataset.wired = "1";
    bell.addEventListener("click", openNotifications);
    bell.setAttribute("aria-haspopup", "dialog");
  }
  store.on(bellLabel);
  bellLabel();

  /* ---------- greeting by IST time ---------- */
  function greeting(now) {
    let h = 12;
    try {
      h =
        Number(
          new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            hour12: false,
            timeZone: "Asia/Kolkata",
          }).format(now),
        ) % 24;
    } catch (e) {}
    return h < 4
      ? "Up late"
      : h < 12
        ? "Good morning"
        : h < 17
          ? "Good afternoon"
          : h < 23
            ? "Good evening"
            : "Up late";
  }

  /* budget: escrow paid in this budget window and not refunded */
  function budget(s) {
    const b = s.budget || { total: 0, label: "" };
    const from = b.from || "2026-10-01",
      to = b.to || "2026-12-31";
    const used = s.payments
      .filter(p => p.kind === "escrow" && p.status !== "refunded" && p.date >= from && p.date <= to)
      .reduce((n, p) => n + p.amount, 0);
    const owed = s.campaigns.filter(c => c.stage === "accepted").reduce((n, c) => n + c.price, 0); // accepted, not paid yet
    return { total: b.total, label: b.label, used, owed, left: Math.max(0, b.total - used) };
  }

  /* creators worth a look: not already working with you, ranked on fit with your industry */
  function picks(s) {
    const busy = new Set(
      s.campaigns.filter(c => [...LIVE, "accepted", "invited"].includes(c.stage)).map(c => c.creator),
    );
    const ind = String(s.me.industry || "").toLowerCase();
    const score = c =>
      (c.categories.some(x => x.toLowerCase() === ind) ? 4 : 0) +
      (c.verified ? 1 : 0) +
      (c.availability === "open" ? 1 : 0) +
      (c.rating || 3.5) +
      (s.favorites.includes(c.id) ? 0.3 : 0);
    return s.creators
      .filter(c => !busy.has(c.id))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 4);
  }

  function render(el) {
    const draw = initial => {
      const s = store.s,
        now = L.today(),
        st = L.brandStats ? L.brandStats() : { hired: 0, hiredIds: [], active: [] };
      const bud = budget(s),
        held = L.heldInEscrow();
      let when = "";
      try {
        const tz = { timeZone: "Asia/Kolkata" };
        const day = new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
          ...tz,
        })
          .format(now)
          .replace(",", "");
        const time = new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          ...tz,
        })
          .format(now)
          .replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase());
        when = `${day} · ${time} IST`;
      } catch (e) {}

      /* ---- needs you: real objects derived from bids and deals. Only the first action is the screen's primary ---- */
      let primed = false;
      const cta = () => (primed ? "lq lq-s lq-sm" : ((primed = true), "lq lq-p lq-sm"));
      const objs = [];
      s.campaigns
        .filter(c => c.stage === "submitted")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            dl = c.deliveries || [],
            d = dl[dl.length - 1];
          const left = (c.revisionsIncluded || 0) - (c.revisionsUsed || 0);
          objs.push(`<li class="home-obj home-del">
          <div class="home-obj-top"><span class="pill pill-info">${icon("upload")}Delivery to verify</span>${d ? `<span class="home-due">Sent ${esc(L.ago(d.at))}</span>` : ""}</div>
          <p class="home-from">${avatar(cr)}<span><b>${esc(cr.name)}</b> sent ${dl.length > 1 ? "a new version" : "the final cut"}</span></p>
          ${d && d.note ? `<blockquote class="home-quote">“${esc(d.note)}”</blockquote>` : ""}
          <p class="home-job">${esc(c.title)}</p>${d && d.file ? `<p class="home-file">${icon("file")}${esc(d.file)}</p>` : ""}
          <div class="home-obj-act"><a class="${cta()}" href="#campaign-${esc(c.id)}">Review delivery</a><span class="pill pill-escrow">${icon("lock")}${L.inr(c.price)} in escrow</span></div>
          <p class="home-obj-foot">Approve to release the money, or ask for a revision.${c.revisionsIncluded ? ` ${left} of ${c.revisionsIncluded} revision${c.revisionsIncluded === 1 ? "" : "s"} left.` : ""}</p>
        </li>`);
        });
      const openJobs = s.jobs
        .filter(j => j.status === "open")
        .map(j => ({ j, fresh: s.bids.filter(b => b.job === j.id && b.status === "new") }))
        .filter(x => x.fresh.length)
        .sort((a, b) => b.fresh.length - a.fresh.length);
      if (openJobs.length) {
        /* the range only over real prices: Math.min() of nothing is Infinity */
        const { j, fresh } = openJobs[0],
          prices = fresh.map(b => Number(b.price)).filter(p => Number.isFinite(p) && p > 0),
          lo = prices.length ? Math.min(...prices) : 0,
          hi = prices.length ? Math.max(...prices) : 0;
        const crs = fresh.map(b => L.creator(b.creator)).filter(Boolean);
        objs.push(`<li class="home-obj home-bids">
          <div class="home-obj-top"><span class="pill pill-violet">${icon("bids")}New bids</span>${j.deadline ? `<span class="home-due">${icon("clock")}Post by ${esc(L.fmtDate(j.deadline))}</span>` : ""}</div>
          <p class="home-obj-t">${fresh.length} new bid${fresh.length === 1 ? "" : "s"} on ${esc(j.title)}</p>
          ${
            crs.length
              ? `<div class="home-stack"><span class="home-avs">${crs
                  .slice(0, 3)
                  .map(c => avatar(c))
                  .join(
                    "",
                  )}</span><span>${esc(crs.map(c => first(c.name)).join(" and "))} bid since yesterday</span></div>`
              : ""
          }
          <dl class="home-mini">
            ${prices.length ? `<div><dt>New bids</dt><dd class="t-money">${lo === hi ? L.inr(lo) : `${L.inr(lo)}–${L.inr(hi).slice(1)}`}</dd></div>` : ""}
            ${j.budget ? `<div><dt>Your budget</dt><dd class="t-money">${L.inr(j.budget)}</dd></div>` : ""}
            <div><dt>All bids</dt><dd class="t-money">${esc(Math.max(j.bids || 0, fresh.length))}</dd></div>
          </dl>
          <ul class="home-bidrows">${fresh
            .slice()
            .sort((a, b) => L.D(b.sent) - L.D(a.sent))
            .slice(0, 3)
            .map(b => {
              const c = L.creator(b.creator) || { name: "Creator" };
              return `<li>${avatar(c)}<span class="home-bidrow-t"><b>${esc(c.name)}</b><span>${b.price ? L.inr(b.price) : "Price not given"}${b.postDate ? ` · posts by ${esc(L.fmtDate(b.postDate))}` : ""}</span></span><button class="lq lq-s lq-sm" type="button" data-viewbid="${esc(b.id)}" data-job="${esc(j.id)}">${icon("eye", "ic")}View bid</button></li>`;
            })
            .join("")}</ul>
          <div class="home-obj-act"><a class="${cta()}" href="#job-${esc(j.id)}">Compare bids</a>${fresh.length > 3 ? `<a class="lq lq-s lq-sm" href="#job-${esc(j.id)}">All ${fresh.length} bids</a>` : ""}${openJobs[1] ? `<a class="lq lq-s lq-sm" href="#job-${esc(openJobs[1].j.id)}">+${openJobs[1].fresh.length} on ${esc(openJobs[1].j.title)}</a>` : ""}</div>
        </li>`);
      }
      s.campaigns
        .filter(c => c.stage === "accepted")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            acc = (c.log || []).find(x => x[1] === "accepted");
          objs.push(`<li class="home-obj home-pay">
          <p class="home-pay-l">${esc(cr.name)} accepted${acc ? ` ${esc(L.ago(acc[0]))}` : ""}</p>
          <p class="t-money home-pay-v">${L.inr(c.price)}</p>
          <p class="home-pay-s">Pay into escrow to start <b>${esc(c.title)}</b>. Chat opens once it's paid.</p>
          <div class="home-obj-act"><button class="${cta()}" type="button" data-pay="${esc(c.id)}">${icon("lock", "ic")}Pay into escrow</button><a class="lq lq-s lq-sm" href="#campaign-${esc(c.id)}">Details</a></div>
          <p class="ll-trust home-trust">${icon("lock")}Linkloom holds it until you approve the work.</p>
          ${bud.total ? `<p class="home-pay-b">Leaves ${L.inr(Math.max(0, bud.left - c.price))} of your ${esc(bud.label)} budget.</p>` : ""}
        </li>`);
        });

      /* waiting on creators: nothing for you to do, but worth knowing */
      const waits = [];
      s.campaigns
        .filter(c => c.stage === "revision")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            th = s.threads.find(t => t.id === c.thread),
            last = th && [...th.messages].reverse().find(m => m.from === "creator");
          waits.push(`<li class="home-wait">${avatar(cr)}
          <div class="home-wait-t"><p><b>${esc(cr.name)}</b> is working on your revision <span class="pill pill-warn">Revision ${c.revisionsUsed} of ${c.revisionsIncluded}</span></p>
            <p class="home-wait-s">${esc(c.title)} · due ${esc(L.fmtDate(c.due))}, ${esc(dayTxt(L.daysLeft(c.due)))}${last ? ` · “${esc(last.text)}”` : ""}</p></div>
          <div class="home-wait-a">${th ? `<a class="lq lq-s lq-sm" href="#chat-${esc(th.id)}">${icon("chat", "ic")}Message</a>` : ""}<a class="lq lq-s lq-sm" href="#campaign-${esc(c.id)}">Open${icon("arrow", "ic")}</a></div></li>`);
        });
      s.campaigns
        .filter(c => c.stage === "invited")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            inv = (c.log || []).find(x => x[1] === "invited");
          waits.push(`<li class="home-wait">${avatar(cr)}
          <div class="home-wait-t"><p><b>${esc(cr.name)}</b> hasn't replied to your invitation <span class="pill pill-paper">${icon("clock")}Pending</span></p>
            <p class="home-wait-s">${esc(c.title)} · ${L.inr(c.price)}${inv ? ` · sent ${esc(L.ago(inv[0]))}` : ""} · nothing is charged until ${esc(first(cr.name))} accepts and you pay</p></div>
          <div class="home-wait-a"><a class="lq lq-s lq-sm" href="#campaign-${esc(c.id)}">View or cancel${icon("arrow", "ic")}</a></div></li>`);
        });

      const crs = picks(s);
      const hiredCr = st.hiredIds.map(id => L.creator(id)).filter(Boolean);
      const act = st.active,
        review = act.filter(c => c.stage === "submitted").length,
        rev = act.filter(c => c.stage === "revision").length;
      const actNote =
        [
          review && `${review} to review`,
          rev && `${rev} in revision`,
          act.length - review - rev > 0 && `${act.length - review - rev} in progress`,
        ]
          .filter(Boolean)
          .join(" · ") || "None running right now";
      const pct = bud.total ? Math.min(100, (bud.used / bud.total) * 100) : 0,
        opct = bud.total ? Math.min(100 - pct, (bud.owed / bud.total) * 100) : 0;

      /* who this is: a brand with no briefs and no deals yet gets "Post your first brief" and no zeros */
      const posted = s.jobs.filter(j => j.status !== "draft"),
        open = s.jobs.filter(j => j.status === "open"),
        draft = s.jobs.find(j => j.status === "draft");
      const isNew = !posted.length && !s.campaigns.length;
      const showNums = st.hired > 0 || act.length > 0 || held > 0;
      const n = k => WORDS[Math.min(k, 5)];
      const lede = isNew
        ? "Post a brief, and creators who fit will bid with a price and a date."
        : objs.length
          ? `${n(objs.length)} ${objs.length === 1 ? "needs" : "need"} you today${waits.length ? `, and ${n(waits.length).toLowerCase()} ${waits.length === 1 ? "is" : "are"} with creators` : ""}.`
          : waits.length
            ? `Nothing needs you right now. ${n(waits.length)} ${waits.length === 1 ? "is" : "are"} with creators.`
            : open.length
              ? `You're all caught up. ${open.length === 1 ? "One brief is" : `${open.length} briefs are`} taking bids.`
              : "You're all caught up.";

      /* needs you: the actions, then what is with creators; a quiet line while open briefs wait for bids */
      let needs = "";
      if (objs.length || waits.length || open.length) {
        const withOnly = !objs.length && waits.length;
        const quiet = open.length
          ? `<div class="home-quiet-row"><p class="home-quiet">${
              open.length === 1
                ? `No new bids yet on <b>${esc(open[0].title)}</b>. Bids land here as creators send them.`
                : `No new bids yet on your ${open.length} open briefs. Bids land here as creators send them.`
            }</p><a class="lq lq-s lq-sm" href="${open.length === 1 ? `#job-${esc(open[0].id)}` : "#jobs"}">${open.length === 1 ? "View brief" : "See briefs"}${icon("arrow", "ic")}</a></div>`
          : "";
        needs = `<section class="ll-panel home-sec home-today" aria-labelledby="homeTodayH">
          <div class="ll-panel-head"><div><h2 class="ll-panel-h" id="homeTodayH">${withOnly ? "With creators" : "Needs you"}</h2>${withOnly ? '<p class="ll-panel-sub">Nothing needs you right now. These are waiting on the creator.</p>' : ""}</div></div>
          ${objs.length ? `<ul class="home-strip home-strip-${Math.min(objs.length, 3)}">${objs.join("")}</ul>` : withOnly ? "" : quiet}
          ${waits.length ? `<div class="home-waits">${objs.length ? '<h3 class="t-eyebrow">With creators</h3>' : ""}<ul>${waits.join("")}</ul></div>` : ""}
        </section>`;
      }

      /* post a brief: the primary action for a new brand (or when nothing else needs you), quieter otherwise */
      const post = `<section class="ll-panel home-sec home-post${isNew ? " is-first" : ""}" aria-labelledby="homePostH">
          ${isNew ? '<img class="home-post-img" src="assets/step-01-envelope.svg" width="112" height="82" alt="">' : ""}
          <div class="home-post-t">
            <h2 class="ll-panel-h" id="homePostH">${isNew ? "Post your first brief" : "Post a brief"}<span class="home-post-time"> · takes about 3 minutes</span></h2>
            <p class="ll-panel-sub">${isNew ? "Say what you need and what you'll pay. Creators who fit bid with a price and a date, and you pay into escrow only when you hire." : "Need another creator? Creators who fit bid with a price and a date."}</p>
            ${draft ? `<a class="lq lq-s lq-sm home-post-draft" href="#post-${esc(draft.id)}">${icon("edit", "ic")}Finish your draft: ${esc(draft.title || "Untitled brief")}</a>` : ""}
          </div>
          <a class="${cta().replace(" lq-sm", "")}" href="#post">${icon("plus", "ic")}Post a brief</a>
        </section>`;

      /* business check: where it stands, on Home, so nobody has to dig into #kyc to find out */
      const kyc = s.kyc || {},
        kst = String(kyc.status || "not_started"),
        kSteps = kyc.steps || {},
        kDone = ["pan", "id", "bank"].filter(k => kSteps[k] && kSteps[k].done).length;
      const KYC_CARD = {
        not_started: ["pill-paper", "Not started", "Verify your business", "Needed before you post a brief, send an offer or pay into escrow. 3 steps, about 4 minutes.", "Start verification"],
        in_progress: ["pill-info", `${kDone} of 3 done`, "Finish verifying your business", "Needed before you post a brief, send an offer or pay into escrow. Pick up where you left off.", "Continue verification"],
        pending: ["pill-info", "Under review", "We're checking your business", REVIEW_TIME + " You'll get a notification when it's done.", "See status"],
        rejected: ["pill-err", "Needs a fix", "Your verification needs a fix", kyc.rejectionReason ? String(kyc.rejectionReason) : "One detail didn't match. Fix it and send it again.", "Fix it"],
      };
      const kc = KYC_CARD[kst];
      const kycCard = kc
        ? `<section class="ll-panel home-sec home-kyc is-${esc(kst)}" aria-labelledby="homeKycH">
          <span class="home-kyc-ic" aria-hidden="true">${icon(kst === "rejected" ? "alert" : kst === "pending" ? "clock" : "shield")}</span>
          <div class="home-kyc-t">
            <p class="home-kyc-top"><span class="pill ${kc[0]}">${esc(kc[1])}</span><span class="t-eyebrow">Business check</span></p>
            <h2 class="ll-panel-h" id="homeKycH">${esc(kc[2])}</h2>
            <p class="ll-panel-sub">${esc(kc[3])}</p>
          </div>
          <a class="lq lq-s" href="#kyc">${kst === "pending" ? "" : icon("lock", "ic")}${esc(kc[4])}</a>
        </section>`
        : "";

      /* the ink numbers card: only once there is something to count */
      const nums = showNums
        ? `<section class="home-band" aria-label="${esc(s.me.brand)} at a glance">
          <dl class="home-nums">
            <div><dt>Creators hired</dt><dd class="t-money" data-n="${st.hired}">${st.hired}</dd>
              <p class="home-num-s">${
                hiredCr.length
                  ? `<span class="home-avs">${hiredCr
                      .slice(0, 3)
                      .map(c => avatar(c))
                      .join("")}</span>${esc(hiredCr.map(c => c.name).join(" and "))}`
                  : "Paid through escrow"
              }</p></div>
            <div><dt>Active deals</dt><dd class="t-money" data-n="${act.length}">${act.length}</dd><p class="home-num-s">${esc(actNote)}</p></div>
            <div><dt>Held in escrow</dt><dd class="t-money" data-inr="${held}">${L.inr(held)}</dd><p class="home-num-s"><span class="pill pill-escrow">${icon("lock")}Released only when you approve</span></p></div>
          </dl>
          ${
            bud.total
              ? `<div class="home-bud">
            <div class="home-bud-h"><p><b>Budget used</b> · ${esc(bud.label)}</p><p class="num"><b>${L.inr(bud.used)}</b> of ${L.inr(bud.total)}</p></div>
            <div class="home-bud-bar" role="img" aria-label="${Math.round(pct)}% of the ${esc(bud.label)} budget used${bud.owed ? `, ${L.inr(bud.owed)} more to pay for accepted invitations` : ""}"><i style="width:${pct.toFixed(2)}%"></i>${bud.owed ? `<i class="is-owed" style="width:${opct.toFixed(2)}%"></i>` : ""}</div>
            <p class="home-bud-s"><span class="num">${L.inr(bud.left)}</span> left${bud.owed ? ` · <span class="home-key"></span>${L.inr(bud.owed)} more once you pay accepted invitations` : ""}</p><a class="lq lq-s lq-sm home-bud-a" href="#reports">${icon("chart", "ic")}Spending report</a>
          </div>`
              : ""
          }
        </section>`
        : "";

      /* creators for you: name and badge, niches, followers and engagement, then the price at the same size */
      const crCard = (c, i) => {
        const top = [...(c.platforms || [])].sort((a, b) => b.followers - a.followers)[0] || {
            p: "instagram",
            followers: 0,
            er: 0,
          },
          rate = lowestRate(c.rates);
        const saved = s.favorites.includes(c.id),
          inCart = s.cart.includes(c.id);
        const cats = c.categories || [];
        return `<li><a class="home-cr" href="#creator-${esc(c.id)}">
              ${i === 0 ? '<span class="t-note home-note" aria-hidden="true">worth a look</span>' : ""}
              <div class="home-cr-top">${avatar(c, "lg")}<span class="home-cr-tags">${saved ? `<span class="pill pill-line">${icon("bookmark")}Saved</span>` : ""}${inCart ? `<span class="pill pill-line">${icon("cart")}In cart</span>` : ""}</span></div>
              <p class="home-cr-n"><b>${esc(c.name)}</b>${c.verified ? `<span class="home-cr-v" title="Verified">${icon("verified")}<span class="sr-only">, verified</span></span>` : ""}</p>
              <p class="home-cr-h">${esc([c.handle, c.city].filter(Boolean).join(" · "))}</p>
              ${cats.length ? `<ul class="home-cr-niche" aria-label="Niches">${cats
                .slice(0, 2)
                .map(x => `<li>${esc(x)}</li>`)
                .join("")}</ul>` : ""}
              <dl class="home-cr-st">
                <div><dt>${top.p === "youtube" ? "Subscribers" : "Followers"}</dt><dd>${icon(top.p === "youtube" ? "yt" : "ig")}${top.followers > 0 ? esc(L.compact(top.followers)) : "—"}</dd></div>
                <div><dt>Engagement</dt><dd>${top.er > 0 ? `${esc(top.er)}%` : "—"}</dd></div>
                <div><dt>Rating</dt><dd>${c.rating ? `${icon("star")}${esc(c.rating)}` : "New"}</dd></div>
              </dl>
              <p class="home-cr-f">${rate ? `<span>From</span><b class="num">${L.inr(rate.price)}</b><span>per ${esc(rate.fmt)}</span>` : `<span>${RATE_ON_REQUEST}</span>`}</p>
            </a></li>`;
      };
      const creators = `<section class="ll-panel home-sec home-crs" aria-labelledby="homeCrH">
          <div class="ll-panel-head">
            <div><h2 class="ll-panel-h" id="homeCrH">Creators for you</h2><p class="ll-panel-sub">Ranked on ${esc((s.me.industry || "your industry").toLowerCase())}, verification, availability and rating.</p></div>
            ${crs.length ? `<a class="ll-panel-more" href="#creators" aria-label="See all creators">See all →</a>` : ""}
          </div>
          ${
            crs.length
              ? `<ul class="home-cr-list">${crs.map(crCard).join("")}</ul>`
              : `<div class="home-quiet-row"><p class="home-quiet">You're working with everyone we'd suggest.</p><a class="lq lq-s lq-sm" href="#creators">${icon("search", "ic")}Search all creators</a></div>`
          }
        </section>`;

      el.innerHTML = `<div class="view-in home">
        <header class="home-hi">
          <h1 class="home-greet">${esc(greeting(now))}, ${esc(first(s.me.name))}.</h1>
          <p class="home-lede">${esc(lede)} <span class="sample">Sample data</span></p>
          ${kst === "verified" ? `<p class="home-verified"><span class="pill pill-ok">${icon("verified")}Business verified</span><span>You can post briefs, send offers and hire with escrow.</span></p>` : ""}
        </header>
        <div class="ll-stack home-secs">
          ${kycCard}${isNew ? post + creators : needs + nums + post + creators}
        </div>
      </div>`;
      L.liquid(el);

      /* View bid: open the brief at that bid (job.ts scrolls to it and outlines it) */
      el.querySelectorAll("[data-viewbid]").forEach(b =>
        b.addEventListener("click", () => {
          if (L.bk) L.bk.ui("job").focusBid = b.dataset.viewbid;
          L.go("#job-" + b.dataset.job);
        }),
      );
      el.querySelectorAll("[data-pay]").forEach(b =>
        b.addEventListener("click", () => {
          if (typeof L.payEscrow === "function") L.payEscrow(b.dataset.pay);
          else L.go("#campaign-" + b.dataset.pay);
        }),
      );
      if (initial) {
        el.querySelectorAll(".home-nums [data-n]").forEach(d => {
          const n = +d.dataset.n;
          if (n) mo("count", d, n, v => String(Math.round(v)));
        });
        const h = el.querySelector("[data-inr]");
        if (h && +h.dataset.inr) mo("count", h, +h.dataset.inr, L.inr);
        mo("stagger", L.$$(".home-obj, .home-wait", el));
        mo("stagger", L.$$(".home-cr-list>li", el));
        const bar = el.querySelector(".home-bud-bar");
        bar && bar.classList.add("is-in");
      } else {
        el.querySelectorAll(".home-bud-bar").forEach(b => b.classList.add("is-in", "is-now"));
      }
      mo("lift", L.$$(".home-cr", el));
    };
    draw(true);
    let raf = 0;
    const off = store.on(why => {
      if (/^notif/.test(String(why))) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (el.isConnected) draw(false);
      });
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }

  L.register("home", { title: "Home", nav: "home", render });
})();
