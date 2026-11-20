/* The shared creator kit (LLD.ck): numbers, rates, availability, saved creators and the cart, and the wiring of the
   creator card (kit.jsx) used by Find creators and Saved creators (creators-list.jsx), the creator profile and the cart.
   Owner: Builder B. View state lives in LLD_DATA.ui.creators (and a sessionStorage copy, in try/catch).
   Classes are .creators-*; styles in creators.css. */
import { rateList as listRates, lowestRate, hasRates, RATE_ON_REQUEST } from "./creator-rates";

(() => {
  const L = window.LLD,
    S = () => window.LLD_DATA;
  /* motion calls are always guarded: a missing or failing hook never breaks a screen */
  const mo = (fn, ...a) => {
    try {
      const m = L.motion;
      return m && m[fn] ? m[fn](...a) : null;
    } catch (e) {
      return null;
    }
  };
  const flip = (mutate, nodes) => {
    let done = false;
    const m = () => {
      done = true;
      mutate();
    };
    try {
      L.motion && L.motion.flip && L.motion.flip(m, nodes);
    } catch (e) {}
    if (!done) mutate();
  };

  const UI0 = {
    q: "",
    cats: [],
    platform: "",
    country: "",
    state: "",
    city: "",
    lang: "",
    followers: "",
    er: 0,
    pmin: "",
    pmax: "",
    rating: 0,
    verified: false,
    avail: "",
    content: [],
    gender: "",
    age: "",
    sort: "match",
    hidden: [],
    showHidden: false,
    more: false,
  };
  const SS_KEY = "ll.b.creatorsUI";
  function ensure() {
    const s = S();
    s.ui = s.ui || {};
    s.favorites = s.favorites || [];
    s.cart = s.cart || [];
    const u = s.ui.creators || (s.ui.creators = {});
    Object.keys(UI0).forEach(k => {
      if (!(k in u)) u[k] = Array.isArray(UI0[k]) ? [] : UI0[k];
    });
    ["cats", "content", "hidden"].forEach(k => {
      if (!Array.isArray(u[k])) u[k] = [];
    });
    return s;
  }
  ensure();
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) Object.assign(S().ui.creators, JSON.parse(raw));
  } catch (e) {}
  const persist = () => {
    try {
      const { scrollY, ...keep } = S().ui.creators;
      sessionStorage.setItem(SS_KEY, JSON.stringify(keep));
    } catch (e) {}
  };

  /* ---------- lookups and numbers ---------- */
  const PLAT = {
    instagram: { name: "Instagram", ic: "ig", unit: "Followers" },
    youtube: { name: "YouTube", ic: "yt", unit: "Subscribers" },
  };
  const FORMATS = { instagram: ["Reel", "Story", "Carousel"], youtube: ["Video", "Short"] };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pct = n => (Math.round(n * 10) / 10).toFixed(1) + "%";
  const isFav = id => S().favorites.includes(id);
  const inCart = id => S().cart.includes(id);
  const plats = (c, p) => c.platforms.filter(x => !p || x.p === p);
  const reach = (c, p) => plats(c, p).reduce((n, x) => n + x.followers, 0);
  const weighted = (c, p, k) => {
    const ps = plats(c, p),
      f = ps.reduce((n, x) => n + x.followers, 0);
    return f ? ps.reduce((n, x) => n + x.followers * x[k], 0) / f : 0;
  };
  const erOf = (c, p) => weighted(c, p, "er");
  const viewsOf = (c, p) => Math.round(weighted(c, p, "avgViews"));
  /* rates: empty or zero entries never count, so the lowest rate is never taken over nothing (no "₹∞") */
  const rateList = (c, types) => listRates(c.rates, types);
  const fromRate = (c, types) => lowestRate(c.rates, types);
  /* engagement and reach the backend hasn't sent read as a dash, not as 0 */
  const erTxt = v => (v > 0 ? pct(v) : "—");
  const folTxt = n => (n > 0 ? L.compact(n) : "—");

  /* availability: 'open' | 'from 15 Nov' | 'busy until 20 Nov' -> days from today until the creator can start */
  const MON = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  function availDays(c) {
    const a = c.availability || "open";
    if (a === "open") return 0;
    const m = /(\d{1,2})\s+([A-Z][a-z]{2})/.exec(a);
    if (!m || !(m[2] in MON)) return 0;
    const t = L.today();
    let y = t.getFullYear();
    if (MON[m[2]] < t.getMonth()) y++;
    const d = new Date(Date.UTC(y, MON[m[2]], +m[1], 6, 30));
    const n = Math.round((d - new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 6, 30))) / 864e5);
    return /until/.test(a) ? n + 1 : n;
  }
  const availLabel = c => {
    const a = c.availability || "open";
    return a === "open" ? "Available now" : /until/.test(a) ? cap(a) : "Free " + a;
  };
  /* Best match: how well a creator fits this brand (industry, city, quality signals) */
  function score(c) {
    const me = S().me;
    let s = 0;
    if (c.categories.includes(me.industry)) s += 30;
    if (c.city === me.city) s += 8;
    s += (c.rating || 4.2) * 6 + erOf(c) * 1.5 + (c.verified ? 6 : 0) + (availDays(c) <= 0 ? 4 : 0);
    return s;
  }

  /* ---------- saved creators and cart (shared) ---------- */
  function setFav(id, on) {
    L.store.set(s => {
      s.favorites = s.favorites.filter(x => x !== id);
      if (on) s.favorites.push(id);
    }, "favorite");
  }
  function toggleFav(id, force) {
    const on = force === undefined ? !isFav(id) : force,
      c = L.creator(id);
    setFav(id, on);
    L.toast(on ? `${c.name} saved` : `${c.name} removed from saved creators`, on ? "bookmark" : "close");
    return on;
  }
  /* add to cart: a short thread runs from the button to the cart in the top bar, so you see where it went */
  function addToCart(id, fromEl) {
    const c = L.creator(id);
    if (!c) return;
    if (!inCart(id))
      L.store.set(s => {
        s.cart.push(id);
      }, "cart-add");
    const cartBtn = document.getElementById("cartBtn");
    if (fromEl && cartBtn && L.motion && L.motion.thread) mo("thread", fromEl, cartBtn);
    else if (cartBtn) mo("bump", cartBtn);
    L.toast(`${c.name} added to your hiring cart`, "cart");
  }
  function removeFromCart(id) {
    L.store.set(s => {
      s.cart = s.cart.filter(x => x !== id);
    }, "cart-remove");
  }

  /* ---------- the creator card (kit.jsx); its cart button label, which the wiring swaps in place ---------- */
  const cartLabel = id =>
    inCart(id) ? `${L.icon("check", "ic")}In cart` : `${L.icon("cart", "ic")}Add to cart`;
  /* sew the bookmark shut when saved: dashes close into a line, then it fills (CSS .is-stitch) */
  function stitch(btn, on) {
    if (!btn) return;
    btn.classList.remove("is-stitch");
    if (!on || L.RM) return;
    void btn.offsetWidth;
    btn.classList.add("is-stitch");
    const off = () => {
      btn.classList.remove("is-stitch");
      btn.removeEventListener("animationend", off);
    };
    btn.addEventListener("animationend", off);
    setTimeout(off, 900);
  }
  function settle(btn) {
    if (!btn || L.RM) return;
    btn.classList.remove("is-settle");
    void btn.offsetWidth;
    btn.classList.add("is-settle");
    const off = () => {
      btn.classList.remove("is-settle");
      btn.removeEventListener("animationend", off);
    };
    btn.addEventListener("animationend", off);
    setTimeout(off, 700);
  }
  function syncCard(root, id) {
    const on = isFav(id),
      c = L.creator(id);
    L.$$(`.creators-card[data-id="${id}"]`, root).forEach(k => {
      k.classList.toggle("is-fav", on);
      const h = k.querySelector(".creators-fav");
      if (h && h.getAttribute("aria-pressed") !== String(on)) {
        h.setAttribute("aria-pressed", on);
        h.setAttribute("aria-label", `${on ? "Saved" : "Save"}: ${c.name}`);
        h.title = on ? "Remove from saved creators" : "Save this creator (or swipe right)";
        stitch(h, on);
      }
      const b = k.querySelector("[data-cart]");
      if (b) {
        const inn = inCart(id);
        b.classList.toggle("is-in", inn);
        b.classList.toggle("lq-s", inn);
        b.classList.toggle("lq-p", !inn);
        b.querySelectorAll(".t,.t2").forEach(x => {
          x.innerHTML = cartLabel(id);
        });
        b.setAttribute("aria-label", inn ? `${c.name} is in your cart. Open cart` : `Add ${c.name} to cart`);
      }
    });
  }

  /* wire every card inside root: buttons, swipe (right = save, left = hide), press, keys S / C / H */
  function wire(root, { onHide, onFav } = {}) {
    const detach = [];
    const onClick = e => {
      const k = e.target.closest(".creators-card");
      if (!k || !root.contains(k)) return;
      const id = k.dataset.id;
      if (e.target.closest(".creators-fav")) {
        e.preventDefault();
        const on = toggleFav(id);
        syncCard(root, id);
        onFav && onFav(id, on, k);
      } else if (e.target.closest("[data-cart]")) {
        e.preventDefault();
        if (inCart(id)) L.go("#cart");
        else {
          addToCart(id, e.target.closest("[data-cart]"));
          syncCard(root, id);
        }
      } else if (e.target.closest(".creators-hide")) {
        e.preventDefault();
        onHide && onHide(id, k);
      }
    };
    root.addEventListener("click", onClick);
    const onKey = e => {
      const k = e.target.closest(".creators-card");
      if (!k || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const id = k.dataset.id,
        key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        const on = toggleFav(id);
        syncCard(root, id);
        onFav && onFav(id, on, k);
      } else if (key === "c") {
        e.preventDefault();
        if (!inCart(id)) {
          addToCart(id, k.querySelector("[data-cart]"));
          syncCard(root, id);
        }
      } else if (key === "h" && onHide && k.querySelector(".creators-hide")) {
        e.preventDefault();
        onHide(id, k);
      }
    };
    root.addEventListener("keydown", onKey);
    const attach = k => {
      if (k.dataset.wired) return;
      k.dataset.wired = "1";
      const id = k.dataset.id;
      const off = mo("swipe", k, {
        rightLabel: "Save",
        rightIcon: "bookmark",
        rightTone: "coral",
        ...(onHide && k.querySelector(".creators-hide")
          ? { leftLabel: "Hide", leftIcon: "close", leftTone: "ink", onLeft: () => onHide(id, k) }
          : {}),
        hint: k === root.querySelector(".creators-card"),
        onRight: () => {
          const on = toggleFav(id, true);
          syncCard(root, id);
          onFav && onFav(id, on, k);
        },
      });
      if (typeof off === "function") detach.push(off);
      mo("press", k);
    };
    L.$$(".creators-card", root).forEach(attach);
    return {
      attach,
      cleanup: () => {
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKey);
        detach.forEach(f => {
          try {
            f();
          } catch (e) {}
        });
      },
    };
  }

  L.ck = {
    ensure,
    PLAT,
    FORMATS,
    cap,
    pct,
    isFav,
    inCart,
    reach,
    erOf,
    viewsOf,
    fromRate,
    rateList,
    hasRates: c => hasRates(c.rates),
    RATE_ON_REQUEST,
    availDays,
    availLabel,
    wire,
    syncCard,
    stitch,
    settle,
    toggleFav,
    setFav,
    addToCart,
    removeFromCart,
    mo,
    flip,
    score,
    /* for Find creators (creators-list.jsx) and the card (kit.jsx): the ER line and the view-state copy */
    erTxt,
    persist,
  };
})();
