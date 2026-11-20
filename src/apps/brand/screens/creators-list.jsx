/* Find creators (#creators) and Saved creators (#saved). Owner: Builder B. React screens (see src/shared/react/view.jsx).
   Mirrors the creator app's Find briefs screen: filter column, cards, sort, hide with undo, swipe, keyboard keys.
   The filter column shows the four filters brands use most (category, platform, followers, price); the rest sit
   behind "More filters", which opens by itself when one of them is set.
   The creator cards (kit.jsx) are drawn once, wired by the kit (save, cart, hide, swipe, keys) and then shown, hidden
   and re-ordered in place; their ER and price lines follow the filters. */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq } from "@/shared/react/view";
import { CREATOR_LANGUAGES } from "@/shared/creator-languages";
import { CITIES_BY_STATE } from "@/shared/india-cities";
import { CreatorCard, refreshCardLines } from "./kit";

const L = window.LLD,
  S = () => window.LLD_DATA;
const K = () => L.ck;

/* ---------- filter vocabularies ---------- */
const FIRST_LANGUAGES = ["Telugu", "Hindi", "English"];
const INDIAN_STATES = Object.keys(CITIES_BY_STATE);
const FOLLOW = [
  ["", "Any"],
  ["0-50000", "Under 50K"],
  ["50000-100000", "50K–1L"],
  ["100000-300000", "1L–3L"],
  ["300000-", "3L+"],
];
const ERS = [
  [0, "Any"],
  [3, "3%+"],
  [5, "5%+"],
  [7, "7%+"],
];
const RATINGS = [
  [0, "Any"],
  [4, "4.0+"],
  [4.5, "4.5+"],
  [4.8, "4.8+"],
];
const AVAIL = [
  ["", "Any time"],
  ["now", "Available now"],
  ["2w", "Within 2 weeks"],
];
const GENDERS = [
  ["", "Any"],
  ["Woman", "Women"],
  ["Man", "Men"],
];
const AGES = [
  ["", "Any"],
  ["18-24", "18–24"],
  ["25-34", "25–34"],
  ["35-", "35+"],
];
const CONTENT = ["Reel", "Story", "Carousel", "Video", "Short"];
const SORTS = {
  match: "Best match",
  followers: "Most followers",
  er: "Highest engagement",
  price: "Price: low to high",
  rating: "Highest rating",
};
const range = v => {
  const [a, b] = String(v).split("-");
  return [+a || 0, b ? +b : Infinity];
};
const rup = v => (v === "" || v == null ? null : Math.max(0, parseInt(v, 10) || 0));
const priceErr = ui => {
  const a = rup(ui.pmin),
    b = rup(ui.pmax);
  return a != null && b != null && a > b ? "Minimum is above maximum." : "";
};

function passes(c, ui, skip) {
  const k = K(),
    on = x => x !== skip;
  const q = ui.q.trim().toLowerCase().replace(/^@/, "");
  if (
    on("q") &&
    q &&
    ![c.name, c.handle, ...c.platforms.map(p => p.handle)]
      .join(" ")
      .toLowerCase()
      .replace(/@/g, "")
      .includes(q)
  )
    return false;
  if (on("platform") && ui.platform && !c.platforms.some(p => p.p === ui.platform)) return false;
  if (on("country") && ui.country && c.country !== ui.country) return false;
  if (on("state") && ui.state && c.state !== ui.state) return false;
  if (on("city") && ui.city && c.city !== ui.city) return false;
  if (on("lang") && ui.lang && !c.languages.includes(ui.lang)) return false;
  if (on("followers") && ui.followers) {
    const [a, b] = range(ui.followers),
      f = k.reach(c, ui.platform);
    if (f < a || f >= b) return false;
  }
  if (on("er") && ui.er && k.erOf(c, ui.platform) < ui.er) return false;
  if (on("price") && !priceErr(ui) && (rup(ui.pmin) != null || rup(ui.pmax) != null)) {
    const a = (rup(ui.pmin) || 0) * 100,
      b = rup(ui.pmax) != null ? rup(ui.pmax) * 100 : Infinity;
    if (!k.rateList(c, ui.content).some(([, v]) => v >= a && v <= b)) return false;
  }
  if (on("rating") && ui.rating && !(c.rating && c.rating >= ui.rating)) return false;
  if (on("verified") && ui.verified && !c.verified) return false;
  if (on("avail") && ui.avail && k.availDays(c) > (ui.avail === "now" ? 0 : 14)) return false;
  const ct = ui.content.filter(x => skip !== "ct:" + x);
  if (ct.length && !ct.some(t => c.content.includes(t))) return false;
  if (on("gender") && ui.gender && c.gender !== ui.gender) return false;
  if (on("age") && ui.age) {
    const [a, b] = range(ui.age);
    if (!c.age || c.age < a || c.age > (b === Infinity ? 200 : b)) return false;
  }
  return true;
}
/* categories are any-of; `skip` lets the empty state ask "how many would come back without this one filter?" */
const catOk = (c, ui, skip) => {
  const cs = ui.cats.filter(x => skip !== "cat:" + x);
  return !cs.length || c.categories.some(x => cs.includes(x));
};
const keep = (c, ui, skip) => catOk(c, ui, skip) && passes(c, Object.assign({}, ui, { cats: [] }), skip);

function filtered(ui) {
  const k = K();
  let list = S().creators.filter(c => keep(c, ui));
  const hiddenCount = list.filter(c => ui.hidden.includes(c.id)).length;
  if (!ui.showHidden) list = list.filter(c => !ui.hidden.includes(c.id));
  const by =
    {
      match: (a, b) => k.score(b) - k.score(a),
      followers: (a, b) => k.reach(b, ui.platform) - k.reach(a, ui.platform),
      er: (a, b) => k.erOf(b, ui.platform) - k.erOf(a, ui.platform),
      price: (a, b) =>
        ((k.fromRate(a, ui.content) || {}).price || 9e12) - ((k.fromRate(b, ui.content) || {}).price || 9e12),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviews - a.reviews,
    }[ui.sort] || ((a, b) => k.score(b) - k.score(a));
  return { list: list.sort(by), hiddenCount };
}

/* the chips above the results: one per active filter, each removable */
function actives(ui) {
  const A = [],
    lab = (arr, v) => (arr.find(x => String(x[0]) === String(v)) || [, v])[1];
  const add = (k, label, off) => A.push({ k, label, off });
  if (ui.q.trim()) add("q", `“${ui.q.trim()}”`, u => (u.q = ""));
  ui.cats.forEach(x => add("cat:" + x, x, u => (u.cats = u.cats.filter(y => y !== x))));
  if (ui.platform) add("platform", K().PLAT[ui.platform].name, u => (u.platform = ""));
  ui.content.forEach(x => add("ct:" + x, x, u => (u.content = u.content.filter(y => y !== x))));
  if (ui.followers) add("followers", lab(FOLLOW, ui.followers) + " followers", u => (u.followers = ""));
  if (ui.er) add("er", "Engagement " + lab(ERS, ui.er), u => (u.er = 0));
  if (ui.lang) add("lang", ui.lang, u => (u.lang = ""));
  if (ui.city) add("city", ui.city, u => (u.city = ""));
  if (ui.state)
    add("state", ui.state, u => {
      u.state = "";
      u.city = "";
    });
  if (ui.country)
    add("country", ui.country, u => {
      u.country = "";
      u.state = "";
      u.city = "";
    });
  const a = rup(ui.pmin),
    b = rup(ui.pmax);
  if ((a != null || b != null) && !priceErr(ui))
    add(
      "price",
      a != null && b != null
        ? `${L.inr(a * 100)}–${L.inr(b * 100)}`
        : a != null
          ? `From ${L.inr(a * 100)}`
          : `Up to ${L.inr(b * 100)}`,
      u => {
        u.pmin = "";
        u.pmax = "";
      },
    );
  if (ui.rating) add("rating", "Rated " + lab(RATINGS, ui.rating), u => (u.rating = 0));
  if (ui.verified) add("verified", "Verified only", u => (u.verified = false));
  if (ui.avail) add("avail", lab(AVAIL, ui.avail), u => (u.avail = ""));
  if (ui.gender) add("gender", lab(GENDERS, ui.gender), u => (u.gender = ""));
  if (ui.age) add("age", "Age " + lab(AGES, ui.age), u => (u.age = ""));
  return A;
}
const clearAll = ui =>
  Object.assign(ui, {
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
  });
/* filters behind "More filters": all but category, platform, followers and price (and the search box) */
const MORE = ["er", "lang", "city", "state", "country", "rating", "verified", "avail", "gender", "age"];
const isMore = k => k.startsWith("ct:") || MORE.includes(k);

/* ---------- the tabs above both screens: All creators / Saved ---------- */
const Tabs = ({ mode }) => {
  const n = S().favorites.length;
  return (
    <div className="seg creators-tabs" role="group" aria-label="Show">
      <button type="button" aria-pressed={String(mode === "all")} data-go="#creators">
        <Icon n="users" />
        All creators
      </button>
      <button type="button" aria-pressed={String(mode === "saved")} data-go="#saved">
        <Icon n="bookmark" />
        Saved creators {/* no "Saved 0" for a new brand: the count shows once something is saved */}
        <span className="creators-tab-n num" data-favn="" hidden={!n}>
          {n}
        </span>
      </button>
    </div>
  );
};

/* one collapsible filter row: its name, then what's chosen ("Any" when nothing is), then the controls */
function Acc({ k, label, value, ui, children }) {
  const open = useRef((ui.open || []).includes(k)).current;
  return (
    <details
      className={`creators-acc${value ? " is-set" : ""}`}
      data-acc={k}
      open={open}
      onToggle={e => {
        const o = new Set(ui.open || []);
        if (e.currentTarget.open) o.add(k);
        else o.delete(k);
        ui.open = [...o];
      }}
    >
      <summary>
        <span className="creators-acc-l" id={`crAcc-${k}`}>
          {label}
        </span>
        <span className="creators-acc-v" data-accv={k} title={value}>
          {value || "Any"}
        </span>
        <Icon n="down" />
      </summary>
      <div className="creators-acc-b">{children}</div>
    </details>
  );
}

function AllCreators() {
  const s = K().ensure(),
    ui = s.ui.creators,
    all = s.creators;
  const [, redraw] = useState(0);
  const [fOpen, setFOpen] = useState(false);
  /* the line under the list: the hidden count, or a note after hiding ({ undo: id }) or undoing ("back") */
  const note = useRef(null);
  const root = useRef(null),
    listEl = useRef(null),
    qEl = useRef(null),
    pminEl = useRef(null),
    pmaxEl = useRef(null),
    toggleEl = useRef(null),
    filtersEl = useRef(null),
    cards = useRef(null),
    timers = useRef({ q: 0, p: 0 });
  const first = useRef(true);
  if (first.current) {
    /* a filter set behind "More filters" (kept from the last visit) opens it, so nothing active is out of sight */
    ui.more = !!(ui.more || actives(ui).some(a => isMore(a.k)));
  }
  const uniq = values => [...new Set(values.filter(value => typeof value === "string" && value.trim()))].sort();
  const cats = uniq(all.flatMap(c => c.categories)),
    langs = [
      ...FIRST_LANGUAGES,
      ...uniq([...CREATOR_LANGUAGES, ...all.flatMap(c => c.languages)]).filter(l => !FIRST_LANGUAGES.includes(l)),
    ],
    countries = uniq(["India", ...all.map(c => c.country)]);

  /* React sets option.selected directly when filters are reset. Refresh the desktop labels after that commit. */
  useLayoutEffect(() => {
    for (const select of root.current.querySelectorAll(".creators-filters select")) select._ui?.sync?.();
  }, [ui.country, ui.state, ui.city, ui.lang]);

  /* show, hide and order the card nodes to match the filters; engagement follows the platform filter, the price follows
     the content type filter */
  const cardEls = useMemo(() => all.map(c => <CreatorCard key={c.id} c={c} ctx="list" />), []); // eslint-disable-line react-hooks/exhaustive-deps
  const placeCards = (lines = true) => {
    const { list: vis } = filtered(ui),
      ids = vis.map(c => c.id);
    cards.current.forEach((k, id) => {
      k.hidden = !ids.includes(id);
      k.classList.toggle("is-hidden-c", ui.hidden.includes(id));
    });
    ids.forEach(id => listEl.current.append(cards.current.get(id)));
    if (lines) refreshCardLines();
  };
  const apply = (animate = true, after) => {
    const mutate = () => {
      /* any redraw replaces "Back in your list." with the count; the Undo note stays until a filter is set */
      if (after !== undefined) note.current = after;
      else if (note.current === "back") note.current = null;
      flushSync(() => redraw(x => x + 1));
      placeCards();
    };
    animate ? K().flip(mutate, [...cards.current.values()]) : mutate();
    K().persist();
  };
  const set = (k, v) => {
    note.current = null;
    ui[k] = v;
    apply();
  };
  const toggleIn = (k, v) => set(k, ui[k].includes(v) ? ui[k].filter(x => x !== v) : [...ui[k], v]);
  const hide = id => {
    if (!ui.hidden.includes(id)) ui.hidden.push(id);
    apply(true, { undo: id });
  };

  useLayoutEffect(() => {
    first.current = false;
    const list = listEl.current;
    cards.current = new Map(L.$$(".creators-card", list).map(k => [k.dataset.id, k]));
    const wired = K().wire(list, { onHide: hide, onFav: () => redraw(x => x + 1) });
    placeCards(false);
    K().persist();
    K().mo("stagger", L.$$(".creators-card:not([hidden])", list));
    if (ui.scrollY && ui.back) {
      const y = ui.scrollY,
        back = ui.back;
      ui.back = null;
      requestAnimationFrame(() =>
        setTimeout(() => {
          window.scrollTo({ top: y, behavior: "auto" });
          const a = list.querySelector(`.creators-card[data-id="${back}"] .creators-card-link`);
          a && a.focus({ preventScroll: true });
        }, 30),
      );
    }
    const onScroll = () => {
      ui.scrollY = window.scrollY;
    };
    addEventListener("scroll", onScroll, { passive: true });
    /* remember which card opened a profile, so Back lands on it */
    const onOpen = e => {
      const a = e.target.closest(".creators-card-link");
      if (a) {
        ui.back = a.closest(".creators-card").dataset.id;
        ui.from = "creators";
      }
    };
    list.addEventListener("click", onOpen, true);
    const t = timers.current;
    return () => {
      wired.cleanup();
      clearTimeout(t.q);
      clearTimeout(t.p);
      removeEventListener("scroll", onScroll);
      list.removeEventListener("click", onOpen, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* the boxes the brand types in follow the filters when something else changes them (Clear all, a removed chip) */
  useLayoutEffect(() => {
    const a = document.activeElement;
    if (qEl.current.value !== ui.q && a !== qEl.current) qEl.current.value = ui.q;
    if (a !== pminEl.current) pminEl.current.value = ui.pmin;
    if (a !== pmaxEl.current) pmaxEl.current.value = ui.pmax;
  });

  /* location choices narrow each other: country → state → city (a choice that no longer fits is cleared) */
  const pool = all.filter(c => !ui.country || c.country === ui.country);
  const india = !ui.country || ui.country === "India";
  const states = uniq([...(india ? INDIAN_STATES : []), ...pool.map(c => c.state)]);
  if (ui.state && !states.includes(ui.state)) ui.state = "";
  const cities = uniq([
    ...(india && Object.hasOwn(CITIES_BY_STATE, ui.state) ? CITIES_BY_STATE[ui.state] : []),
    ...pool.filter(c => !ui.state || c.state === ui.state).map(c => c.city),
  ]).filter(city => city !== "India");
  if (ui.city && !cities.includes(ui.city)) ui.city = "";

  const { list: vis, hiddenCount } = filtered(ui);
  const act = actives(ui),
    n = act.length,
    nMore = act.filter(a => isMore(a.k)).length,
    pe = priceErr(ui);
  const empty = !vis.length;
  const lab = (opts, v) => (opts.find(o => String(o[0]) === String(v)) || [, ""])[1];
  const inr = v => "₹" + Number(v).toLocaleString("en-IN");
  const accv = {
    cat: ui.cats.join(", "),
    plat: ui.platform ? K().PLAT[ui.platform].name : "",
    fol: ui.followers ? lab(FOLLOW, ui.followers) : "",
    price:
      ui.pmin && ui.pmax
        ? `${inr(ui.pmin)}–${inr(ui.pmax)}`
        : ui.pmin
          ? `From ${inr(ui.pmin)}`
          : ui.pmax
            ? `Up to ${inr(ui.pmax)}`
            : "",
    ct: ui.content.join(", "),
    er: +ui.er ? lab(ERS, ui.er) : "",
    lang: ui.lang,
    loc: [ui.city, ui.state, ui.country === "India" && (ui.city || ui.state) ? "" : ui.country]
      .filter(Boolean)
      .join(", "),
    rating: +ui.rating ? lab(RATINGS, ui.rating) : "",
    avail: ui.avail ? lab(AVAIL, ui.avail) : "",
    ver: ui.verified ? "Verified only" : "",
    who: [ui.gender && lab(GENDERS, ui.gender), ui.age && lab(AGES, ui.age)].filter(Boolean).join(", "),
  };
  const best = empty
    ? act
        .map(a => ({ a, n: S().creators.filter(c => keep(c, ui, a.k) && !ui.hidden.includes(c.id)).length }))
        .sort((x, y) => y.n - x.n)[0]
    : null;
  const removeChip = (k, btn) => {
    const a = actives(ui).find(x => x.k === k);
    if (!a) return;
    const nextK = btn && (btn.nextElementSibling || btn.previousElementSibling);
    const nk = nextK && nextK.dataset && nextK.dataset.off;
    a.off(ui);
    note.current = null;
    apply();
    const again = nk ? root.current.querySelector(`#crActive [data-off="${CSS.escape(nk)}"]`) : null;
    (again || qEl.current).focus({ preventScroll: true });
  };
  const clear = () => {
    if (!actives(ui).length) return;
    clearAll(ui);
    note.current = null;
    apply();
    L.toast("Filters cleared", "filter");
    qEl.current.focus({ preventScroll: true });
  };
  const chip = (attr, v, label, on, onClick) => (
    <button
      key={String(v)}
      className="chip"
      type="button"
      {...{ [`data-${attr}`]: v }}
      aria-pressed={String(on)}
      onClick={onClick}
    >
      {label}
    </button>
  );
  const chips = (labelId, attr, opts, cur, pick) => (
    <div className="chips" role="group" aria-labelledby={labelId}>
      {opts.map(([v, t]) =>
        chip(attr, v, t, String(v) === String(cur), e => {
          const b = e.currentTarget;
          pick(v);
          K().settle(b);
        }),
      )}
    </div>
  );
  const priceIn = (k, inp) => {
    const v = inp.value.replace(/[^\d]/g, "").slice(0, 7);
    if (v !== inp.value) inp.value = v;
    clearTimeout(timers.current.p);
    timers.current.p = setTimeout(() => set(k, v), 260);
  };
  const nt = note.current;

  return (
    <div className="view-in creators" ref={root}>
      <header className="creators-head">
        <div className="creators-head-t">
          <h1 className="t-h1">Find creators</h1>
          <p className="muted">
            {all.length} {all.length === 1 ? "creator" : "creators"} on Instagram and YouTube,{" "}
            {all.filter(c => c.verified).length} of them verified. <span className="sample">Sample data</span>
          </p>
        </div>
        <div className="creators-search">
          <label className="sr-only" htmlFor="crQ">
            Search by creator name or username
          </label>
          <Icon n="search" />
          <input
            className="input"
            id="crQ"
            type="search"
            autoComplete="off"
            spellCheck="false"
            placeholder="Search name or @username"
            defaultValue={ui.q}
            ref={qEl}
            onChange={e => {
              clearTimeout(timers.current.q);
              const v = e.target.value;
              timers.current.q = setTimeout(() => set("q", v), 140);
            }}
          />
        </div>
      </header>
      <Tabs mode="all" />
      <div className="creators-layout">
        <aside
          className={`creators-filters${fOpen ? " is-open" : ""}`}
          id="crFilters"
          aria-label="Filters"
          ref={filtersEl}
        >
          <div className="creators-f-h">
            <p className="t-label">Filters</p>
            <Lq
              className="lq-s lq-sm creators-clear"
              data-clear=""
              aria-disabled={String(!n)}
              onClick={clear}
            >
              {n ? `Clear all (${n})` : "Clear all"}
            </Lq>
          </div>

          <div className="creators-accs">
            <Acc k="cat" label="Category" value={accv.cat} ui={ui}>
              <div className="chips" role="group" aria-labelledby="crAcc-cat">
                {cats.length ? (
                  cats.map(c =>
                    chip("cat", c, c, ui.cats.includes(c), e => {
                      const b = e.currentTarget;
                      toggleIn("cats", c);
                      K().settle(b);
                    }),
                  )
                ) : (
                  <p className="help">No categories yet.</p>
                )}
              </div>
            </Acc>
            <Acc k="plat" label="Platform" value={accv.plat} ui={ui}>
              <div className="seg creators-seg" role="group" aria-labelledby="crAcc-plat">
                {[
                  ["", "All"],
                  ["instagram", "Instagram", "ig"],
                  ["youtube", "YouTube", "yt"],
                ].map(([v, t, icn]) => (
                  <button
                    key={v}
                    type="button"
                    data-plat={v}
                    aria-pressed={String(v === ui.platform)}
                    onClick={() => set("platform", v)}
                  >
                    {icn ? <Icon n={icn} /> : null}
                    {t}
                  </button>
                ))}
              </div>
            </Acc>
            <Acc k="fol" label="Followers" value={accv.fol} ui={ui}>
              {chips("crAcc-fol", "fol", FOLLOW, ui.followers, v => set("followers", v))}
            </Acc>
            <Acc k="price" label="Price per post" value={accv.price} ui={ui}>
              <div className={`field creators-pricef${pe ? " is-err" : ""}`}>
                <div className="creators-pin" role="group" aria-labelledby="crAcc-price">
                  <label className="creators-pi">
                    <span className="sr-only">Minimum, in rupees</span>
                    <span aria-hidden="true">₹</span>
                    <input
                      className="input num"
                      id="crPmin"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Min"
                      defaultValue={ui.pmin}
                      ref={pminEl}
                      onInput={e => priceIn("pmin", e.currentTarget)}
                    />
                  </label>
                  <span className="creators-dash" aria-hidden="true">
                    to
                  </span>
                  <label className="creators-pi">
                    <span className="sr-only">Maximum, in rupees</span>
                    <span aria-hidden="true">₹</span>
                    <input
                      className="input num"
                      id="crPmax"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Max"
                      defaultValue={ui.pmax}
                      ref={pmaxEl}
                      onInput={e => priceIn("pmax", e.currentTarget)}
                    />
                  </label>
                </div>
                <p className="err" id="crPriceE" aria-live="polite">
                  {pe}
                </p>
                <p className="help">Any listed rate in this range counts.</p>
              </div>
            </Acc>
          </div>

          <button
            className="creators-more"
            type="button"
            data-more=""
            aria-expanded={String(!!ui.more)}
            aria-controls="crMore"
            onClick={() => {
              ui.more = !ui.more;
              flushSync(() => redraw(x => x + 1));
              K().persist();
              if (ui.more) K().mo("reveal", root.current.querySelector("#crMore"));
            }}
          >
            <Icon n="filter" />
            <span data-morel="">{nMore ? `More filters · ${nMore} active` : "More filters"}</span>
            <Icon n="down" />
          </button>
          <div className="creators-more-b creators-accs" id="crMore" hidden={!ui.more}>
            <Acc k="ct" label="Content type" value={accv.ct} ui={ui}>
              <div className="chips" role="group" aria-labelledby="crAcc-ct">
                {CONTENT.map(c =>
                  chip("ct", c, c, ui.content.includes(c), e => {
                    const b = e.currentTarget;
                    toggleIn("content", c);
                    K().settle(b);
                  }),
                )}
              </div>
            </Acc>
            <Acc k="er" label="Engagement rate" value={accv.er} ui={ui}>
              {chips("crAcc-er", "er", ERS, +ui.er, v => set("er", +v))}
            </Acc>
            <Acc k="lang" label="Language" value={accv.lang} ui={ui}>
              <label className="sr-only" htmlFor="crLang">
                Language
              </label>
              <select
                className="select"
                id="crLang"
                value={ui.lang}
                onChange={e => set("lang", e.target.value)}
              >
                <option value="">Any language</option>
                {langs.map(x => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Acc>
            <Acc k="loc" label="Location" value={accv.loc} ui={ui}>
              <div className="creators-loc">
                <div className="field">
                  <label htmlFor="crCountry">Country</label>
                  <select
                    className="select"
                    id="crCountry"
                    value={ui.country}
                    onChange={e => {
                      ui.state = "";
                      ui.city = "";
                      set("country", e.target.value);
                    }}
                  >
                    <option value="">Any country</option>
                    {countries.map(x => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="crState">State</label>
                  <select
                    className="select"
                    id="crState"
                    value={ui.state}
                    onChange={e => {
                      ui.city = "";
                      set("state", e.target.value);
                    }}
                  >
                    <option value="">Any state</option>
                    {states.map(x => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="crCity">City</label>
                  <select
                    className="select"
                    id="crCity"
                    value={ui.city}
                    onChange={e => {
                      const v = e.target.value,
                        c = pool.find(x => x.city === v);
                      if (v && c && !ui.state) ui.state = c.state; // picking a city fills in its state, so the chips read correctly
                      set("city", v);
                    }}
                  >
                    <option value="">{ui.state ? "Any city in " + ui.state : "Any city"}</option>
                    {cities.map(x => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Acc>
            <Acc k="rating" label="Rating" value={accv.rating} ui={ui}>
              {chips("crAcc-rating", "rating", RATINGS, +ui.rating, v => set("rating", +v))}
            </Acc>
            <Acc k="avail" label="Availability" value={accv.avail} ui={ui}>
              {chips("crAcc-avail", "avail", AVAIL, ui.avail, v => set("avail", v))}
            </Acc>
            <Acc k="ver" label="Verification" value={accv.ver} ui={ui}>
              <label className="check creators-verified">
                <input
                  type="checkbox"
                  id="crVer"
                  checked={!!ui.verified}
                  onChange={e => set("verified", e.target.checked)}
                />{" "}
                <span>
                  Verified creators only<span className="help">ID and platform checked by Linkloom</span>
                </span>
              </label>
            </Acc>
            <Acc k="who" label="Gender and age" value={accv.who} ui={ui}>
              <div className="field">
                <span className="lab" id="crGenL">
                  Gender
                </span>
                {chips("crGenL", "gender", GENDERS, ui.gender, v => set("gender", v))}
              </div>
              <div className="field">
                <span className="lab" id="crAgeL">
                  Age range
                </span>
                {chips("crAgeL", "age", AGES, ui.age, v => set("age", v))}
              </div>
              <p className="help">
                Creators choose whether to share these. Leave them on Any unless the brief needs it.
              </p>
            </Acc>
          </div>
          <Lq
            className="lq-p creators-f-done"
            data-done=""
            onClick={() => {
              flushSync(() => setFOpen(false));
              const top =
                root.current.querySelector(".creators-bar").getBoundingClientRect().top + scrollY - 80;
              window.scrollTo({ top: Math.max(0, top), behavior: L.RM ? "auto" : "smooth" });
              toggleEl.current.focus({ preventScroll: true });
            }}
          >
            {vis.length
              ? `Show ${vis.length} ${vis.length === 1 ? "creator" : "creators"}`
              : "No matches yet"}
          </Lq>
        </aside>

        <section className="creators-results" aria-label="Creators">
          <div className="creators-bar">
            <p className="creators-count" id="crCount" aria-live="polite">
              <b>{vis.length}</b> of {all.length} {all.length === 1 ? "creator" : "creators"} ·{" "}
              {ui.sort === "match" ? "Best match first" : SORTS[ui.sort]}
            </p>
            <Lq
              className="lq-s lq-sm creators-ftoggle"
              aria-expanded={String(fOpen)}
              data-guest-ok=""
              aria-controls="crFilters"
              ref={toggleEl}
              onClick={() => {
                const on = !fOpen;
                flushSync(() => setFOpen(on));
                if (on) {
                  K().mo("reveal", filtersEl.current);
                  const f = filtersEl.current.querySelector("button.chip");
                  f && f.focus({ preventScroll: true });
                }
              }}
            >
              <Icon n="filter" className="ic" />
              {n ? `Filters · ${n}` : "Filters"}
            </Lq>
            <div className="creators-sort">
              <label className="sr-only" htmlFor="crSort">
                Sort creators
              </label>
              <select
                className="select"
                id="crSort"
                value={ui.sort}
                onChange={e => set("sort", e.target.value)}
              >
                {Object.entries(SORTS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="creators-active" id="crActive" data-guest-ok="" aria-label="Active filters" hidden={!act.length}>
            {act.length ? (
              <>
                {act.map(a => (
                  <button
                    key={a.k}
                    className="chip creators-achip"
                    type="button"
                    data-off={a.k}
                    aria-label={`Remove filter: ${a.label}`}
                    onClick={e => removeChip(a.k, e.currentTarget)}
                  >
                    {a.label}
                    <Icon n="close" />
                  </button>
                ))}
                <Lq className="lq-s lq-sm" data-clear="" onClick={clear}>
                  Clear all
                </Lq>
              </>
            ) : null}
          </div>
          <div className="creators-list" id="crList" ref={listEl} hidden={empty}>
            {cardEls}
          </div>
          <div className="empty creators-empty" hidden={!empty}>
            <img src="assets/step-04-orbit.svg" width="160" height="117" alt="" />
            <p className="t-h2">No creators match all of that.</p>
            <p className="muted" data-suggest="" data-guest-ok="">
              {best && best.n ? (
                <>
                  Removing <b>{best.a.label}</b> brings back {best.n} {best.n === 1 ? "creator" : "creators"}.{" "}
                  <button
                    className="btn-q"
                    type="button"
                    data-off={best.a.k}
                    onClick={() => removeChip(best.a.k)}
                  >
                    Remove it
                  </button>
                </>
              ) : (
                "Remove a filter or two. Price and availability narrow the list fastest."
              )}
            </p>
            <Lq className="lq-p" data-clear="" onClick={clear}>
              Clear all filters
            </Lq>
          </div>
          <p className="creators-hidden-line" aria-live="polite">
            {nt === "back" ? (
              "Back in your list."
            ) : nt && nt.undo ? (
              <>
                Hidden {L.creator(nt.undo).name}.{" "}
                <button
                  className="btn-q"
                  type="button"
                  data-undo={nt.undo}
                  onClick={() => {
                    ui.hidden = ui.hidden.filter(x => x !== nt.undo);
                    apply(true, "back");
                  }}
                >
                  Undo
                </button>
              </>
            ) : hiddenCount ? (
              <>
                {hiddenCount} hidden {hiddenCount === 1 ? "creator" : "creators"} ·{" "}
                <button
                  className="btn-q"
                  type="button"
                  data-showhidden=""
                  onClick={() => set("showHidden", !ui.showHidden)}
                >
                  {ui.showHidden ? "Hide them again" : "Show"}
                </button>
              </>
            ) : null}
          </p>
        </section>
      </div>
    </div>
  );
}

/* ---------- #saved (saved creators) ---------- */
function SavedList({ onUnsave }) {
  const box = useRef(null);
  const s = S();
  /* drawn once per paint (the list is keyed by it): an unsave takes its card out in place */
  const cardEls = useMemo(
    () =>
      s.favorites
        .map(L.creator)
        .filter(Boolean)
        .map(c => <CreatorCard key={c.id} c={c} ctx="saved" hide={false} platform="" content={[]} />),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useLayoutEffect(() => {
    const list = box.current;
    const wired = K().wire(list, {
      onFav: (id, on, k) => {
        if (on) return onUnsave(null);
        K().flip(
          () => {
            k.remove();
            onUnsave(id);
          },
          () => [...list.children],
        );
      },
    });
    return () => wired.cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="creators-list creators-list--3" id="crSaved" ref={box} hidden={!s.favorites.length}>
      {cardEls}
    </div>
  );
}

function Saved() {
  const s = K().ensure();
  const [, redraw] = useState(0);
  const [ver, setVer] = useState(0);
  /* the line under the list: { removed: id } after an unsave, "back" after its undo */
  const [line, setLine] = useState(null);
  const root = useRef(null);
  const paintN = useRef(s.favorites.length); // how many were saved when the list was last drawn
  const after = useRef(null);
  useLayoutEffect(() => {
    K().mo("stagger", L.$$(".creators-card", root.current));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const id = after.current;
    if (!id) return;
    after.current = null;
    const k = root.current.querySelector(`.creators-card[data-id="${id}"]`);
    if (k) {
      K().mo("fresh", k);
      const a = k.querySelector(".creators-fav");
      a && a.focus({ preventScroll: true });
    }
  });
  const favs = s.favorites.map(L.creator).filter(Boolean);
  const notInCart = favs.filter(c => !K().inCart(c.id));
  const n = s.favorites.length;
  const repaint = () => {
    paintN.current = S().favorites.length;
    flushSync(() => setVer(v => v + 1));
  };
  return (
    <div
      className="view-in creators creators--saved"
      ref={root}
      onClickCapture={e => {
        if (e.target.closest(".creators-card-link")) s.ui.creators.from = "saved";
      }}
    >
      <header className="creators-head">
        <div className="creators-head-t">
          <h1 className="t-h1">Saved creators</h1>
          <p className="muted">
            Your shortlist. Only you can see it. <span className="sample">Sample data</span>
          </p>
        </div>
        {notInCart.length > 1 ? (
          <Lq
            className="lq-s"
            data-allcart=""
            onClick={e => {
              const t = e.currentTarget;
              const ids = s.favorites.filter(id => !K().inCart(id));
              L.store.set(st => {
                ids.forEach(id => st.cart.push(id));
              }, "cart-add");
              const cartBtn = document.getElementById("cartBtn");
              if (cartBtn) K().mo("thread", t, cartBtn);
              L.toast(
                `${ids.length} ${ids.length === 1 ? "creator" : "creators"} added to your hiring cart`,
                "cart",
              );
              repaint();
            }}
          >
            <Icon n="cart" className="ic" />
            Add all {notInCart.length} to cart
          </Lq>
        ) : null}
      </header>
      <Tabs mode="saved" />
      <section className="creators-results" aria-label="Saved creators">
        {paintN.current ? (
          <>
            <p className="creators-count" aria-live="polite" hidden={!n}>
              <b>{n}</b> saved · newest last
            </p>
            <SavedList
              key={ver}
              onUnsave={id => {
                if (id) setLine({ removed: id });
                redraw(x => x + 1);
              }}
            />
          </>
        ) : null}
        <div className="empty creators-empty" hidden={!!n}>
          <img src="assets/step-04-orbit.svg" width="160" height="117" alt="" />
          <p className="t-h2">Nobody saved yet.</p>
          <p className="muted">Tap Save on a creator to keep them here while you decide.</p>
          <Lq className="lq-p" data-go="#creators">
            Find creators
          </Lq>
        </div>
        <p className="creators-hidden-line" aria-live="polite">
          {line === "back" ? (
            "Back in your saved list."
          ) : line && line.removed ? (
            <>
              Removed {L.creator(line.removed).name} from saved.{" "}
              <button
                className="btn-q"
                type="button"
                data-undo={line.removed}
                onClick={() => {
                  const id = line.removed;
                  L.store.set(st => {
                    st.favorites = st.favorites.filter(x => x !== id);
                    st.favorites.push(id);
                  }, "favorite");
                  after.current = id;
                  setLine("back");
                  repaint();
                }}
              >
                Undo
              </button>
            </>
          ) : null}
        </p>
      </section>
    </div>
  );
}

L.register("creators", { title: "Find creators", nav: "creators", Component: AllCreators });
L.register("saved", {
  title: "Saved creators",
  nav: "creators",
  crumb: '<a href="#creators">Find creators</a> / Saved creators',
  Component: Saved,
});
