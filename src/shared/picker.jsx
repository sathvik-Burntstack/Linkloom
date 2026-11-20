/* A choice picker: a search box, the options as chips (in groups when given), and one Done button.
   Forms show a single button ("Choose niches", "Choose languages") instead of every option at once; the picker
   opens on click. Single choice closes as soon as one is picked; multiple choice closes on Done.
   It is its own dialog on top of the page, not LLD.openSheet: the app shows one sheet at a time, and the picker is
   often opened from inside one (Edit profile), which must stay open underneath. React, drawn straight into <body>. */
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Icon, Lq } from "./react/view";

function Picker({ o, close }) {
  const L = window.LLD;
  const single = !o.multi;
  const [picked, setPicked] = useState([...o.selected]);
  const [q, setQ] = useState("");
  const v = q.trim().toLowerCase();
  const toggle = x => {
    if (single) {
      o.onDone([x]);
      close();
      return;
    }
    if (picked.includes(x)) setPicked(picked.filter(y => y !== x));
    else if (o.max && picked.length >= o.max) L.toast(`Choose up to ${o.max}.`, "info");
    else setPicked([...picked, x]);
  };
  /* search: hide chips (and whole groups) that don't match; a group's name counts too: "food" shows all of
     "Food and drink" */
  let any = false;
  const groups = o.groups.map(g => {
    const inGroup =
      !!v &&
      String(g.label || "")
        .toLowerCase()
        .includes(v);
    const hits = g.items.map(x => !v || inGroup || String(x).toLowerCase().includes(v));
    const n = hits.filter(Boolean).length;
    if (n) any = true;
    return { g, hits, n };
  });
  return (
    <div className="pick">
      {o.sub ? <p className="muted pick-sub">{o.sub}</p> : null}
      <label className="pick-search">
        <span className="sr-only">Search</span>
        <Icon n="search" />
        <input
          className="input"
          type="search"
          placeholder="Search"
          autoComplete="off"
          data-q=""
          onInput={e => setQ(e.currentTarget.value)}
        />
      </label>
      <div className="pick-groups" data-groups="">
        {groups.map(({ g, hits, n }) => (
          <section key={g.label} className="pick-g" data-g={g.label} hidden={!n}>
            {o.groups.length > 1 ? <h3 className="t-eyebrow">{g.label}</h3> : null}
            <div className="chips" role="group" aria-label={g.label}>
              {g.items.map((x, i) => {
                const on = picked.includes(x);
                return (
                  <button
                    key={x}
                    className="chip"
                    type="button"
                    data-pick={x}
                    aria-pressed={String(on)}
                    hidden={!hits[i]}
                    onClick={() => toggle(x)}
                  >
                    {on ? <Icon n="check" /> : null}
                    {x}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="muted pick-none" data-none="" hidden={any}>
        Nothing matches that.
      </p>
      {single ? null : (
        <div className="pick-f">
          <p className="pick-n" data-n="" aria-live="polite">
            {picked.length ? `${picked.length} chosen` : "None chosen"}
          </p>
          <Lq className="lq-s" data-clear="" onClick={() => setPicked([])}>
            Clear
          </Lq>
          <Lq
            className="lq-p"
            data-done=""
            onClick={() => {
              o.onDone(picked);
              close();
            }}
          >
            Done
          </Lq>
        </div>
      )}
    </div>
  );
}

/** The dialog: Esc, the close button and the backdrop close it; Tab stays inside; focus goes back to where it was. */
function Dialog({ title, close, children }) {
  const scrim = useRef(null),
    dlg = useRef(null);
  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      if (!dlg.current) return;
      scrim.current.classList.add("on");
      dlg.current.classList.add("on");
      dlg.current.querySelector("[data-q]")?.focus({ preventScroll: true });
    });
  }, []);
  return (
    <>
      <div className="pick-scrim" ref={scrim} onClick={close}></div>
      <div
        className="pick-dlg light"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dlg}
        onKeyDown={e => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          } else if (e.key === "Tab") {
            const f = [...dlg.current.querySelectorAll("button, input")].filter(
              x => !x.hidden && x.offsetParent,
            );
            if (!f.length) return;
            const first = f[0],
              last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="pick-h">
          <p className="t-h2">{title}</p>
          <button className="ibtn" type="button" data-x="" aria-label="Close" onClick={close}>
            <Icon n="close" />
          </button>
        </div>
        <div className="pick-b">{children}</div>
      </div>
    </>
  );
}

export function openPicker(o) {
  const back = document.activeElement;
  const root = createRoot(document.createElement("div"));
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    root.unmount();
    back?.focus?.({ preventScroll: true });
  };
  flushSync(() =>
    root.render(
      createPortal(
        <Dialog title={o.title} close={close}>
          <Picker o={o} close={close} />
        </Dialog>,
        document.body,
      ),
    ),
  );
}
