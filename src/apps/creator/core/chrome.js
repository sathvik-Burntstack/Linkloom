/* chrome: badges, avatar, KYC banner */
import { $, $$, esc } from "./dom";
import { fmtDate, inr } from "./format";
import { icon } from "./icons";
import { store } from "./store";

export function renderChrome() {
  const s = store.s;
  const unread = s.threads.reduce((n, t) => n + t.unread, 0);
  $$('[data-badge="messages"]').forEach(b => {
    b.textContent = String(unread);
    b.hidden = !unread;
  });
  const nb = s.notifications.filter(n => !n.read).length;
  $$('[data-badge="bell"]').forEach(b => {
    b.textContent = String(nb);
    b.hidden = !nb;
  });
  $$("[data-me-initials]").forEach(e => {
    const ph = s.me.photo;
    e.textContent = ph ? "" : (s.me.name.trim()[0] || "?").toUpperCase();
    e.style.background = ph ? `center/cover url("${ph}")` : "";
  });
  $$("[data-me-name]").forEach(e => (e.textContent = s.me.name));
  $$("[data-me-handle]").forEach(e => (e.textContent = [s.me.handle, s.me.city].filter(Boolean).join(" · ")));
  const ib = $("#inbox");
  if (ib) ib.setAttribute("aria-label", unread ? `Messages, ${unread} unread` : "Messages");
  const held = s.active.filter(a => a.pay === "escrow").reduce((n, a) => n + a.price, 0);
  /* C11: the amount only once there is money to withdraw; until then, when the next payout comes, never "₹0" */
  const ready = s.readyToWithdraw || 0;
  $$("[data-side-label]").forEach(e => (e.textContent = ready > 0 ? "Ready to withdraw" : "Next payout"));
  $$("[data-side-ready]").forEach(e => {
    e.textContent = ready > 0 ? inr(ready) : "";
    e.hidden = !(ready > 0);
  });
  $$("[data-side-next]").forEach(e => {
    e.textContent =
      ready > 0 ? "" : held ? "When the brand approves your work" : "After your first approved deal";
    e.hidden = ready > 0;
  });
  /* subscription plan, shown quietly in the sidebar slip; never a price */
  const p = s.plan;
  $$("[data-side-plan]").forEach(e => {
    e.textContent = p
      ? p.name + (p.status === "active" && p.renews ? " · renews " + fmtDate(p.renews) : "")
      : "";
    e.hidden = !p;
  });
  $$("[data-side-escrow]").forEach(e => {
    e.innerHTML = icon("lock") + " " + esc(inr(held)) + " in escrow";
    e.hidden = !held;
  });
}
store.on(renderChrome);
