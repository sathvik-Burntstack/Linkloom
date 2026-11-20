/* The brand dashboard frame (sidebar, top bar, tab bar) with its badges, avatar and the escrow slip.
   React (see src/shared/react/view.jsx): drawn into #app when this module loads (main.js loads it right after core.js,
   before the session's loading skeleton and the first route). The router still marks the current tab and writes the
   breadcrumb, and boot adds the icons to [data-ic]; React never redraws those parts. core.js's renderChrome() calls
   LLD.renderShell() to redraw the frame from LLD_DATA. */
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const L = window.LLD;
let redraw = null,
  pending = false;
/** Redraws the frame. Store changes can come while a screen is drawing, so the redraw waits for that to finish. */
L.renderShell = () => {
  if (!redraw || pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    flushSync(redraw);
  });
};

const Badge = ({ k, n, cls = "badge" }) => (
  <span className={cls} data-badge={k} hidden={!n}>
    {String(n)}
  </span>
);
const NAV = [
  ["home", "Home"],
  ["creators", "Find creators"],
  ["jobs", "Collabs"],
];
const NAV2 = [
  ["campaigns", "Deals"],
  ["payments", "Payments"],
  ["reports", "Reports"],
];
const TABS = [
  ["home", "Home", "home"],
  ["creators", "Creators", "users"],
  ["jobs", "Collabs", "brief"],
  ["campaigns", "Deals", "rail"],
  ["payments", "Payments", "coin"],
];
const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];

function Shell() {
  const [, tick] = useState(0);
  redraw = () => tick(n => n + 1);
  const s = window.LLD_DATA;
  const unread = s.threads.reduce((n, t) => n + t.unread, 0);
  const np = (s.pitches || []).filter(p => !p.read && p.status !== "declined").length;
  const nb = s.notifications.filter(n => !n.read).length;
  const lg = s.me.logo;
  const initials = lg ? "" : (s.me.brand.trim()[0] || "?").toUpperCase();
  const avatarStyle = lg ? { background: `center/cover url("${lg}")` } : undefined;
  const held = L.heldInEscrow();
  const live = s.campaigns.filter(c => LIVE.includes(c.stage)).length;
  /* subscription plan, shown quietly; never a price */
  const p = s.plan;
  return (
    <>
      <aside className="side" aria-label="Main">
        <a className="sbox brand" href="#home" aria-label="Linkloom home">
          <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
          <span>linkloom</span>
        </a>
        <div className="sbox nav-box">
          <nav className="nav" aria-label="Sections">
            {NAV.map(([k, t]) => (
              <a key={k} href={`#${k}`} data-nav={k}>
                {t}
              </a>
            ))}
            <a href="#pitches" data-nav="pitches">
              Pitches <Badge k="pitches" n={np} />
            </a>
            {NAV2.map(([k, t]) => (
              <a key={k} href={`#${k}`} data-nav={k}>
                {t}
              </a>
            ))}
            <a href="#messages" data-nav="messages">
              Messages <Badge k="messages" n={unread} />
            </a>
            <a href="#support" data-nav="support">
              Help &amp; support <span className="badge" data-badge="support" hidden></span>
            </a>
          </nav>
          <p className="nav-note">Instagram · YouTube · English</p>
        </div>
        <a className="sbox slipbox" href="#payments">
          {/* no ₹0 for a new brand: the amount only once something is held */}
          <span className="t-cap slip-l" data-side-label="">
            {held > 0 ? "Held in escrow" : "Escrow"}
          </span>
          <span className="t-money t-money-m" data-side-held="" hidden={!(held > 0)}>
            {held > 0 ? L.inr(held) : ""}
          </span>
          <span className="slip-next" data-side-next="" hidden={held > 0}>
            {held > 0 ? "" : "You pay in only when you hire. Released when you approve."}
          </span>
          {/* escrow pills always carry the lock */}
          <span
            className="pill pill-escrow"
            data-side-live=""
            hidden={!live}
            dangerouslySetInnerHTML={{
              __html: L.icon("lock") + " " + live + (live === 1 ? " deal running" : " deals running"),
            }}
          />
          <span className="slip-plan" data-side-plan="" hidden={!p}>
            {p ? p.name + (p.status === "active" && p.renews ? " · renews " + L.fmtDate(p.renews) : "") : ""}
          </span>
        </a>
        <a className="sbox me" href="#profile" data-nav="profile">
          <span className="avatar" data-me-initials="" style={avatarStyle}>
            {initials}
          </span>
          <span className="me-t">
            <b data-me-name="">{s.me.brand}</b>
            <span data-me-handle="">{[s.me.name, s.me.city].filter(Boolean).join(" · ")}</span>
          </span>
        </a>
      </aside>

      <div className="main">
        <header className="top">
          <a className="hbox hlogo" href="#home" aria-label="Linkloom home">
            <img src="assets/logo-mark.svg" width="26" height="26" alt="" />
            <span>linkloom</span>
          </a>
          <p className="hbox crumb" id="crumb" hidden></p>
          <div className="grow"></div>
          <div className="hbox icons">
            <a className="ibtn bell" href="#cart" id="cartBtn" aria-label="Hiring cart" data-ic="cart">
              <Badge k="cart" n={s.cart.length} cls="bell-n" />
            </a>
            <a
              className="ibtn bell"
              href="#messages"
              id="inbox"
              aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
              data-ic="chat"
            >
              <Badge k="messages" n={unread} cls="bell-n" />
            </a>
            <button className="ibtn bell" type="button" id="bell" aria-label="Notifications" data-ic="bell">
              <Badge k="bell" n={nb} cls="bell-n" />
            </button>
            <a
              className="avatar"
              href="#profile"
              aria-label="Brand profile"
              data-me-initials=""
              style={avatarStyle}
            >
              {initials}
            </a>
          </div>
        </header>
        <main className="view light" id="view" tabIndex={-1}></main>
      </div>

      <nav className="tabbar dark" aria-label="Sections">
        {TABS.map(([k, t, ic]) => (
          <a key={k} href={`#${k}`} data-nav={k} data-ic={ic}>
            {t}
          </a>
        ))}
      </nav>
    </>
  );
}

const app = document.getElementById("app");
if (app) flushSync(() => createRoot(app).render(<Shell />));
