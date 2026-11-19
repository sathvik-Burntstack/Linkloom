/* DOM helpers shared by every screen. */

/** Read once at load, like the prototype. Motion reads the media query live; screens read this. */
export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** querySelector. Returns null on no match, like the DOM; a screen that knows the node exists asserts it with `!`. */

export function $(s, c = document) {
  return c.querySelector(s);
}

/** querySelectorAll, as a real array. */

export function $$(s, c = document) {
  return [...c.querySelectorAll(s)];
}

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML-escapes any value for use in a template. Null and undefined become "". */
export const esc = v => String(v ?? "").replace(/[&<>"']/g, ch => ESCAPES[ch]);

/* liquid buttons: <a class="lq lq-p">Label</a> -> label roll markup */
export function liquid(root = document) {
  $$(".lq", root).forEach(b => {
    if (b.querySelector(":scope > .t")) return;
    const label = b.innerHTML.trim();
    b.innerHTML = `<span class="t">${label}</span><span class="t2" aria-hidden="true">${label}</span>`;
  });
}
