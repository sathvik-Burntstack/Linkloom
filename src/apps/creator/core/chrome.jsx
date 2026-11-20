/* chrome: the dashboard frame (sidebar, top bar, tab bar) with its badges, avatar and the sidebar money slip.
   React (see src/shared/react/view.jsx): the frame is drawn into #app when this module loads, before the session's
   loading skeleton and the first route. The router still marks the current tab (aria-current) and writes the breadcrumb
   (#crumb), and boot adds the icons to [data-ic]; React never redraws those parts, so they stay as set.
   renderChrome() redraws the frame from the store. */
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { fmtDate, inr } from "./format";
import { icon } from "./icons";
import { store } from "./store";

let redraw = null,
  pending = false;
/** Redraws the frame. Store changes can come while a screen is drawing, so the redraw waits for that to finish. */
export function renderChrome() {
  if (!redraw || pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    flushSync(redraw);
  });
}

const Badge = ({ k, n, cls = "badge" }) => (
  <span className={cls} data-badge={k} hidden={!n}>
    {String(n)}
  </span>
);
const NAV = [
  ["home", "Home"],
  ["jobs", "Find collabs"],
  ["bids", "My bids"],
  ["active", "Active deals"],
  ["earnings", "Earnings"],
];
const TABS = [
  ["home", "Home", "home"],
  ["jobs", "Find collabs", "brief"],
  ["bids", "My bids", "send"],
  ["active", "Active deals", "rail"],
  ["earnings", "Earnings", "coin"],
];

function Shell() {
  const [, tick] = useState(0);
  redraw = () => tick(n => n + 1);
  const s = store.s;
  const unread = s.threads.reduce((n, t) => n + t.unread, 0);
  const nb = s.notifications.filter(n => !n.read).length;
  const ph = s.me.photo;
  const initials = ph ? "" : (s.me.name.trim()[0] || "?").toUpperCase();
  const avatarStyle = ph ? { background: `center/cover url("${ph}")` } : undefined;
  const held = s.active.filter(a => a.pay === "escrow").reduce((n, a) => n + a.price, 0);
  /* C11: the amount only once there is money to withdraw; until then, when the next payout comes, never "₹0" */
  const ready = s.readyToWithdraw || 0;
  /* subscription plan, shown quietly in the sidebar slip; never a price */
  const p = s.plan;
  const support = 0; // the Help & support badge is set by the support screen when replies come in
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
            <a href="#messages" data-nav="messages">
              Messages <Badge k="messages" n={unread} />
            </a>
            <a href="#support" data-nav="support">
              Help &amp; support <span className="badge" data-badge="support" hidden={!support}></span>
            </a>
          </nav>
          <p className="nav-note">Instagram · YouTube · English</p>
        </div>
        <a className="sbox slipbox" href="#earnings">
          <span className="t-cap slip-l" data-side-label="">
            {ready > 0 ? "Ready to withdraw" : "Next payout"}
          </span>
          <span className="t-money t-money-m" data-side-ready="" hidden={!(ready > 0)}>
            {ready > 0 ? inr(ready) : ""}
          </span>
          <span className="slip-next" data-side-next="" hidden={ready > 0}>
            {ready > 0 ? "" : held ? "When the brand approves your work" : "After your first approved deal"}
          </span>
          <span
            className="pill pill-escrow"
            data-side-escrow=""
            hidden={!held}
            dangerouslySetInnerHTML={{ __html: icon("lock") + " " + inr(held) + " in escrow" }}
          />
          <span className="slip-plan" data-side-plan="" hidden={!p}>
            {p ? p.name + (p.status === "active" && p.renews ? " · renews " + fmtDate(p.renews) : "") : ""}
          </span>
        </a>
        <a className="sbox me" href="#profile" data-nav="profile">
          <span className="avatar" data-me-initials="" style={avatarStyle}>
            {initials}
          </span>
          <span className="me-t">
            <b data-me-name="">{s.me.name}</b>
            <span data-me-handle="">{[s.me.handle, s.me.city].filter(Boolean).join(" · ")}</span>
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
              aria-label="Your profile"
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
store.on(renderChrome);
