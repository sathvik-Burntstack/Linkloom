/* setup screen (Builder A): first-login profile setup in four short steps.
   Rules: skip contact fields already verified by sign-in; age is computed from date of birth and under-18s cannot
   continue; gender optional with prefer-not-to-say; platform metrics are labelled self-reported; bio has a limit and
   counter; one or more languages; city and state only (never an address); photo upload with crop, type and size checks.
   Save lands on the creator's own profile (#profile).
   React screen (see src/shared/react/view.jsx); the shared parts are in setup-kit.jsx. Each paint redraws the step from
   the draft, as before. */
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ApiError, apiEnabled } from "@/shared/api/client";
import { submitCreatorOnboarding } from "@/shared/api/onboarding";
import { Icon, Lq } from "@/shared/react/view";
import {
  BIO_MAX,
  CAT_MAX,
  ChipPicker,
  Field,
  GENDERS,
  LANGS,
  NICHE_GROUPS,
  PhotoPicker,
  PlaceFields,
  PriceFields,
  V,
  digits,
  useErrors,
} from "./setup-kit";

const LLD = window.LLD,
  { store } = LLD;
const SAMPLE = JSON.parse(JSON.stringify(window.LLD_DATA.me)); // copy of the sample creator, for "Fill with sample"
const STEPS = [
  {
    id: "you",
    t: "About you",
    sub: "Brands see your name. Your date of birth and contact details stay private.",
  },
  {
    id: "platforms",
    t: "Your platforms",
    sub: "Add at least one, and your starting price. Numbers you type are marked self-reported until the account is connected.",
  },
  { id: "work", t: "Your work", sub: "A short line about what you make, and where your audience is." },
  {
    id: "photo",
    t: "Profile photo",
    sub: "Optional. A clear face photo works best. You can change it later.",
  },
];
const todayISO = () => {
  const t = LLD.today();
  return new Date(t.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
}; // IST date
const press = el => {
  try {
    LLD.motion.press(el);
  } catch (e) {}
};
const maskPhone = d => "+91 " + d.slice(0, 2) + "•••••" + d.slice(7);

/* ---------- draft: survives step changes and leaving the screen; reset on a new sign-in ---------- */
let D = null;
store.on(why => {
  if (why === "signed-in") D = null;
});
function fresh() {
  const s = store.s,
    me = s.me,
    sess = s.session,
    pre = !sess.firstLogin;
  const p = k => (pre && me.platforms[k]) || {};
  return {
    step: 0,
    reached: 0,
    name: pre ? me.name : sess.method === "google" ? sess.googleName || "" : "",
    email: "",
    mobile: "",
    dob: pre ? me.dob : "",
    gender: pre ? me.gender || "" : "",
    ig: {
      handle: (p("instagram").handle || "").replace(/^@/, ""),
      followers: p("instagram").followers || "",
      avgViews: p("instagram").avgViews || "",
      er: p("instagram").er || "",
    },
    yt: {
      handle: p("youtube").handle || "",
      followers: p("youtube").followers || "",
      avgViews: p("youtube").avgViews || "",
      er: p("youtube").er || "",
    },
    bio: pre ? me.bio : "",
    categories: pre ? [...(me.categories || [])] : [],
    languages: pre ? [...(me.languages || [])] : [],
    city: pre ? me.city : "",
    region: pre ? me.region : "",
    photo: pre ? me.photo : null,
    price: {
      format: (pre && me.startPrice && me.startPrice.format) || "",
      price: pre && me.startPrice ? String(Math.round(me.startPrice.price / 100)) : "",
      days: pre && me.startPrice && me.startPrice.deliveryDays ? String(me.startPrice.deliveryDays) : "",
    },
  };
}
function fillSample(step) {
  const m = SAMPLE,
    ig = m.platforms.instagram,
    yt = m.platforms.youtube;
  if (step === 0) {
    D.name = m.name;
    D.dob = m.dob;
    D.gender = m.gender;
    D.email = store.s.session.method === "mobile" ? "ananya.iyer@example.com" : D.email;
    D.mobile = store.s.session.method === "google" ? "98765 43210" : D.mobile;
  }
  if (step === 1) {
    D.ig = { handle: ig.handle.replace(/^@/, ""), followers: ig.followers, avgViews: ig.avgViews, er: ig.er };
    D.yt = { handle: yt.handle, followers: yt.followers, avgViews: yt.avgViews, er: yt.er };
  }
  if (step === 2) {
    D.bio = m.bio;
    D.categories = [...m.categories];
    D.languages = [...m.languages];
    D.city = m.city;
    D.region = m.region;
  }
}
function ageState() {
  const v = D.dob;
  if (!v) return { ok: false, msg: "" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, msg: "Enter a full date." };
  if (v > todayISO()) return { ok: false, msg: "That date is in the future." };
  const a = LLD.ageFrom(v);
  if (a > 110) return { ok: false, msg: "Check the year." };
  if (a < 18) return { ok: false, minor: true, age: a };
  return { ok: true, age: a };
}
const checks = [
  sess => {
    const errs = [];
    const e1 = V.name(D.name);
    if (e1) errs.push(["name", e1]);
    if (sess.method === "google") {
      const e = V.mobile(D.mobile);
      if (e) errs.push(["mobile", e]);
    }
    if (sess.method === "mobile") {
      const e = V.email(D.email);
      if (e) errs.push(["email", e]);
    }
    const a = ageState();
    if (!D.dob) errs.push(["dob", "Enter your date of birth. We use it only to confirm you're 18 or older."]);
    else if (a.msg) errs.push(["dob", a.msg]);
    else if (a.minor) errs.push(["dob", ""]);
    return errs;
  },
  () => {
    const errs = [];
    const pf = V.format(D.price.format),
      pa = V.price(D.price.price),
      pd = V.days(D.price.days);
    let any = false;
    ["ig", "yt"].forEach(k => {
      const p = D[k],
        r = V[k](String(p.handle));
      if (r.e) errs.push([k + "-handle", r.e]);
      const has = r.h || (!r.e && String(p.handle).trim());
      if (has) {
        any = true;
        const ef = V.count(p.followers, true);
        if (ef) errs.push([k + "-followers", ef]);
        const ev = V.count(p.avgViews, false);
        if (ev) errs.push([k + "-avgViews", ev]);
        const ee = V.er(p.er);
        if (ee) errs.push([k + "-er", ee]);
      } else if (!r.e && (digits(p.followers) || digits(p.avgViews)))
        errs.push([k + "-handle", "Add the username these numbers belong to."]);
    });
    if (!any && !errs.length) errs.push(["ig-handle", "Add at least one platform: Instagram or YouTube."]);
    if (pf) errs.push(["price-format", pf]);
    if (pa) errs.push(["price-amount", pa]);
    if (pd) errs.push(["price-days", pd]);
    return errs;
  },
  () => {
    const errs = [],
      n = [...D.bio.trim()].length;
    if (!n) errs.push(["bio", "Add a line or two about what you make."]);
    else if (n < 20) errs.push(["bio", "Add a little more, at least 20 characters."]);
    else if (n > BIO_MAX) errs.push(["bio", `${n - BIO_MAX} characters over. Trim it to ${BIO_MAX}.`]);
    if (!D.languages.length) errs.push(["langs", "Pick at least one language."]);
    const c = D.city.trim();
    if (!D.region) {
      /* the state comes first; the city list follows it */
    } else if (!c) errs.push(["city", "Choose your city, or Other city to type it."]);
    else if (!/^[\p{L}][\p{L} .'-]{1,40}$/u.test(c))
      errs.push(["city", "Use the city name only, like Pune. No street or pin code."]);
    if (!D.region) errs.push(["region", "Choose your state or union territory."]);
    return errs;
  },
  () => [],
];

const P = { pre: "setup-" };
const Opt = ({ v, on, onChange }) => (
  <label className="setup-opt">
    <input type="radio" name="gender" value={v} defaultChecked={on} onChange={onChange} />
    <span>{v}</span>
  </label>
);

/* ---- step 1: about you ---- */
function StepYou({ sess, E, redraw, signOut }) {
  const verified = [];
  if (sess.method === "google" && sess.email) verified.push(["Email", sess.email, "Verified by Google"]);
  if (sess.method === "email" && sess.email) verified.push(["Email", sess.email, "Verified"]);
  if (sess.method === "mobile" && sess.mobile) verified.push(["Mobile", sess.mobile, "Verified by OTP"]);
  const on = (id, k, fmt) => e => {
    const i = e.currentTarget;
    if (fmt) i.value = fmt(i.value);
    D[k] = i.value;
    E.clear(id);
  };
  const a = ageState();
  /* the date's own check (shown as it changes, and when the step is drawn) replaces whatever the field said */
  const dobCheck = () => {
    const x = ageState();
    E.set("dob", x.msg || x.minor ? x.msg || "" : null);
  };
  useLayoutEffect(dobCheck, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Field {...P} id="name" label="Display name" help="Shown on your profile and bids." err={E.errs.name}>
        <input
          className="input"
          id="setup-name"
          autoComplete="name"
          defaultValue={D.name}
          aria-describedby="setup-name-h setup-name-e"
          aria-invalid={E.inv("name")}
          onInput={on("name", "name")}
        />
      </Field>
      {verified.map(v => (
        <div key={v[0]} className="setup-verified">
          <span className="setup-v-l">{v[0]}</span>
          <span className="setup-v-v num">{v[1]}</span>
          <span className="pill pill-ok" data-motion="check">
            <Icon n="check" />
            {v[2]}
          </span>
        </div>
      ))}
      {sess.method === "google" ? (
        <Field
          {...P}
          id="mobile"
          label="Mobile number"
          help="Private. Used for payout alerts, never shown to brands."
          err={E.errs.mobile}
        >
          <div className="setup-tel">
            <span aria-hidden="true">+91</span>
            <input
              className="input"
              id="setup-mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={11}
              defaultValue={D.mobile}
              placeholder="98765 43210"
              aria-describedby="setup-mobile-h setup-mobile-e"
              aria-invalid={E.inv("mobile")}
              onInput={on("mobile", "mobile", v => {
                const d = v.replace(/\D/g, "").slice(0, 10);
                return d.length > 5 ? d.slice(0, 5) + " " + d.slice(5) : d;
              })}
            />
          </div>
        </Field>
      ) : null}
      {sess.method === "mobile" ? (
        <Field
          {...P}
          id="email"
          label="Email"
          help="Private. For receipts and payout slips."
          err={E.errs.email}
        >
          <input
            className="input"
            id="setup-email"
            type="email"
            autoComplete="email"
            defaultValue={D.email}
            placeholder="name@example.com"
            aria-describedby="setup-email-h setup-email-e"
            aria-invalid={E.inv("email")}
            onInput={on("email", "email")}
          />
        </Field>
      ) : null}
      <Field {...P} id="dob" label="Date of birth" err={E.errs.dob}>
        <input
          className="input setup-dob"
          id="setup-dob"
          type="date"
          min="1920-01-01"
          max={todayISO()}
          defaultValue={D.dob}
          aria-describedby="setup-dob-h setup-dob-e"
          aria-invalid={E.inv("dob")}
          onInput={e => {
            D.dob = e.currentTarget.value;
            dobCheck();
            redraw();
          }}
          onChange={e => {
            D.dob = e.currentTarget.value;
            dobCheck();
            redraw();
          }}
        />
      </Field>
      <div
        className={`setup-age${a.minor ? " is-minor" : a.ok ? " is-ok" : ""}`}
        data-age=""
        role="status"
        hidden={!a.minor && !a.ok}
      >
        {a.minor ? (
          <>
            <Icon n="alert" />
            <div>
              <p className="t-label">You need to be 18 or older to join as a creator</p>
              <p>
                Based on this date you're {a.age}. Brand deals on Linkloom are only open to adults, so you
                can't continue yet.
              </p>
              <button type="button" className="btn-q" data-signout="" onClick={signOut}>
                Sign out
              </button>
            </div>
          </>
        ) : a.ok ? (
          <>
            <span className="setup-age-n t-money">{a.age}</span>
            <p>years old. Brands never see your date of birth.</p>
          </>
        ) : null}
      </div>
      <fieldset className="setup-fs">
        <legend className="lab">
          Gender <span className="setup-opt-l">optional</span>
        </legend>
        <div className="setup-opts">
          {GENDERS.map(g => (
            <Opt key={g} v={g} on={D.gender === g} onChange={() => (D.gender = g)} />
          ))}
        </div>
      </fieldset>
    </>
  );
}

/* ---- step 2: platforms ---- */
function Plat({ k, name, ic, ph, E }) {
  const p = D[k];
  const box = (f, label, extra) => (
    <Field {...P} id={`${k}-${f}`} label={label} err={E.errs[`${k}-${f}`]}>
      <input
        className={f === "handle" ? "input" : "input num"}
        id={`setup-${k}-${f}`}
        defaultValue={p[f]}
        aria-describedby={`setup-${k}-${f}-e`}
        aria-invalid={E.inv(`${k}-${f}`)}
        onInput={e => {
          D[k][f] = e.currentTarget.value;
          E.clear(`${k}-${f}`);
        }}
        {...extra}
      />
    </Field>
  );
  return (
    <fieldset className="setup-plat" data-plat={k}>
      <legend className="setup-plat-h">
        <span className="setup-plat-ic">
          <Icon n={ic} />
        </span>
        <span className="t-h3">{name}</span>
        <span className="pill pill-paper">Self-reported</span>
      </legend>
      {box("handle", "Username or profile link", {
        autoComplete: "off",
        spellCheck: "false",
        placeholder: ph,
      })}
      <div className="setup-metrics">
        {box("followers", k === "yt" ? "Subscribers" : "Followers", {
          inputMode: "numeric",
          placeholder: "0",
        })}
        {box("avgViews", "Avg views", { inputMode: "numeric", placeholder: "optional" })}
        {box("er", "Engagement %", { inputMode: "decimal", placeholder: "optional" })}
      </div>
    </fieldset>
  );
}

/* ---- step 3: your work ---- */
function StepWork({ E, redraw }) {
  const n = [...D.bio].length;
  /* the bio's "over" message shows as it's typed and goes when it's trimmed back; a submit's message stays */
  const bioCount = () => {
    const k = [...D.bio].length;
    if (k > BIO_MAX) E.set("bio", `${k - BIO_MAX} characters over. Trim it to ${BIO_MAX}.`);
    else E.set("bio", m => (m && m.includes("over") ? null : m));
  };
  useLayoutEffect(bioCount, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bioErr = E.errs.bio;
  return (
    <>
      <div className={`field${bioErr != null ? " is-err" : ""}`} data-field="bio">
        <div className="row between">
          <label className="lab" htmlFor="setup-bio">
            Short bio
          </label>
          <span
            className={`setup-count num${n > BIO_MAX - 20 && n <= BIO_MAX ? " is-near" : ""}${n > BIO_MAX ? " is-over" : ""}`}
            id="setup-bio-c"
            data-bioc=""
          >
            {n} / {BIO_MAX}
          </span>
        </div>
        <textarea
          className="textarea"
          id="setup-bio"
          rows={3}
          aria-describedby="setup-bio-c setup-bio-e"
          aria-invalid={E.inv("bio")}
          placeholder="Honest skincare for humid weather. Routines and 30-day tests."
          defaultValue={D.bio}
          onInput={e => {
            D.bio = e.currentTarget.value;
            bioCount();
            redraw();
          }}
        />
        <p className="err" id="setup-bio-e" aria-live="polite">
          {bioErr || ""}
        </p>
      </div>
      <div className={`field setup-pickf${E.errs.cats != null ? " is-err" : ""}`} data-field="cats">
        <p className="lab">
          What you make <span className="setup-opt-l">up to {CAT_MAX}</span>
        </p>
        <div data-catpick="">
          <ChipPicker
            title="What you make"
            sub={`Pick up to ${CAT_MAX}. Brands search by these, so choose the ones most of your posts are about.`}
            groups={NICHE_GROUPS}
            value={D.categories}
            max={CAT_MAX}
            noun="niches"
            onChange={v => {
              D.categories = v;
              E.clear("cats");
              redraw();
            }}
          />
        </div>
        <p className="err" id="setup-cats-e" aria-live="polite">
          {E.errs.cats || ""}
        </p>
      </div>
      <div className={`field setup-pickf${E.errs.langs != null ? " is-err" : ""}`} data-field="langs">
        <p className="lab">Languages you create in</p>
        <div data-langpick="">
          <ChipPicker
            title="Languages you create in"
            sub="Every language your posts are in. Brands filter by these."
            groups={[{ label: "Languages", items: LANGS }]}
            value={D.languages}
            noun="languages"
            onChange={v => {
              D.languages = v;
              E.clear("langs");
              redraw();
            }}
          />
        </div>
        <p className="err" id="setup-langs-e" aria-live="polite">
          {E.errs.langs || ""}
        </p>
      </div>
      <PlaceFields
        attr="data-field"
        pre="setup-"
        region={D.region}
        city={D.city}
        E={E}
        onChange={(st, c) => {
          if (D.region !== st) E.clear("region");
          D.region = st;
          D.city = c;
          E.clear("city");
          redraw();
        }}
      />
      <p className="help setup-note">
        <Icon n="pin" />
        Only your city and state appear on your profile. We never ask for your address.
      </p>
    </>
  );
}

/* ---- step 4: photo ---- */
function StepPhoto({ photoApi }) {
  const ps = D.photoState;
  const ig = V.ig(String(D.ig.handle)).h,
    yt = V.yt(String(D.yt.handle)).h;
  return (
    <>
      <div data-photo="">
        <PhotoPicker
          src={ps ? ps.src : D.photo}
          crop={ps}
          initials={(D.name.trim()[0] || "Y").toUpperCase()}
          api={photoApi}
        />
      </div>
      <div className="setup-sum" data-sum="">
        <p className="t-eyebrow muted">You're about to save</p>
        <dl>
          <div className="kv">
            <dt>Name</dt>
            <dd>{D.name}</dd>
          </div>
          <div className="kv">
            <dt>Platforms</dt>
            <dd>{[ig && "Instagram @" + ig, yt && "YouTube " + yt].filter(Boolean).join(" · ")}</dd>
          </div>
          <div className="kv">
            <dt>Starting price</dt>
            <dd>
              From ₹{Number(digits(D.price.price)).toLocaleString("en-IN")} per {D.price.format}
            </dd>
          </div>
          <div className="kv">
            <dt>City</dt>
            <dd>
              {D.city}, {D.region}
            </dd>
          </div>
          <div className="kv">
            <dt>Languages</dt>
            <dd>{D.languages.join(", ")}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}

function Setup() {
  const sess = store.s.session;
  if (!D) D = fresh();
  if (!D.price) D.price = { format: "", price: "", days: "" };
  const [paintN, setPaintN] = useState(0);
  const [, tick] = useState(0);
  const redraw = () => tick(n => n + 1);
  const [live, setLive] = useState("");
  const [formErr, setFormErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const E = useErrors();
  const root = useRef(null),
    head = useRef(null),
    body = useRef(null),
    next = useRef(null),
    photoApi = useRef(null);
  const R = useRef({ railAt: null, alive: true, focus: false, focusErr: null });
  const step = D.step,
    s = STEPS[step];
  /* a paint: the step is drawn again from the draft (the photo's crop kept), errors cleared */
  const paint = focus => {
    if (photoApi.current) {
      D.photoState = photoApi.current.state();
      D.photo = D.photoState ? D.photo : null;
      photoApi.current = null;
    }
    R.current.focus = focus;
    E.reset();
    flushSync(() => {
      setFormErr(null);
      setBusy(false);
      setLive(`Step ${D.step + 1} of ${STEPS.length}: ${STEPS[D.step].t}`);
      setPaintN(n => n + 1);
    });
  };
  useLayoutEffect(() => {
    setLive(`Step ${D.step + 1} of ${STEPS.length}: ${STEPS[D.step].t}`);
    return () => {
      R.current.alive = false;
      if (photoApi.current && D) D.photoState = photoApi.current.state();
    };
  }, []);
  useLayoutEffect(() => {
    const ns = root.current.querySelectorAll(".setup-rail-n");
    const at = R.current.railAt;
    if (at != null && D && D.step > at && ns[at] && ns[D.step]) {
      try {
        LLD.motion.pull && LLD.motion.pull(ns[at], ns[D.step]);
      } catch (e) {}
    }
    if (D) R.current.railAt = D.step;
    try {
      LLD.motion.stagger([...body.current.children]);
    } catch (e) {}
    if (R.current.focus) {
      R.current.focus = false;
      head.current.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [paintN]);
  useLayoutEffect(() => {
    const f = R.current.focusErr;
    if (!f) return;
    R.current.focusErr = null;
    const first = root.current.querySelector(
      `[data-field="${f}"] input, [data-field="${f}"] textarea, [data-field="${f}"] select`,
    );
    first && first.focus();
  });
  const showErrs = errs => {
    E.show(errs);
    R.current.focusErr = errs.length ? errs[0][0] : null;
    redraw();
  };
  const go = i => {
    D.step = i;
    paint(true);
  };
  const signOut = () => {
    store.set(x => {
      x.session.signedIn = false;
    }, "signed-out");
    D = null;
    LLD.go("#login");
  };

  function save() {
    for (let i = 0; i < 3; i++) {
      const errs = checks[i](sess);
      if (errs.length) {
        go(i);
        showErrs(errs);
        return;
      }
    }
    if (!navigator.onLine)
      return setFormErr(
        "You're offline, so we couldn't save. Your answers are still here; save again when you're connected.",
      );
    setBusy(true);
    const photo = photoApi.current && photoApi.current.has() ? photoApi.current.exportURL() : null;
    const commit = (message = "Profile saved. This is your profile.") => {
      if (!R.current.alive) return;
      const ig = V.ig(String(D.ig.handle)).h,
        yt = V.yt(String(D.yt.handle)).h,
        day = todayISO();
      const n = v => +digits(v) || 0;
      const price = { ...D.price };
      const platform = (h, url, p) => ({
        handle: h,
        url,
        followers: h ? n(p.followers) : 0,
        avgViews: h ? n(p.avgViews) : 0,
        er: h ? +String(p.er).replace("%", "") || 0 : 0,
        updated: day,
        source: "Self-reported",
      });
      store.set(st => {
        const me = st.me;
        me.name = D.name.trim().replace(/\s+/g, " ");
        me.dob = D.dob;
        me.gender = D.gender || "";
        me.bio = D.bio.trim();
        me.categories = [...D.categories];
        me.languages = [...D.languages];
        me.city = D.city.trim();
        me.region = D.region;
        me.photo = photo;
        me.platforms = me.platforms || {};
        me.platforms.instagram = platform(ig ? "@" + ig : "", ig ? "instagram.com/" + ig : "", D.ig);
        me.platforms.youtube = platform(
          yt ? (yt.startsWith("@") ? yt : yt.split("/").pop()) : "",
          yt ? "youtube.com/" + yt : "",
          D.yt,
        );
        me.handle = ig ? "@" + ig : yt || me.handle;
        me.startPrice = {
          id: (me.startPrice && me.startPrice.id) || "",
          format: price.format,
          platform: price.format === "Video" || price.format === "Short" ? "youtube" : "instagram",
          price: n(price.price) * 100,
          deliveryDays: n(price.days),
        };
        if (D.email) st.session.email = D.email.trim();
        if (D.mobile) st.session.mobile = maskPhone(D.mobile.replace(/\D/g, ""));
        st.session.firstLogin = false;
        st.session.profileDone = true;
      }, "profile-saved");
      if (LLD.live) {
        const me = store.s.me;
        /* languages and platforms go to the server (C6); then reload what it kept */
        LLD.live
          .saveProfile({
            languages: me.languages,
            platforms: me.platforms,
            extras: { dob: me.dob, gender: me.gender },
          })
          .catch(() => undefined)
          .then(() =>
            LLD.live.saveStartPrice({
              format: price.format,
              rupees: +digits(price.price),
              deliveryDays: +digits(price.days),
            }),
          )
          .catch(er =>
            LLD.toast(
              "Your profile is saved, but not your starting price. " + LLD.live.errorText(er),
              "alert",
            ),
          )
          .then(() => LLD.live.reload())
          .catch(() => undefined);
      }
      D = null;
      LLD.toast(message, "check");
      LLD.go("#profile");
    };
    if (!apiEnabled()) {
      setTimeout(commit, 500);
      return;
    }
    submitCreatorOnboarding({
      name: D.name,
      dob: D.dob,
      gender: D.gender,
      categories: D.categories,
      bio: D.bio,
      languages: D.languages,
      city: D.city,
      region: D.region,
      instagram: V.ig(String(D.ig.handle)).h,
      youtube: V.yt(String(D.yt.handle)).h,
      photo,
    }).then(
      res =>
        commit(
          res?.user?.approvalStatus === "pending"
            ? "Profile submitted for verification! Our team will review your account shortly."
            : undefined,
        ),
      err => {
        if (!R.current.alive) return;
        if (err instanceof ApiError && err.status === 401) {
          store.set(x => {
            x.session.signedIn = false;
            x.session.expired = true;
          }, "session-expired");
          LLD.go("#login-expired");
          return;
        }
        setBusy(false);
        setFormErr(err instanceof ApiError ? err.message : "We couldn't save that. Please try again.");
      },
    );
  }
  const submit = e => {
    e.preventDefault();
    const errs = checks[D.step](sess);
    if (errs.length) {
      showErrs(errs);
      setLive("Check the highlighted fields");
      return;
    }
    press(next.current);
    if (D.step < STEPS.length - 1) {
      D.step++;
      D.reached = Math.max(D.reached, D.step);
      paint(true);
      return;
    }
    save();
  };
  const minor = step === 0 && ageState().minor;

  return (
    <div className="focus setup" ref={root}>
      <section className="focus-art dark setup-art" aria-label="Profile setup progress">
        <p className="setup-brand">
          <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
          <span>linkloom</span>
        </p>
        <h2 className="t-display setup-line">Brands read this before your bid.</h2>
        <ol className="setup-rail" data-rail="">
          {STEPS.map((x, i) => {
            const state = i < step ? "done" : i === step ? "now" : "next";
            const can = i <= D.reached && i !== step;
            const inner = (
              <>
                <span className="setup-rail-n">{state === "done" ? <Icon n="check" /> : "0" + (i + 1)}</span>
                <span className="setup-rail-t">{x.t}</span>
              </>
            );
            return (
              <li
                key={i}
                className={`setup-rail-i is-${state}`}
                aria-current={state === "now" ? "step" : undefined}
              >
                {can ? (
                  <button type="button" data-goto={i} onClick={() => go(i)}>
                    {inner}
                    <span className="sr-only">, go back to this step</span>
                  </button>
                ) : (
                  <span className="setup-rail-b">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
        <img className="setup-orbit" src="assets/step-04-orbit.svg" width="300" height="220" alt="" />
        <div className="setup-prog" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i < step ? "is-done" : i === step ? "is-now" : ""}></span>
          ))}
        </div>
      </section>
      <section className="focus-form light setup-form">
        <form className="setup-in" noValidate data-form="" onSubmit={submit}>
          <div className="setup-top">
            <div className="row between wrap">
              <p className="t-eyebrow muted" data-count="">
                Step {step + 1} of {STEPS.length}
              </p>
              {/* the sample filler exists only in the parity build */}
              <button
                type="button"
                className="btn-q setup-fill"
                data-fill=""
                hidden={!import.meta.env.VITE_TEST_HOOKS || step === 3}
                onClick={() => {
                  fillSample(D.step);
                  paint(false);
                  setLive("Filled with sample details");
                }}
              >
                <span className="sample">Sample</span> Fill this step
              </button>
            </div>
            <h1 className="t-h1" tabIndex={-1} data-h="" ref={head}>
              {s.t}
            </h1>
            <p className="muted" data-sub="">
              {s.sub}
            </p>
          </div>
          <div className="setup-body" data-body="" ref={body} key={paintN}>
            {step === 0 ? (
              <StepYou sess={sess} E={E} redraw={redraw} signOut={signOut} />
            ) : step === 1 ? (
              <>
                <Plat k="ig" name="Instagram" ic="ig" ph="@yourname" E={E} />
                <Plat k="yt" name="YouTube" ic="yt" ph="@YourChannel" E={E} />
                <PriceFields attr="data-field" pre="setup-" d={D.price} E={E} />
                <p className="help setup-note">
                  <Icon n="info" />
                  Linkloom works with Instagram and YouTube for now.
                </p>
              </>
            ) : step === 2 ? (
              <StepWork E={E} redraw={redraw} />
            ) : (
              <StepPhoto photoApi={photoApi} />
            )}
          </div>
          <p className="setup-formerr" role="alert" data-formerr="" hidden={formErr === null}>
            {formErr || ""}
          </p>
          <div className="setup-nav">
            <Lq
              className="lq-s"
              data-back=""
              hidden={step === 0}
              onClick={() => D.step > 0 && go(D.step - 1)}
            >
              <Icon n="back" className="ic" />
              Back
            </Lq>
            <Lq className="lq-p" type="submit" data-next="" ref={next} disabled={busy || minor}>
              {busy ? "Saving…" : step === 3 ? "Save profile" : "Continue"}
            </Lq>
          </div>
        </form>
        <p className="sr-only" aria-live="polite" data-live="">
          {live}
        </p>
      </section>
    </div>
  );
}

LLD.register("setup", { title: "Set up your profile", shell: "focus", Component: Setup });
