/* The account menu on the top-bar avatar (F5): Profile, Settings, Help and Sign out, two clicks from anywhere.
   Each app's session start-up registers what the menu holds (setAccountMenu); the dashboard frame draws the avatar
   with <AccountAvatar>, which is a plain profile link until a menu is registered (test hooks skip it) and the menu
   button after. Closes on outside click, Esc, Tab-out and route changes; arrow keys, Home and End move focus. */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./view";

let config = null;
const subs = new Set();

/** { who: () => ({ name, sub }), items: [{ label, icon, run } | { kind: "sep" }] } */
export function setAccountMenu(c) {
  config = c;
  subs.forEach(f => f());
}
const subscribe = f => (subs.add(f), () => subs.delete(f));
const read = () => config;

/** The top-bar avatar: `children` (initials) and `style` (the photo) are the avatar's own, as before. */
export function AccountAvatar({ href, label, style, children }) {
  const menu = useSyncExternalStore(subscribe, read);
  if (!menu)
    return (
      <a className="avatar" href={href} aria-label={label} data-me-initials="" style={style}>
        {children}
      </a>
    );
  return (
    <Menu menu={menu} style={style}>
      {children}
    </Menu>
  );
}

function Menu({ menu, style, children }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null),
    btn = useRef(null),
    list = useRef(null);
  const focusFirst = useRef(false);
  const id = "llMenu" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const items = () => Array.from(list.current?.querySelectorAll(".ll-menu-i") || []);
  const show = first => {
    focusFirst.current = first;
    setOpen(true);
  };
  const close = refocus => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  };

  useEffect(() => {
    if (open && focusFirst.current) items()[0]?.focus();
  }, [open]);

  /* while open: a click outside, Esc anywhere or a route change closes it */
  useEffect(() => {
    if (!open) return;
    const click = e => {
      if (!wrap.current?.contains(e.target)) close(false);
    };
    const key = e => {
      if (e.key === "Escape") close(true);
    };
    const nav = () => close(false);
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    addEventListener("hashchange", nav);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
      removeEventListener("hashchange", nav);
    };
  }, [open]);

  const who = open ? menu.who?.() : null;
  return (
    <div className="ll-menu-wrap" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="avatar ll-menu-btn"
        data-me-initials=""
        style={style}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={String(open)}
        aria-controls={id}
        onClick={() => (open ? close(false) : show(false))}
        onKeyDown={e => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            show(true);
          }
        }}
      >
        {children}
      </button>
      <div
        ref={list}
        className="ll-menu"
        id={id}
        role="menu"
        aria-label="Account"
        hidden={!open}
        onKeyDown={e => {
          const l = items();
          const i = l.indexOf(document.activeElement);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const n = l.length;
            l[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            l[e.key === "Home" ? 0 : l.length - 1]?.focus();
          } else if (e.key === "Escape") {
            e.preventDefault();
            close(true);
          } else if (e.key === "Tab") close(false);
        }}
      >
        {open ? (
          <>
            {who && (who.name || who.sub) ? (
              <>
                <div className="ll-menu-who" role="presentation">
                  <b>{who.name}</b>
                  {who.sub ? <span>{who.sub}</span> : null}
                </div>
                <div className="ll-menu-sep" role="separator"></div>
              </>
            ) : null}
            {menu.items.map((it, i) =>
              it.kind === "sep" ? (
                <div key={i} className="ll-menu-sep" role="separator"></div>
              ) : (
                <button
                  key={i}
                  type="button"
                  className="ll-menu-i"
                  role="menuitem"
                  tabIndex={-1}
                  data-i={i}
                  onClick={() => {
                    close(false);
                    it.run?.();
                  }}
                >
                  {it.icon ? <Icon n={it.icon} /> : null}
                  {it.label}
                </button>
              ),
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
