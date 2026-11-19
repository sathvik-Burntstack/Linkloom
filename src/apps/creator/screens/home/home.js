/* Home (#home): IST greeting, the ID check as one slim bar, "what needs you today" strip of real objects,
   then the "Briefs for you" and "Your bids" panels. Brief cards come from ui/brief-card.ts, shared with #jobs.
   Also owns the notifications sheet opened by the #bell button in the top bar. Owner: Builder B. */
import { BEST_FIT_MIN, briefCard } from "../../ui/brief-card";
import { KYC_AFTER_ACCEPT, kycOwed, kycWaitText, openKyc } from "../../core/kyc-gate";
import { storedUser } from "@/shared/api/client";
import { firstTime } from "@/shared/ux";

(() => {
  const L = window.LLD,
    esc = L.esc;
  const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];

  /* ---------- notifications sheet (#bell) ---------- */
  function bellLabel() {
    const b = document.getElementById("bell");
    if (!b) return;
    const n = LLD_DATA.notifications.filter(x => !x.read).length;
    b.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
  }
  function openNotifications() {
    const s = LLD_DATA;
    const paint = body => {
      const list = [...s.notifications].sort((a, b) => L.D(b.at) - L.D(a.at));
      const unread = list.filter(n => !n.read).length;
      body.innerHTML = list.length
        ? `<div class="home-nt-h">
          <p class="t-small muted" aria-live="polite">${unread ? `${unread} unread` : "All caught up"}</p>
          <button class="lq lq-s lq-sm" type="button" data-allread ${unread ? "" : 'disabled aria-disabled="true"'}>${L.icon("check", "ic")}Mark all read</button>
        </div>
        <ul class="home-nt">${list
          .map(
            n => `<li><button class="home-nt-i${n.read ? "" : " is-unread"}" type="button" data-n="${esc(n.id)}">
            <span class="home-nt-dot" aria-hidden="true"></span>
            <span class="home-nt-t"><span>${esc(n.text)}</span><span class="home-nt-at">${esc(L.ago(n.at))}${n.read ? "" : '<span class="sr-only">, unread</span>'}</span></span>
            ${L.icon("chevron")}
          </button></li>`,
          )
          .join("")}</ul>
        <p class="home-nt-foot sample">Sample notifications</p>`
        : `<div class="empty home-nt-empty"><img src="assets/step-01-envelope.svg" width="140" height="103" alt=""><p class="t-h2">You are all caught up.</p><p class="muted">Bid updates, revision requests and payouts land here.</p></div>`;
      L.liquid(body); // the sheet's own liquid pass ran before this body was painted
    };
    L.openSheet({
      title: "Notifications",
      body: "",
      onMount(body, close) {
        paint(body);
        body.addEventListener("click", e => {
          const t = e.target.closest("button");
          if (!t) return;
          if (t.hasAttribute("data-allread")) {
            L.store.set(
              st =>
                st.notifications.forEach(n => {
                  n.read = true;
                }),
              "notif-read-all",
            );
            L.live && L.live.readAllNotifications().catch(() => undefined);
            paint(body);
            L.toast("All marked as read");
            const first = body.querySelector(".home-nt-i");
            first && first.focus();
          } else if (t.dataset.n) {
            const n = s.notifications.find(x => x.id === t.dataset.n);
            if (!n) return;
            if (!n.read && L.live) L.live.readNotification(n.id).catch(() => undefined);
            L.store.set(() => {
              n.read = true;
            }, "notif-read");
            close(true);
            if (n.go) L.go(n.go);
          }
        });
        L.jobkit && L.jobkit.mo("stagger", L.$$(".home-nt-i", body));
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
  L.store.on(bellLabel);
  bellLabel();

  /* ---------- greeting by IST time ---------- */
  /* hour of the app clock in IST */
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

  /* ---------- ID check: one slim bar (C1), or a waiting card while it is under review ---------- */
  /* The check has three steps on #kyc: PAN, identity proof, payout. Live data carries kyc.steps; the sample derives it. */
  const KYC_TOTAL = 3;
  function kycDone(k) {
    const st = k.steps;
    if (st) return [st.pan, st.id, st.bank].filter(Boolean).length;
    const payout =
      k.payoutMethod === "bank" ? !!(k.bank && k.bank.acc && k.bank.ifsc && k.bank.holder) : !!k.upi;
    return [!!(k.pan && k.panName), !!k.idDone, payout].filter(Boolean).length;
  }
  /* time left on the ID review: the API's estimate when it sends one, otherwise our promise */
  // TODO(backend): automatic PAN check so most reviews finish within 2 hours; expose an ETA on GET /v1/kyc/
  // (for example "reviewEtaAt", the ISO time the review should be done), copied onto kyc.reviewEtaAt by live/creator.ts mapKyc.
  /* same words as #kyc and the profile (one helper, the app clock) */
  const reviewLeft = k => kycWaitText(k);
  function kycBar(k) {
    if (k.status === "verified") return "";
    if (k.status === "under_review")
      return `<section class="home-kyc-wait" aria-labelledby="homeKycH">
          <span class="home-kyc-ic" aria-hidden="true">${L.icon("clock")}</span>
          <div class="home-kyc-wait-t">
            <p class="home-kyc-wait-h" id="homeKycH">We're checking your ID · ${esc(reviewLeft(k))}</p>
            <p class="t-small muted">Meanwhile, keep browsing briefs. We'll tell you the moment it's done.</p>
          </div>
          <a class="lq lq-s lq-sm" href="#jobs">Browse briefs</a>
        </section>`;
    let tone = "",
      ic = "shield",
      main,
      rest,
      cta = "Continue",
      prog = "";
    if (k.status === "action_needed") {
      tone = " is-warn";
      ic = "alert";
      main = "One detail in your ID check needs fixing";
      rest = k.note || "Fix it to keep bidding.";
      cta = "Fix it";
    } else if (k.status === "rejected") {
      tone = " is-err";
      ic = "alert";
      main = "Your ID check was not approved";
      rest = k.note || "See what to change and try again.";
      cta = "See why";
    } else {
      const done = Math.min(kycDone(k), KYC_TOTAL),
        left = KYC_TOTAL - done;
      // progress only once something is done: a new creator never sees "0 of 3"
      if (done)
        prog = `<span class="home-kyc-prog"><span class="home-kyc-meter" aria-hidden="true">${Array.from({ length: KYC_TOTAL }, (_, i) => `<i${i < done ? ' class="is-done"' : ""}></i>`).join("")}</span>${done} of ${KYC_TOTAL} done</span>`;
      if (!left) {
        main = "Your ID check is ready to send";
        rest = "send it for review";
      } else {
        const mins = Math.max(1, Math.round((4 * left) / KYC_TOTAL));
        main = `${left} ${left === 1 ? "step" : "steps"} to your first payout`;
        rest = `about ${mins} ${mins === 1 ? "minute" : "minutes"}`;
      }
    }
    return `<section class="home-kyc-bar${tone}" aria-label="ID check">
        ${L.icon(ic)}
        <p class="home-kyc-bar-t" title="${esc(main + " · " + rest)}"><b>${esc(main)}</b><span> · ${esc(rest)}</span></p>
        ${prog}
        <p class="ll-trust">${L.icon("lock")}Encrypted. Never shown to brands.</p>
        <a class="lq lq-s lq-sm home-kyc-go" href="#kyc">${esc(cta)}${L.icon("arrow", "ic")}</a>
      </section>`;
  }

  /* ---------- the best moment: first deal confirmed, first payout ---------- */
  /* Shown on the visit after it happens, once per account and device (shared/ux firstTime). It stays for the rest of
     that visit until it is dismissed or its button is used. Only for a creator's real first: an account with more than
     one deal or payout never sees it, so turning this on doesn't congratulate old hands. */
  let cheerNow = null,
    cheerDone = false;
  const BID_WORD = {
    submitted: "Sent",
    viewed: "Viewed",
    accepted: "Accepted",
    rejected: "Not selected",
    withdrawn: "Withdrawn",
    completed: "Completed",
  };
  function cheerFor(s) {
    const u = storedUser();
    const uid = (u && u.id) || s.me.handle || "anon";
    /* first payout: the one deal approved and its money released */
    const paid = (s.ledger || []).filter(x => x.status === "paid");
    if (paid.length === 1) {
      const x = paid[0];
      return {
        key: `${uid}-first-payout`,
        ic: "coin",
        title: "Your first payout is in!",
        text: `${L.inr(x.amount)} from ${x.brand} was released to you.${s.payoutsEnabled === false ? " It's kept in your Linkloom balance until bank withdrawals open." : ""}`,
        cta: "See earnings",
        href: "#earnings",
      };
    }
    if (paid.length > 1) return null;
    /* first deal: one accepted bid or one hire (direct offers become deals without a bid) */
    const won = s.bids.filter(b => b.status === "accepted" || b.status === "completed");
    const deals = new Set([...s.active.map(a => a.job || "o:" + a.id), ...won.map(b => b.job)]);
    if (deals.size !== 1) return null;
    const a = s.active[0] || null,
      b = won[0] || null;
    if (a && (a.pay === "released" || a.stage === "approved")) return null; // already done: the payout moment covers it
    const j = b ? L.jobkit.job(b.job) : null;
    const brand = a ? a.brand : (j && j.brand) || (b && b.brand) || "The brand";
    const title = a ? a.title : (j && j.title) || (b && b.title) || "the brief";
    if (b && b.status === "accepted" && kycOwed())
      /* C10 trial: the bid went out before the ID check, so the deal waits on it */
      return {
        key: `${uid}-first-deal-kyc`,
        ic: "shield",
        title: "Your first deal is one step away",
        text: KYC_AFTER_ACCEPT,
        cta: "Verify ID",
        kyc: true,
      };
    return {
      key: `${uid}-first-deal`,
      ic: "check",
      title: "Your first deal is confirmed!",
      text: a
        ? `${brand} hired you for ${title}. The money is in escrow, so you can start.`
        : `${brand} picked your bid for ${title}. You can start once they pay into escrow.`,
      cta: a ? "Open the deal" : "See your bid",
      href: a ? "#work-" + a.id : "#bids",
    };
  }
  function bestMoment(s) {
    if (cheerDone) return null;
    if (cheerNow) return cheerNow;
    if (import.meta.env.VITE_TEST_HOOKS || !s.session.signedIn) return null; // never in the parity build or for guests
    const c = cheerFor(s);
    if (!c || !firstTime(c.key)) return null;
    return (cheerNow = c);
  }
  function cheerCard(c, btn) {
    return `<section class="ll-cheer home-cheer" aria-labelledby="homeCheerH">
        <span class="ll-cheer-ic" aria-hidden="true">${L.icon(c.ic)}</span>
        <p class="ll-cheer-t"><b id="homeCheerH">${esc(c.title)}</b><span>${esc(c.text)}</span></p>
        ${c.kyc ? `<button class="${btn}" type="button" data-cheer-go>${L.icon("shield")}${esc(c.cta)}</button>` : `<a class="${btn}" href="${esc(c.href)}" data-cheer-go>${esc(c.cta)}</a>`}
        <button class="ll-cheer-x" type="button" data-cheer-x aria-label="Dismiss">${L.icon("close")}</button>
      </section>`;
  }

  L.register("home", {
    title: "Home",
    nav: "home",
    render(el) {
      const K = L.jobkit,
        s = K.ensure(),
        now = L.today(); // the app clock, same one the top bar shows
      const first = s.me.name.split(/\s+/)[0];
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

      /* one primary button per screen: the first real ask on the page gets it, everything after is outlined */
      let primaryUsed = false;
      const prim = () => (primaryUsed ? "lq lq-s lq-sm" : ((primaryUsed = true), "lq lq-p lq-sm"));
      /* the best moment comes first and takes the one primary button and the one coloured block */
      const cheer = bestMoment(s);
      const cheerHtml = cheer ? cheerCard(cheer, prim().replace(" lq-sm", "")) : "";

      /* what needs you today: real objects from active work and money */
      const objs = [];
      s.active
        .filter(a => a.stage === "revision")
        .forEach(a => {
          const dl = K.daysTo(a.due),
            th = s.threads.find(t => t.id === a.thread);
          objs.push(`<li class="home-obj home-rev">
          <div class="home-obj-top"><span class="pill pill-warn">Revision requested</span><span class="home-due">${L.icon("clock")}Due ${esc(L.fmtDate(a.due))} · ${esc(K.daysTxt(dl))}</span></div>
          <p class="home-from"><span class="jobs-bi" aria-hidden="true">${esc(th ? th.bi : L.initials(a.brand))}</span>${esc(a.brand)} asked</p>
          <blockquote class="home-quote">“${esc(a.revision || "Please take another look.")}”</blockquote>
          <p class="home-job">${esc(a.title)}</p>
          <div class="home-obj-act"><a class="${prim()}" href="#work-${esc(a.id)}">Open the deal</a>${th ? `<a class="lq lq-s lq-sm" href="#chat-${esc(th.id)}">Reply</a>` : ""}</div>
        </li>`);
        });
      s.active
        .filter(a => a.stage === "review")
        .forEach(a => {
          const up = a.uploads && a.uploads[a.uploads.length - 1];
          objs.push(`<li class="home-obj home-review">
          <div class="home-obj-top"><span class="pill pill-info">In review</span>${up ? `<span class="home-due">Sent ${esc(L.ago(up.at))}</span>` : ""}</div>
          <p class="home-obj-t">${esc(a.brand)} is reviewing your final cut</p>
          <p class="home-job">${esc(a.title)}</p>
          <ol class="home-track" aria-label="Stage"><li class="is-done">Kickoff</li><li class="is-done">Upload</li><li class="is-now" aria-current="step">Review</li></ol>
          <div class="home-obj-act"><span class="pill pill-escrow">${L.icon("lock")}${L.inr(a.price)} in escrow</span><a class="lq lq-s lq-sm" href="#work-${esc(a.id)}">See status${L.icon("arrow", "ic")}</a></div>
        </li>`);
        });
      const pending = s.ledger.filter(x => x.status === "pending").reduce((n, x) => n + x.amount, 0);
      if (s.readyToWithdraw > 0) {
        objs.push(`<li class="home-obj home-money ${cheer ? "is-quiet" : "ink-card dark"}">
          <p class="home-money-l">Ready to withdraw</p>
          <p class="t-money home-money-v" data-ready>${L.inr(s.readyToWithdraw)}</p>
          <p class="home-money-s">Cleared funds only.${pending ? ` ${L.inr(pending)} still pending is not included.` : ""}</p>
          <div class="home-obj-act"><a class="${prim()}" href="#earnings">Withdraw</a><span class="home-money-to">to UPI or bank</span></div>
        </li>`);
      }

      /* the lede only says nothing needs you when that is true: no open work, no money waiting, ID check done */
      const myBids = [...s.bids].sort((a, b) => L.D(b.sent) - L.D(a.sent));
      /* deals still being made (not approved, not cancelled): "nothing needs you" would not be true then (C1) */
      const working = s.active.filter(a => a.stage !== "approved" && a.pay !== "released");
      const lede = objs.length
        ? `${WORDS[Math.min(objs.length, 5)]} ${objs.length === 1 ? "needs" : "need"} you today.`
        : cheer
          ? "Good news since your last visit."
          : working.length
            ? `${working.length === 1 ? "Your deal is" : `${working.length} deals are`} in progress. Find the next brief while you work.`
            : s.kyc.status === "verified"
              ? "Nothing needs you right now. A good day to find a new brief."
              : myBids.length
                ? "Here are the briefs that fit you best."
                : "Find a brief that fits you and send your first bid.";

      /* Your bids: the latest three that are still in play */
      const bidRow = b => {
        const j = K.job(b.job);
        const brand = j ? j.brand : b.brand || "Brand",
          title = j ? j.title : b.title || "Brief";
        const act = b.status === "accepted" ? s.active.find(a => a.job === b.job) : null;
        return `<li><a class="home-bid" href="${act ? "#work-" + esc(act.id) : "#bids"}">
            <span class="jobs-bi" aria-hidden="true">${esc(j ? j.bi : L.initials(brand))}</span>
            <span class="home-bid-t"><span class="home-bid-n">${esc(title)}</span><span class="home-bid-s">${esc(brand)} · sent ${esc(L.fmtDate(b.sent))}</span></span>
            <span class="home-bid-p">${L.inr(b.price)}</span>
            ${b.status === "viewed" && b.shortlisted ? `<span class="pill pill-info">${L.icon("flag")}Shortlisted</span>` : K.pill(b.status, BID_WORD[b.status] || "")}
          </a></li>`;
      };
      const shownBids = myBids.filter(b => b.status !== "withdrawn").slice(0, 3);
      const bidsBody = shownBids.length
        ? `<ul class="home-bids-list">${shownBids.map(bidRow).join("")}</ul>`
        : `<p class="home-bids-none">${myBids.length ? "No bids in play right now. Your earlier bids are in My bids." : "No bids yet. Pick a brief above and send your first bid. It takes about a minute."}</p>`;

      el.innerHTML = `<div class="view-in home${cheer ? " has-cheer" : ""}">
        <header class="home-hi">
          <h1 class="home-greet">${esc(greeting(now))}, ${esc(first)}.</h1>
          <p class="home-lede">${lede} <span class="sample">Sample data</span></p>
        </header>

        ${cheerHtml}
        ${cheer && cheer.kyc ? "" : kycBar(s.kyc)}

        <div class="ll-stack home-stack">
          ${
            objs.length
              ? `<section class="home-today" aria-labelledby="homeTodayH">
            <h2 class="sr-only" id="homeTodayH">What needs you today</h2>
            <ul class="home-strip">${objs.join("")}</ul>
          </section>`
              : ""
          }

          <section class="ll-panel home-panel home-match" aria-labelledby="homeMatchH">
            <div class="ll-panel-head">
              <div><h2 class="ll-panel-h" id="homeMatchH">Briefs for you</h2>
              <p class="ll-panel-sub">Ranked on platform, niche, language, city, budget and deadline.</p></div>
              <a class="ll-panel-more" href="#jobs" aria-label="See all briefs">See all →</a>
            </div>
            <p class="home-hint help">${L.icon("info")}Swipe a brief right to save it, left to hide it. The buttons do the same.</p>
            <div class="home-match-grid" id="homeGrid"></div>
            <p class="home-hidden" aria-live="polite"></p>
          </section>

          <section class="ll-panel home-panel home-bids" aria-labelledby="homeBidsH">
            <div class="ll-panel-head">
              <h2 class="ll-panel-h" id="homeBidsH">Your bids</h2>
              ${myBids.length ? '<a class="ll-panel-more" href="#bids" aria-label="See all your bids">See all →</a>' : ""}
            </div>
            ${bidsBody}
          </section>
        </div>
      </div>`;
      L.liquid(el);

      const ch = el.querySelector(".home-cheer");
      if (ch) {
        ch.querySelector("[data-cheer-x]").addEventListener("click", () => {
          cheerDone = true;
          ch.remove();
          el.firstElementChild.classList.remove("has-cheer");
          /* the money slip may be the one ink block again */
          const money = el.querySelector(".home-money.is-quiet");
          if (money) (money.classList.replace("is-quiet", "ink-card"), money.classList.add("dark"));
          const h = el.querySelector(".home-greet");
          h.setAttribute("tabindex", "-1");
          h.focus({ preventScroll: true });
        });
        ch.querySelector("[data-cheer-go]").addEventListener("click", e => {
          cheerDone = true;
          if (cheer.kyc) {
            e.preventDefault();
            openKyc("#bids");
          }
        });
      }

      const grid = el.querySelector("#homeGrid");
      const lead = !primaryUsed; // nothing above needs you, so the top brief's Bid is the one primary button
      let wired = null;
      function picks() {
        return K.openJobs()
          .filter(j => !K.isHidden(j.id) && !K.openBid(j.id))
          .sort((a, b) => b.match - a.match);
      }
      function paint() {
        const all = picks();
        // the big card is only for a real best fit (C5); otherwise four equal cards
        const feat = all.length && all[0].match >= BEST_FIT_MIN ? all[0] : null;
        const rest = all.slice(feat ? 1 : 0, feat ? 3 : 4);
        if (wired) {
          wired.cleanup();
          grid.classList.add("is-settled");
        } // match rings fill once per visit, not on every repaint
        const anyOpen = K.openJobs().length > 0;
        grid.innerHTML =
          feat || rest.length
            ? `${feat ? `<div class="home-feat">${briefCard(feat, { variant: "feature", ctx: "home", primary: lead })}</div>` : ""}
          <div class="home-more">${rest.map((j, i) => briefCard(j, { ctx: "home", primary: lead && !feat && i === 0 })).join("")}</div>`
            : `<div class="empty home-empty"><img src="assets/step-04-orbit.svg" width="160" height="117" alt=""><p class="t-h2">No new matches right now.</p><p class="muted">${anyOpen ? "You have bid on or hidden every brief that fits. New ones arrive most days." : "New briefs arrive most days. The ones that fit you will show up here."}</p>${anyOpen ? `<a class="lq ${lead ? "lq-p" : "lq-s"}" href="#jobs">See all briefs</a>` : ""}</div>`;
        L.liquid(grid);
        wired = K.wire(grid, { onHide: id => hidden(id) });
      }
      function hidden(id) {
        const j = K.job(id);
        K.flip(
          () => paint(),
          () => L.$$(".jobs-card", grid),
        );
        el.querySelector(".home-hidden").innerHTML =
          `Hidden “${esc(j.title)}”. <button class="btn-q" type="button" data-unhide="${esc(id)}">Undo</button>`;
      }
      el.firstElementChild.addEventListener("click", e => {
        // on this render's root, not the shared #view outlet
        const t = e.target.closest("[data-unhide]");
        if (!t) return;
        K.setHidden(t.dataset.unhide, false);
        K.flip(
          () => paint(),
          () => L.$$(".jobs-card", grid),
        );
        el.querySelector(".home-hidden").textContent = "Back in your matches.";
      });
      grid.addEventListener("keydown", e => {
        const c = e.target.closest(".jobs-card");
        if (!c || e.altKey || e.ctrlKey || e.metaKey || e.target.matches("input,textarea")) return;
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          K.toggleSave(c.dataset.id, grid);
        }
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          K.setHidden(c.dataset.id, true);
          hidden(c.dataset.id);
        }
      });
      paint();

      const ready = el.querySelector("[data-ready]");
      if (ready) K.mo("count", ready, s.readyToWithdraw, L.inr);
      K.mo("stagger", L.$$(".home-obj", el));
      K.mo("stagger", L.$$(".jobs-card", grid));
      L.$$(".home-obj", el).forEach(o => K.mo("press", o));
      return () => {
        wired && wired.cleanup();
      };
    },
  });
})();
