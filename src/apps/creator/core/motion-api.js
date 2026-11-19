/* The motion API: the contract between src/shared/motion.ts (the implementation) and the screens (the callers).

   Core owns the `motion` object and seeds it with the eight no-ops below. src/shared/motion.ts assigns the real methods ONTO THIS
   SAME OBJECT when it loads (`Object.assign(motion, impl)`); never replace the object, since the router and every screen
   hold a reference to it. Check the implementation with `satisfies MotionImpl`.

   Members other than the eight are optional because they do not exist until src/shared/motion.ts has loaded. That is why screens
   guard them (`L.motion.print ? ... : ...`) and go through `mo()` in the job kit. */

/** Resolves when the animation has finished, or at once under reduced motion. Undefined from the core no-ops. */

/** An element that may be missing. Every method tolerates null and does nothing, or just applies its end state. */

/** A selector, one element, or any list of elements (holes are skipped). */

/** A selector or a list, or a parent whose children are the items, or a function returning the items. Omit to skip the glide. */

/** A token (coral, violet, butter, plum, escrow, ink, info, white, mist, paper, coral-deep, violet-deep, ok), a "--css-var", or any CSS colour. */

/** New class, markup and text for morph(); html wins over text. */

/** Shared durations in ms, the same values as the CSS --mo-* tokens. */

/** What src/shared/motion.ts must provide: every member, present. */

/** The callable members, for dynamic dispatch such as the job kit's mo("press", el). */

/* motion API (implemented in src/shared/motion.ts; safe no-ops until then) */
export const motion = {
  enter() {},
  stagger() {},
  count(el, to, fmt) {
    if (el) el.textContent = fmt ? fmt(to) : String(to);
  },
  press() {},
  swipe() {
    return () => {};
  },
  reveal() {},
  celebrate() {},
  flip(fn) {
    fn && fn();
  },
};
