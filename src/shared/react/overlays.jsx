/* The bottom sheet and the toast, shared by both dashboards (LLD.openSheet, LLD.closeSheet, LLD.toast).
   Both are React, drawn straight into <body> (portals), the way the apps always placed them: the scrim and the sheet
   go at the end of the body when a sheet opens, the toast once when the first message shows. The motion layer
   (shared/motion.js) watches the body for them, drags the sheet by its header and animates the toast.
   The sheet and scrim get their "on" class through classList, as before: the motion layer styles them directly, so
   React draws them once and leaves them be. */
import { Fragment, useLayoutEffect, useRef } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Icon } from "./view";

const RM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = s => document.querySelector(s);

/* one root (on a detached element) holds every overlay */
let root = null;
const st = { sheets: [], toast: null };
let sheetN = 0;
function draw() {
  if (!root) root = createRoot(document.createElement("div"));
  flushSync(() => root.render(<Overlays />));
}
function Overlays() {
  return (
    <>
      {st.sheets.map(e => (
        <Fragment key={e.id}>{createPortal(<Sheet e={e} />, document.body)}</Fragment>
      ))}
      {st.toast ? createPortal(<Toast t={st.toast} />, document.body) : null}
    </>
  );
}

/* ---------- the sheet ---------- */
let current = null, // the open sheet's entry
  lastFocus = null;

function Sheet({ e }) {
  const scrim = useRef(null),
    sheet = useRef(null),
    body = useRef(null);
  useLayoutEffect(() => {
    e.scrim = scrim.current;
    e.sheet = sheet.current;
    /* the sheet slides in on the next frame; then the first field (or Close) takes focus */
    requestAnimationFrame(() => {
      if (e.closed) return;
      scrim.current.classList.add("on");
      sheet.current.classList.add("on");
      const f =
        body.current.querySelector("input,button:not([data-close]),select,textarea,a") ||
        sheet.current.querySelector("[data-close]");
      f && f.focus({ preventScroll: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="scrim" ref={scrim} onClick={() => closeSheet()}></div>
      <aside
        className="sheet light"
        role="dialog"
        aria-modal="true"
        aria-label={e.title}
        style={e.wide ? { width: "min(720px,100%)" } : undefined}
        ref={sheet}
        onKeyDown={ev => {
          if (ev.key === "Escape") closeSheet();
        }}
      >
        <div className="sheet-h">
          <p className="t-h2">{e.title}</p>
          <button
            className="ibtn"
            type="button"
            data-close=""
            aria-label="Close"
            onClick={() => closeSheet()}
          >
            <Icon n="close" />
          </button>
        </div>
        <div className="sheet-b" ref={body}>
          {e.body}
        </div>
      </aside>
    </>
  );
}

/**
 * Opens a sheet. `render(close)` returns its body (a React element); `close(instant)` closes it.
 * Returns { close }.
 */
export function openSheet({ title, wide, render }) {
  closeSheet(true);
  lastFocus = document.activeElement;
  const e = { id: ++sheetN, title, wide, body: null, closed: false };
  e.body = render ? render(closeSheet) : null;
  current = e;
  st.sheets = [...st.sheets, e];
  $("#app").inert = true;
  $("#focusRoot").inert = true;
  draw();
  return { close: closeSheet };
}

export function closeSheet(instant) {
  if (!current) return;
  const e = current;
  current = null;
  e.closed = true;
  $("#app").inert = false;
  $("#focusRoot").inert = false;
  const drop = () => {
    st.sheets = st.sheets.filter(x => x !== e);
    draw();
  };
  if (instant || RM() || !e.sheet) drop();
  else {
    e.sheet.classList.remove("on");
    e.scrim.classList.remove("on");
    setTimeout(drop, 500);
  }
  lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
}

/* ---------- the toast ---------- */
let toastT = 0;

function Toast({ t }) {
  return (
    <div className={`toast${t.on ? " on" : ""}`} role="status">
      {/* keyed by the message count, so each message replaces the last one (the motion layer bumps on that) */}
      <Fragment key={t.n}>
        <Icon n={t.ic} style={{ width: "18px", height: "18px" }} />
        <span>{t.msg}</span>
      </Fragment>
    </div>
  );
}

export function toast(msg, ic = "check") {
  st.toast = { n: (st.toast ? st.toast.n : 0) + 1, msg, ic, on: st.toast ? st.toast.on : false };
  draw();
  requestAnimationFrame(() => {
    st.toast = { ...st.toast, on: true };
    draw();
  });
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    st.toast = { ...st.toast, on: false };
    draw();
  }, 3200);
}
