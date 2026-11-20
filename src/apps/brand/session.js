/* A brand's way into the dashboard.
   - Signed in (tokens stored): load everything from the API. A creator account is sent to the creator dashboard;
     an account that hasn't finished its brand profile goes to #setup.
   - Signed out: a read-only guest view of the creator directory. Any other click asks them to sign in.
   - The prototype's own account screens (#login, #signup, #forgot, #reset) hand over to the shared sign-in page,
     opening its sign-in, sign-up or forgot-password form with the brand side selected.

   The parity build runs on the prototype's sample data and skips all of this. */
import { clearAuth, isSignedIn, setSessionLostHandler } from "../../shared/api/client";
import { signOut } from "../../shared/api/auth";
import { stopLive } from "../../shared/api/realtime";
import { brandApi, loadBrand, loadBrandGuest } from "./live";
import { registerBrandKyc } from "./kyc";
import { showSkeleton, wireBusyButtons } from "../../shared/ux";
import { setAccountMenu } from "../../shared/react/account-menu";
import { promptSignInSheet, showLoadFailed } from "../../shared/react/session-ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the brand runtime is still untyped
const w = window;
const OPEN_DURING_SETUP = new Set(["setup", "kyc"]);
const PASSWORD_SCREENS = new Set(["login", "signup", "forgot", "reset"]);
const GUEST_ROUTES = new Set(["home", "creators"]);

const view = () => document.getElementById("view");

/** F4: a page-shaped skeleton at once (never a blank area); a tab clicked meanwhile opens as soon as data lands. */
function loading(text = "Loading your dashboard") {
  showSkeleton(view(), text);
}

/** F5: the avatar opens Profile, Settings, Help and Sign out, so signing out is two clicks from anywhere. */
function avatarMenu() {
  const L = w.LLD;
  const toSettings = () => {
    L.go("#profile");
    setTimeout(
      () => document.querySelector("[data-settings]")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };
  setAccountMenu({
    who: () => ({
      name: w.LLD_DATA.me.brand || "",
      sub: w.LLD_DATA.session.email || w.LLD_DATA.me.name || "",
    }),
    items: [
      { label: "Profile", icon: "user", run: () => L.go("#profile") },
      { label: "Settings", icon: "filter", run: toSettings },
      { label: "Help", icon: "info", run: () => L.go("#support") },
      { kind: "sep", label: "" },
      {
        label: "Sign out",
        icon: "logout",
        run: () =>
          L.store.set(s => {
            s.session.signedIn = false;
          }, "signed-out"),
      },
    ],
  });
}

function failed(retry) {
  showLoadFailed(view(), retry);
}

function hideDemoBits() {
  const st = document.createElement("style");
  st.textContent =
    ".sample,.bk-sample,.work-demo{display:none!important}" + "html.is-guest [data-me-handle]{opacity:.7}";
  document.head.appendChild(st);
}

function promptSignIn(why = "Sign in to continue") {
  promptSignInSheet(why, "brand");
}

function guardClicks() {
  document.addEventListener(
    "click",
    e => {
      const s = w.LLD_DATA.session;
      if (!s.guest || s.signedIn) return;
      const t = e.target;
      if (t.closest(".sheet, [role=dialog], [data-guest-ok]")) return;
      const nav = t.closest("a[href^='#']");
      if (nav) {
        const h = (nav.getAttribute("href") || "").replace(/^#/, "");
        if (GUEST_ROUTES.has(h)) return;
      }
      /* searching and filtering the directory is looking, not doing */
      if (
        t.closest(
          "#view .creators-filters, #view .creators-search, #view [data-filter], #view select, #view input[type=search]",
        )
      )
        return;
      const hit = t.closest("a, button, input, select, textarea, label, summary, [data-go], [role=button]");
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      promptSignIn();
    },
    true,
  );
}

async function enterSignedIn() {
  loading();
  try {
    const user = await loadBrand();
    if (user.role === "creator") {
      location.replace("app.html#home");
      return false;
    }
    document.documentElement.classList.remove("is-guest");
    w.LLD.store.set(s => {
      s.session.firstRun = !!user.needsOnboarding || !user.role;
    }, "signed-in");
    return true;
  } catch (e) {
    if (e.status === 401) {
      clearAuth();
      return enterGuest();
    }
    return new Promise(resolve => failed(() => resolve(enterSignedIn())));
  }
}

async function enterGuest() {
  loading("Loading Linkloom");
  await loadBrandGuest();
  document.documentElement.classList.add("is-guest");
  w.LLD.store.set(s => {
    s.session.signedIn = false;
    s.session.guest = true;
    s.me.brand = "Guest";
    s.me.name = "Not signed in";
  }, "guest");
  if (!location.hash || location.hash === "#home" || location.hash === "#login")
    location.replace("#creators");
  return true;
}

/** Returns false (or resolves to false) when the page is leaving, so the dashboard should not boot. */
export function initBrandSession() {
  if (import.meta.env.VITE_TEST_HOOKS) return true;
  hideDemoBits();
  registerBrandKyc();

  w.LLD.live = Object.assign(Object.create(null), brandApi, {
    promptSignIn,
    get guest() {
      return !!w.LLD_DATA.session.guest;
    },
  });

  setSessionLostHandler(() => {
    stopLive();
    location.href = "signin.html?role=brand&expired=1";
  });

  w.LLD.setGuestRoutes(GUEST_ROUTES);
  wireBusyButtons();
  avatarMenu();
  guardClicks();

  w.LLD.setRouteGuard(name => {
    const s = w.LLD_DATA.session;
    if (PASSWORD_SCREENS.has(name)) {
      if (s.signedIn) return "#home";
      /* open the matching form on the shared page: sign up, forgot password, or sign in */
      const to = name === "signup" ? "&join=1" : name === "forgot" || name === "reset" ? "&forgot=1" : "";
      location.replace(`signin.html?role=brand${to}`);
      return null;
    }
    return s.signedIn && s.firstRun && !OPEN_DURING_SETUP.has(name) ? "#setup" : null;
  });

  /* Changes the screens make to the store that map one-to-one onto the server: favourites, the cart (kept per account
     on this device), read notifications and the budget. Each is diffed against what was there before. */
  let favs = new Set(),
    reads = new Set();
  const snap = () => {
    favs = new Set(w.LLD_DATA.favorites);
    reads = new Set(w.LLD_DATA.notifications.filter(n => n.read).map(n => n.id));
  };
  w.LLD.store.on(why => {
    const s = w.LLD_DATA;
    if (why === "live-loaded" || why === "live-refresh") return snap();
    if (!s.session.signedIn) return;
    if (why === "favorite") {
      const now = new Set(s.favorites);
      const changes = [
        ...[...now].filter(id => !favs.has(id)).map(id => [id, true]),
        ...[...favs].filter(id => !now.has(id)).map(id => [id, false]),
      ];
      favs = now;
      for (const [id, on] of changes)
        brandApi.setFavorite(id, on).catch(e => w.LLD.toast(brandApi.errorText(e), "alert"));
    } else if (why === "cart-add" || why === "cart-remove" || why === "invite") brandApi.saveCart(s.cart);
    else if (why === "budget-changed") brandApi.saveBudget(s.budget);
    else if (why === "job-draft" || why === "job-published" || why === "job-deleted")
      brandApi.saveDrafts(s.jobs);
    else if (why === "notif-read" || why === "notif-read-all") {
      const now = s.notifications.filter(n => n.read).map(n => n.id);
      const fresh = now.filter(id => !reads.has(id));
      reads = new Set(now);
      if (why === "notif-read-all" || fresh.length > 1)
        void brandApi.readAllNotifications().catch(() => undefined);
      else fresh.forEach(id => void brandApi.readNotification(id).catch(() => undefined));
    }
  });

  w.LLD.store.on(why => {
    if (why === "chat-live" && location.hash === "#messages") w.LLD.route();
  });

  /* a creator's full profile (packages, gallery, reviews) loads when it is opened */
  const fetched = new Set();
  const creatorDetail = () => {
    const m = /^#creator-(.+)$/.exec(location.hash);
    if (!m || fetched.has(m[1]) || !w.LLD_DATA.session.signedIn) return;
    fetched.add(m[1]);
    brandApi.creatorDetail(m[1]).then(
      () => location.hash === "#creator-" + m[1] && w.LLD.route(),
      () => undefined,
    );
  };
  addEventListener("hashchange", creatorDetail);
  setTimeout(creatorDetail, 0);
  /* opened straight from a link (brand.html#creator-<id>): the first try ran before sign-in finished, so try again
     once the data has loaded */
  w.LLD.store.on(why => {
    if (why === "live-loaded") creatorDetail();
  });

  /* signing out (profile) ends the server session, then hands over to the shared page */
  let was = isSignedIn();
  w.LLD.store.on(why => {
    const now = w.LLD_DATA.session.signedIn;
    if (was && !now && why === "signed-out") {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=brand&out=1"));
    }
    was = now;
  });
  /* the profile's sign-out goes through LLD.auth when the auth screens loaded it */
  if (w.LLD.auth) {
    w.LLD.auth.signOut = () => {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=brand&out=1"));
    };
  }

  return isSignedIn() ? enterSignedIn() : enterGuest();
}
