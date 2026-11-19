/* store: one in-memory state object, change events. */
import { seed } from "../data/seed";

/** Receives the `why` passed to store.set. Screens match on it, e.g. "signed-in". */

let state = seed;
const subs = new Set();

export const store = {
  get s() {
    return state;
  },
  set(fn, why) {
    fn(state);
    subs.forEach(f => {
      try {
        f(why);
      } catch (e) {
        console.error(e);
      }
    });
  },
  on(f) {
    subs.add(f);
    return () => subs.delete(f);
  },
};

/** Test-hook seam, not app API. The prototype's store read window.LLD_DATA, so assigning a new object there replaced the
    state. Only core/legacy-bridge.ts calls this, to keep that true. Deliberately not exported from the barrel. */
export const replaceState = next => {
  state = next;
};
