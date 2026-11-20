/* React inside the Linkloom apps.

   Both routers (creator core/router.js, brand core.js) take either a screen's render(el, param) function or a React
   `Component`. A Component screen is mounted into the route's outlet here and unmounted when the route changes, so
   screens can move to React one at a time while the rest keep working.

   The first render is synchronous (flushSync): the router decorates buttons, runs the enter motion and moves focus
   right after rendering, so the screen's DOM has to exist by then. */
import { createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

/* one React root per outlet: the screen, the loading placeholder and the router's notes all render through it */
const roots = new WeakMap();
const rootFor = el => {
  let r = roots.get(el);
  if (!r) {
    r = createRoot(el);
    roots.set(el, r);
  }
  return r;
};
/** Renders `node` into `el` (an outlet) now. */
export function renderInto(el, node) {
  const r = rootFor(el);
  flushSync(() => r.render(node));
}

/** Mounts a screen component into `el` and returns the router's cleanup (unmount). */
export function mountView(el, Component, props) {
  renderInto(el, createElement(Component, props));
  return () => {
    const r = roots.get(el);
    roots.delete(el);
    r && r.unmount();
  };
}

/** The router's "This screen is being built." / "could not load" notes. */
export function outletNote(el, title, text) {
  renderInto(
    el,
    createElement(
      "div",
      { className: "empty" },
      createElement("p", { className: "t-h2" }, title),
      text ? createElement("p", { className: "muted" }, text) : null,
    ),
  );
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

/* SVG attribute names React wants in camelCase */
const SVG_ATTR = {
  class: "className",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
};

/** An app icon: the same <svg> element the apps' L.icon(n, cls) markup makes, as React elements. Extra props
    (a style, say) go on the <svg>. */
export function Icon({ n, className = "", ...rest }) {
  const html = window.LLD.icon(n, className);
  const m = /^<svg([^>]*)>([\s\S]*)<\/svg>$/.exec(html.trim());
  if (!m) return null;
  const attrs = str => {
    const o = {};
    for (const [, k, v] of str.matchAll(/([\w:-]+)="([^"]*)"/g)) o[SVG_ATTR[k] || k] = v;
    return o;
  };
  /* the icon set's shapes are all self-closing (<path/>, <rect/>, <circle/>) */
  const inner = m[2].trim();
  const shapes = [...inner.matchAll(/<(\w+)([^>]*?)\/>/g)];
  const whole = shapes.map(x => x[0]).join("") === inner.replace(/>\s+</g, "><");
  return whole
    ? createElement(
        "svg",
        { ...attrs(m[1]), ...rest },
        ...shapes.map((x, i) => createElement(x[1], { key: i, ...attrs(x[2]) })),
      )
    : createElement("svg", { ...attrs(m[1]), ...rest, dangerouslySetInnerHTML: { __html: m[2] } });
}

/** A sheet whose body is React: `render(close)` returns the body element (see react/overlays.jsx). */
export function openReactSheet({ title, wide, render }) {
  return window.LLD.openSheet({ title, wide, render });
}

/**
 * A person's photo or a brand's logo inside an avatar. Without a link, or when the image fails to load, the avatar's
 * own contents (the initials) show instead: <Photo src={c.avatarUrl}>{initials}</Photo>.
 */
export function Photo({ src, children }) {
  const [bad, setBad] = useState("");
  if (!src || bad === src) return children;
  return createElement("img", {
    className: "av-ph",
    src,
    alt: "",
    loading: "lazy",
    decoding: "async",
    onError: () => setBad(src),
  });
}
