/* A choice picker: a search box, the options as chips (in groups when given), and one Done button.
   Forms show a single button ("Choose niches", "Choose languages") instead of every option at once; the picker
   opens on click. Single choice closes as soon as one is picked; multiple choice closes on Done.
   It is its own dialog on top of the page, not LLD.openSheet: the app shows one sheet at a time, and the picker is
   often opened from inside one (Edit profile), which must stay open underneath. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the dashboards' runtime is still untyped
const w = window as any;

export type PickGroup = { label: string; items: string[] };

export function openPicker(o: {
  title: string;
  sub?: string;
  groups: PickGroup[];
  selected: string[];
  multi?: boolean;
  max?: number;
  onDone: (picked: string[]) => void;
}): void {
  const L = w.LLD,
    esc = L.esc;
  let picked = [...o.selected];
  const single = !o.multi;
  const body = `<div class="pick">
      ${o.sub ? `<p class="muted pick-sub">${esc(o.sub)}</p>` : ""}
      <label class="pick-search"><span class="sr-only">Search</span>${L.icon("search")}<input class="input" type="search" placeholder="Search" autocomplete="off" data-q></label>
      <div class="pick-groups" data-groups>${o.groups
        .map(
          g => `<section class="pick-g" data-g="${esc(g.label)}">
          ${o.groups.length > 1 ? `<h3 class="t-eyebrow">${esc(g.label)}</h3>` : ""}
          <div class="chips" role="group" aria-label="${esc(g.label)}">${g.items
            .map(
              x =>
                `<button class="chip" type="button" data-pick="${esc(x)}" aria-pressed="${picked.includes(x)}">${picked.includes(x) ? L.icon("check") : ""}${esc(x)}</button>`,
            )
            .join("")}</div>
        </section>`,
        )
        .join("")}</div>
      <p class="muted pick-none" data-none hidden>Nothing matches that.</p>
      ${
        single
          ? ""
          : `<div class="pick-f"><p class="pick-n" data-n aria-live="polite"></p><button class="lq lq-s" type="button" data-clear>Clear</button><button class="lq lq-p" type="button" data-done>Done</button></div>`
      }
    </div>`;
  mountDialog(o.title, body, {
    onMount(b: HTMLElement, close: () => void) {
      const count = () => {
        const n = b.querySelector<HTMLElement>("[data-n]");
        if (n) n.textContent = picked.length ? `${picked.length} chosen` : "None chosen";
      };
      const paint = (x: string) => {
        const on = picked.includes(x);
        b.querySelectorAll<HTMLButtonElement>("[data-pick]").forEach(c => {
          if (c.dataset.pick !== x) return;
          c.setAttribute("aria-pressed", String(on));
          c.innerHTML = (on ? L.icon("check") : "") + esc(x);
        });
      };
      count();
      b.addEventListener("click", e => {
        const t = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
        if (!t) return;
        if (t.dataset.pick) {
          const x = t.dataset.pick;
          if (single) {
            o.onDone([x]);
            close();
            return;
          }
          if (picked.includes(x)) picked = picked.filter(y => y !== x);
          else if (o.max && picked.length >= o.max) return void L.toast(`Choose up to ${o.max}.`, "info");
          else picked.push(x);
          paint(x);
          count();
        } else if (t.hasAttribute("data-clear")) {
          const was = picked;
          picked = [];
          was.forEach(paint);
          count();
        } else if (t.hasAttribute("data-done")) {
          o.onDone(picked);
          close();
        }
      });
      /* search: hide chips (and whole groups) that don't match */
      const q = b.querySelector<HTMLInputElement>("[data-q]")!;
      q.addEventListener("input", () => {
        const v = q.value.trim().toLowerCase();
        let any = false;
        b.querySelectorAll<HTMLElement>("[data-g]").forEach(g => {
          let n = 0;
          /* a group's name counts too: "food" shows all of "Food and drink" */
          const inGroup = !!v && String(g.dataset.g || "").toLowerCase().includes(v);
          g.querySelectorAll<HTMLElement>("[data-pick]").forEach(c => {
            const hit = !v || inGroup || String(c.dataset.pick).toLowerCase().includes(v);
            c.hidden = !hit;
            if (hit) n++;
          });
          g.hidden = !n;
          if (n) any = true;
        });
        b.querySelector<HTMLElement>("[data-none]")!.hidden = any;
      });
    },
  });
}

/** A modal dialog of its own, above any open sheet: Esc, the close button and the backdrop close it; Tab stays inside;
    focus goes back to where it was. */
function mountDialog(title: string, body: string, { onMount }: { onMount: (b: HTMLElement, close: () => void) => void }): void {
  const L = w.LLD;
  const back = document.activeElement as HTMLElement | null;
  const scrim = document.createElement("div");
  scrim.className = "pick-scrim";
  const dlg = document.createElement("div");
  dlg.className = "pick-dlg light";
  dlg.setAttribute("role", "dialog");
  dlg.setAttribute("aria-modal", "true");
  dlg.setAttribute("aria-label", title);
  dlg.innerHTML = `<div class="pick-h"><p class="t-h2">${L.esc(title)}</p><button class="ibtn" type="button" data-x aria-label="Close">${L.icon("close")}</button></div><div class="pick-b"></div>`;
  const b = dlg.querySelector<HTMLElement>(".pick-b")!;
  b.innerHTML = body;
  document.body.append(scrim, dlg);
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    scrim.remove();
    dlg.remove();
    back?.focus?.({ preventScroll: true });
  };
  scrim.addEventListener("click", close);
  dlg.querySelector("[data-x]")!.addEventListener("click", close);
  dlg.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      const f = [...dlg.querySelectorAll<HTMLElement>("button, input")].filter(x => !x.hidden && x.offsetParent);
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
  });
  L.liquid?.(dlg);
  onMount(b, close);
  requestAnimationFrame(() => {
    scrim.classList.add("on");
    dlg.classList.add("on");
    dlg.querySelector<HTMLInputElement>("[data-q]")?.focus({ preventScroll: true });
  });
}
