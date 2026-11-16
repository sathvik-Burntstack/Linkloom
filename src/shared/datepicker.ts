/* Linkloom date picker: replaces the browser's plain calendar on every <input type="date"> in both dashboards.

   How it works
   - The original <input type="date"> stays in the page, visually hidden. Screens keep reading `input.value`
     (YYYY-MM-DD), setting it, and listening for "input"/"change" exactly as before; nothing in the screens changes.
   - A button in the input's style is shown in its place ("Tue, 25 Nov 2026 · in 10 days"). It opens a calendar card
     in the dashboard's colour: violet on brand.html, coral on the creator side; today has a butter ring; days outside
     min/max are dimmed and can't be picked.
   - Quick picks ("In 1 week", "In 2 weeks", "In a month") when the range is in the future; for long ranges such as a
     date of birth, the month title opens a year grid, then a month grid.
   - Keyboard: arrows move a day/week, PageUp/PageDown a month, Home/End the week, Enter/Space picks, Esc closes.
     On phones the calendar opens as a bottom sheet.
   - A MutationObserver upgrades date inputs as screens render them, so new screens get it for free. */
import "./datepicker.css";

const DAY = 864e5;
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = MONTHS.map(m => m.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string | null | undefined): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(+d) ? null : d;
};
const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getTime() === b.getTime();
const days = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const WD3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtLong = (d: Date) => `${WD3[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ICON_CAL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
const ICON_PREV =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_NEXT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!;
const rawGet = (i: HTMLInputElement): string => valueDesc.get!.call(i) as string;
const rawSet = (i: HTMLInputElement, v: string): void => valueDesc.set!.call(i, v);

interface Field {
  input: HTMLInputElement;
  btn: HTMLButtonElement;
  paint(): void;
}

const fields = new WeakMap<HTMLInputElement, Field>();
const role = (): "brand" | "creator" => (/brand\.html/.test(location.pathname) ? "brand" : "creator");

/* ---------- the trigger that replaces each date input ---------- */

function enhance(input: HTMLInputElement): void {
  if (fields.has(input) || input.dataset.dp === "off") return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${input.className} dp-trigger`.replace(/\bdp-native\b/, "").trim();
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-expanded", "false");
  const label = input.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(input.id)}"]`) : null;
  if (label) {
    if (!label.id) label.id = `${input.id}-lbl`;
    btn.id = `${input.id}-dp`;
    label.htmlFor = btn.id; // clicking the label focuses the button
    btn.setAttribute("aria-labelledby", `${label.id} ${btn.id}`);
  } else if (input.getAttribute("aria-label")) btn.setAttribute("aria-label", input.getAttribute("aria-label")!);
  if (input.getAttribute("aria-describedby")) btn.setAttribute("aria-describedby", input.getAttribute("aria-describedby")!);

  input.classList.add("dp-native");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.after(btn);

  const paint = () => {
    const d = parse(rawGet(input));
    const t = today();
    let rel = "";
    if (d) {
      const n = days(t, d);
      rel = n === 0 ? "today" : n === 1 ? "tomorrow" : n > 1 && n < 400 ? `in ${n} days` : "";
    }
    btn.innerHTML = `${ICON_CAL}<span class="dp-trigger-t${d ? "" : " is-ph"}">${d ? esc(fmtLong(d)) : "Pick a date"}</span>${rel ? `<span class="dp-trigger-rel">${rel}</span>` : ""}`;
    btn.disabled = input.disabled;
    const inv = input.getAttribute("aria-invalid");
    if (inv) btn.setAttribute("aria-invalid", inv);
    else btn.removeAttribute("aria-invalid");
  };

  /* screens set .value directly (drafts, re-renders): keep the button in step */
  Object.defineProperty(input, "value", {
    configurable: true,
    get() {
      return rawGet(input);
    },
    set(v: string) {
      rawSet(input, v);
      paint();
    },
  });
  new MutationObserver(paint).observe(input, { attributes: true, attributeFilter: ["aria-invalid", "disabled", "min", "max"] });
  /* code that focuses the input (e.g. the first field with an error) lands on the button */
  input.addEventListener("focus", () => btn.focus());
  btn.addEventListener("click", () => (picker.openFor === input ? picker.close(true) : picker.open(input, btn)));
  btn.addEventListener("keydown", e => {
    if (e.key === "Escape" && picker.openFor === input) {
      e.preventDefault();
      picker.close(true);
      return;
    }
    if (e.key === "ArrowDown" || (e.key === " " && !picker.openFor)) {
      e.preventDefault();
      picker.open(input, btn, true);
    }
  });

  fields.set(input, { input, btn, paint });
  paint();
}

/* ---------- the calendar card (one, shared) ---------- */

type View = "days" | "months" | "years";

const picker = {
  el: null as HTMLDivElement | null,
  scrim: null as HTMLDivElement | null,
  openFor: null as HTMLInputElement | null,
  btn: null as HTMLButtonElement | null,
  month: today(), // first of the shown month
  focus: today(),
  view: "days" as View,
  yearPage: 0,

  min(): Date | null {
    return parse(this.openFor?.min);
  },
  max(): Date | null {
    return parse(this.openFor?.max);
  },
  inRange(d: Date): boolean {
    const a = this.min(),
      b = this.max();
    return (!a || d >= a) && (!b || d <= b);
  },
  clamp(d: Date): Date {
    const a = this.min(),
      b = this.max();
    if (a && d < a) return a;
    if (b && d > b) return b;
    return d;
  },

  ensure(): HTMLDivElement {
    if (this.el) return this.el;
    const scrim = document.createElement("div");
    scrim.className = "dp-scrim";
    scrim.addEventListener("click", () => this.close(true));
    const el = document.createElement("div");
    el.className = "dp";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.hidden = true;
    scrim.hidden = true;
    document.body.append(scrim, el);
    el.addEventListener("click", e => this.onClick(e));
    el.addEventListener("keydown", e => this.onKey(e));
    document.addEventListener("pointerdown", e => {
      if (!this.openFor) return;
      const t = e.target as Node;
      if (!el.contains(t) && !this.btn?.contains(t)) this.close(false);
    });
    addEventListener("resize", () => this.place());
    addEventListener("scroll", () => this.place(), true);
    this.el = el;
    this.scrim = scrim;
    return el;
  },

  open(input: HTMLInputElement, btn: HTMLButtonElement, kb = false): void {
    const el = this.ensure();
    if (this.btn && this.btn !== btn) this.btn.setAttribute("aria-expanded", "false");
    this.openFor = input;
    this.btn = btn;
    const sel = parse(rawGet(input));
    this.focus = this.clamp(sel || today());
    this.month = new Date(this.focus.getFullYear(), this.focus.getMonth(), 1);
    /* a long range that ends in the past (a date of birth) starts at the year grid: nobody clicks back 25 years */
    const a = this.min(),
      b = this.max();
    this.view = !sel && a && b && days(a, b) > 3 * 366 && b <= addDays(today(), 1) ? "years" : "days";
    this.yearPage = 0;
    el.dataset.role = role();
    const lbl = btn.getAttribute("aria-labelledby")?.split(" ")[0];
    if (lbl) el.setAttribute("aria-labelledby", lbl);
    else el.setAttribute("aria-label", "Choose a date");
    btn.setAttribute("aria-expanded", "true");
    this.render();
    el.hidden = false;
    this.scrim!.hidden = false;
    this.place();
    requestAnimationFrame(() => {
      el.classList.add("is-on");
      this.scrim!.classList.add("is-on");
      if (kb || matchMedia("(max-width: 600px)").matches) this.focusCell();
      else this.focusCell(false);
    });
  },

  close(refocus: boolean): void {
    if (!this.el || !this.openFor) return;
    this.el.classList.remove("is-on");
    this.scrim!.classList.remove("is-on");
    this.el.hidden = true;
    this.scrim!.hidden = true;
    this.btn?.setAttribute("aria-expanded", "false");
    if (refocus) this.btn?.focus();
    this.openFor = null;
  },

  pick(d: Date): void {
    const input = this.openFor;
    if (!input || !this.inRange(d)) return;
    rawSet(input, iso(d));
    fields.get(input)?.paint();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    this.close(true);
  },

  place(): void {
    const el = this.el,
      btn = this.btn;
    if (!el || !btn || el.hidden) return;
    if (matchMedia("(max-width: 600px)").matches) {
      el.style.left = el.style.top = "";
      return; // CSS turns it into a bottom sheet
    }
    const r = btn.getBoundingClientRect();
    const w = el.offsetWidth,
      h = el.offsetHeight;
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    const below = r.bottom + 8;
    const top = below + h > innerHeight - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : Math.min(below, innerHeight - h - 8);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
  },

  /* ---------- render ---------- */
  render(): void {
    const el = this.el!;
    const sel = parse(this.openFor ? rawGet(this.openFor) : "");
    const t = today();
    const a = this.min(),
      b = this.max();
    const y = this.month.getFullYear(),
      m = this.month.getMonth();
    const prevOk = this.view === "days" ? !a || new Date(y, m, 0) >= a : this.view === "years" ? true : !a || y - 1 >= a.getFullYear();
    const nextOk = this.view === "days" ? !b || new Date(y, m + 1, 1) <= b : this.view === "years" ? this.yearPage > 0 : !b || y + 1 <= b.getFullYear();
    /* a range over a year long (a date of birth) gets the year grid; a deadline that crosses New Year doesn't */
    const longRange = !!a && !!b && days(a, b) > 366;
    let title = "",
      body = "";

    if (this.view === "days") {
      title = `<span class="dp-title-m">${MONTHS[m]}</span> <span class="dp-title-y">${y}</span>`;
      const first = new Date(y, m, 1);
      const lead = (first.getDay() + 6) % 7; // Monday first
      const start = addDays(first, -lead);
      let cells = "";
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const out = d.getMonth() !== m;
        const ok = this.inRange(d);
        const cls = ["dp-day", out && "is-out", !ok && "is-off", sameDay(d, t) && "is-today", sameDay(d, sel) && "is-sel"].filter(Boolean).join(" ");
        cells += `<button type="button" class="${cls}" data-d="${iso(d)}" tabindex="-1" ${ok ? "" : 'aria-disabled="true"'} aria-label="${esc(fmtLong(d))}${sameDay(d, t) ? ", today" : ""}"${sameDay(d, sel) ? ' aria-pressed="true"' : ""}>${d.getDate()}</button>`;
        if (i === 34 && addDays(start, 35).getMonth() !== m) break; // 5 rows are enough this month
      }
      body = `<div class="dp-week" aria-hidden="true">${WEEK.map(w => `<span>${w}</span>`).join("")}</div><div class="dp-grid" role="grid">${cells}</div>`;
    } else if (this.view === "months") {
      title = `<span class="dp-title-y">${y}</span>`;
      body = `<div class="dp-mgrid">${MON3.map((mn, i) => {
        const ok = (!a || new Date(y, i + 1, 0) >= a) && (!b || new Date(y, i, 1) <= b);
        const isSel = !!sel && sel.getFullYear() === y && sel.getMonth() === i;
        return `<button type="button" class="dp-cell${ok ? "" : " is-off"}${isSel ? " is-sel" : ""}" data-m="${i}" tabindex="-1" ${ok ? "" : 'aria-disabled="true"'}>${mn}</button>`;
      }).join("")}</div>`;
    } else {
      const top = (b ? b.getFullYear() : t.getFullYear() + 10) - this.yearPage * 20;
      const years = Array.from({ length: 20 }, (_, i) => top - i).filter(yr => !a || yr >= a.getFullYear());
      title = `<span class="dp-title-y">${years[years.length - 1]}–${years[0]}</span>`;
      body = `<div class="dp-ygrid">${years
        .map(yr => `<button type="button" class="dp-cell${sel && sel.getFullYear() === yr ? " is-sel" : ""}" data-y="${yr}" tabindex="-1">${yr}</button>`)
        .join("")}</div>`;
    }

    /* quick picks for a range in the future (deadlines, post dates) */
    let quick = "";
    if (this.view === "days" && (!a || a >= addDays(t, -1)) && !longRange) {
      const opts: [string, Date][] = [
        ["In 1 week", addDays(t, 7)],
        ["In 2 weeks", addDays(t, 14)],
        ["In a month", addDays(t, 30)],
      ];
      const ok = opts.filter(([, d]) => this.inRange(d));
      if (ok.length) quick = `<div class="dp-quick">${ok.map(([l, d]) => `<button type="button" class="dp-chip" data-d="${iso(d)}">${l}</button>`).join("")}</div>`;
    }
    const foot = sel
      ? `<p class="dp-foot"><span>Selected</span><b>${esc(fmtLong(sel))}</b></p>`
      : `<p class="dp-foot"><span>${a && b ? `${esc(fmtShort(a))} – ${esc(fmtShort(b))}` : "Pick a day"}</span></p>`;

    el.innerHTML = `<div class="dp-grab" aria-hidden="true"></div>
      <div class="dp-head">
        <button type="button" class="dp-title" data-view ${longRange || this.view !== "days" ? "" : 'tabindex="-1"'} aria-live="polite">${title}${longRange || this.view !== "days" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>' : ""}</button>
        <div class="dp-nav">
          <button type="button" class="dp-arrow" data-step="-1" aria-label="Previous" ${prevOk ? "" : "disabled"}>${ICON_PREV}</button>
          <button type="button" class="dp-arrow" data-step="1" aria-label="Next" ${nextOk ? "" : "disabled"}>${ICON_NEXT}</button>
        </div>
      </div>
      ${body}${quick}${foot}`;
    this.place();
  },

  focusCell(move = true): void {
    const el = this.el;
    if (!el) return;
    let c: HTMLElement | null = null;
    if (this.view === "days") c = el.querySelector<HTMLElement>(`[data-d="${iso(this.focus)}"].dp-day`);
    else if (this.view === "months") c = el.querySelector<HTMLElement>(`[data-m="${this.focus.getMonth()}"]`) || el.querySelector(".dp-cell");
    else c = el.querySelector<HTMLElement>(`[data-y="${this.focus.getFullYear()}"]`) || el.querySelector(".dp-cell");
    el.querySelectorAll<HTMLElement>(".dp-day,.dp-cell").forEach(x => (x.tabIndex = -1));
    if (c) {
      c.tabIndex = 0;
      if (move) c.focus();
    }
  },

  onClick(e: MouseEvent): void {
    const t = (e.target as Element).closest<HTMLElement>("button");
    if (!t || t.hasAttribute("disabled") || t.getAttribute("aria-disabled") === "true") return;
    if (t.dataset.step) {
      const s = +t.dataset.step;
      if (this.view === "days") this.month = new Date(this.month.getFullYear(), this.month.getMonth() + s, 1);
      else if (this.view === "months") this.month = new Date(this.month.getFullYear() + s, 0, 1);
      else this.yearPage = Math.max(0, this.yearPage - s);
      this.render();
      this.focusCell(false);
      return;
    }
    if (t.hasAttribute("data-view")) {
      this.view = this.view === "days" ? "years" : "days";
      this.render();
      this.focusCell();
      return;
    }
    if (t.dataset.y) {
      this.month = new Date(+t.dataset.y, this.month.getMonth(), 1);
      this.focus = this.clamp(new Date(+t.dataset.y, this.focus.getMonth(), Math.min(this.focus.getDate(), 28)));
      this.view = "months";
      this.render();
      this.focusCell();
      return;
    }
    if (t.dataset.m) {
      this.month = new Date(this.month.getFullYear(), +t.dataset.m, 1);
      this.focus = this.clamp(new Date(this.month.getFullYear(), +t.dataset.m, Math.min(this.focus.getDate(), 28)));
      this.view = "days";
      this.render();
      this.focusCell();
      return;
    }
    if (t.dataset.d) this.pick(parse(t.dataset.d)!);
  },

  onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close(true);
      return;
    }
    if (e.key === "Tab") {
      /* keep Tab inside the card while it's open */
      const f = Array.from(this.el!.querySelectorAll<HTMLElement>("button:not([disabled]):not([tabindex='-1'])"));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
      return;
    }
    if (this.view !== "days" || !(document.activeElement as HTMLElement)?.classList.contains("dp-day")) return;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Date | null = null;
    if (e.key in step) next = addDays(this.focus, step[e.key]);
    else if (e.key === "PageUp") next = new Date(this.focus.getFullYear(), this.focus.getMonth() - 1, this.focus.getDate());
    else if (e.key === "PageDown") next = new Date(this.focus.getFullYear(), this.focus.getMonth() + 1, this.focus.getDate());
    else if (e.key === "Home") next = addDays(this.focus, -((this.focus.getDay() + 6) % 7));
    else if (e.key === "End") next = addDays(this.focus, 6 - ((this.focus.getDay() + 6) % 7));
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.pick(this.focus);
      return;
    }
    if (!next) return;
    e.preventDefault();
    this.focus = this.clamp(next);
    if (this.focus.getMonth() !== this.month.getMonth() || this.focus.getFullYear() !== this.month.getFullYear()) {
      this.month = new Date(this.focus.getFullYear(), this.focus.getMonth(), 1);
      this.render();
    }
    this.focusCell();
  },
};

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + (d.getFullYear() !== today().getFullYear() ? ` ${d.getFullYear()}` : "");
}

/* ---------- upgrade every date input, now and as screens render ---------- */

function scan(root: ParentNode): void {
  root.querySelectorAll<HTMLInputElement>('input[type="date"]').forEach(enhance);
}

export function initDatePickers(): void {
  if (typeof document === "undefined" || (window as Window & { __llDp?: boolean }).__llDp) return;
  (window as Window & { __llDp?: boolean }).__llDp = true;
  const start = () => {
    scan(document);
    new MutationObserver(list => {
      for (const r of list)
        r.addedNodes.forEach(n => {
          if (n instanceof HTMLInputElement && n.type === "date") enhance(n);
          else if (n instanceof Element) scan(n);
        });
      /* a re-render removed the field the card was open for */
      if (picker.openFor && !picker.openFor.isConnected) picker.close(false);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else addEventListener("DOMContentLoaded", start, { once: true });
}

initDatePickers();
