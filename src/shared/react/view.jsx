/* React inside the Linkloom apps.

   Both routers (creator core/router.js, brand core.js) take either a screen's render(el, param) function or a React
   `Component`. A Component screen is mounted into the route's outlet here and unmounted when the route changes, so
   screens can move to React one at a time while the rest keep working.

   The first render is synchronous (flushSync): the router decorates buttons, runs the enter motion and moves focus
   right after rendering, so the screen's DOM has to exist by then. */
import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

/** Mounts a screen component into `el` and returns the router's cleanup (unmount). */
export function mountView(el, Component, props) {
  const root = createRoot(el);
  flushSync(() => root.render(createElement(Component, props)));
  return () => root.unmount();
}

/**
 * The Linkloom "liquid" button. The apps' liquid() decorates every .lq button by rewriting its contents into a
 * .t label and a .t2 copy for the hover roll; it skips buttons that already have them. Rendering the two spans here
 * keeps React the only owner of these elements.
 * Use `as="a"` for links. Everything else goes to the element.
 */
export function Lq({ as = "button", className = "", children, ...rest }) {
  const props = { className: `lq ${className}`.trim(), ...rest };
  if (as === "button" && !props.type) props.type = "button";
  return createElement(
    as,
    props,
    createElement("span", { className: "t" }, children),
    createElement("span", { className: "t2", "aria-hidden": "true" }, children),
  );
}

/**
 * Redraws a React screen when the app's store changes. `match` (a RegExp or a function of the change name) limits
 * it to the changes the screen cares about, like the old screens' L.store.on(why => ...) listeners.
 */
export function useStore(match) {
  const [, tick] = useState(0);
  useEffect(
    () =>
      window.LLD.store.on(why => {
        if (!match || (typeof match === "function" ? match(why) : match.test(String(why)))) tick(n => n + 1);
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return window.LLD.store.s;
}

/** An HTML string from the apps' older helpers (chips, avatars), shown as-is until those helpers move to React. */
export const Html = ({ as = "span", html, ...rest }) =>
  createElement(as, { ...rest, dangerouslySetInnerHTML: { __html: html } });

/* SVG attribute names React wants in camelCase */
const SVG_ATTR = {
  class: "className",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
};

/** An app icon: the same <svg> element the apps' L.icon(n, cls) markup makes, as a React element. */
export function Icon({ n, className = "" }) {
  const html = window.LLD.icon(n, className);
  const m = /^<svg([^>]*)>([\s\S]*)<\/svg>$/.exec(html.trim());
  if (!m) return null;
  const props = {};
  for (const [, k, v] of m[1].matchAll(/([\w:-]+)="([^"]*)"/g)) props[SVG_ATTR[k] || k] = v;
  if (!props.className) delete props.className;
  return createElement("svg", { ...props, dangerouslySetInnerHTML: { __html: m[2] } });
}

/**
 * A sheet (the apps' L.openSheet) whose body is React. `render(close)` returns the body element.
 * The React root is unmounted once the sheet leaves the page, however it was closed (button, Esc, scrim).
 */
export function openReactSheet({ title, wide, render }) {
  window.LLD.openSheet({
    title,
    wide,
    body: "",
    onMount(b, close) {
      const root = createRoot(b);
      flushSync(() => root.render(render(close)));
      const mo = new MutationObserver(() => {
        if (b.isConnected) return;
        mo.disconnect();
        setTimeout(() => root.unmount());
      });
      mo.observe(document.body, { childList: true, subtree: true });
    },
  });
}
