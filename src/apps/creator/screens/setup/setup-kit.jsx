/* The creator profile kit (Builder A), shared by first-login setup (setup.jsx) and the Edit profile sheet
   (profile/profile-edit.jsx): validators and choices, the photo picker with crop, the chip pickers (niches, languages),
   state-then-city fields and the starting-price fields. React components (see src/shared/react/view.jsx). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { openPicker } from "@/shared/picker";
import { CITIES_BY_STATE, OTHER_CITY } from "@/shared/india-cities";
import { Icon, Lq } from "@/shared/react/view";

const LLD = window.LLD;
export { CITIES_BY_STATE, OTHER_CITY };
export const BIO_MAX = 160,
  CAT_MAX = 3;
export const LANGS = [
  "Hindi",
  "English",
  "Marathi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Odia",
  "Urdu",
  "Assamese",
  "Bhojpuri",
  "Konkani",
  "Haryanvi",
];
/* niches in groups, for the picker; the twelve names creators could pick before are all still here */
export const NICHE_GROUPS = [
  {
    label: "Beauty and fashion",
    items: [
      "Skincare",
      "Beauty",
      "Makeup",
      "Haircare",
      "Grooming",
      "Fragrance",
      "Fashion",
      "Jewellery and accessories",
      "Footwear",
    ],
  },
  {
    label: "Health and fitness",
    items: ["Fitness", "Yoga", "Health and wellness", "Nutrition", "Mental health"],
  },
  {
    label: "Food and drink",
    items: ["Food & drink", "Cooking and recipes", "Restaurants and reviews", "Healthy eating"],
  },
  {
    label: "Lifestyle",
    items: ["Lifestyle", "Travel", "Home", "Parenting", "Pets", "Weddings", "Sustainability"],
  },
  {
    label: "Tech and money",
    items: ["Tech", "Gadgets", "Gaming", "Finance", "Business and startups", "Cars and bikes"],
  },
  { label: "Learning", items: ["Education", "Science", "Books", "Careers"] },
  {
    label: "Entertainment and creative",
    items: [
      "Comedy",
      "Music",
      "Dance",
      "Movies and TV",
      "Art and design",
      "Photography",
      "DIY and crafts",
      "Sports",
      "Cricket",
    ],
  },
];
export const CATS = NICHE_GROUPS.flatMap(g => g.items);
export const GENDERS = ["Woman", "Man", "Non-binary", "Another identity", "Prefer not to say"];
export const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];
/* what a starting price can be for: Instagram formats, then YouTube ones */
export const PRICE_FORMATS = ["Reel", "Story", "Carousel", "Video", "Short"];
export const digits = v => String(v || "").replace(/[,\s]/g, "");

/* ---------- validators shared with the profile edit sheet ---------- */
export const V = {
  name: v => {
    v = v.trim();
    if (!v) return "Enter the name brands will see.";
    if (v.length < 2) return "Use at least 2 letters.";
    if (v.length > 60) return "Keep it under 60 characters.";
    if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(v)) return "Use letters, spaces, dots or hyphens only.";
    return "";
  },
  email: v => {
    v = v.trim();
    if (!v) return "Enter your email.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
      ? ""
      : "That email looks incomplete, like name@example.com.";
  },
  mobile: v => {
    const d = v.replace(/\D/g, "");
    if (!d) return "Enter your mobile number.";
    if (d.length !== 10) return "Enter all 10 digits.";
    return /^[6-9]/.test(d) ? "" : "Indian mobile numbers start with 6, 7, 8 or 9.";
  },
  ig: v => {
    v = v.trim();
    if (!v) return { h: "" };
    const m =
      v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i) ||
      v.match(/^@?([A-Za-z0-9._]{1,30})$/);
    return m ? { h: m[1] } : { e: "Use your Instagram username, like @ananyamakes, or your profile link." };
  },
  yt: v => {
    v = v.trim();
    if (!v) return { h: "" };
    let m = v.match(
      /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(@[A-Za-z0-9._-]{3,30}|channel\/UC[\w-]{10,30}|c\/[\w.-]{1,100})\/?(?:\?.*)?$/i,
    );
    if (m) return { h: m[1] };
    m = v.match(/^@?([A-Za-z0-9._-]{3,30})$/);
    return m ? { h: "@" + m[1] } : { e: "Use your YouTube handle, like @AnanyaMakes, or your channel link." };
  },
  count: (v, req) => {
    const d = digits(v);
    if (!d) return req ? "Add your follower count." : "";
    return /^\d{1,10}$/.test(d) ? "" : "Use whole numbers, like 182000.";
  },
  er: v => {
    const d = String(v || "")
      .trim()
      .replace("%", "");
    if (!d) return "";
    const n = Number(d);
    return isFinite(n) && n >= 0 && n <= 100 ? "" : "Use a percentage between 0 and 100.";
  },
  /* starting price, in rupees: required, whole rupees, ₹100 to ₹10,00,000 */
  price: v => {
    const d = digits(v).replace(/^₹/, "");
    if (!d) return "Add your starting price. Brands see it on your card.";
    if (!/^\d{1,7}$/.test(d)) return "Use whole rupees, like 5000.";
    const n = +d;
    if (n < 100) return "The lowest starting price is ₹100.";
    return n > 1000000 ? "Keep it at ₹10,00,000 or less." : "";
  },
  days: v => {
    const d = digits(v);
    if (!d) return "Add how many days you need to deliver.";
    return /^\d{1,2}$/.test(d) && +d >= 1 && +d <= 60 ? "" : "Use a number of days from 1 to 60.";
  },
  format: v => (PRICE_FORMATS.includes(v) ? "" : "Choose what this price is for."),
  url: v => {
    v = v.trim();
    if (!v) return "Paste a link.";
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : "https://" + v);
      return /\./.test(u.hostname) ? "" : "That link looks incomplete.";
    } catch (e) {
      return "That doesn't look like a link. Try instagram.com/reel/…";
    }
  },
};

/* ---------- form parts: a field shows its error once checked; `inv` keeps aria-invalid until it's typed in ---------- */
/** `attr` names the data attribute the form looks fields up by (setup: data-field, the edit sheet: data-pf). */
/** `ids: false` leaves the help and error lines without ids (the edit sheet's fields never had them). */
export function Field({
  attr = "data-field",
  pre,
  id,
  label,
  help,
  err,
  children,
  className = "field",
  ids = true,
}) {
  return (
    <div className={`${className}${err != null ? " is-err" : ""}`} {...{ [attr]: id }}>
      <label htmlFor={`${pre}${id}`}>{label}</label>
      {children}
      {help ? (
        <p className="help" id={ids ? `${pre}${id}-h` : undefined}>
          {help}
        </p>
      ) : null}
      <p className="err" id={ids ? `${pre}${id}-e` : undefined} aria-live="polite">
        {err || ""}
      </p>
    </div>
  );
}
/** Errors by field id for a form: `show(list)` marks them, `clear(id)` drops one as it's typed in. */
export function useErrors() {
  const [errs, setErrs] = useState({});
  const inv = useRef(new Set());
  return {
    errs,
    inv: id => (inv.current.has(id) ? "true" : undefined),
    show: list =>
      setErrs(e => {
        const x = { ...e };
        list.forEach(([id, m]) => {
          x[id] = m || x[id] || "";
          inv.current.add(id);
        });
        return x;
      }),
    clear: id => {
      inv.current.delete(id);
      setErrs(e => {
        if (!(id in e)) return e;
        const x = { ...e };
        delete x[id];
        return x;
      });
    },
    reset: () => {
      inv.current.clear();
      setErrs({});
    },
    /** `m` may be a function of the current message */
    set: (id, m) =>
      setErrs(e => {
        const x = { ...e };
        const v = typeof m === "function" ? m(e[id]) : m;
        if (v == null) delete x[id];
        else x[id] = v;
        return x;
      }),
  };
}

/** The starting-price fields. `pre` is the id prefix ("setup-" or "pe-"), `d` = { format, price, days } (kept up to date). */
export function PriceFields({ attr, pre, d, E, onChange, ids }) {
  const put = (k, v, id) => {
    d[k] = v;
    E.clear(id);
    onChange && onChange();
  };
  const F = props => <Field attr={attr} pre={pre} ids={ids} err={E.errs[props.id]} {...props} />;
  return (
    <fieldset className="setup-fs setup-price" data-price="">
      <legend className="lab">
        Your starting price <span className="setup-opt-l">required</span>
      </legend>
      <p className="help">
        Your lowest price for one post. Brands see "From ₹…" on your card, and you can still bid any amount on
        a brief.
      </p>
      <div className="setup-metrics">
        {F({
          id: "price-format",
          label: "For one",
          children: (
            <select
              className="select"
              id={`${pre}price-format`}
              value={d.format || ""}
              aria-invalid={E.inv("price-format")}
              onChange={e => put("format", e.target.value, "price-format")}
            >
              <option value="">Choose</option>
              {PRICE_FORMATS.map(f => (
                <option key={f}>{f}</option>
              ))}
            </select>
          ),
        })}
        {F({
          id: "price-amount",
          label: "Price (₹)",
          children: (
            <input
              className="input num"
              id={`${pre}price-amount`}
              inputMode="numeric"
              defaultValue={d.price || ""}
              placeholder="5000"
              aria-invalid={E.inv("price-amount")}
              onInput={e => put("price", e.currentTarget.value, "price-amount")}
            />
          ),
        })}
        {F({
          id: "price-days",
          label: "Delivery (days)",
          children: (
            <input
              className="input num"
              id={`${pre}price-days`}
              inputMode="numeric"
              defaultValue={d.days || ""}
              placeholder="7"
              aria-invalid={E.inv("price-days")}
              onInput={e => put("days", e.currentTarget.value, "price-days")}
            />
          ),
        })}
      </div>
    </fieldset>
  );
}

/** State, then city (or "Other city", typed in). `value` = { region, city }; `onChange(region, city)` after each change. */
export function PlaceFields({ attr, pre, region, city, E, onChange, ids }) {
  const list = CITIES_BY_STATE[region] || [];
  const other0 = !!city && !!region && !list.includes(city);
  const [sel, setSel] = useState(other0 ? OTHER_CITY : city || "");
  const [typedCity, setTyped] = useState(other0 ? city : "");
  const x = useRef(null);
  const cityOf = (s, t) => (s === OTHER_CITY ? t.trim() : s);
  return (
    <div className="setup-two">
      <Field attr={attr} pre={pre} ids={ids} id="region" label="State or UT" err={E.errs.region}>
        <select
          className="select"
          id={`${pre}region`}
          autoComplete="address-level1"
          value={region || ""}
          aria-invalid={E.inv("region")}
          onChange={e => {
            setSel("");
            setTyped("");
            onChange(e.target.value, "");
          }}
        >
          <option value="">Choose</option>
          {STATES.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field attr={attr} pre={pre} ids={ids} id="city" label="City" err={E.errs.city}>
        <select
          className="select"
          id={`${pre}city`}
          disabled={!region}
          value={sel}
          aria-invalid={E.inv("city")}
          onChange={e => {
            const v = e.target.value;
            setSel(v);
            onChange(region, cityOf(v, typedCity));
            if (v === OTHER_CITY) setTimeout(() => x.current && x.current.focus());
          }}
        >
          {region ? (
            <>
              <option value="">Choose a city</option>
              {list.map(c => (
                <option key={c}>{c}</option>
              ))}
              <option value={OTHER_CITY}>Other city</option>
            </>
          ) : (
            <option value="">Choose a state first</option>
          )}
        </select>
        <input
          className="input setup-cityx"
          id={`${pre}cityx`}
          autoComplete="address-level2"
          placeholder="Type your city"
          aria-label="Your city"
          value={typedCity}
          hidden={sel !== OTHER_CITY}
          ref={x}
          onChange={e => {
            setTyped(e.target.value);
            onChange(region, cityOf(sel, e.target.value));
          }}
        />
      </Field>
    </div>
  );
}

/** Chosen items as removable chips and one button that opens the picker. `value` is the list, `onChange(list)` stores it. */
export function ChipPicker({ title, sub, groups, value, onChange, max, noun }) {
  const host = useRef(null);
  const focus = sel => setTimeout(() => host.current && (host.current.querySelector(sel) || {}).focus?.());
  return (
    <div ref={host}>
      {value.length ? (
        <ul className="setup-picked" aria-label={`Chosen ${noun}`}>
          {value.map(x => (
            <li key={x}>
              <button
                className="chip"
                type="button"
                aria-pressed="true"
                data-unpick={x}
                aria-label={`Remove ${x}`}
                onClick={() => {
                  onChange(value.filter(y => y !== x));
                  focus("[data-unpick], [data-pickopen]");
                }}
              >
                {x}
                <Icon n="close" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Lq
        className="lq-s lq-sm setup-pickbtn"
        data-pickopen=""
        aria-haspopup="dialog"
        onClick={() =>
          openPicker({
            title,
            sub,
            groups,
            selected: value,
            multi: true,
            max,
            onDone: v => {
              onChange(v);
              focus("[data-pickopen]");
            },
          })
        }
      >
        <Icon n="plus" className="ic" />
        {value.length ? `Change ${noun}` : `Choose ${noun}`}
      </Lq>
    </div>
  );
}

/* ---------- the photo picker: choose, validate, crop (drag + zoom), export a square JPEG ---------- */
const PH_TYPES = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 },
  PH_MAX = 5 * 1024 * 1024,
  PH_MIN = 200;
let phN = 0;
const fit = (F, o) => {
  const w = o.img.naturalWidth,
    h = o.img.naturalHeight,
    sc = (F / Math.min(w, h)) * o.zoom,
    W = w * sc,
    H = h * sc;
  let ox = F / 2 - o.cx * W,
    oy = F / 2 - o.cy * H;
  ox = Math.min(0, Math.max(F - W, ox));
  oy = Math.min(0, Math.max(F - H, oy));
  return { W, H, ox, oy };
};
/** `api` (a ref) gets { has, state, exportURL }; `initials` is what the empty frame shows. */
export function PhotoPicker({ src = null, crop = null, initials = "", onChange, api }) {
  const id = useRef(null);
  if (!id.current) id.current = "ph" + ++phN;
  const [err, setErr] = useState("");
  const [has, setHas] = useState(false);
  const [zoom, setZoom] = useState(1);
  const st = useRef({ img: null, zoom: 1, cx: 0.5, cy: 0.5, drag: null });
  const frame = useRef(null),
    img = useRef(null),
    file = useRef(null),
    pick = useRef(null);
  const layout = () => {
    const o = st.current;
    if (!o.img || !frame.current) return;
    const F = frame.current.clientWidth || 200,
      r = fit(F, o);
    o.cx = (F / 2 - r.ox) / r.W;
    o.cy = (F / 2 - r.oy) / r.H;
    img.current.style.width = r.W + "px";
    img.current.style.height = r.H + "px";
    img.current.style.transform = `translate(${r.ox}px,${r.oy}px)`;
  };
  const changed = () => {
    layout();
    onChange && onChange();
  };
  const load = (url, keep) => {
    const im = new Image();
    im.onload = () => {
      if (Math.min(im.naturalWidth, im.naturalHeight) < PH_MIN)
        return setErr(
          `That photo is only ${im.naturalWidth} × ${im.naturalHeight} px. Use one at least ${PH_MIN} px wide.`,
        );
      setErr("");
      const o = st.current;
      o.img = im;
      img.current.src = url;
      if (keep && crop) {
        o.zoom = crop.zoom || 1;
        o.cx = crop.cx ?? 0.5;
        o.cy = crop.cy ?? 0.5;
      } else {
        o.zoom = 1;
        o.cx = 0.5;
        o.cy = 0.5;
      }
      setZoom(o.zoom);
      setHas(true);
    };
    im.onerror = () => setErr("We couldn't open that photo. Try another JPG or PNG.");
    im.src = url;
  };
  useLayoutEffect(() => {
    if (has) changed();
  }, [has]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ro = new ResizeObserver(() => layout());
    ro.observe(frame.current);
    if (src) load(src, true);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (api)
    api.current = {
      has: () => !!st.current.img,
      state: () =>
        st.current.img
          ? { src: img.current.src, zoom: st.current.zoom, cx: st.current.cx, cy: st.current.cy }
          : null,
      exportURL() {
        const o = st.current;
        if (!o.img) return null;
        const F = 400,
          c = document.createElement("canvas");
        c.width = c.height = F;
        const r = fit(F, o);
        c.getContext("2d").drawImage(o.img, r.ox, r.oy, r.W, r.H);
        try {
          return c.toDataURL("image/jpeg", 0.88);
        } catch (e) {
          return null;
        }
      },
    };
  const setZ = z => {
    st.current.zoom = z;
    setZoom(z);
    changed();
  };
  const k = id.current;
  return (
    <div className="setup-ph">
      <div
        className="setup-ph-frame"
        tabIndex={0}
        role="group"
        aria-roledescription="photo crop"
        aria-label="Photo crop. Drag or use arrow keys to move, plus or minus to zoom."
        aria-describedby={`${k}-h`}
        ref={frame}
        onPointerDown={e => {
          if (!st.current.img) return;
          st.current.drag = { x: e.clientX, y: e.clientY };
          frame.current.setPointerCapture(e.pointerId);
          frame.current.classList.add("is-drag");
        }}
        onPointerMove={e => {
          const o = st.current;
          if (!o.drag) return;
          const r = fit(frame.current.clientWidth, o);
          o.cx -= (e.clientX - o.drag.x) / r.W;
          o.cy -= (e.clientY - o.drag.y) / r.H;
          o.drag = { x: e.clientX, y: e.clientY };
          changed();
        }}
        onPointerUp={() => {
          st.current.drag = null;
          frame.current.classList.remove("is-drag");
        }}
        onPointerCancel={() => {
          st.current.drag = null;
          frame.current.classList.remove("is-drag");
        }}
        onKeyDown={e => {
          const o = st.current;
          if (!o.img) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              file.current.click();
            }
            return;
          }
          const r = fit(frame.current.clientWidth, o),
            step = 8;
          const d = {
            ArrowLeft: [step, 0],
            ArrowRight: [-step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          }[e.key];
          if (d) {
            e.preventDefault();
            o.cx -= d[0] / r.W;
            o.cy -= d[1] / r.H;
            changed();
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            setZ(Math.min(3, o.zoom + 0.1));
          } else if (e.key === "-") {
            e.preventDefault();
            setZ(Math.max(1, o.zoom - 0.1));
          }
        }}
      >
        <img className="setup-ph-img" alt="" draggable="false" hidden={!has} ref={img} />
        <span className="setup-ph-ph" aria-hidden="true" hidden={has}>
          <b>{initials || ""}</b>
          <Icon n="camera" />
        </span>
      </div>
      <div className="setup-ph-side">
        <div className="row wrap">
          <Lq className="lq-s lq-sm" data-pick="" ref={pick} onClick={() => file.current.click()}>
            <Icon n="upload" className="ic" />
            <span data-pick-l="">{has ? "Replace photo" : "Choose a photo"}</span>
          </Lq>
          <button
            className="btn-q"
            type="button"
            data-remove=""
            hidden={!has}
            onClick={() => {
              st.current.img = null;
              img.current.removeAttribute("src");
              setErr("");
              setHas(false);
              onChange && onChange();
              pick.current.focus();
            }}
          >
            Remove
          </button>
        </div>
        <input
          className="sr-only"
          type="file"
          id={`${k}-f`}
          accept="image/jpeg,image/png,image/webp"
          tabIndex={-1}
          aria-label="Profile photo file"
          ref={file}
          onChange={e => {
            const f = e.currentTarget.files && e.currentTarget.files[0];
            e.currentTarget.value = "";
            if (!f) return;
            const kind = (f.type.split("/")[1] || f.name.split(".").pop() || "unknown").toUpperCase();
            if (!PH_TYPES[f.type])
              return setErr(
                `That file is ${kind === "UNKNOWN" ? "not a photo" : "a " + kind + " file"}. Use a JPG, PNG or WebP photo.`,
              );
            if (f.size > PH_MAX)
              return setErr(`That photo is ${(f.size / 1048576).toFixed(1)} MB. Use one under 5 MB.`);
            if (!f.size) return setErr("That file is empty. Try another photo.");
            const rd = new FileReader();
            rd.onerror = () => setErr("We couldn't read that file. Try another photo.");
            rd.onload = () => load(rd.result);
            rd.readAsDataURL(f);
          }}
        />
        <p className="help" id={`${k}-h`}>
          JPG, PNG or WebP, up to 5 MB and at least 200 px wide.
        </p>
        <div className="setup-zoom" data-zoomrow="" hidden={!has}>
          <label htmlFor={`${k}-z`}>Zoom</label>
          <input
            type="range"
            id={`${k}-z`}
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={e => setZ(+e.target.value)}
          />
        </div>
        <p className="err" aria-live="polite" data-perr="">
          {err}
        </p>
      </div>
    </div>
  );
}
