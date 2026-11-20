/* Shared interaction foundations for both dashboards (implementation brief F3, F4, F5). Styles live in layout.css.
   - showSkeleton(): the page-shaped placeholder shown at once while a dashboard or a screen is loading (F4).
   - wireBusyButtons(): any button whose click starts an API call shows a spinner in place of its label and ignores
     further clicks until the call settles, so nothing can be sent twice (F3).
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
