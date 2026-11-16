// @ts-nocheck
/* Brand side · Post or edit a brief (#post, #post-<id>). Builder C.
   Five steps, each its own section panel (B3): the brief (title, then the brief text, B5), platform and format, budget
   and date, who can bid, deliverables. A "Step 2 of 5" line on top follows the scroll and jumps to a step on click.
   One Publish button, in a sticky bar at the bottom of the form that also shows the budget (B4). Nothing is preset
   (B6): no category, any city, no languages, no minimum followers.
   Drafts save themselves every few seconds and when the brand leaves (B4); there is no draft endpoint, so a draft lives
   in LLD_DATA.jobs (status "draft") and session.ts keeps it on this device. Publish checks everything.
   The working copy lives in LLD_DATA.ui.post[<id>|new]. */
import { USAGE_OPTIONS } from "@/shared/live";

(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
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
  /* the API's usage rights choices (shared/live.ts): each label is one usage object the API accepts */
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

  L.register("post", {
    title: id => (id ? "Edit brief" : "Post a brief"),
    crumb: id => {
      const j = id && L.bk.job(id);
      return `<a href="#jobs">Briefs</a> / ${j ? esc(j.title || "Untitled brief") + " / Edit" : "Post a brief"}`;
    },
    nav: "jobs",
    render(el, id) {
      const K = L.bk,
        u = K.ui("post"),
        j = id ? K.job(id) : null;
      if (id && !j) {
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
          <p class="t-h2">This brief is gone.</p><p class="muted">It may have been deleted. Your other briefs are safe.</p><a class="lq lq-p" href="#jobs">See all briefs</a></div></div>`;
        return;
      }
      if (j && (j.status === "hired" || j.status === "closed")) {
        const c = K.campOfJob(j.id);
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-05-stamp.svg" width="160" height="117" alt="">
          <p class="t-h2">${j.status === "hired" ? "You hired on this brief, so it is locked." : "This brief is closed, so it can’t be edited."}</p>
          <p class="muted">${j.status === "hired" ? "The creator bid on this brief. Change details with them in the deal chat." : "Post a new brief if you need another creator."}</p>
          <div class="row wrap pj-locked-cta">${c ? `<a class="lq lq-p" href="#campaign-${esc(c.id)}">Open deal</a>` : '<a class="lq lq-p" href="#post">Post a new brief</a>'}<a class="lq lq-s" href="#job-${esc(j.id)}">View brief</a></div></div></div>`;
        L.liquid(el);
        return;
      }
      const key = id || "new";
      const d = u[key] || (u[key] = j ? fromJob(j) : blank());
      const today = K.todayISO(),
        minDate = K.addDays(today, 1),
        maxDate = K.addDays(today, 365);
      const isOpen = j && j.status === "open",
        isDraft = !j || j.status === "draft";
      const touched = new Set();
      let tried = false;
      const cityOpts = !d.city || CITIES.includes(d.city) ? CITIES : [d.city, ...CITIES];
      const sec = (i, body, extra = "") =>
        `<section class="ll-panel pj-sec" id="pjSec${i}" data-step="${i}" tabindex="-1" aria-labelledby="pjS${i}"${extra}>
              <div class="pj-sec-head"><h2 class="ll-panel-h" id="pjS${i}">${STEPS[i][0]}</h2><p class="ll-panel-sub">${STEPS[i][1]}</p></div>
              ${body}
            </section>`;

      el.innerHTML = `<div class="view-in pj">
        <a class="btn-q pj-back" href="${j ? "#job-" + esc(j.id) : "#jobs"}">${ic("back")}${j ? "Back to the brief" : "All briefs"}</a>
        <header class="pj-h">
          <h1 class="t-h1">${j ? (isOpen ? "Edit brief" : "Finish your draft") : "Post a brief"}</h1>
          <p class="muted t-small">${isOpen ? `Live since ${esc(L.fmtDate(j.posted))} · ${j.bids} bids so far. Creators who bid see the changes.` : "Creators who fit bid with a price, a date and their reasons. You pick, then pay into escrow."}</p>
        </header>
        <div class="pj-layout">
          <div class="pj-main">
          <form class="pj-form" id="pjForm" novalidate>
            <nav class="ll-steps pj-steps" aria-label="Steps of the brief">
              <p class="ll-steps-t" id="pjStepT">Step 1 of ${STEPS.length} · ${STEPS[0][0]}</p>
              <ol class="pj-steps-l">${STEPS.map(
                (s, i) =>
                  `<li><button type="button" class="pj-st" data-goto="${i}" aria-controls="pjSec${i}"><span class="pj-st-bar" aria-hidden="true"></span><span class="pj-st-t">${s[0]}</span></button></li>`,
              ).join("")}</ol>
            </nav>

            ${sec(
              0,
              `<div class="field" id="fTitle">
                  <label for="pjTitle">Brief title</label>
                  <input class="input" id="pjTitle" maxlength="${R.titleMax}" autocomplete="off" placeholder="For example: Barrier Repair Serum launch" value="${esc(d.title)}" aria-describedby="pjTitleErr">
                  <p class="err" id="pjTitleErr"></p>
                </div>
                <div class="field" id="fBrief">
                  <div class="pj-why-h"><label id="pjBriefL" for="pjBrief">The brief</label><span class="t-note pj-note" aria-hidden="true">creators read this first</span></div>
                  <textarea class="textarea" id="pjBrief" maxlength="${R.briefMax}" rows="5" aria-describedby="pjBriefHelp pjBriefN pjBriefErr" placeholder="What the product is, the one thing to say, the feel you want, and anything to avoid. For example: show a real morning routine, no filters.">${esc(d.brief)}</textarea>
                  <div class="pj-why-f"><p class="help" id="pjBriefHelp">At least ${R.briefMin} characters.</p><p class="pj-count num" id="pjBriefN"></p></div>
                  <p class="err" id="pjBriefErr"></p>
                </div>`,
            )}

            ${sec(
              1,
              `<div class="pj-pair">
                  <div class="field"><p class="lab" id="pjPlatL">Platform</p>
                    <div class="seg pj-seg" role="group" aria-labelledby="pjPlatL">${["instagram", "youtube"].map(p => `<button type="button" data-plat="${p}" aria-pressed="${d.platform === p}">${K.glyph(p)}${K.plat(p)}</button>`).join("")}</div></div>
                  <div class="field" id="fCat"><label for="pjCat">Category</label>
                    <select class="select${d.category ? "" : " is-ph"}" id="pjCat" aria-describedby="pjCatErr"><option value=""${d.category ? "" : " selected"} disabled>Choose a category</option>${CATS.map(c => `<option${c === d.category ? " selected" : ""}>${c}</option>`).join("")}</select>
                    <p class="err" id="pjCatErr"></p></div>
                </div>
                <div class="field" id="fFormat"><p class="lab" id="pjFmtL">Format</p>
                  <div class="chips" role="group" aria-labelledby="pjFmtL" id="pjFormats"></div>
                  <p class="err" id="pjFormatErr"></p></div>`,
            )}

            ${sec(
              2,
              `<div class="field" id="fBudget">
                  <label id="pjBudgetL" for="pjBudget">Budget</label>
                  <div class="money-in pj-money">
                    <span aria-hidden="true">₹</span>
                    <input id="pjBudget" type="text" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="15,000" value="${esc(group(d.budget))}" aria-describedby="pjBudgetHelp pjBudgetErr">
                    <button class="pj-step" type="button" data-step="-500" aria-label="Lower by ₹500">${ic("minus")}</button>
                    <button class="pj-step" type="button" data-step="500" aria-label="Raise by ₹500">${ic("plus")}</button>
                  </div>
                  <p class="help" id="pjBudgetHelp">What you expect to pay one creator. Creators may bid a little above or below. You pay the agreed price into escrow when you hire. No platform fee.</p>
                  <p class="err" id="pjBudgetErr"></p>
                </div>
                <div class="field pj-date" id="fDeadline">
                  <label for="pjDeadline">Live by</label>
                  <input class="input" id="pjDeadline" type="date" min="${minDate}" max="${maxDate}" value="${esc(d.deadline)}" aria-describedby="pjDeadlineHelp pjDeadlineErr">
                  <p class="help" id="pjDeadlineHelp">The last day the post can go live.</p>
                  <p class="err" id="pjDeadlineErr"></p>
                </div>`,
            )}

            ${sec(
              3,
              `<div class="pj-pair">
                  <div class="field"><p class="lab" id="pjWhereL">Where they shoot</p>
                    <div class="seg pj-seg" role="group" aria-labelledby="pjWhereL"><button type="button" data-remote="1" aria-pressed="${d.remote}">Any city</button><button type="button" data-remote="0" aria-pressed="${!d.remote}">${ic("pin")}In a city</button></div></div>
                  <div class="field" id="fCity" ${d.remote ? "hidden" : ""}><label for="pjCity">City</label>
                    <select class="select${d.city ? "" : " is-ph"}" id="pjCity" aria-describedby="pjCityErr"><option value=""${d.city ? "" : " selected"} disabled>Choose a city</option>${cityOpts.map(c => `<option${c === d.city ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
                    <p class="err" id="pjCityErr"></p></div>
                </div>
                <div class="field" id="fLangs"><p class="lab" id="pjLangL">Languages <span class="pj-opt">optional · leave empty for any language</span></p>
                  <div class="chips" role="group" aria-labelledby="pjLangL" id="pjLangs"></div>
                  <p class="err" id="pjLangsErr"></p></div>
                <div class="field pj-date"><label for="pjFollow">Minimum followers</label>
                  <select class="select" id="pjFollow">${FOLLOW.map(([v, t]) => `<option value="${v}"${v === +d.minFollowers ? " selected" : ""}>${t}</option>`).join("")}</select>
                  <p class="help">On the platform you picked.</p></div>`,
            )}

            ${sec(
              4,
              `<div class="field" id="fDels">
                  <p class="lab" id="pjDelL">Deliverables</p>
                  <ol class="pj-dels" id="pjDels" aria-labelledby="pjDelL"></ol>
                  <div class="pj-dels-f"><button class="lq lq-s lq-sm" type="button" data-adddel>${ic("plus", "ic")}Add a deliverable</button><span class="help">Up to ${R.maxDel}.</span></div>
                  <p class="err" id="pjDelsErr"></p>
                </div>
                <div class="field pj-date"><label for="pjUsage">Usage rights</label>
                  <select class="select" id="pjUsage">${USAGE.map(x => `<option${x === d.usage ? " selected" : ""}>${x}</option>`).join("")}</select>
                  <p class="help">What you may do with the content after it goes live.</p></div>`,
            )}

            <div class="pj-bar" role="region" aria-label="${isOpen ? "Save changes" : "Publish"}">
              <p class="pj-sum" id="pjSum" aria-live="polite"></p>
              <p class="pj-bar-t"><span>Budget</span><b class="t-money pj-bar-v" data-p="dock">₹ —</b></p>
              <p class="pj-saved" id="pjSaved" aria-live="polite">${isOpen ? "Creators see changes once you save." : j ? `${ic("check")}Draft saved` : "Drafts save as you go. Only you can see them."}</p>
              <div class="pj-bar-a">
                ${isOpen ? `<a class="lq lq-s" href="#job-${esc(j.id)}">Cancel</a>` : ""}
                <button class="lq lq-p" type="submit">${isOpen ? "Save changes" : "Publish brief"}</button>
              </div>
            </div>
          </form>
            ${
              j
                ? `<div class="pj-danger" role="group" aria-label="Close or delete">
              <div><p class="t-label">${isOpen ? "Done hiring, or changed your mind?" : "Not needed any more?"}</p><p class="help">${isOpen ? "Closing stops new bids and tells the creators who bid." : "Delete the draft. Creators never saw it."}</p></div>
              <div class="row wrap">${isOpen ? '<button class="lq lq-s lq-sm" type="button" data-closejob>Close brief</button>' : ""}<button class="lq lq-s lq-sm" type="button" data-deljob>${ic("trash")}${isOpen ? "Delete brief" : "Delete draft"}</button></div>
            </div>`
                : ""
            }
          </div>

          <aside class="pj-side" aria-label="Preview">
            <div class="pj-receipt ink-card">
              <p class="pj-rc-h">How creators see it</p>
              <p class="pj-pv-plat" data-p="plat"></p>
              <p class="pj-pv-t" data-p="title"></p>
              <p class="pj-rc-l">Budget</p>
              <p class="pj-rc-net"><span class="t-money" data-p="budget">₹ —</span></p>
              <dl class="pj-rows">
                <div><dt>Live by</dt><dd data-p="deadline">—</dd></div>
                <div><dt>Where</dt><dd data-p="where">—</dd></div>
                <div><dt>Deliverables</dt><dd data-p="dels">—</dd></div>
                <div><dt>Taxes</dt><dd>As per confirmed rules</dd></div>
              </dl>
              <p class="pj-rc-s">The creator you hire receives the agreed price in full. No platform fee.</p>
              <span class="pill pill-escrow">${ic("lock")}Paid into escrow when you hire</span>
            </div>
            <p class="help pj-side-note">${ic("info")}Your brand name and logo show on the brief. Your billing details never do.</p>
          </aside>
        </div>
        <p class="sr-only" id="pjLive" aria-live="polite"></p>
      </div>`;
      L.liquid(el);

      const $ = q => el.querySelector(q);
      const form = $("#pjForm"),
        titleIn = $("#pjTitle"),
        budgetIn = $("#pjBudget"),
        dlIn = $("#pjDeadline"),
        briefIn = $("#pjBrief"),
        catSel = $("#pjCat"),
        citySel = $("#pjCity"),
        delsOl = $("#pjDels");

      /* ---------- choice groups ---------- */
      function formats() {
        const list = FORMATS[d.platform];
        if (!list.includes(d.format)) d.format = list[0];
        $("#pjFormats").innerHTML = list
          .map(
            f =>
              `<button class="chip" type="button" data-fmt="${f}" aria-pressed="${f === d.format}">${f}</button>`,
          )
          .join("");
      }
      function langs() {
        $("#pjLangs").innerHTML = LANGS.map(
          l =>
            `<button class="chip" type="button" data-lang="${l}" aria-pressed="${d.languages.includes(l)}">${d.languages.includes(l) ? ic("check") : ""}${l}</button>`,
        ).join("");
      }
      function dels(focus) {
        delsOl.innerHTML = d.deliverables
          .map(
            (v, i) => `<li class="pj-del" data-i="${i}">
          <span class="pj-del-n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
          <label class="sr-only" for="pjD${i}">Deliverable ${i + 1}</label>
          <input class="input" id="pjD${i}" maxlength="${R.delMax}" autocomplete="off" placeholder="${i === 0 ? "1 Reel, 30–45 s" : i === 1 ? "Product on screen in the first 3 s" : "One line"}" value="${esc(v)}">
          <button class="ibtn pj-del-x" type="button" data-rmdel="${i}" aria-label="Remove deliverable ${i + 1}" ${d.deliverables.length === 1 && !v ? "hidden" : ""}>${ic("close")}</button>
        </li>`,
          )
          .join("");
        const add = $("[data-adddel]");
        add.disabled = d.deliverables.length >= R.maxDel;
        if (focus !== undefined) {
          const i = delsOl.querySelector("#pjD" + focus);
          i && i.focus();
        }
      }

      /* ---------- validation ---------- */
      const readBudget = () => {
        const g = digits(budgetIn.value);
        return g ? L.rupees(Number(g)) : 0;
      };
      function check(publish) {
        const e = {};
        const t = titleIn.value.trim();
        if (!t)
          e.title = publish
            ? "Give the brief a title creators will understand."
            : "Give the draft a name so you can find it later.";
        else if (publish && t.length < R.titleMin)
          e.title = `Make the title a little longer, at least ${R.titleMin} characters.`;
        if (!publish) return e;
        const br = briefIn.value.trim();
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
        const dl = dlIn.value;
        if (!dl) e.deadline = "Pick the last day the post can go live.";
        else if (dl < minDate) e.deadline = `Pick ${L.fmtDate(minDate)} or later, so creators have time.`;
        else if (dl > maxDate) e.deadline = "Pick a date within the next year.";
        if (!d.remote && !d.city) e.city = "Choose the city, or pick Any city.";
        if (!d.deliverables.some(x => x.trim())) e.dels = "Add at least one deliverable.";
        return e;
      }
      function show(e) {
        const vis = k => tried || touched.has(k);
        const put = (fid, eid, k, inp) => {
          const m = vis(k) ? e[k] || "" : "";
          $(eid).textContent = m;
          $(fid).classList.toggle("is-err", !!m);
          inp && inp.setAttribute("aria-invalid", String(!!m));
        };
        put("#fTitle", "#pjTitleErr", "title", titleIn);
        put("#fBrief", "#pjBriefErr", "brief", briefIn);
        put("#fCat", "#pjCatErr", "cat", catSel);
        put("#fBudget", "#pjBudgetErr", "budget", budgetIn);
        put("#fDeadline", "#pjDeadlineErr", "deadline", dlIn);
        put("#fCity", "#pjCityErr", "city", citySel);
        put("#fLangs", "#pjLangsErr", "langs");
        put("#fDels", "#pjDelsErr", "dels");
        const dl = dlIn.value;
        $("#pjDeadlineHelp").textContent =
          dl && !e.deadline
            ? `${L.fmtDate(dl, { year: true })}, ${K.daysTo(dl)} days from today.`
            : "The last day the post can go live.";
        if (tried) summary(e);
      }
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
      function summary(e) {
        const keys = Object.keys(e);
        $("#pjSum").innerHTML = keys.length
          ? `${ic("alert")}<span>Fix ${keys.length === 1 ? "one thing" : keys.length + " things"} first: ${keys.map(k => esc(NAMES[k])).join(", ")}.</span>`
          : "";
        return keys;
      }
      const validate = () => show(check(true));

      /* ---------- steps (B3): which one is on screen, which are done, jump on click ---------- */
      const secs = L.$$(".pj-sec", el),
        stepLis = L.$$(".pj-steps-l > li", el);
      let cur = 0,
        furthest = 0;
      const poked = new Set();
      function stepsPaint() {
        const e = check(true);
        const valid = [!e.title && !e.brief, !e.cat, !e.budget && !e.deadline, !e.city && !e.langs, !e.dels];
        /* step 4 is valid untouched (any city, no minimum): it counts once the brand has been through it */
        const done = valid.map((v, i) => v && (i !== 3 || poked.has(3) || furthest > 3));
        stepLis.forEach((li, i) => {
          li.classList.toggle("is-done", done[i]);
          li.classList.toggle("is-now", i === cur);
          const b = li.firstElementChild;
          if (i === cur) b.setAttribute("aria-current", "step");
          else b.removeAttribute("aria-current");
          b.setAttribute(
            "aria-label",
            `Step ${i + 1} of ${STEPS.length}: ${STEPS[i][0]}${done[i] ? ", done" : ""}${i === cur ? ", current" : ""}`,
          );
        });
        const n = done.filter(Boolean).length;
        $("#pjStepT").textContent =
          `Step ${cur + 1} of ${STEPS.length} · ${STEPS[cur][0]}${n ? ` · ${n} of ${STEPS.length} done` : ""}`;
      }
      function setCur(i) {
        if (i === cur) return;
        cur = i;
        furthest = Math.max(furthest, i);
        stepsPaint();
      }
      let spyRaf = 0;
      function spy() {
        spyRaf = 0;
        const line = innerHeight * 0.4;
        let i = 0;
        secs.forEach((s, k) => {
          if (s.getBoundingClientRect().top <= line) i = k;
        });
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 8) i = secs.length - 1;
        setCur(i);
      }
      const onScroll = () => {
        if (!spyRaf) spyRaf = requestAnimationFrame(spy);
      };
      addEventListener("scroll", onScroll, { passive: true });
      form.addEventListener("focusin", e => {
        const s = e.target.closest(".pj-sec");
        if (s) setCur(+s.dataset.step);
      });
      $(".pj-steps-l").addEventListener("click", e => {
        const b = e.target.closest("[data-goto]");
        if (!b) return;
        const i = +b.dataset.goto,
          s = secs[i];
        s.scrollIntoView({ behavior: L.RM ? "auto" : "smooth", block: "start" });
        s.focus({ preventScroll: true });
        setCur(i);
      });

      /* ---------- live preview ---------- */
      function preview() {
        const b = readBudget(),
          n = d.deliverables.filter(x => x.trim()).length;
        $('[data-p="plat"]').innerHTML =
          `${K.glyph(d.platform)}<span>${esc(K.plat(d.platform))} ${esc(d.format)}${d.category ? ` · ${esc(d.category)}` : ""}</span>`;
        $('[data-p="title"]').textContent = titleIn.value.trim() || "Your brief title";
        $('[data-p="title"]').classList.toggle("is-ph", !titleIn.value.trim());
        [$('[data-p="budget"]'), $('[data-p="dock"]')].forEach(nd => {
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
        $('[data-p="deadline"]').textContent = dlIn.value ? L.fmtDate(dlIn.value, { year: true }) : "—";
        $('[data-p="where"]').textContent = d.remote ? "Any city · remote" : d.city || "—";
        $('[data-p="dels"]').textContent = n ? `${n} item${n === 1 ? "" : "s"}` : "—";
      }
      const sync = () => {
        d.title = titleIn.value;
        d.budget = digits(budgetIn.value);
        d.deadline = dlIn.value;
        d.brief = briefIn.value;
        d.category = catSel.value;
        d.city = citySel.value;
        d.minFollowers = +$("#pjFollow").value;
        d.usage = $("#pjUsage").value;
      };
      const counter = () => {
        const n = briefIn.value.length,
          c = $("#pjBriefN");
        c.textContent = `${n} / ${R.briefMax}`;
        c.classList.toggle("is-near", n >= R.briefMax - 40);
      };
      function grouped(inp, max) {
        const fromRight = inp.value.length - (inp.selectionEnd ?? inp.value.length);
        inp.value = group(digits(inp.value).slice(0, max));
        const pos = Math.max(0, inp.value.length - fromRight);
        try {
          inp.setSelectionRange(pos, pos);
        } catch (e) {}
      }

      /* ---------- autosave (B4): a draft every few seconds and on the way out; never for a live brief ---------- */
      let dirty = false,
        publishing = false;
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
      const savedLine = () => {
        const s = $("#pjSaved");
        if (!s) return;
        s.innerHTML = `${ic("check")}Draft saved`;
        s.title = "Saved " + new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
      };
      function autosave() {
        if (!dirty || isOpen || publishing || !el.isConnected) return;
        sync();
        if (!hasContent()) return;
        dirty = false;
        const rec = record();
        L.store.set(s => {
          const x = draftId() && s.jobs.find(y => y.id === draftId());
          if (x) Object.assign(x, rec);
          else {
            d._draftId = "j" + Date.now().toString(36);
            s.jobs.unshift({ id: d._draftId, status: "draft", posted: null, bids: 0, ...rec });
          }
        }, "job-draft");
        savedLine();
      }
      const timer = setInterval(autosave, AUTOSAVE_MS);
      const onHide = () => autosave();
      const onVis = () => document.visibilityState === "hidden" && autosave();
      addEventListener("pagehide", onHide);
      document.addEventListener("visibilitychange", onVis);

      const changed = () => {
        sync();
        preview();
        dirty = true;
        if (!isOpen && hasContent()) {
          const s = $("#pjSaved");
          if (s && s.textContent.startsWith("Draft saved")) s.textContent = "Saving…";
        }
        if (tried || touched.size) validate();
        stepsPaint();
      };

      titleIn.addEventListener("input", changed);
      budgetIn.addEventListener("input", () => {
        grouped(budgetIn, 8);
        changed();
      });
      dlIn.addEventListener("change", () => {
        touched.add("deadline");
        changed();
      });
      briefIn.addEventListener("input", () => {
        counter();
        changed();
      });
      catSel.addEventListener("change", () => {
        catSel.classList.toggle("is-ph", !catSel.value);
        touched.add("cat");
        changed();
      });
      citySel.addEventListener("change", () => {
        citySel.classList.toggle("is-ph", !citySel.value);
        touched.add("city");
        poked.add(3);
        changed();
      });
      ["pjFollow", "pjUsage"].forEach(x =>
        $("#" + x).addEventListener("change", () => {
          if (x === "pjFollow") poked.add(3);
          changed();
        }),
      );
      [
        ["title", titleIn],
        ["budget", budgetIn],
        ["deadline", dlIn],
        ["brief", briefIn],
      ].forEach(([k, inp]) =>
        inp.addEventListener("blur", () => {
          if (inp.value.trim()) touched.add(k);
          validate();
        }),
      );
      delsOl.addEventListener("input", e => {
        const li = e.target.closest(".pj-del");
        if (!li) return;
        d.deliverables[+li.dataset.i] = e.target.value;
        const x = li.querySelector(".pj-del-x");
        if (x) x.hidden = d.deliverables.length === 1 && !e.target.value;
        changed();
      });
      delsOl.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.matches("input")) {
          e.preventDefault();
          if (d.deliverables.length < R.maxDel && e.target.value.trim()) {
            d.deliverables.push("");
            dels(d.deliverables.length - 1);
          }
        }
      });

      el.firstElementChild.addEventListener("click", e => {
        const t = e.target.closest("button");
        if (!t || !el.contains(t)) return;
        if (t.dataset.plat) {
          d.platform = t.dataset.plat;
          L.$$("[data-plat]", el).forEach(b => b.setAttribute("aria-pressed", String(b === t)));
          formats();
          changed();
        } else if (t.dataset.fmt) {
          d.format = t.dataset.fmt;
          formats();
          $(`[data-fmt="${d.format}"]`).focus();
          changed();
        } else if (t.dataset.remote !== undefined) {
          d.remote = t.dataset.remote === "1";
          L.$$("[data-remote]", el).forEach(b => b.setAttribute("aria-pressed", String(b === t)));
          $("#fCity").hidden = d.remote;
          poked.add(3);
          changed();
        } else if (t.dataset.lang) {
          const l = t.dataset.lang;
          d.languages = d.languages.includes(l) ? d.languages.filter(x => x !== l) : [...d.languages, l];
          langs();
          $(`[data-lang="${l}"]`).focus();
          touched.add("langs");
          poked.add(3);
          changed();
        } else if (t.dataset.step) {
          const now = Number(digits(budgetIn.value)) || 0;
          budgetIn.value = group(String(Math.max(0, now + Number(t.dataset.step))));
          touched.add("budget");
          changed();
        } else if (t.hasAttribute("data-adddel")) {
          if (d.deliverables.length < R.maxDel) {
            d.deliverables.push("");
            dels(d.deliverables.length - 1);
          }
        } else if (t.dataset.rmdel !== undefined) {
          const i = +t.dataset.rmdel;
          d.deliverables.splice(i, 1);
          if (!d.deliverables.length) d.deliverables = [""];
          dels(Math.min(i, d.deliverables.length - 1));
          touched.add("dels");
          changed();
        } else if (t.hasAttribute("data-closejob"))
          K.closeJob(j.id, () => {
            dirty = false;
            delete u[key];
            L.go("#jobs");
          });
        else if (t.hasAttribute("data-deljob"))
          K.deleteJob(j.id, () => {
            dirty = false; // the draft is gone: leaving must not save it again
            delete u[key];
            L.go("#jobs");
          });
      });
      form.addEventListener("submit", e => {
        e.preventDefault();
        publish(form.querySelector("[type=submit]"));
      });

      function publish(btn) {
        sync();
        tried = true;
        const e = check(true);
        show(e);
        stepsPaint();
        const keys = Object.keys(e);
        if (keys.length) {
          summary(e);
          const f = {
            title: titleIn,
            brief: briefIn,
            cat: catSel,
            budget: budgetIn,
            deadline: dlIn,
            city: citySel,
            langs: $("#pjLangs .chip"),
            dels: delsOl.querySelector("input"),
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
          publishing = true; // autosave must not start a new draft of what is being published
          L.live.postJob(rec, j && j.status !== "draft" ? j.id : undefined).then(
            nid => {
              dirty = false;
              const gone = [dId, draftId()].filter(Boolean);
              L.store.set(s => {
                if (gone.length) s.jobs = s.jobs.filter(y => !gone.includes(y.id));
              }, "job-published");
              return L.live.refresh().then(() => {
                delete u[key];
                K.ui("jobs").justSaved = nid;
                K.ui("jobs").tab = "all";
                L.toast(wasDraft ? "Brief published. Creators can bid now." : "Changes saved", "check");
                L.go("#jobs");
              });
            },
            er => {
              publishing = false;
              btn && (btn.disabled = false);
              if (L.live.isKycRequired(er)) return L.kycGate("#post");
              L.toast(L.live.errorText(er), "alert");
            },
          );
          return;
        }
        let jid = j ? j.id : dId;
        dirty = false;
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

      formats();
      langs();
      dels();
      counter();
      preview();
      stepsPaint();
      if (j && isDraft) {
        touched.add("title");
      }
      K.mo("stagger", L.$$(".pj-sec, .pj-receipt", el));
      return () => {
        sync();
        autosave();
        /* once it lives in a draft, the draft is the copy: "Post a brief" opens blank next time, and editing the draft
           elsewhere is never overwritten by this stale working copy. A live brief keeps its unsaved edits. */
        if (!isOpen && !publishing && draftId()) delete u[key];
        clearInterval(timer);
        removeEventListener("scroll", onScroll);
        removeEventListener("pagehide", onHide);
        document.removeEventListener("visibilitychange", onVis);
        if (spyRaf) cancelAnimationFrame(spyRaf);
      };
    },
  });
})();
