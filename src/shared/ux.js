/* Shared interaction foundations for both dashboards (implementation brief F3, F4, F5). Styles live in layout.css.
   - showSkeleton(): the page-shaped placeholder shown at once while a dashboard or a screen is loading (F4).
   - wireBusyButtons(): any button whose click starts an API call shows a spinner in place of its label and ignores
     further clicks until the call settles, so nothing can be sent twice (F3).
   - mountAvatarMenu(): the avatar in the top bar opens Profile, Settings, Help and Sign out (F5).
   - firstTime(): remembers a one-off moment per account and device (first deal confirmed, first payout).
   shared/ must not import from apps/, so each app passes in what is app-specific. */
import { onRequest } from "./api/client";

/* ---------- F4: skeleton (a React component, react/skeleton.jsx) ---------- */
export { showSkeleton } from "./react/skeleton";

/* ---------- F3: busy buttons ---------- */

const PRESSABLE = "button, a.lq, [role=button]";
/** How long after a click a request still counts as started by it. Handlers that first open a sheet are fine: the
    request then follows the click on the sheet's own button. */
const CLICK_WINDOW_MS = 600;
let wired = false;

/** Spinner + click guard on whichever button started an API call. Safe to call more than once. */
export function wireBusyButtons() {
  if (wired) return;
  wired = true;
  let last = null;
  const pending = new WeakMap();

  document.addEventListener(
    "click",
    e => {
      const el = e.target?.closest?.(PRESSABLE);
      if (!el) return;
      /* a busy button swallows clicks (Enter and Space included), so nothing is sent twice */
      if (el.classList.contains("is-busy")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (!el.closest("[data-no-busy]")) last = { el, at: performance.now() };
    },
    true,
  );
  document.addEventListener(
    "submit",
    e => {
      const by = e.submitter;
      if (by?.classList.contains("is-busy")) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  onRequest((p, method) => {
    /* reads are never a button's doing (polls, refreshes, read-backs after a save): only writes mark it busy */
    if (method === "GET") return;
    if (!last || performance.now() - last.at > CLICK_WINDOW_MS) return;
    const el = last.el;
    if (!el.isConnected) return;
    const n = (pending.get(el) || 0) + 1;
    pending.set(el, n);
    if (n === 1) {
      el.style.setProperty("--busy-c", getComputedStyle(el).color);
      el.classList.add("is-busy");
      el.setAttribute("aria-busy", "true");
    }
    const done = () => {
      const m = (pending.get(el) || 1) - 1;
      pending.set(el, m);
      if (m > 0) return;
      el.classList.remove("is-busy");
      el.removeAttribute("aria-busy");
      el.style.removeProperty("--busy-c");
    };
    p.then(done, done);
  });
}

/* ---------- F5: avatar menu ---------- */

let menuSeq = 0;

/** Turns the top-bar avatar into a menu button. Closes on outside click, Esc and Tab-out; arrow keys move focus. */
export function mountAvatarMenu(o) {
  const a = o.avatar;
  if (!a || a.closest(".ll-menu-wrap")) return;
  const id = `llMenu${++menuSeq}`;
  const wrap = document.createElement("div");
  wrap.className = "ll-menu-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  /* keep the avatar's classes and data hooks (initials, photo), so chrome code keeps filling it */
  btn.className = `${a.className} ll-menu-btn`;
  for (const at of Array.from(a.attributes))
    if (at.name.startsWith("data-")) btn.setAttribute(at.name, at.value);
  btn.setAttribute("aria-label", "Account menu");
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", id);
  btn.innerHTML = a.innerHTML;
  btn.style.cssText = a.style.cssText;
  const menu = document.createElement("div");
  menu.className = "ll-menu";
  menu.id = id;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Account");
  menu.hidden = true;
  a.replaceWith(wrap);
  wrap.append(btn, menu);

  const esc = t =>
    t.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const items = () => Array.from(menu.querySelectorAll(".ll-menu-i"));

  function render() {
    const w = o.who?.();
    menu.innerHTML =
      (w && (w.name || w.sub)
        ? `<div class="ll-menu-who" role="presentation"><b>${esc(w.name)}</b>${w.sub ? `<span>${esc(w.sub)}</span>` : ""}</div><div class="ll-menu-sep" role="separator"></div>`
        : "") +
      o.items
        .map((it, i) =>
          it.kind === "sep"
            ? '<div class="ll-menu-sep" role="separator"></div>'
            : `<button type="button" class="ll-menu-i" role="menuitem" tabindex="-1" data-i="${i}">${it.icon || ""}${esc(it.label)}</button>`,
        )
        .join("");
  }
  function open(focusFirst) {
    render();
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    if (focusFirst) items()[0]?.focus();
  }
  function close(refocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (refocus) btn.focus();
  }

  btn.addEventListener("click", () => (menu.hidden ? open(false) : close(false)));
  btn.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(true);
    }
  });
  menu.addEventListener("click", e => {
    const b = e.target.closest("[data-i]");
    if (!b) return;
    const it = o.items[Number(b.dataset.i)];
    close(false);
    it?.run?.();
  });
  menu.addEventListener("keydown", e => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = list.length;
      list[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") close(false);
  });
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target)) close(false);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !menu.hidden) close(true);
  });
  addEventListener("hashchange", () => close(false));
}

/* ---------- one-off moments ---------- */

/** True the first time it is asked for this key (per account, per device), then false for good. */
export function firstTime(key) {
  const k = `ll-once-${key}`;
  try {
    if (localStorage.getItem(k)) return false;
    localStorage.setItem(k, new Date().toISOString());
    return true;
  } catch {
    return false; // storage blocked: never nag
  }
}

/** Whether a one-off moment was already shown, without marking it. */
export function seen(key) {
  try {
    return !!localStorage.getItem(`ll-once-${key}`);
  } catch {
    return true;
  }
}
