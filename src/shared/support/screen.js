/* Help & support (#support, #support-new, #support-new-<orderId>, #support-<ticketId>), the same in the brand and the
   creator app. Each app calls installSupport() with its own deal list and deal links; everything else is shared.
   A ticket is a conversation with Linkloom Support (replies come from super admin), not live chat. */
import { support, supportError, SUPPORT_EMAIL, SUPPORT_OFF, TOPICS } from "./api";

const MAX_FILES = 3,
  MAX_MSG = 5000;
const STATUS_TXT = {
  open: "Open",
  waiting_on_user: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};
const topicTxt = t => (TOPICS.find(x => x[0] === t) || [, "Something else"])[1];

export function installSupport(host) {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  let tickets = null, // null = not loaded yet
    off = false,
    lastLoad = 0;
  const cache = {}; // ticketId → Ticket with messages

  const errText = e =>
    supportError(e, x =>
      L.live && L.live.errorText ? L.live.errorText(x) : "Something went wrong. Please try again.",
    );
  const here = param => {
    const c = L.current && L.current();
    return c && c.name === "support" && (param === undefined || c.param === param);
  };
  const fmt = iso => {
    try {
      const d = new Date(iso);
      const t = d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      return `${L.fmtDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))}, ${t}`;
    } catch {
      return "";
    }
  };
  const statusPill = s => `<span class="sp-st sp-st-${s}">${esc(STATUS_TXT[s] || "Open")}</span>`;
  const soon = () => `<section class="card sp-soon">
      <p class="t-h2">Support requests open soon</p>
      <p class="muted">You'll be able to write to us here and follow the replies. Until then, email us and we'll get back to you.</p>
      <a class="lq lq-p" href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Help with Linkloom")}">${ic("send", "ic")}Email ${SUPPORT_EMAIL}</a>
    </section>`;

  function badges() {
    const n = (tickets || []).filter(t => t.unread > 0).length;
    L.$$('[data-badge="support"]').forEach(b => {
      b.textContent = n;
      b.hidden = !n;
    });
  }

  /** Loads the user's tickets (at most every 20 s unless forced) and repaints the list if it is showing. */
  function load(force) {
    if (!L.live || L.live.guest) return Promise.resolve();
    if (!force && Date.now() - lastLoad < 20000) return Promise.resolve();
    lastLoad = Date.now();
    return support.list().then(
      t => {
        tickets = t;
        off = false;
        badges();
        if (here(null)) L.route();
      },
      e => {
        if (e && e.code === SUPPORT_OFF) off = true;
        if (tickets === null) tickets = [];
        if (here(null)) L.route();
      },
    );
  }
  L.store.on(why => {
    if (why === "live-loaded" || why === "live-refresh") void load(false);
    else if (/^notif/.test(String(why))) void load(true); // a support reply may have just come in
  });
  L.supportRefresh = () => load(true);

  /* ---------- the list ---------- */
  function list(el) {
    const head = `<header class="sp-head"><div><h1 class="t-h1">Help & support</h1>
      <p class="muted">Write to us about payments, a deal, your account, or anything that isn't working. You'll get a notification when we reply.</p></div>
      ${L.live && !off ? `<a class="lq lq-p" href="#support-new">${ic("plus", "ic")}New request</a>` : ""}</header>`;
    if (!L.live) {
      el.innerHTML = `<div class="view-in sp">${head}<section class="card sp-soon"><p class="t-h2">Support works in the live app.</p><p class="muted">Email ${SUPPORT_EMAIL} and we'll help.</p></section></div>`;
      return;
    }
    if (tickets === null) {
      el.innerHTML = `<div class="view-in sp">${head}<section class="card sp-soon" aria-busy="true"><p class="muted">Loading your requests…</p></section></div>`;
      void load(true);
      return;
    }
    const rows = tickets
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(
        t => `<li><a class="sp-row${t.unread ? " is-unread" : ""}" href="#support-${esc(t.id)}">
          <span class="sp-row-t"><span class="sp-row-ref">${esc(t.ref)} · ${esc(topicTxt(t.topic))}${t.order ? ` · ${esc(t.order.title)}` : ""}</span>
          <b>${t.unread ? '<i class="sp-dot" aria-label="New reply"></i>' : ""}${esc(t.subject)}</b>
          ${t.lastText ? `<span class="muted sp-row-last">${t.lastAuthor === "admin" ? "Support: " : t.lastAuthor === "user" ? "You: " : ""}${esc(t.lastText)}</span>` : ""}</span>
          <span class="sp-row-r">${statusPill(t.status)}<span class="t-small muted">${esc(fmt(t.updatedAt))}</span></span>
        </a></li>`,
      )
      .join("");
    el.innerHTML = `<div class="view-in sp">${head}
      ${
        off
          ? soon()
          : tickets.length
            ? `<ul class="sp-list">${rows}</ul>`
            : `<section class="card sp-soon"><p class="t-h2">No requests yet</p><p class="muted">When something isn't right, send us a request. We reply here, and you get a notification.</p><a class="lq lq-p" href="#support-new">${ic("plus", "ic")}New request</a></section>`
      }
      <p class="t-small muted sp-mail">Prefer email? <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    </div>`;
    void load(false);
  }

  /* ---------- files picked for a request or a reply ---------- */
  function filePicker(root) {
    const files = [];
    const input = root.querySelector("[data-files]"),
      chips = root.querySelector("[data-fchips]"),
      add = root.querySelector("[data-fadd]"),
      err = root.querySelector("[data-ferr]");
    const paint = () => {
      chips.innerHTML = files
        .map(
          (f, i) =>
            `<span class="sp-fchip">${ic("upload", "ic")}<span>${esc(f.name)}</span><button class="ibtn" type="button" data-frm="${i}" aria-label="Remove ${esc(f.name)}">${ic("close")}</button></span>`,
        )
        .join("");
      add.hidden = files.length >= MAX_FILES;
    };
    add.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      err.hidden = true;
      for (const f of input.files) {
        if (files.length >= MAX_FILES) break;
        if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
          err.textContent = `${f.name}: only JPG, PNG, WebP or PDF files.`;
          err.hidden = false;
          continue;
        }
        if (f.size > 10 << 20) {
          err.textContent = `${f.name} is over 10 MB.`;
          err.hidden = false;
          continue;
        }
        files.push(f);
      }
      input.value = "";
      paint();
    });
    chips.addEventListener("click", e => {
      const b = e.target.closest("[data-frm]");
      if (!b) return;
      files.splice(+b.dataset.frm, 1);
      paint();
    });
    paint();
    return { files, reset: () => (files.length = 0) && paint(), paint };
  }
  const fileField = label => `<div class="sp-files">
      <input type="file" data-files accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden>
      <div class="sp-fchips" data-fchips></div>
      <button class="lq lq-s lq-sm" type="button" data-fadd>${ic("upload", "ic")}${label}</button>
      <p class="err" data-ferr hidden></p>
    </div>`;

  /* ---------- a new request ---------- */
  function form(el, orderId) {
    if (!L.live || off) {
      el.innerHTML = `<div class="view-in sp"><header class="sp-head"><div><h1 class="t-h1">New request</h1></div></header>${soon()}</div>`;
      return;
    }
    const deals = host.deals();
    el.innerHTML = `<div class="view-in sp">
      <header class="sp-head"><div><h1 class="t-h1">New request</h1><p class="muted">Tell us what happened and what you expected. Screenshots help us fix it faster.</p></div></header>
      <form class="card sp-form" novalidate>
        <div class="field"><label for="spTopic">What's it about?</label>
          <select class="input" id="spTopic">${TOPICS.map(([k, n]) => `<option value="${k}"${orderId && k === "deal" ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
        <div class="field"><label for="spDeal">Which deal? <span class="muted">(optional)</span></label>
          <select class="input" id="spDeal"><option value="">Not about a deal</option>${deals
            .map(
              d =>
                `<option value="${esc(d.id)}"${d.id === orderId ? " selected" : ""}>${esc(d.title)}${d.sub ? " · " + esc(d.sub) : ""}</option>`,
            )
            .join("")}</select></div>
        <div class="field"><label for="spSubject">Subject</label><input class="input" id="spSubject" maxlength="120" placeholder="For example: Paid, but the deal still says unpaid"></div>
        <div class="field"><label for="spMsg">Message</label><textarea class="input" id="spMsg" rows="7" maxlength="${MAX_MSG}" placeholder="What happened, when, and what you expected to happen."></textarea></div>
        <div class="field"><span class="label">Screenshots or PDFs <span class="muted">(optional, up to ${MAX_FILES}, 10 MB each)</span></span>${fileField("Attach a file")}</div>
        <p class="err" id="spErr" role="alert" hidden></p>
        <div class="row wrap"><button class="lq lq-p" type="submit" data-send>${ic("send", "ic")}Send request</button><a class="lq lq-s" href="#support">Cancel</a></div>
        <p class="ll-trust">${ic("lock")}Never send your PAN, Aadhaar, bank or UPI details here.</p>
      </form>
    </div>`;
    L.liquid(el);
    const f = el.querySelector("form"),
      err = el.querySelector("#spErr"),
      send = el.querySelector("[data-send]"),
      fp = filePicker(f);
    const fail = t => {
      err.textContent = t;
      err.hidden = false;
    };
    f.addEventListener("submit", async e => {
      e.preventDefault();
      err.hidden = true;
      const subject = el.querySelector("#spSubject").value.trim(),
        message = el.querySelector("#spMsg").value.trim();
      if (subject.length < 5) {
        el.querySelector("#spSubject").focus();
        return fail("Add a short subject (at least 5 characters).");
      }
      if (message.length < 10) {
        el.querySelector("#spMsg").focus();
        return fail("Tell us a little more in the message.");
      }
      send.disabled = true;
      send.setAttribute("aria-busy", "true");
      try {
        const t = await support.create({
          topic: el.querySelector("#spTopic").value,
          orderId: el.querySelector("#spDeal").value || null,
          subject,
          message,
          files: fp.files,
        });
        cache[t.id] = t.messages.length ? t : null;
        (tickets = tickets || []).unshift(t);
        L.toast(`Request ${t.ref} sent. We'll reply here.`, "check");
        L.go("#support-" + t.id);
      } catch (x) {
        send.disabled = false;
        send.removeAttribute("aria-busy");
        if (x && x.code === SUPPORT_OFF) {
          off = true;
          return form(el, orderId);
        }
        fail(errText(x));
      }
    });
  }

  /* ---------- one request ---------- */
  function bubble(m) {
    if (m.author === "system")
      return `<li class="sp-sys"><span>${esc(m.text)}</span><span class="t-small muted">${esc(fmt(m.at))}</span></li>`;
    const mine = m.author === "user";
    return `<li class="sp-msg${mine ? " is-mine" : ""}">
      <p class="sp-msg-h"><b>${mine ? "You" : esc(m.authorName || "Linkloom Support")}</b><span class="t-small muted">${esc(fmt(m.at))}</span></p>
      ${m.text ? `<p class="sp-msg-t">${esc(m.text)}</p>` : ""}
      ${m.attachments.length ? `<div class="sp-atts">${m.attachments.map(a => `<button class="sp-att" type="button" data-att="${esc(a.uploadId)}">${ic("eye", "ic")}<span>${esc(a.fileName)}</span></button>`).join("")}</div>` : ""}
    </li>`;
  }

  function ticket(el, id) {
    const t = cache[id];
    if (!L.live) return list(el);
    if (!t) {
      el.innerHTML = `<div class="view-in sp"><section class="card sp-soon" aria-busy="true"><p class="muted">Loading the request…</p></section></div>`;
      support.get(id).then(
        r => {
          cache[id] = r;
          const i = (tickets || []).findIndex(x => x.id === id);
          if (i >= 0) tickets[i] = { ...r, unread: 0 };
          badges();
          if (here(id)) ticket(el, id);
        },
        e => {
          if (!here(id)) return;
          if (e && e.code === SUPPORT_OFF) {
            off = true;
            return list(el);
          }
          el.innerHTML = `<div class="view-in sp"><section class="card sp-soon"><p class="t-h2">${e && e.status === 404 ? "We couldn't find that request." : "The request couldn't load."}</p><p class="muted">${esc(errText(e))}</p><a class="lq lq-p" href="#support">All requests</a></section></div>`;
          L.liquid(el);
        },
      );
      return;
    }
    const foot =
      t.status === "closed"
        ? `<section class="card sp-end"><p>This request is closed. If you still need help, open a new one.</p><a class="lq lq-p" href="#support-new">${ic("plus", "ic")}New request</a></section>`
        : t.status === "resolved"
          ? `<section class="card sp-end"><p>Marked resolved${t.resolvedAt ? " " + esc(fmt(t.resolvedAt)) : ""}.${t.canReopen ? " Not fixed after all? Reopen it within 7 days." : ""}</p>
             <div class="row wrap">${t.canReopen ? '<button class="lq lq-p" type="button" data-reopen>Reopen request</button>' : ""}<a class="lq lq-s" href="#support-new">New request</a></div><p class="err" id="spErr" role="alert" hidden></p></section>`
          : `<form class="card sp-reply" novalidate>
              <label class="label" for="spReply">${t.status === "waiting_on_user" ? "Support is waiting for your reply" : "Add to this request"}</label>
              <textarea class="input" id="spReply" rows="4" maxlength="${MAX_MSG}" placeholder="Write a reply"></textarea>
              ${fileField("Attach")}
              <p class="err" id="spErr" role="alert" hidden></p>
              <div class="row wrap sp-reply-a"><button class="lq lq-p" type="submit" data-send>${ic("send", "ic")}Send reply</button><button class="lq lq-s" type="button" data-resolve>${ic("check", "ic")}Mark as resolved</button></div>
            </form>`;
    el.innerHTML = `<div class="view-in sp">
      <a class="sp-back" href="#support">${ic("back", "ic")}All requests</a>
      <header class="card sp-thead">
        <div class="sp-thead-t"><p class="sp-row-ref">${esc(t.ref)} · ${esc(topicTxt(t.topic))}</p><h1 class="t-h2">${esc(t.subject)}</h1>
        ${t.order ? `<a class="lq lq-s lq-sm" href="${esc(host.dealHref(t.order.id))}">${ic("rail", "ic")}${esc(t.order.title)}</a>` : ""}</div>
        ${statusPill(t.status)}
      </header>
      <ol class="sp-conv">${t.messages.map(bubble).join("")}</ol>
      ${foot}
    </div>`;
    L.liquid(el);
    if (document.getElementById("crumb"))
      document.getElementById("crumb").innerHTML = `<a href="#support">Help & support</a> / ${esc(t.ref)}`;
    const err = el.querySelector("#spErr");
    const fail = x => {
      if (x && x.code === SUPPORT_OFF) {
        off = true;
        return list(el);
      }
      err.textContent = errText(x);
      err.hidden = false;
    };
    const swap = r => {
      cache[id] = { ...r, messages: r.messages.length ? r.messages : t.messages };
      const i = (tickets || []).findIndex(x => x.id === id);
      if (i >= 0) tickets[i] = { ...cache[id], unread: 0 };
      ticket(el, id);
    };
    if (!el._spAtt) {
      el._spAtt = true; // once per screen: the request repaints into the same element
      el.addEventListener("click", e => {
        const a = e.target.closest("[data-att]");
        if (a) support.openFile(a.dataset.att).catch(x => L.toast(errText(x), "alert"));
      });
    }
    const reopen = el.querySelector("[data-reopen]");
    reopen &&
      reopen.addEventListener("click", () => {
        reopen.disabled = true;
        support.reopen(id).then(
          r => {
            L.toast(`${t.ref} reopened`, "check");
            swap(r);
          },
          x => {
            reopen.disabled = false;
            fail(x);
          },
        );
      });
    const f = el.querySelector(".sp-reply");
    if (!f) return;
    const fp = filePicker(f),
      send = f.querySelector("[data-send]"),
      res = f.querySelector("[data-resolve]");
    res.addEventListener("click", () => {
      res.disabled = true;
      support.resolve(id).then(
        r => {
          L.toast(`${t.ref} marked resolved`, "check");
          swap(r);
        },
        x => {
          res.disabled = false;
          fail(x);
        },
      );
    });
    f.addEventListener("submit", async e => {
      e.preventDefault();
      err.hidden = true;
      const text = f.querySelector("#spReply").value.trim();
      if (!text && !fp.files.length) {
        err.textContent = "Write a reply first.";
        err.hidden = false;
        return;
      }
      send.disabled = true;
      send.setAttribute("aria-busy", "true");
      try {
        const m = await support.reply(id, text, fp.files);
        const next = {
          ...t,
          status: "open",
          messages: [...t.messages, m.text || m.attachments.length ? m : { ...m, text }],
        };
        cache[id] = next;
        const i = (tickets || []).findIndex(x => x.id === id);
        if (i >= 0)
          tickets[i] = {
            ...next,
            lastText: text,
            lastAuthor: "user",
            updatedAt: new Date().toISOString(),
            unread: 0,
          };
        ticket(el, id);
      } catch (x) {
        send.disabled = false;
        send.removeAttribute("aria-busy");
        fail(x);
      }
    });
  }

  L.register("support", {
    title: p => (!p ? "Help & support" : p.startsWith("new") ? "New support request" : "Support request"),
    crumb: p =>
      !p ? "" : `<a href="#support">Help & support</a> / ${p.startsWith("new") ? "New request" : "Request"}`,
    nav: "support",
    render(el, p) {
      if (!p) return list(el);
      if (p === "new" || p.startsWith("new-")) return form(el, p === "new" ? "" : p.slice(4));
      delete cache[p]; // always fresh when opened: support may have replied
      return ticket(el, p);
    },
  });
}
