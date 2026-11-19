/* React inside the Linkloom apps.

   Both routers (creator core/router.js, brand core.js) take either a screen's render(el, param) function or a React
   `Component`. A Component screen is mounted into the route's outlet here and unmounted when the route changes, so
   screens can move to React one at a time while the rest keep working.

   The first render is synchronous (flushSync): the router decorates buttons, runs the enter motion and moves focus
   right after rendering, so the screen's DOM has to exist by then. */
import { createElement } from "react";
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

/** An app icon (the apps' L.icon returns SVG markup as a string). */
export function Icon({ n, className }) {
  const L = window.LLD;
  return createElement("span", {
    className: `react-ic${className ? " " + className : ""}`,
    "aria-hidden": "true",
    style: { display: "contents" },
    dangerouslySetInnerHTML: { __html: L.icon(n, className) },
  });
}
