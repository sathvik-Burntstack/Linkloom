/* Google Identity Services. Google only issues an ID token from its own button (or One Tap), so the designed
   "Continue with Google" button gets Google's real button laid over it, invisible, at the same size.
   The page keeps its look; the click lands on Google's button.
   Until Google's button is really there, a click on the designed one would do nothing, so the page is told the state
   ("loading", "ready", "failed") and shows it on the button; after a failure a click on the button tries again. */
const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "591280470035-mamos86blk66gpr7bufpv48ln9dntsef.apps.googleusercontent.com";
const SRC = "https://accounts.google.com/gsi/client";
const LOAD_MS = 15000; // a hung request (no load, no error) counts as failed after this
const BUTTON_MS = 10000; // Google's script loaded but drew no button

export const GOOGLE_BLOCKED =
  "Google sign-in couldn't load. A weak connection, or an ad or tracker blocker, can stop it. Try again, or use your email.";
const NO_BUTTON = "Google sign-in didn't start. Try again, or use your email.";

let loading = null;
let handler = null;

function load() {
  const w = window;
  if (w.google?.accounts?.id) return Promise.resolve(init(w.google));
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.defer = true;
    const fail = () => {
      clearTimeout(t);
      loading = null; // the next attempt adds a fresh script
      reject(new Error(GOOGLE_BLOCKED));
    };
    const t = setTimeout(fail, LOAD_MS);
    s.onload = () => {
      clearTimeout(t);
      const g = window.google;
      if (!g?.accounts?.id) return fail();
      resolve(init(g));
    };
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return loading;
}

let ready = false;
function init(g) {
  if (ready) return g;
  ready = true;
  g.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: r => r.credential && handler?.(r.credential),
    ux_mode: "popup",
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
  });
  return g;
}

/** Starts fetching Google's script before the page needs it. */
export function preloadGoogle() {
  load().catch(() => {});
}

/** Lays Google's button over `button`. `onToken` gets the ID token after the person picks an account; `onState`
    gets "loading", "ready" or "failed" (with a message). Returns { retry, pause, stop }: retry() after a failure,
    pause(true) while signing in (clicks stop reaching Google's button), stop() removes the overlay. */
export function attachGoogle(button, onToken, onState) {
  handler = onToken;
  const host = document.createElement("div");
  host.className = "gsi-overlay";
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, {
    position: "absolute",
    inset: "0",
    opacity: "0.001",
    overflow: "hidden",
    zIndex: "2",
    cursor: "pointer",
  });
  const parentStyle = getComputedStyle(button);
  if (parentStyle.position === "static") button.style.position = "relative";
  button.appendChild(host);
  let gone = false;
  let attempt = 0;
  let stopObs = () => {};

  const start = () => {
    const mine = ++attempt;
    stopObs();
    host.replaceChildren();
    host.style.display = "none"; // no invisible layer over the button until Google's button is in it
    onState?.("loading");
    load()
      .then(g => {
        if (gone || mine !== attempt) return;
        const width = Math.max(200, Math.min(400, Math.round(button.getBoundingClientRect().width || 320)));
        host.style.display = "";
        g.accounts.id.renderButton(host, {
          type: "standard",
          size: "large",
          width,
          text: "continue_with",
          shape: "pill",
        });
        let shown = false;
        /* Centre Google's iframe on the designed button and scale it once, just enough that Google's clickable
           button covers all of it. (Scaling every nested layer compounded and pushed the real button below the
           designed one, leaving a few pixels at the bottom edge as the only spot that worked.) The iframe is the
           button plus Google's padding: 10 px each side, 2 px top and bottom. */
        const fit = () => {
          const ifr = host.querySelector("iframe");
          if (!ifr) return;
          host.querySelectorAll("div").forEach(n => {
            n.style.position = "static";
            n.style.transform = "none";
          });
          const w = ifr.offsetWidth || width + 20;
          const h = ifr.offsetHeight || 44;
          const s =
            Math.max(host.clientWidth / Math.max(1, w - 20), host.clientHeight / Math.max(1, h - 4)) * 1.04;
          Object.assign(ifr.style, {
            position: "absolute",
            left: "50%",
            top: "50%",
            margin: "0",
            transformOrigin: "center",
            transform: `translate(-50%, -50%) scale(${s.toFixed(3)})`,
          });
          if (!shown) {
            shown = true;
            clearTimeout(noButton);
            /* the iframe is in the page; give Google a moment to draw inside it before saying it's ready */
            const done = () => !gone && mine === attempt && onState?.("ready");
            if (ifr.contentDocument === null) ifr.addEventListener("load", done, { once: true });
            setTimeout(done, 1200);
          }
        };
        const noButton = setTimeout(() => {
          if (!shown && !gone && mine === attempt) {
            host.style.display = "none";
            onState?.("failed", NO_BUTTON);
          }
        }, BUTTON_MS);
        /* Google adds the iframe a moment after renderButton, and the designed button can change size */
        const mo = new MutationObserver(fit);
        mo.observe(host, { childList: true, subtree: true });
        const ro = new ResizeObserver(fit);
        ro.observe(host);
        stopObs = () => {
          clearTimeout(noButton);
          mo.disconnect();
          ro.disconnect();
        };
        fit();
      })
      .catch(e => {
        if (gone || mine !== attempt) return;
        host.style.display = "none";
        onState?.("failed", e.message);
      });
  };
  start();
  return {
    retry: start,
    pause(on) {
      host.style.pointerEvents = on ? "none" : "";
    },
    stop() {
      gone = true;
      stopObs();
      host.remove();
    },
  };
}
