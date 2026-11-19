/* router: #name or #name-param */
import { renderChrome } from "./chrome";
import { $, $$, liquid } from "./dom";
import { motion } from "./motion-api";
import { closeSheet } from "./overlays";
import { store } from "./store";
import { mountView } from "@/shared/react/view";

/** Runs when the route changes away. */

/** The param is the part of the hash after the first "-", or null. */

/* A plain object on purpose: names come straight from the hash, and the prototype's lookup includes inherited keys. */
export const views = {};
let current = null,
  cleanup = null;
let booted = false,
  routed = false;

export const register = (name, def) => {
  views[name] = def;
  if (booted) route();
};
const parse = () => {
  const h = location.hash.replace(/^#/, "");
  const i = h.indexOf("-");
  return i < 0 ? { name: h, param: null } : { name: h.slice(0, i), param: h.slice(i + 1) };
};
export const go = hash => {
  if (location.hash === hash) {
    if (booted) route(); // before boot the hash is all there is; boot routes to it (F4)
  } else location.hash = hash;
};
/** The route showing now. Null only before the first route has run. */
export const getCurrent = () => current;
/** boot.ts calls this once. From then on, a late register() routes at once. */
export const markBooted = () => {
  booted = true;
};

/** Lets the app send a route elsewhere before it renders. Returns the hash to go to, or null to carry on. */
const liveApi = () => window.LLD?.live;

/** Screens a signed-out visitor may look at, read-only. Empty in the parity build. */
let guestRoutes = new Set();
export const setGuestRoutes = r => {
  guestRoutes = r;
};
let guard = null;
export const setRouteGuard = g => {
  guard = g;
};

export function route() {
  let { name, param } = parse();
  if (!views[name]) {
    name = store.s.session.signedIn || store.s.session.guest ? "home" : "login";
    param = null;
  }
  const v = views[name] || {
    title: "Linkloom",
    render: el => {
      el.innerHTML = '<div class="empty"><p class="t-h2">This screen is being built.</p></div>';
    },
  };
  const guestOk = !!store.s.session.guest && guestRoutes.has(name) && !param;
  if (v.auth !== false && !store.s.session.signedIn && !guestOk && name !== "login") {
    if (store.s.session.guest) {
      location.replace("#home");
      setTimeout(() => liveApi()?.promptSignIn?.(), 0);
      return;
    }
    location.replace("#login");
    return;
  }
  const redirect = guard?.(name);
  if (redirect) {
    location.replace(redirect);
    return;
  }
  if (cleanup) {
    try {
      cleanup();
    } catch (e) {}
    cleanup = null;
  }
  closeSheet(true);
  const focus = v.shell === "focus";
  $("#app").hidden = focus;
  $("#focusRoot").hidden = !focus;
  const old = focus ? $("#focusRoot") : $("#view");
  const el = old.cloneNode(false);
  old.replaceWith(el); // fresh outlet each route, so listeners never pile up
  current = { name, param };
  document.title =
    (v.title ? (typeof v.title === "function" ? v.title(param) : v.title) + " · " : "") + "Linkloom";
  $$("[data-nav]").forEach(a => {
    if (a.dataset.nav === (v.nav || name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const crumb = $("#crumb");
  if (crumb) {
    const c = v.crumb ? (typeof v.crumb === "function" ? v.crumb(param) : v.crumb) : "";
    crumb.innerHTML = c;
    crumb.hidden = !c;
  }
  try {
    /* a React screen (Component) or a plain one (render) */
    cleanup = (v.Component ? mountView(el, v.Component, { param }) : v.render(el, param)) || null;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty"><p class="t-h2">This screen could not load.</p><p class="muted">Reload the page to try again.</p></div>`;
  }
  liquid(el);
  if (!focus) window.scrollTo({ top: 0, behavior: "auto" });
  if (routed) {
    const f = focus ? $("#focusRoot") : $("#view");
    f.setAttribute("tabindex", "-1");
    f.focus({ preventScroll: true });
  }
  routed = true;
  motion.enter(el, { name });
  renderChrome();
}
/* While the dashboard is still loading (before boot) a tab click only marks the tab; boot then opens it. Routing that
   early treated a signed-in creator as signed out and sent them to the sign-in page (F4). */
addEventListener("hashchange", () => {
  if (booted) return route();
  const name = parse().name;
  $$("[data-nav]").forEach(a => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
});
