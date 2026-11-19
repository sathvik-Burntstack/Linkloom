/* Brand profile (#brand-<brandId>): what a creator sees of a brand (basic info and its open briefs, no deal counts),
   and the one pitch they can send it. Rules (the backend enforces them too): one pitch per brand, about one of its
   briefs or a fresh idea; message + links only; edited at most once; never deleted. A declined pitch frees the creator
   to pitch again after 15 days. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const MAX_MSG = 1500,
    MIN_MSG = 20,
    MAX_LINKS = 5;
  const cache = {}; // brandId → { p: BrandProfile } | { err }
  const initials = n =>
    String(n || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join("");
  const fmt = d => (d ? L.fmtDate(String(d).slice(0, 10)) : "");
  const platName = p => (p === "youtube" ? "YouTube" : "Instagram");
  const hrefOf = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
  const shortUrl = u =>
    String(u)
      .replace(/^https?:\/\/(www\.)?/i, "")
      .replace(/\/$/, "");
  const future = d => d && Date.parse(d) > Date.now();

  const PITCH_ERR = {
    ALREADY_PITCHED: "You've already pitched this brand. You can pitch each brand once.",
    EDIT_USED: "You've already used your one edit, so this pitch is locked.",
    PITCH_DECLINED: "The brand passed on this pitch, so it can't be edited.",
    PITCH_COOLDOWN: "The brand passed on your last pitch. You can pitch them again once 15 days have passed.",
    BRIEF_NOT_THIS_BRAND: "That brief isn't open any more. Pick another one, or pitch a fresh idea.",
  };
  const errText = e => PITCH_ERR[e && e.code] || (L.live ? L.live.errorText(e) : "Something went wrong.");

  /** Where the pitch stands, for the button and the card. */
  function state(p) {
    const mp = p.myPitch;
    if (!p.pitchingOn) return { k: "soon", label: `Pitch ${p.name}` };
    if (mp && mp.status !== "declined")
      return mp.canEdit
        ? { k: "edit", label: "Edit pitch", sub: "1 edit left" }
        : { k: "locked", label: "Pitched", sub: "Edit used" };
    if (future(p.pitchBlockedUntil) || (!p.canPitch && mp && mp.status === "declined"))
      return {
        k: "cooldown",
        label: p.pitchBlockedUntil ? `Pitch again on ${fmt(p.pitchBlockedUntil)}` : "Pitch again later",
      };
    /* the server says no, with no pitch of theirs and no cooldown: say so (with its reason when it gives one) */
    if (!p.canPitch) return { k: "blocked", label: "Can't pitch right now" };
    return { k: "new", label: `Pitch ${p.name}` };
  }

  function actionBtn(p, cls = "") {
    const st = state(p);
    if (st.k === "locked" || st.k === "cooldown" || st.k === "blocked")
      return `<button class="lq lq-s bp-pitchbtn is-done ${cls}" type="button" data-pitchview aria-disabled="true">${st.k === "locked" ? ic("check", "ic") : ic("clock", "ic")}<span>${esc(st.label)}</span>${st.sub ? `<small>${esc(st.sub)}</small>` : ""}</button>`;
    return `<button class="lq lq-p bp-pitchbtn ${cls}" type="button" data-pitch>${ic(st.k === "edit" ? "plus" : "send", "ic")}<span>${esc(st.label)}</span>${st.sub ? `<small>${esc(st.sub)}</small>` : ""}</button>`;
  }

  function pitchCard(p) {
    const mp = p.myPitch;
    if (!mp) return "";
    const about = mp.campaignId
      ? `About <b>${esc(mp.campaignTitle || (p.openBriefs.find(b => b.id === mp.campaignId) || {}).title || "a brief")}</b>`
      : "A fresh idea, not a specific brief";
    const tag =
      mp.status === "declined"
        ? '<span class="pill pill-err">Declined</span>'
        : mp.canEdit
          ? '<span class="pill pill-violet">Sent · 1 edit left</span>'
          : `<span class="pill pill-ok">${ic("check")}Sent${mp.status === "edited" ? " · edited" : ""}</span>`;
    const note =
      mp.status === "declined"
        ? future(p.pitchBlockedUntil)
          ? `${esc(p.name)} passed on this pitch. You can pitch them again on ${esc(fmt(p.pitchBlockedUntil))}.`
          : `${esc(p.name)} passed on this pitch. You can send them a new one.`
        : mp.canEdit
          ? "You can edit this pitch once. After that it's locked. Pitches can't be deleted."
          : `This pitch is locked: you've used your one edit. ${esc(p.name)} can message you if they're interested.`;
    return `<section class="card bp-sec bp-mine" id="bpMine" aria-labelledby="bpMineH">
      <div class="bp-sec-h"><h2 class="t-h2" id="bpMineH">Your pitch</h2>${tag}</div>
      <p class="bp-about-line">${ic("brief", "ic")}<span>${about}</span><span class="muted">· ${esc(fmt(mp.createdAt))}${mp.editedAt ? `, edited ${esc(fmt(mp.editedAt))}` : ""}</span></p>
      <p class="bp-msg">${esc(mp.message)}</p>
      ${mp.links.length ? `<div class="bp-links">${mp.links.map(u => `<a class="bp-link" href="${esc(hrefOf(u))}" target="_blank" rel="noopener noreferrer">${ic("link", "ic")}<span>${esc(shortUrl(u))}</span></a>`).join("")}</div>` : ""}
      <p class="t-small muted bp-note">${note}</p>
    </section>`;
  }

  function page(p) {
    const logo = p.logoUrl
      ? `<img class="bp-logo" src="${esc(p.logoUrl)}" alt="" width="88" height="88">`
      : `<span class="bp-logo is-txt" aria-hidden="true">${esc(initials(p.name))}</span>`;
    const meta = [p.industry, p.location].filter(Boolean);
    const briefs = p.openBriefs;
    return `<div class="view-in bp">
      <section class="card bp-head">
        ${logo}
        <div class="bp-id">
          <h1 class="t-h1">${esc(p.name)}</h1>
          ${meta.length ? `<p class="bp-meta">${meta.map(m => `<span>${esc(m)}</span>`).join('<span aria-hidden="true">·</span>')}</p>` : ""}
          ${p.website ? `<a class="lq lq-s lq-sm bp-web" href="${esc(hrefOf(p.website))}" target="_blank" rel="noopener noreferrer">${ic("link", "ic")}${esc(shortUrl(p.website))}</a>` : ""}
        </div>
        <div class="bp-act">${actionBtn(p)}<p class="t-small muted bp-act-n">${state(p).k === "new" ? "One pitch per brand. You can edit it once." : state(p).k === "blocked" ? esc(p.blockedReason || "Pitching isn't open for your account yet.") : ""}</p></div>
      </section>
      ${p.about ? `<section class="card bp-sec" aria-labelledby="bpAboutH"><h2 class="t-h2" id="bpAboutH">About ${esc(p.name)}</h2><p class="bp-msg">${esc(p.about)}</p></section>` : ""}
      ${pitchCard(p)}
      <section class="card bp-sec" aria-labelledby="bpBriefsH">
        <div class="bp-sec-h"><h2 class="t-h2" id="bpBriefsH">Open briefs</h2><span class="pill">${briefs.length}</span></div>
        ${
          briefs.length
            ? `<ul class="bp-briefs">${briefs
                .map(
                  b =>
                    `<li><a class="bp-brief" href="#job-${esc(b.id)}"><span class="bp-brief-t"><b>${esc(b.title)}</b><span class="muted">${esc(platName(b.platform))}${b.closesAt ? ` · closes ${esc(fmt(b.closesAt))}` : ""}</span></span><span class="lq lq-s lq-sm">View brief</span></a></li>`,
                )
                .join("")}</ul>`
            : `<p class="muted">No open briefs right now. You can still pitch them a fresh idea.</p>`
        }
      </section>
      <div class="bp-bar">${actionBtn(p, "is-wide")}</div>
    </div>`;
  }

  function linkRow(v = "") {
    return `<div class="bp-lrow"><input class="input" type="url" inputmode="url" autocomplete="off" maxlength="300" placeholder="instagram.com/reel/…" value="${esc(v)}" aria-label="Link to your work"><button class="ibtn" type="button" data-lx aria-label="Remove this link">${ic("close")}</button></div>`;
  }

  function openPitch(p, repaint) {
    const st = state(p);
    if (st.k === "soon") {
      L.openSheet({
        title: "Pitching opens soon",
        body: `<div class="stack bp-sheet"><p>Soon you'll be able to pitch ${esc(p.name)} an idea, about one of their briefs or something new. You'll get one pitch per brand.</p><p class="muted">For now, bid on one of their open briefs.</p><div class="row wrap"><button class="lq lq-p" type="button" data-no>OK</button></div></div>`,
        onMount(b, close) {
          b.querySelector("[data-no]").addEventListener("click", () => close());
        },
      });
      return;
    }
    const editing = st.k === "edit";
    const mp = editing ? p.myPitch : null;
    const sel = mp ? mp.campaignId || "" : "";
    L.openSheet({
      title: editing ? "Edit your pitch" : `Pitch ${p.name}`,
      body: `<form class="stack bp-sheet" novalidate>
        <p class="bp-rule">${ic("info", "ic")}<span>${editing ? "<b>This is your one edit.</b> After you save, the pitch is locked. Pitches can't be deleted." : `<b>You can pitch ${esc(p.name)} once</b> and edit it once. Pitches can't be deleted.`}</span></p>
        <div class="field"><label for="bpAbout">What's it about?</label>
          <select class="input" id="bpAbout">
            <option value="">A fresh idea (not a specific brief)</option>
            ${p.openBriefs.map(b => `<option value="${esc(b.id)}"${b.id === sel ? " selected" : ""}>${esc(b.title)}</option>`).join("")}
            ${mp && mp.campaignId && !p.openBriefs.some(b => b.id === mp.campaignId) ? `<option value="${esc(mp.campaignId)}" selected>${esc(mp.campaignTitle || "Your earlier brief")}</option>` : ""}
          </select></div>
        <div class="field"><label for="bpMsg">Your pitch</label>
          <textarea class="input" id="bpMsg" rows="6" maxlength="${MAX_MSG}" placeholder="The idea, why it fits ${esc(p.name)}, and what you'd make. Be specific.">${esc(mp ? mp.message : "")}</textarea>
          <p class="help bp-count" id="bpCount"></p></div>
        <div class="field"><span class="label" id="bpLinksL">Links to your work <span class="muted">(optional, up to ${MAX_LINKS})</span></span>
          <div class="bp-lrows" id="bpLinks" role="group" aria-labelledby="bpLinksL">${(mp && mp.links.length ? mp.links : [""]).map(linkRow).join("")}</div>
          <button class="lq lq-s lq-sm bp-addl" type="button" data-addl>${ic("plus", "ic")}Add link</button></div>
        <p class="err" id="bpErr" role="alert" hidden></p>
        <div class="row wrap"><button class="lq lq-p" type="submit" data-send>${ic("send", "ic")}${editing ? "Save my one edit" : "Send pitch"}</button><button class="lq lq-s" type="button" data-no>Cancel</button></div>
      </form>`,
      onMount(b, close) {
        const f = b.querySelector("form"),
          msg = b.querySelector("#bpMsg"),
          cnt = b.querySelector("#bpCount"),
          rows = b.querySelector("#bpLinks"),
          add = b.querySelector("[data-addl]"),
          err = b.querySelector("#bpErr"),
          send = b.querySelector("[data-send]");
        const count = () => {
          const n = msg.value.trim().length;
          cnt.textContent =
            n < MIN_MSG ? `${n} / ${MAX_MSG} · at least ${MIN_MSG} characters` : `${n} / ${MAX_MSG}`;
        };
        const linkCount = () => {
          add.hidden = rows.children.length >= MAX_LINKS;
        };
        count();
        linkCount();
        msg.addEventListener("input", count);
        b.querySelector("[data-no]").addEventListener("click", () => close());
        add.addEventListener("click", () => {
          rows.insertAdjacentHTML("beforeend", linkRow());
          rows.lastElementChild.querySelector("input").focus();
          linkCount();
        });
        rows.addEventListener("click", e => {
          const x = e.target.closest("[data-lx]");
          if (!x) return;
          if (rows.children.length > 1) x.parentElement.remove();
          else x.parentElement.querySelector("input").value = "";
          linkCount();
        });
        const fail = t => {
          err.textContent = t;
          err.hidden = false;
        };
        f.addEventListener("submit", async e => {
          e.preventDefault();
          err.hidden = true;
          const text = msg.value.trim();
          if (text.length < MIN_MSG) {
            msg.focus();
            return fail(`Write at least ${MIN_MSG} characters so ${p.name} knows what you have in mind.`);
          }
          const links = [...rows.querySelectorAll("input")].map(i => i.value.trim()).filter(Boolean);
          const bad = links.find(u => !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(u));
          if (bad)
            return fail(
              `"${bad}" doesn't look like a link. Paste the full address, like instagram.com/reel/…`,
            );
          const body = {
            campaignId: b.querySelector("#bpAbout").value || null,
            message: text,
            links: links.map(hrefOf),
          };
          send.disabled = true;
          send.setAttribute("aria-busy", "true");
          try {
            const r = editing ? await L.live.editPitch(mp.id, body) : await L.live.sendPitch(p.id, body);
            const camp = p.openBriefs.find(x => x.id === body.campaignId);
            p.myPitch = {
              ...r,
              campaignTitle: r.campaignTitle || (camp ? camp.title : ""),
              ...(editing
                ? { canEdit: false, status: "edited", editedAt: r.editedAt || new Date().toISOString() }
                : {}),
            };
            p.canPitch = false;
            close();
            L.toast(editing ? "Pitch updated. It's locked now." : `Pitch sent to ${p.name}`, "check");
            repaint();
          } catch (x) {
            send.disabled = false;
            send.removeAttribute("aria-busy");
            if (x && x.code === L.live.PITCHING_OFF) {
              p.pitchingOn = false;
              close();
              repaint();
              return openPitch(p, repaint);
            }
            fail(errText(x));
            if (x && /ALREADY_PITCHED|EDIT_USED|PITCH_DECLINED|PITCH_COOLDOWN/.test(x.code || ""))
              load(p.id, repaint, true);
          }
        });
      },
    });
  }

  /** Fetches the profile (always fresh on open) and repaints the screen if it is still showing this brand. */
  function load(id, onDone, quiet) {
    L.live.brandProfile(id).then(
      p => {
        cache[id] = { p };
        onDone();
      },
      e => {
        if (!quiet || !cache[id]) cache[id] = { err: e };
        onDone();
      },
    );
  }

  L.register("brand", {
    title: id => (cache[id] && cache[id].p ? cache[id].p.name : "Brand"),
    crumb: id =>
      `<a href="#jobs">Find briefs</a> / ${esc(cache[id] && cache[id].p ? cache[id].p.name : "Brand")}`,
    nav: "jobs",
    render(el, id) {
      const here = () => {
        const c = L.current && L.current();
        return c && c.name === "brand" && c.param === id;
      };
      const paint = () => {
        const c = cache[id];
        if (!L.live) {
          el.innerHTML = `<div class="view-in"><div class="empty"><p class="t-h2">Brand profiles open in the live app.</p><a class="lq lq-p" href="#jobs">See open briefs</a></div></div>`;
          return;
        }
        if (!c) {
          el.innerHTML = `<div class="view-in bp"><section class="card bp-head is-loading" aria-busy="true"><span class="bp-logo is-txt"></span><div class="bp-id"><p class="t-h2">Loading the brand…</p></div></section></div>`;
          return;
        }
        if (c.err) {
          const gone = c.err.status === 404 || c.err.status === 403;
          el.innerHTML = `<div class="view-in"><div class="empty"><p class="t-h2">${gone ? "This brand isn't available." : "The brand profile couldn't load."}</p><p class="muted">${gone ? "The brand may have closed its account." : esc(errText(c.err))}</p><div class="row wrap">${gone ? "" : '<button class="lq lq-p" type="button" data-retry>Try again</button>'}<a class="lq lq-s" href="#jobs">See open briefs</a></div></div></div>`;
          const r = el.querySelector("[data-retry]");
          r &&
            r.addEventListener("click", () => {
              delete cache[id];
              paint();
              load(id, () => here() && paint());
            });
          L.liquid(el);
          return;
        }
        el.innerHTML = page(c.p);
        document.title = c.p.name + " · Linkloom";
        const cr = document.getElementById("crumb");
        if (cr) cr.innerHTML = `<a href="#jobs">Find briefs</a> / ${esc(c.p.name)}`;
        L.liquid(el);
      };
      paint();
      if (L.live) load(id, () => here() && paint());
      el.addEventListener("click", e => {
        const c = cache[id];
        if (!c || !c.p) return;
        if (e.target.closest("[data-pitch]")) openPitch(c.p, paint);
        else if (e.target.closest("[data-pitchview]")) {
          if (state(c.p).k === "blocked")
            return L.toast(c.p.blockedReason || "Pitching isn't open for your account yet.", "info");
          const m = el.querySelector("#bpMine");
          if (m) m.scrollIntoView({ behavior: L.RM ? "auto" : "smooth", block: "start" });
        }
      });
    },
  });
})();
