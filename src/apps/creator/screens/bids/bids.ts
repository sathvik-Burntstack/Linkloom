// @ts-nocheck
/* My Bids (#bids): bid slips in three tabs, each slip with its own progress rail.
   Tabs (C8): Active (sent, viewed, shortlisted), Won (accepted), Closed (not selected, withdrawn, completed). A tab
   with nothing in it is hidden, except Active. The Filter menu narrows to one exact status.
   Statuses: submitted, viewed (+ shortlisted, a flag from the live layer), accepted, rejected, withdrawn (shows who),
   completed (feedback). Owner: Builder B.
   TODO(backend): record brand view/shortlist/decline on bids and send a notification the same day. */
import { KYC_AFTER_ACCEPT, kycOwed, openKyc } from "../../core/kyc-gate";

(() => {
  const L = window.LLD,
    esc = L.esc;
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
  function rail(b) {
    const steps = ["Sent", b.shortlisted ? "Shortlisted" : "Viewed", "Accepted", "Completed"];
    const at = { submitted: 0, viewed: 1, accepted: 2, completed: 3 }[b.status];
    if (at !== undefined) {
      return `<ol class="bids-rail" aria-label="Progress">${steps.map((t, i) => `<li class="${i < at ? "is-done" : i === at ? "is-now" : "is-next"}"${i === at ? ' aria-current="step"' : ""}><span>${t}</span></li>`).join("")}</ol>`;
    }
    const by = b.by || "you";
    const end =
      b.status === "rejected"
        ? "Not selected"
        : by === "you"
          ? "Withdrawn by you"
          : `Cancelled by ${WHO[by] || by}`;
    const reached = b.status === "rejected" ? ["Sent", "Viewed"] : ["Sent"];
    return `<ol class="bids-rail is-${b.status}" aria-label="Progress">${reached.map(t => `<li class="is-done"><span>${t}</span></li>`).join("")}<li class="is-end" aria-current="step"><span>${esc(end)}</span></li></ol>`;
  }

  L.register("bids", {
    title: "My bids",
    nav: "bids",
    render(el) {
      const K = L.jobkit,
        s = K.ensure();
      s.bidsUI = s.bidsUI || { status: "" };
      const ui = s.bidsUI;
      /* ui.status is the exact status from the Filter menu (a KINDS value); ui.tab the tab it sits in */
      if (ui.status && !KINDS.includes(ui.status)) ui.status = "";
      if (!TABS.some(t => t.key === ui.tab)) ui.tab = ui.status ? tabOf(ui.status).key : "active";

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
        const actions = [];
        if (b.status === "submitted" || b.status === "viewed") {
          actions.push(
            `<button class="lq lq-s lq-sm" type="button" data-withdraw="${esc(b.id)}">Withdraw bid</button>`,
          );
          if (m.job) actions.push(`<a class="btn-q" href="#job-${esc(m.job.id)}">View brief</a>`);
        } else if (owed) {
          actions.push(
            `<button class="lq lq-p lq-sm" type="button" data-verify>${L.icon("shield")}Verify ID</button>`,
          );
          if (thread)
            actions.push(
              `<a class="btn-q" href="#chat-${esc(thread.id)}">${L.icon("chat")}Message ${esc(m.brand)}</a>`,
            );
        } else if (b.status === "accepted") {
          actions.push(
            `<a class="lq lq-p lq-sm" href="${act ? "#work-" + esc(act.id) : "#active"}">Open your deal</a>`,
          );
          if (thread)
            actions.push(
              `<a class="btn-q" href="#chat-${esc(thread.id)}">${L.icon("chat")}Message ${esc(m.brand)}</a>`,
            );
        } else if (b.status === "completed") {
          if (b.feedback)
            actions.push(
              `<p class="bids-fb">${L.icon("check")}You rated ${esc(m.brand)} ${b.feedback.rating}/5</p>`,
            );
          else
            actions.push(
              `<button class="lq lq-p lq-sm" type="button" data-feedback="${esc(b.id)}">Leave feedback</button>`,
            );
          actions.push(`<a class="btn-q" href="#earnings">See payout</a>`);
        } else if (b.status === "rejected") {
          actions.push(
            `<button class="btn-q" type="button" data-similar="${esc(m.job ? m.job.category : "")}">Find similar briefs${L.icon("arrow")}</button>`,
          );
        } else if (b.status === "withdrawn" && m.job) {
          actions.push(`<a class="btn-q" href="#job-${esc(m.job.id)}">Open brief to bid again</a>`);
        }
        return `<article class="bids-slip is-${b.status}" data-id="${esc(b.id)}" data-status="${b.status}" aria-labelledby="bt-${esc(b.id)}">
          <div class="bids-stub">
            <p class="bids-stub-l">Your bid</p>
            <p class="bids-price t-money">${L.inr(b.price)}</p>
            <p class="bids-stub-d">Sent ${esc(L.fmtDate(b.sent))}</p>
          </div>
          <div class="bids-body">
            <div class="bids-top">
              <span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(m.bi)}</span><span class="jobs-bn">${esc(m.brand)}</span></span>
              ${b.shortlisted && b.status === "viewed" ? `<span class="pill pill-info">${L.icon("flag")}Shortlisted</span>` : K.pill(b.status, b.status === "withdrawn" ? (by === "you" ? "Withdrawn by you" : "Cancelled") : b.status === "rejected" ? "Not selected" : "")}
            </div>
            <h3 class="bids-t" id="bt-${esc(b.id)}">${esc(m.title)}</h3>
            <p class="bids-sub">${K.glyph(m.platform)}<span>${esc(K.platName(m.platform))} ${esc(m.format)}${b.postDate ? ` · post date ${esc(L.fmtDate(b.postDate))}` : ""}</span></p>
            ${rail(b)}
            <p class="bids-note">${esc(note)}</p>
            <div class="bids-acts">${actions.join("")}</div>
          </div>
        </article>`;
      }

      const counts = () =>
        KINDS.reduce((o, k) => ((o[k] = s.bids.filter(b => kindOf(b) === k).length), o), {});
      const tabCount = (t, c = counts()) => t.kinds.reduce((n, k) => n + c[k], 0);
      /* Active always shows; Won and Closed only once they have something in them */
      const shownTabs = (c = counts()) => TABS.filter(t => t.key === "active" || tabCount(t, c) > 0);

      function summary() {
        const c = counts();
        const parts = [
          [tabCount(TABS[0], c), "waiting on brands"],
          [tabCount(TABS[1], c), "won"],
          [tabCount(TABS[2], c), "closed"],
        ].filter(([n]) => n > 0);
        return parts.length ? parts.map(([n, t]) => `${n} ${t}`).join(" · ") : "Bids you send show up here.";
      }

      function board() {
        if (!s.bids.length) {
          return `<div class="empty bids-empty"><img src="assets/step-02-plane.svg" width="72" height="72" alt="">
            <p class="t-h2">No bids yet.</p><p class="muted">Find a brief that fits and send your first bid. It takes about a minute.</p>
            <a class="lq lq-p" href="#jobs">Find briefs</a></div>`;
        }
        const tab = TABS.find(t => t.key === ui.tab) || TABS[0];
        const list = s.bids
          .filter(b => (ui.status ? kindOf(b) === ui.status : tab.kinds.includes(kindOf(b))))
          .sort((a, b) => L.D(b.sent) - L.D(a.sent));
        if (!list.length) {
          return ui.status
            ? `<div class="empty bids-empty"><p class="t-h2">No ${esc(LABEL[ui.status].toLowerCase())} bids.</p><button class="lq lq-s" type="button" data-kind="">Show every ${esc(tab.title.toLowerCase())} bid</button></div>`
            : `<div class="empty bids-empty"><img src="assets/step-02-plane.svg" width="72" height="72" alt="">
            <p class="t-h2">No bids waiting on brands.</p><p class="muted">Your other bids are under ${shownTabs()
              .filter(t => t.key !== "active")
              .map(t => esc(t.title))
              .join(" and ")}. Find a brief that fits and send a new one.</p>
            <a class="lq lq-p" href="#jobs">Find briefs</a></div>`;
        }
        return `<div class="bids-list">${list.map(slip).join("")}</div>`;
      }

      function tabs() {
        const c = counts();
        return shownTabs(c)
          .map(
            t =>
              `<button class="chip bids-tab" type="button" role="tab" id="bids-tab-${t.key}" data-tab="${t.key}" aria-selected="${ui.tab === t.key}" aria-controls="bidsBoard" tabindex="${ui.tab === t.key ? 0 : -1}">${esc(t.title)} <span class="bids-cn">${tabCount(t, c)}</span></button>`,
          )
          .join("");
      }

      function filter() {
        const c = counts();
        return `<label class="bids-fl" for="bidsKind">Filter</label>
          <select class="select bids-kind" id="bidsKind" data-kindsel>
            <option value="" ${ui.status ? "" : "selected"}>Any status</option>
            ${KINDS.map(k => `<option value="${k}" ${ui.status === k ? "selected" : ""} ${c[k] ? "" : "disabled"}>${esc(LABEL[k])} · ${c[k]}</option>`).join("")}
          </select>`;
      }

      if (s.justSent) {
        ui.tab = "active"; // a bid just sent is waiting on the brand: open where it is
        ui.status = "";
      }
      if (!shownTabs().some(t => t.key === ui.tab)) ui.tab = "active";

      el.innerHTML = `<div class="view-in bids">
        <header class="bids-head">
          <div class="bids-head-t"><h1 class="t-h1">My bids</h1><p class="muted" id="bidsSum">${esc(summary())} <span class="sample">Sample data</span></p></div>
          <a class="lq lq-s" href="#jobs">${L.icon("search")}Find more briefs</a>
        </header>
        ${
          s.bids.length
            ? `<div class="bids-bar">
          <div class="chips bids-tabs" role="tablist" aria-label="Bids by stage">${tabs()}</div>
          <div class="bids-filter">${filter()}</div>
        </div>`
            : ""
        }
        <p class="sr-only" id="bidsLive" aria-live="polite"></p>
        <div class="bids-board" id="bidsBoard" ${s.bids.length ? `role="tabpanel" aria-labelledby="bids-tab-${ui.tab}"` : ""}>${board()}</div>
      </div>`;
      L.liquid(el);

      const $ = q => el.querySelector(q);
      /* keepFilter: the Filter menu itself changed, so it is left alone (re-rendering it would drop its focus) */
      const refresh = (animate = true, msg, keepFilter = false) => {
        const nodes = () => L.$$(".bids-slip", el); // live list: slips are re-rendered, matched by data-id
        const mutate = () => {
          if (!shownTabs().some(t => t.key === ui.tab)) ui.tab = "active";
          $("#bidsBoard").innerHTML = board();
          $("#bidsBoard").setAttribute("aria-labelledby", "bids-tab-" + ui.tab);
          if ($(".bids-tabs")) $(".bids-tabs").innerHTML = tabs();
          if ($(".bids-filter") && !keepFilter) $(".bids-filter").innerHTML = filter();
          $("#bidsSum").innerHTML = `${esc(summary())} <span class="sample">Sample data</span>`;
          L.liquid($("#bidsBoard"));
        };
        animate ? K.flip(mutate, nodes) : mutate();
        if (msg) $("#bidsLive").textContent = msg;
      };
      const pickTab = (key, focus) => {
        ui.tab = key;
        ui.status = "";
        const t = TABS.find(x => x.key === key);
        refresh(true, `Showing ${t.title.toLowerCase()} bids`);
        const same = el.querySelector(`.bids-tabs [data-tab="${key}"]`);
        if (same && focus) {
          same.focus();
          K.settle && K.settle(same);
        }
      };

      el.firstElementChild.addEventListener("change", e => {
        if (!e.target.matches("[data-kindsel]")) return;
        const k = e.target.value;
        ui.status = k;
        if (k) ui.tab = tabOf(k).key;
        refresh(true, k ? `Showing ${LABEL[k].toLowerCase()} bids` : "Showing every status", true);
      });
      el.firstElementChild.addEventListener("keydown", e => {
        const t = e.target.closest && e.target.closest("[data-tab]");
        if (!t || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        const all = L.$$(".bids-tabs [data-tab]", el);
        const i = all.indexOf(t);
        const n =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? all.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
        e.preventDefault();
        pickTab(all[n].dataset.tab, true);
      });

      el.firstElementChild.addEventListener("click", e => {
        // on this render's root, not the shared #view outlet
        const t = e.target.closest("button");
        if (!t || !el.contains(t)) return;
        if (t.dataset.tab) pickTab(t.dataset.tab, true);
        else if (t.dataset.kind !== undefined) {
          ui.status = "";
          refresh(true, "Showing every status");
          const sel = el.querySelector("[data-kindsel]");
          sel && sel.focus();
        } else if (t.hasAttribute("data-verify")) openKyc("#bids");
        else if (t.dataset.withdraw) withdraw(t.dataset.withdraw);
        else if (t.dataset.feedback) feedback(t.dataset.feedback);
        else if (t.dataset.similar !== undefined) {
          Object.assign(s.jobsUI, {
            q: "",
            city: "",
            platform: "",
            minBudget: 0,
            savedOnly: false,
            category: t.dataset.similar,
          });
          K.persistUI();
          L.go("#jobs");
        }
      });

      function withdraw(bid) {
        const b = s.bids.find(x => x.id === bid);
        if (!b) return;
        const m = info(b);
        L.openSheet({
          title: "Withdraw this bid?",
          body: `<div class="stack bids-sheet">
            <div class="bids-mini"><span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(m.bi)}</span><span class="jobs-bn">${esc(m.brand)}</span></span><p class="t-money bids-mini-p">${L.inr(b.price)}</p><p class="t-small muted">${esc(m.title)}</p></div>
            <ul class="bids-conseq">
              <li>${esc(m.brand)} sees it as withdrawn by you.</li>
              <li>You can bid again while the brief is open.</li>
              <li>Nothing is charged. No money has moved yet.</li>
            </ul>
            <div class="row wrap"><button class="lq lq-p" type="button" data-yes>Withdraw bid</button><button class="lq lq-s" type="button" data-no>Keep my bid</button></div>
          </div>`,
          onMount(body, close) {
            body.querySelector("[data-no]").addEventListener("click", () => close());
            body.querySelector("[data-yes]").addEventListener("click", async e => {
              if (L.live) {
                const yes = e.currentTarget;
                yes.disabled = true;
                try {
                  await L.live.withdrawBid(b);
                } catch (er) {
                  yes.disabled = false;
                  L.toast(L.live.errorText(er), "alert");
                  return;
                }
              }
              L.store.set(st => {
                const x = st.bids.find(y => y.id === bid);
                x.status = "withdrawn";
                x.by = "you";
                x.at = L.today().toISOString();
                x.note = "You withdrew this bid.";
                const jj = st.jobs.find(y => y.id === x.job);
                if (jj && jj.bids > 0) jj.bids -= 1; // live count leaves out withdrawn bids
              }, "bid-withdrawn");
              close();
              refresh(true, `Bid to ${m.brand} withdrawn`);
              L.toast("Bid withdrawn", "check");
            });
          },
        });
      }

      function feedback(bid) {
        const b = s.bids.find(x => x.id === bid);
        if (!b) return;
        const m = info(b);
        const labels = ["Poor", "Fair", "Good", "Very good", "Great"];
        L.openSheet({
          title: "Feedback for " + m.brand,
          body: `<form class="stack bids-fbform" novalidate>
            <p class="muted">${esc(m.title)} is approved and closed. Tell other creators what working with ${esc(m.brand)} was like.</p>
            <fieldset class="bids-rate"><legend class="t-label">How was working with them?</legend>
              <div class="bids-stars">${labels.map((t, i) => `<label class="bids-star"><input type="radio" name="rate" value="${i + 1}"><span class="t-money">${i + 1}</span><small>${t}</small></label>`).join("")}</div>
            </fieldset>
            <div class="field"><label for="bidsFbTx">What went well, or what could be better? (optional)</label>
              <textarea class="textarea" id="bidsFbTx" maxlength="300" placeholder="Clear brief, quick approvals, paid on time…"></textarea>
              <p class="help num" id="bidsFbN">0 / 300</p></div>
            <p class="err" id="bidsFbErr" aria-live="polite"></p>
            <div class="row wrap"><button class="lq lq-p" type="submit">Send feedback</button><button class="lq lq-s" type="button" data-no>Later</button></div>
          </form>`,
          onMount(body, close) {
            const f = body.querySelector("form"),
              tx = body.querySelector("#bidsFbTx");
            tx.addEventListener("input", () => {
              body.querySelector("#bidsFbN").textContent = `${tx.value.length} / 300`;
            });
            body.querySelector("[data-no]").addEventListener("click", () => close());
            f.addEventListener("submit", async e => {
              e.preventDefault();
              const r = f.querySelector("input[name=rate]:checked");
              if (!r) {
                body.querySelector("#bidsFbErr").textContent = "Pick a rating from 1 to 5.";
                f.querySelector("input[name=rate]").focus();
                return;
              }
              if (L.live) {
                const bb = s.bids.find(y => y.id === bid);
                const order = bb && s.active.find(a => a.job === bb.job);
                if (order) {
                  const go = f.querySelector("[type=submit]");
                  go.disabled = true;
                  try {
                    await L.live.reviewOrder(order.id, +r.value, tx.value.trim());
                  } catch (er) {
                    go.disabled = false;
                    body.querySelector("#bidsFbErr").textContent = L.live.errorText(er);
                    return;
                  }
                }
              }
              L.store.set(st => {
                st.bids.find(y => y.id === bid).feedback = {
                  rating: +r.value,
                  text: tx.value.trim(),
                  at: L.today().toISOString(),
                };
              }, "bid-feedback");
              close();
              refresh(false, `Feedback sent to ${m.brand}`);
              L.toast("Feedback sent", "check");
            });
          },
        });
      }

      K.mo("stagger", L.$$(".bids-slip", el));
      // a bid that was just sent: bring it into view and mark the moment once
      if (s.justSent) {
        const id = s.justSent;
        s.justSent = null;
        const n = el.querySelector(`.bids-slip[data-id="${id}"]`);
        if (n) {
          n.classList.add("is-new");
          const b = s.bids.find(x => x.id === id),
            m = b && info(b);
          $("#bidsLive").textContent = m ? `Bid sent to ${m.brand}` : "Bid sent";
          L.toast(m ? `Bid sent to ${m.brand}` : "Bid sent", "send");
          requestAnimationFrame(() => {
            n.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
            K.mo("celebrate", n);
          });
        }
      }
    },
  });
})();
