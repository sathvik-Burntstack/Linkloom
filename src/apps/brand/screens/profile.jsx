/* profile screens (Builder A). React screens (see src/shared/react/view.jsx).
   #setup   first-run brand profile, two short steps: brand (logo, name, website, industry, contact) and billing (legal name, GSTIN, address, accounts email).
            Save lands on #home.
   #profile the brand's own profile, laid out like the creator profile: masthead, an ink band of counts, brand details,
            billing details, plan ("Brand plan · renews 1 Dec", never a price), sign-in and security (change password, sign out).
            "Edit profile" opens a sheet with every brand field plus billing; "Change password" opens its own sheet.
   Validators, choices and the shared counts are in profile-kit.js; the logo picker is logo-picker.jsx. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";
import { Match, PwField, Rules, focusFirstErr, useErrs } from "./auth-ui";
import { LogoPicker } from "./logo-picker";
import {
  ABOUT_MAX,
  CITIES_BY_STATE,
  INDUSTRIES,
  OTHER_CITY,
  STATES,
  V,
  cityOther,
  fmtMobile,
  href,
  initial,
  todayISO,
} from "./profile-kit";

const L = window.LLD,
  { icon, store } = L;
const mo = (k, ...a) => {
  const f = L.motion && L.motion[k];
  if (typeof f === "function") {
    try {
      return f(...a);
    } catch (e) {}
  }
};
const SAMPLE = JSON.parse(JSON.stringify(window.LLD_DATA.me)); // the sample brand, for "Fill this step"

/* ---------- form parts ---------- */
function Field({ p, id, label, help, err, children }) {
  return (
    <div className={`field${err ? " is-err" : ""}`} data-f={id}>
      <label htmlFor={`${p}-${id}`}>{label}</label>
      {children}
      {help ? (
        <p className="help" id={`${p}-${id}-h`}>
          {help}
        </p>
      ) : null}
      <p className="err" id={`${p}-${id}-e`} aria-live="polite">
        {err || ""}
      </p>
    </div>
  );
}
const Opt = () => <span className="profile-opt">optional</span>;
const Select = ({ id, list, value, onChange, ph = "Choose", invalid }) => (
  <select
    className="select"
    id={id}
    value={value || ""}
    onChange={e => onChange(e.target.value)}
    aria-invalid={invalid}
  >
    <option value="">{ph}</option>
    {list.map(x => (
      <option key={x}>{x}</option>
    ))}
  </select>
);
/** errors by field id; a field's error clears as soon as it changes */
function useErrors() {
  const [errs, setErrs] = useState({});
  const clear = id => setErrs(e => (e[id] ? { ...e, [id]: "" } : e));
  const inv = id => (errs[id] ? "true" : undefined);
  return { errs, setErrs, clear, inv };
}
const focusErr = root => {
  const i = root && root.querySelector(".field.is-err input,.field.is-err select,.field.is-err textarea");
  if (i) {
    const b = i.closest(".ui-sel") && i.closest(".ui-sel").querySelector(".ui-sel-btn");
    (b || i).focus();
  }
};
/* GSTIN: capitals, no spaces, the caret kept where it was */
const gstinInput = (e, set) => {
  const g = e.target,
    p = g.selectionStart;
  g.value = g.value.toUpperCase().replace(/\s/g, "");
  try {
    g.setSelectionRange(p, p);
  } catch (x) {}
  set(g.value);
};

/* =====================================================================
   #setup (first run)
   ===================================================================== */
const STEPS = [
  { t: "Your brand", sub: "Creators see this on your collabs and invitations before they accept." },
  { t: "Billing details", sub: "Printed on every invoice and credit note. Creators never see it." },
];
let D = null;
store.on(why => {
  if (why === "signed-in" || why === "signed-out") D = null;
});
function freshDraft() {
  const s = store.s,
    me = s.me,
    pre = !s.session.firstRun,
    b = me.billing || {};
  return {
    step: 0,
    logo: pre ? me.logo : null,
    brand: pre ? me.brand : "",
    website: pre ? me.website : "",
    industry: pre ? me.industry : "",
    name: pre ? me.name : "",
    role: pre ? me.role || "" : "",
    legal: pre ? b.legal || "" : "",
    gstin: pre ? b.gstin || "" : "",
    address: pre ? b.address || "" : "",
    bemail: pre ? b.email || "" : s.session.email || "",
  };
}

function Setup() {
  if (!D) D = freshDraft();
  const [, redraw] = useState(0);
  const draw = () => flushSync(() => redraw(n => n + 1));
  const { errs, setErrs, clear, inv } = useErrors();
  const [ferr, setFerr] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(`Step ${D.step + 1} of ${STEPS.length}: ${STEPS[D.step].t}`);
  const root = useRef(null),
    body = useRef(null),
    head = useRef(null);
  const R = useRef({ railAt: null, alive: true, focus: false, swapped: false });
  const step = D.step,
    s = STEPS[step];
  /* an industry that isn't one of the choices reads as not chosen, as the dropdown shows it */
  if (D.industry && !INDUSTRIES.includes(D.industry)) D.industry = "";
  const val = k => D[k] || "";
  const put = k => v => {
    D[k] = v;
    clear(k);
    redraw(n => n + 1);
  };
  useLayoutEffect(() => {
    R.current.alive = true;
    mo("stagger", [...body.current.children]);
    return () => {
      R.current.alive = false;
    };
  }, []);
  /* the rail: a thread pulls to the step you reach */
  useLayoutEffect(() => {
    const ns = root.current.querySelectorAll(".auth-rail-n");
    const at = R.current.railAt;
    if (at != null && step > at) mo("pull", ns[at], ns[step], { color: "butter" });
    R.current.railAt = step;
    if (R.current.focus) {
      R.current.focus = false;
      head.current.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [step]);

  const paintStep = (mutate, dir) => {
    const run = () =>
      flushSync(() => {
        mutate();
        setErrs({});
        setFerr("");
        setLive(`Step ${D.step + 1} of ${STEPS.length}: ${STEPS[D.step].t}`);
        redraw(n => n + 1);
      });
    if (dir && L.motion && L.motion.swap) {
      try {
        L.motion.swap(body.current, run, { dir });
      } catch (e) {
        run();
      }
    } else {
      run();
      mo("stagger", [...body.current.children]);
    }
  };
  const go = (i, dir = 1) => {
    R.current.focus = true;
    paintStep(() => (D.step = i), dir);
  };
  const check = st =>
    (st === 0
      ? [
          ["brand", V.brand(val("brand"))],
          ["website", V.website(val("website"))],
          ["industry", V.industry(val("industry"))],
          ["name", V.person(val("name"))],
        ]
      : [
          ["legal", V.legal(val("legal"))],
          ["gstin", V.gstin(val("gstin"))],
          ["address", V.address(val("address"))],
          ["bemail", V.email(val("bemail"))],
        ]
    ).filter(x => x[1]);
  const submit = e => {
    e.preventDefault();
    const bad = check(step);
    if (bad.length) {
      flushSync(() => setErrs(Object.fromEntries(bad)));
      focusErr(body.current);
      setLive("Check the highlighted fields");
      return;
    }
    if (step < STEPS.length - 1) return go(step + 1, 1);
    if (!navigator.onLine)
      return setFerr(
        "You're offline, so we couldn't save. Your answers are still here; try again when you're connected.",
      );
    setBusy("Saving…");
    setTimeout(
      () => {
        if (!R.current.alive) return;
        store.set(st => {
          const me = st.me;
          me.brand = D.brand.trim();
          me.website = D.website
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/\/$/, "");
          me.industry = D.industry;
          me.name = D.name.trim().replace(/\s+/g, " ");
          me.role = D.role.trim();
          me.logo = D.logo || null;
          me.billing = {
            legal: D.legal.trim(),
            gstin: D.gstin.trim().toUpperCase(),
            address: D.address.trim(),
            email: D.bemail.trim(),
          };
          if (st.session.email) me.email = st.session.email;
          st.session.firstRun = false;
        }, "brand-profile-saved");
        const done = () => {
          D = null;
          L.toast("Brand profile saved", "check");
          L.go("#home");
        };
        if (!L.live) return done();
        const me = store.s.me;
        L.live
          .saveBrand(me)
          .then(() =>
            me.logo && String(me.logo).startsWith("data:")
              ? import("@/shared/api/uploads")
                  .then(u => L.live.uploadLogo(u.dataUrlToBlob(me.logo)))
                  .then(url => url && store.set(x => (x.me.logo = url), "profile-edited"))
              : null,
          )
          .then(done, er => {
            store.set(x => (x.session.firstRun = true), "brand-profile-saved");
            if (!R.current.alive) return;
            setBusy("Save");
            setFerr(L.live.errorText(er));
          });
      },
      L.live ? 0 : 500,
    );
  };

  return (
    <div className="focus auth setup" ref={root}>
      <section className="focus-art dark auth-art" aria-label="Brand profile progress">
        <p className="auth-brand">
          <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
          <span>linkloom</span>
          <span className="auth-for">for brands</span>
        </p>
        <h2 className="t-display auth-line">Creators read this before they accept.</h2>
        <ol className="auth-rail" data-rail="">
          {STEPS.map((x, i) => {
            const st = i < step ? "done" : i === step ? "now" : "next";
            const inner = (
              <>
                <span className="auth-rail-n">{st === "done" ? <Icon n="check" /> : "0" + (i + 1)}</span>
                <span className="auth-rail-t">{x.t}</span>
              </>
            );
            return (
              <li key={i} className={`auth-rail-i is-${st}`} aria-current={st === "now" ? "step" : undefined}>
                {st === "done" ? (
                  <button type="button" data-goto={i} onClick={() => go(i, -1)}>
                    {inner}
                    <span className="sr-only">, go back to this step</span>
                  </button>
                ) : (
                  <span className="auth-rail-b">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
        <div className="auth-prog" style={{ "--n": 2 }} aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i < step ? "is-done" : i === step ? "is-now" : ""}></span>
          ))}
        </div>
        <img className="auth-rings" src="assets/hero-rings.svg" width="610" height="660" alt="" />
      </section>
      <section className="focus-form light auth-form">
        <form className="auth-in" noValidate data-form="" onSubmit={submit}>
          <div className="auth-head">
            <div className="row between wrap">
              <p className="t-eyebrow muted" data-count="">
                Step {step + 1} of {STEPS.length}
              </p>
              <button
                type="button"
                className="btn-q auth-samplebtn"
                data-fill=""
                hidden={!!L.live}
                onClick={() => {
                  const m = SAMPLE,
                    b = m.billing;
                  paintStep(() => {
                    if (D.step === 0)
                      Object.assign(D, {
                        brand: m.brand,
                        website: m.website,
                        industry: m.industry,
                        name: m.name,
                        role: m.role,
                      });
                    else
                      Object.assign(D, {
                        legal: b.legal,
                        gstin: b.gstin,
                        address: b.address,
                        bemail: b.email,
                      });
                  });
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
          <div className="auth-stack" data-body="" ref={body}>
            {step === 0 ? (
              <>
                <div data-logo="">
                  <LogoPicker value={D.logo} onChange={put("logo")} initials={initial(D.brand)} />
                </div>
                <Field
                  p="su"
                  id="brand"
                  label="Brand name"
                  help="Shown on your collabs, invitations and chats."
                  err={errs.brand}
                >
                  <input
                    className="input"
                    id="su-brand"
                    autoComplete="organization"
                    value={val("brand")}
                    placeholder="Mirevo Skincare"
                    aria-invalid={inv("brand")}
                    onChange={e => put("brand")(e.target.value)}
                  />
                </Field>
                <div className="profile-two">
                  <Field p="su" id="website" label="Website" err={errs.website}>
                    <input
                      className="input"
                      id="su-website"
                      inputMode="url"
                      spellCheck="false"
                      autoCapitalize="off"
                      value={val("website")}
                      placeholder="mirevo.in"
                      aria-invalid={inv("website")}
                      onChange={e => put("website")(e.target.value)}
                    />
                  </Field>
                  <Field p="su" id="industry" label="Industry" err={errs.industry}>
                    <Select
                      id="su-industry"
                      list={INDUSTRIES}
                      value={val("industry")}
                      onChange={put("industry")}
                      invalid={inv("industry")}
                    />
                  </Field>
                </div>
                <div className="profile-two">
                  <Field p="su" id="name" label="Contact person" err={errs.name}>
                    <input
                      className="input"
                      id="su-name"
                      autoComplete="name"
                      value={val("name")}
                      placeholder="Meera Kapoor"
                      aria-invalid={inv("name")}
                      onChange={e => put("name")(e.target.value)}
                    />
                  </Field>
                  <Field
                    p="su"
                    id="role"
                    label={
                      <>
                        Role <Opt />
                      </>
                    }
                    err={errs.role}
                  >
                    <input
                      className="input"
                      id="su-role"
                      autoComplete="organization-title"
                      value={val("role")}
                      placeholder="Brand manager"
                      onChange={e => put("role")(e.target.value)}
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field
                  p="su"
                  id="legal"
                  label="Legal name"
                  help="Exactly as registered. It appears on invoices."
                  err={errs.legal}
                >
                  <input
                    className="input"
                    id="su-legal"
                    value={val("legal")}
                    placeholder="Mirevo Skincare Private Limited"
                    aria-invalid={inv("legal")}
                    onChange={e => put("legal")(e.target.value)}
                  />
                </Field>
                <Field
                  p="su"
                  id="gstin"
                  label={
                    <>
                      GSTIN <Opt />
                    </>
                  }
                  help="Add it to claim input tax credit. Taxes as per confirmed rules."
                  err={errs.gstin}
                >
                  <input
                    className="input num profile-gstin"
                    id="su-gstin"
                    maxLength={15}
                    spellCheck="false"
                    autoCapitalize="characters"
                    value={val("gstin")}
                    placeholder="27AABCM1234F1Z5"
                    aria-invalid={inv("gstin")}
                    onChange={e => gstinInput(e, put("gstin"))}
                  />
                </Field>
                <Field p="su" id="address" label="Billing address" err={errs.address}>
                  <textarea
                    className="textarea"
                    id="su-address"
                    rows={3}
                    autoComplete="street-address"
                    placeholder="4th floor, Lodha Supremus, Lower Parel, Mumbai 400013"
                    value={val("address")}
                    aria-invalid={inv("address")}
                    onChange={e => put("address")(e.target.value)}
                  />
                </Field>
                <Field
                  p="su"
                  id="bemail"
                  label="Send invoices to"
                  help="Often your accounts team. You can change it later."
                  err={errs.bemail}
                >
                  <input
                    className="input"
                    id="su-bemail"
                    type="email"
                    spellCheck="false"
                    autoCapitalize="off"
                    value={val("bemail")}
                    placeholder="accounts@brand.in"
                    aria-invalid={inv("bemail")}
                    onChange={e => put("bemail")(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>
          <p className="profile-formerr" role="alert" data-ferr="" hidden={!ferr}>
            {ferr}
          </p>
          <div className="profile-setup-nav">
            <Lq className="lq-s" data-back="" hidden={step === 0} onClick={() => go(step - 1, -1)}>
              <Icon n="back" className="ic" />
              Back
            </Lq>
            <Lq className="lq-p" type="submit" data-next="" disabled={busy === "Saving…"}>
              {busy || (step === STEPS.length - 1 ? "Save brand profile" : "Continue")}
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

/* =====================================================================
   #profile
   ===================================================================== */
/* budget windows the brand can plan against (quarters); stored in LLD_DATA.budget as { label, total (paise), from, to } */
const QUARTERS = [
  ["Oct–Dec 2026", "2026-10-01", "2026-12-31"],
  ["Jan–Mar 2027", "2027-01-01", "2027-03-31"],
  ["Apr–Jun 2027", "2027-04-01", "2027-06-30"],
];
const budgetUsed = s => {
  const b = s.budget || {},
    q = QUARTERS.find(x => x[0] === b.label) || QUARTERS[0],
    from = b.from || q[1],
    to = b.to || q[2];
  return (s.payments || [])
    .filter(x => x.kind === "escrow" && x.status !== "refunded" && x.date >= from && x.date <= to)
    .reduce((n, x) => n + x.amount, 0);
};

/* B12: business check (brand KYC) status, from the /v1/kyc/ status the dashboard loads. Null in the sample build. */
function bizCheck(k) {
  if (!k) return null;
  const st = String(k.status || "not_started").toLowerCase(),
    steps = k.steps || {},
    n = [steps.pan, steps.id, steps.bank].filter(x => x && x.done).length;
  if (st === "verified")
    return {
      tone: "ok",
      pill: "pill-ok",
      state: "Verified",
      icon: "verified",
      sub: "You can post collabs, send offers and hire with escrow.",
    };
  if (["pending", "submitted", "in_review", "under_review"].includes(st))
    return {
      tone: "review",
      pill: "pill-info",
      state: "In review",
      icon: "clock",
      sub: "Usually 1 to 2 hours, up to 24 hours. We check it by hand and send you a notification when it's done.",
    };
  if (st === "rejected")
    return {
      tone: "fix",
      pill: "pill-err",
      state: "Needs a fix",
      icon: "alert",
      sub: k.rejectionReason || "One of the details needs changing before we can verify it.",
      todo: "Fix it",
    };
  return {
    tone: "todo",
    pill: "pill-paper",
    state: n ? `${n} of 3 done` : "Not started",
    icon: "shield",
    sub: n
      ? "A few minutes to finish. Needed to post a collab, send an offer or hire."
      : "About 4 min. Needed to post a collab, send an offer or hire.",
    todo: n ? "Continue" : "Start",
  };
}

/* ---------- sheets ---------- */
function BudgetSheet({ close, done }) {
  const b = store.s.budget || { label: QUARTERS[0][0], total: 0 };
  const [q, setQ] = useState(b.label || QUARTERS[0][0]);
  const [amt, setAmt] = useState(b.total ? Math.round(b.total / 100).toLocaleString("en-IN") : "");
  const { errs, setErrs, clear, inv } = useErrors();
  const box = useRef(null);
  const qq = QUARTERS.find(x => x[0] === q);
  const used = qq ? budgetUsed({ ...store.s, budget: { label: qq[0], from: qq[1], to: qq[2] } }) : 0;
  const submit = e => {
    e.preventDefault();
    const r = +String(amt).replace(/[^\d]/g, "") || 0;
    const bad = {};
    if (!qq) bad.q = "Choose a quarter.";
    if (!r) bad.amt = "Enter an amount in rupees, like 2,00,000.";
    else if (r < 1000) bad.amt = "Use at least ₹1,000.";
    else if (r * 100 < used)
      bad.amt = `You've already paid ${L.inr(used)} into escrow this quarter. Set at least that much.`;
    if (Object.keys(bad).length) {
      flushSync(() => setErrs(bad));
      return focusErr(box.current);
    }
    store.set(s => {
      s.budget = { ...(s.budget || {}), label: qq[0], from: qq[1], to: qq[2], total: r * 100 };
    }, "budget-changed");
    close();
    done();
    L.toast(`Budget set to ${L.inr(r * 100)} for ${qq[0]}`, "check");
  };
  return (
    <form className="profile-pe" noValidate data-bf="" onSubmit={submit} ref={box}>
      <p className="muted">
        How much you plan to pay creators in a quarter. Home and Reports show spend against it. It never
        blocks a payment.
      </p>
      <Field p="bu" id="q" label="Quarter" err={errs.q}>
        <Select
          id="bu-q"
          list={QUARTERS.map(x => x[0])}
          value={q}
          ph="Choose a quarter"
          invalid={inv("q")}
          onChange={v => {
            setQ(v);
            clear("q");
          }}
        />
      </Field>
      <div className={`field${errs.amt ? " is-err" : ""}`} data-f="amt">
        <label htmlFor="bu-amt">Budget</label>
        <div className="money-in profile-money">
          <span aria-hidden="true">₹</span>
          <input
            className="input num"
            id="bu-amt"
            inputMode="numeric"
            autoComplete="off"
            value={amt}
            placeholder="2,00,000"
            aria-describedby="bu-amt-h bu-amt-e"
            aria-invalid={inv("amt")}
            onChange={e => {
              const d = String(e.target.value).replace(/[^\d]/g, "").slice(0, 9);
              setAmt(d ? (+d).toLocaleString("en-IN") : "");
              clear("amt");
            }}
          />
        </div>
        <p className="help" id="bu-amt-h" data-bh="">
          {L.inr(used)} already paid into escrow in {q || "this quarter"}.
        </p>
        <p className="err" id="bu-amt-e" aria-live="polite">
          {errs.amt || ""}
        </p>
      </div>
      <div className="profile-pe-f">
        <Lq className="lq-p" type="submit" data-save="">
          Save budget
        </Lq>
        <Lq className="lq-s" data-cancel="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}

const SignOutSheet = ({ close }) => (
  <div className="profile-q">
    <p className="muted">
      {L.live
        ? "You'll sign back in with your password, a one-time code or Google."
        : "You'll need your email and password to sign back in."}{" "}
      Collabs, deals and money in escrow are not affected.
    </p>
    <div className="row wrap">
      <Lq
        className="lq-p"
        data-yes=""
        onClick={() => {
          if (L.auth) L.auth.signOut();
          else {
            store.set(s => {
              s.session.signedIn = false;
            }, "signed-out");
            close(true);
            L.go("#login");
          }
        }}
      >
        <Icon n="logout" className="ic" />
        Sign out
      </Lq>
      <Lq className="lq-s" data-no="" onClick={() => close()}>
        Stay signed in
      </Lq>
    </div>
  </div>
);

function EditSheet({ toBilling, close, done }) {
  const me = store.s.me,
    bl = me.billing || {};
  const other0 = cityOther(me.state, me.city);
  const [f, setF] = useState({
    logo: me.logo || null,
    brand: me.brand || "",
    website: me.website || "",
    industry: me.industry || "",
    about: me.about || "",
    state: me.state || "",
    city: other0 ? OTHER_CITY : me.city || "",
    cityx: other0 ? me.city : "",
    name: me.name || "",
    role: me.role || "",
    legal: bl.legal || "",
    gstin: bl.gstin || "",
    address: bl.address || "",
    bemail: bl.email || "",
  });
  const { errs, setErrs, clear, inv } = useErrors();
  const [ferr, setFerr] = useState("");
  const box = useRef(null),
    cityX = useRef(null);
  const put = k => v => {
    setF(x => ({ ...x, [k]: v }));
    clear(k);
  };
  useLayoutEffect(() => {
    if (!toBilling) return;
    const t = setTimeout(() => {
      box.current.querySelector("[data-billing]").scrollIntoView({ block: "start" });
      box.current.querySelector("#pe-legal").focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cities = CITIES_BY_STATE[f.state] || [];
  const cityVal = () => (f.city === OTHER_CITY ? f.cityx : f.city);
  const aboutN = [...f.about].length;
  const industries =
    INDUSTRIES.includes(me.industry) || !me.industry ? INDUSTRIES : [me.industry, ...INDUSTRIES];
  const submit = e => {
    e.preventDefault();
    const bad = [
      ["brand", V.brand(f.brand)],
      ["website", V.website(f.website)],
      ["industry", V.industry(f.industry)],
      ["state", f.state ? "" : "Choose your state or union territory."],
      ["city", !f.state ? "" : f.city === "" ? "Choose your city." : V.city(cityVal())],
      ["name", V.person(f.name)],
      ["legal", V.legal(f.legal)],
      ["gstin", V.gstin(f.gstin)],
      ["address", V.address(f.address)],
      ["bemail", V.email(f.bemail)],
    ].filter(x => x[1]);
    const an = [...f.about.trim()].length;
    if (an > ABOUT_MAX) bad.push(["about", `${an - ABOUT_MAX} characters over. Trim it to ${ABOUT_MAX}.`]);
    if (bad.length) {
      flushSync(() => setErrs(Object.fromEntries(bad)));
      return focusErr(box.current);
    }
    if (!navigator.onLine)
      return setFerr(
        "You're offline, so nothing was saved. Your edits are still here; try again when you're connected.",
      );
    store.set(s => {
      const m = s.me;
      m.brand = f.brand.trim();
      m.website = f.website
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");
      m.industry = f.industry;
      m.about = f.about.trim();
      m.city = cityVal().trim();
      m.state = f.state;
      m.name = f.name.trim().replace(/\s+/g, " ");
      m.role = f.role.trim();
      m.logo = f.logo;
      m.billing = {
        legal: f.legal.trim(),
        gstin: f.gstin.trim().toUpperCase(),
        address: f.address.trim(),
        email: f.bemail.trim(),
      };
    }, "profile-edited");
    if (L.live) {
      const m = store.s.me;
      L.live
        .saveBrand(m)
        .then(() =>
          m.logo && String(m.logo).startsWith("data:")
            ? import("@/shared/api/uploads")
                .then(u => L.live.uploadLogo(u.dataUrlToBlob(m.logo)))
                .then(url => url && store.set(s => (s.me.logo = url), "profile-edited"))
            : null,
        )
        .catch(er => L.toast(L.live.errorText(er), "alert"));
    }
    close();
    done(toBilling ? "[data-editbill]" : "[data-edit]");
    let back = "";
    try {
      back = sessionStorage.getItem("ll-brand-profile-return") || "";
    } catch (x) {
      /* no storage */
    }
    if (back && !L.brandMissing().length) {
      try {
        sessionStorage.removeItem("ll-brand-profile-return");
      } catch (x) {
        /* ignore */
      }
      L.toast("Profile complete. You can publish your collab now.", "check");
      L.go(back);
      return;
    }
    L.toast(toBilling ? "Billing details updated" : "Profile updated", "check");
  };
  const text = (id, extra = {}) => (
    <input
      className="input"
      id={`pe-${id}`}
      value={f[id]}
      aria-invalid={inv(id)}
      onChange={e => put(id)(e.target.value)}
      {...extra}
    />
  );
  return (
    <form className="profile-pe" noValidate data-pe="" onSubmit={submit} ref={box}>
      <fieldset className="profile-fs">
        <legend className="t-h3">Brand</legend>
        <div data-logo="">
          <LogoPicker value={f.logo} onChange={put("logo")} initials={initial(f.brand || me.brand)} />
        </div>
        <Field p="pe" id="brand" label="Brand name" err={errs.brand}>
          {text("brand", { autoComplete: "organization" })}
        </Field>
        <div className="profile-two">
          <Field p="pe" id="website" label="Website" err={errs.website}>
            {text("website", { inputMode: "url", spellCheck: "false", autoCapitalize: "off" })}
          </Field>
          <Field p="pe" id="industry" label="Industry" err={errs.industry}>
            <Select
              id="pe-industry"
              list={industries}
              value={f.industry}
              onChange={put("industry")}
              invalid={inv("industry")}
            />
          </Field>
        </div>
        <div className={`field${errs.about ? " is-err" : ""}`} data-f="about">
          <div className="row between">
            <label className="lab" htmlFor="pe-about">
              About <Opt />
            </label>
            <span
              className={`profile-count num${aboutN > ABOUT_MAX - 20 && aboutN <= ABOUT_MAX ? " is-near" : ""}${aboutN > ABOUT_MAX ? " is-over" : ""}`}
              data-cnt=""
            >
              {aboutN} / {ABOUT_MAX}
            </span>
          </div>
          <textarea
            className="textarea"
            id="pe-about"
            rows={3}
            placeholder="What you make and who it's for, in a line or two."
            value={f.about}
            aria-invalid={inv("about")}
            onChange={e => put("about")(e.target.value)}
          />
          <p className="err" aria-live="polite">
            {errs.about || ""}
          </p>
        </div>
        <div className="profile-two">
          <Field p="pe" id="state" label="State or UT" err={errs.state}>
            <Select
              id="pe-state"
              list={STATES}
              value={f.state}
              invalid={inv("state")}
              onChange={v => {
                setF(x => ({ ...x, state: v, city: "", cityx: "" }));
                clear("state");
              }}
            />
          </Field>
          <Field p="pe" id="city" label="City" err={errs.city}>
            <select
              className="select"
              id="pe-city"
              disabled={!f.state}
              value={f.city}
              aria-invalid={inv("city")}
              onChange={e => {
                const v = e.target.value;
                flushSync(() => put("city")(v));
                if (v === OTHER_CITY) cityX.current.focus();
              }}
            >
              {f.state ? (
                <>
                  <option value="">Choose a city</option>
                  {cities.map(c => (
                    <option key={c}>{c}</option>
                  ))}
                  <option value={OTHER_CITY}>Other city</option>
                </>
              ) : (
                <option value="">Choose a state first</option>
              )}
            </select>
            <input
              className="input profile-cityx"
              id="pe-cityx"
              autoComplete="address-level2"
              placeholder="Type your city"
              aria-label="Your city"
              value={f.cityx}
              hidden={f.city !== OTHER_CITY}
              ref={cityX}
              onChange={e => put("cityx")(e.target.value) || clear("city")}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset className="profile-fs">
        <legend className="t-h3">Contact person</legend>
        <div className="profile-two">
          <Field p="pe" id="name" label="Name" err={errs.name}>
            {text("name", { autoComplete: "name" })}
          </Field>
          <Field
            p="pe"
            id="role"
            label={
              <>
                Role <Opt />
              </>
            }
            err={errs.role}
          >
            {text("role")}
          </Field>
        </div>
        <div className="profile-locked">
          <Icon n="lock" />
          <p>
            <b>{me.email}</b> and <b className="num">{fmtMobile(me.mobile)}</b> are verified for sign-in. To
            change them, write to support@linkloom.in so we can verify the new ones. One email and one mobile
            per account.
          </p>
        </div>
      </fieldset>
      <fieldset className="profile-fs" data-billing="">
        <legend className="t-h3">Billing</legend>
        <Field p="pe" id="legal" label="Legal name" err={errs.legal}>
          {text("legal")}
        </Field>
        <Field
          p="pe"
          id="gstin"
          label={
            <>
              GSTIN <Opt />
            </>
          }
          err={errs.gstin}
        >
          <input
            className="input num profile-gstin"
            id="pe-gstin"
            maxLength={15}
            spellCheck="false"
            autoCapitalize="characters"
            value={f.gstin}
            aria-invalid={inv("gstin")}
            onChange={e => gstinInput(e, put("gstin"))}
          />
        </Field>
        <Field p="pe" id="address" label="Billing address" err={errs.address}>
          <textarea
            className="textarea"
            id="pe-address"
            rows={3}
            autoComplete="street-address"
            value={f.address}
            aria-invalid={inv("address")}
            onChange={e => put("address")(e.target.value)}
          />
        </Field>
        <Field p="pe" id="bemail" label="Send invoices to" err={errs.bemail}>
          {text("bemail", { type: "email", spellCheck: "false", autoCapitalize: "off" })}
        </Field>
        <p className="t-cap muted">
          Changes apply to invoices from today. Past invoices keep the details they were issued with.
        </p>
      </fieldset>
      <p className="profile-formerr" role="alert" data-pe-err="" hidden={!ferr}>
        {ferr}
      </p>
      <div className="profile-pe-f">
        <Lq className="lq-p" type="submit" data-save="">
          Save changes
        </Lq>
        <Lq className="lq-s" data-cancel="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}

/* the sample build's password change (the prototype sign-in kit, LLD.auth); the live app links to signin.html instead */
function PasswordSheet({ close, done }) {
  const A = L.auth;
  const E = useErrs();
  const [p1, setP1] = useState(""),
    [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef(null),
    cur = useRef(null),
    r1 = useRef(null),
    r2 = useRef(null);
  useEffect(() => {
    if (p2 && p1 === p2) E.clr("pw2");
  }, [p1, p2]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = e => {
    e.preventDefault();
    const c = cur.current.value,
      v1 = r1.current.value,
      v2 = r2.current.value;
    let bad = false;
    if (!c) {
      E.at("cur", "Enter your current password.");
      bad = true;
    } else if (!A.checkCurrent(c)) {
      E.at("cur", `That isn't your current password. Forgot it? Sign out and use "Forgot password".`);
      bad = true;
      mo("shake", cur.current.parentElement);
    }
    if (!A.pwOk(v1)) {
      E.at("pw", v1 ? "Your new password needs everything in the list below." : "Choose a new password.");
      bad = true;
    } else if (v1 === c) {
      E.at("pw", "Use a password different from the current one.");
      bad = true;
    }
    if (!bad && v1 !== v2) {
      E.at("pw2", v2 ? "The two passwords don't match." : "Type the new password again.");
      bad = true;
    }
    if (bad) {
      flushSync(() => {});
      return focusFirstErr(box.current);
    }
    setBusy(true);
    setTimeout(() => {
      A.setPassword(v1);
      store.set(s => {
        s.me.passwordChanged = todayISO();
      }, "password-changed");
      close();
      done();
      L.toast("Password changed. Other devices are signed out.", "check");
    }, 500);
  };
  return (
    <form className="profile-pe" noValidate data-pwf="" ref={box} onSubmit={submit}>
      <p className="muted">Changing it signs you out on other devices. This one stays signed in.</p>
      <PwField
        id="cur"
        label="Current password"
        auto="current-password"
        E={E}
        inputRef={cur}
        onInput={() => E.clr("cur")}
      />
      <PwField
        id="pw"
        label="New password"
        desc="au-rules"
        E={E}
        inputRef={r1}
        onInput={e => {
          setP1(e.currentTarget.value);
          E.clr("pw");
        }}
      />
      <Rules id="au-rules" value={p1} />
      <PwField
        id="pw2"
        label="Confirm new password"
        E={E}
        inputRef={r2}
        onInput={e => setP2(e.currentTarget.value)}
      />
      <Match p1={p1} p2={p2} />
      <p className="t-cap muted">
        <span className="sample">Sample</span> current password: <b className="num">Mirevo@2026</b>, unless
        you changed it
      </p>
      <div className="profile-pe-f">
        <Lq className="lq-p" type="submit" data-save="" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </Lq>
        <Lq className="lq-s" data-cancel="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}
function openPassword(done) {
  if (!L.auth) {
    L.toast("Password change is unavailable right now. Reload and try again.", "alert");
    return;
  }
  openReactSheet({ title: "Change password", render: close => <PasswordSheet close={close} done={done} /> });
}

/** One paint of the profile, keyed by a version: a save redraws it from scratch and the counts count up again. */
function Profile({ param, repaint }) {
  const root = useRef(null);
  const s = store.s,
    me = s.me,
    b = me.billing || {},
    st = L.brandStats(),
    sess = s.session,
    p = s.plan;
  const bud = s.budget,
    used = budgetUsed(s);
  const hiredNames = st.hiredIds.map(id => (L.creator(id) || {}).name).filter(Boolean);
  const where = [me.city, me.state].filter(Boolean).join(", ");
  const check = bizCheck(s.kyc);
  useLayoutEffect(() => {
    root.current.querySelectorAll(".profile-nums [data-n]").forEach(d => {
      const n = +d.dataset.n;
      if (n) mo("count", d, n, v => String(Math.round(v)));
    });
    mo("stagger", [...root.current.querySelectorAll(".profile-dl>div, .profile-rows>li")]);
  }, []);
  useLayoutEffect(() => {
    if (!param) return;
    /* #profile-edit (from "Complete your profile" on Post a brief): open the editor straight away */
    if (param === "edit") {
      const t = setTimeout(() => openEdit(), 60);
      return () => clearTimeout(t);
    }
    /* deep links from Payments and Reports: #profile-billing, #profile-budget */
    if (param === "billing" || param === "budget") {
      const sec = root.current.querySelector("#" + param);
      if (!sec) return;
      const t = setTimeout(() => {
        sec.scrollIntoView({ block: "start", behavior: L.RM ? "auto" : "smooth" });
        sec.classList.add("is-target");
        const bt = sec.querySelector("button");
        bt && bt.focus({ preventScroll: true });
      }, 120);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openEdit = toBilling =>
    openReactSheet({
      title: toBilling ? "Edit billing details" : "Edit profile",
      wide: true,
      render: close => <EditSheet toBilling={toBilling} close={close} done={sel => repaint(sel)} />,
    });
  /* the "On Linkloom" band shows for every brand; a count of 0 shows the next step in its slot, never a big 0 */
  const num = (n, none) =>
    n ? (
      <dd className="t-money" data-n={n}>
        {n}
      </dd>
    ) : (
      <dd className="profile-none">{none}</dd>
    );
  return (
    <div className="view-in profile" ref={root}>
      <header className="profile-mast">
        <div className={`profile-logo ${me.logo ? "has-img" : ""}`}>
          {me.logo ? (
            <img src={me.logo} alt={`${me.brand} logo`} />
          ) : (
            <span aria-hidden="true">{initial(me.brand)}</span>
          )}
        </div>
        <div className="profile-id">
          <p className="t-eyebrow">{["Brand", me.industry, where].filter(Boolean).join(" · ")}</p>
          <h1 className="t-display profile-name">{me.brand}</h1>
          {me.website ? (
            <p className="profile-web">
              <a href={href(me.website)} target="_blank" rel="noopener noreferrer">
                <Icon n="link" />
                <span>{me.website}</span>
                <span className="sr-only">, opens in a new tab</span>
              </a>
            </p>
          ) : null}
          {me.about ? <p className="profile-bio">{me.about}</p> : null}
          <p className="profile-meta">
            <span className="pill pill-ok">
              <Icon n="verified" />
              {me.mobile ? "Email and mobile verified" : "Email verified"}
            </span>
            {me.name ? (
              <span className="profile-langs">
                Contact: {me.name}
                {me.role ? ", " + me.role : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="profile-act">
          <Lq className={check && check.todo ? "lq-s" : "lq-p"} data-edit="" onClick={() => openEdit()}>
            <Icon n="edit" className="ic" />
            Edit profile
          </Lq>
        </div>
      </header>
      {check ? (
        <section className={`ll-panel profile-check is-${check.tone}`} aria-labelledby="profile-check-h">
          <span className="profile-check-ic" aria-hidden="true">
            <Icon n={check.icon} />
          </span>
          <div className="profile-check-t">
            <h2 className="profile-check-h" id="profile-check-h">
              Business check{" "}
              <span className={`pill ${check.pill}`}>
                {check.tone === "ok" ? <Icon n="check" /> : null}
                {check.state}
              </span>
            </h2>
            <p className="muted">{check.sub}</p>
          </div>
          {check.todo ? (
            <div className="profile-check-a">
              <Lq
                as="a"
                className="lq-p"
                href="#kyc"
                data-kyc=""
                onClick={() => {
                  try {
                    sessionStorage.setItem("ll-brand-kyc-return", "#profile");
                  } catch (e) {}
                }}
              >
                <Icon n="lock" className="ic" />
                {check.todo}
              </Lq>
              <p className="ll-trust">
                <Icon n="lock" />
                Encrypted. Never shown to creators.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="profile-band" aria-labelledby="profile-on">
        <div className="profile-band-h">
          <h2 className="t-eyebrow" id="profile-on">
            On Linkloom
          </h2>
          <p className="profile-src">
            {p ? "Since " + L.fmtDate(p.since, { year: true }) + " · " : ""}counted by Linkloom, not
            self-reported <span className="sample">Sample</span>
          </p>
        </div>
        <dl className="profile-nums">
          <div>
            <dt>Creators hired</dt>
            {num(st.hired, "None yet")}
            <p>
              {hiredNames.length
                ? hiredNames.join(" and ")
                : st.hired
                  ? "Paid through escrow"
                  : "Hire from a collab or Find creators"}
            </p>
          </div>
          <div>
            <dt>Deals</dt>
            {num(st.funded, "None yet")}
            <p>{st.funded ? "funded through escrow" : "Fund a deal after you hire"}</p>
          </div>
          <div>
            <dt>Collabs posted</dt>
            {num(st.jobs, "None yet")}
            <p>
              {st.drafts
                ? `${st.drafts} draft not counted`
                : st.jobs
                  ? "open, hired or closed"
                  : "Post a collab to hear from creators"}
            </p>
          </div>
        </dl>
      </section>

      <div className="profile-grid">
        <div className="profile-col">
          <section className="profile-sec profile-card" aria-labelledby="profile-det">
            <div className="profile-sec-h">
              <h2 className="t-h2" id="profile-det">
                Brand details
              </h2>
              <Lq className="lq-s lq-sm" data-edit2="" onClick={() => openEdit()}>
                <Icon n="edit" className="ic" />
                Edit<span className="sr-only"> brand details</span>
              </Lq>
            </div>
            <dl className="profile-dl">
              <div>
                <dt>Brand name</dt>
                <dd>{me.brand}</dd>
              </div>
              <div>
                <dt>Industry</dt>
                <dd>{me.industry || "—"}</dd>
              </div>
              <div>
                <dt>Website</dt>
                <dd>{me.website ? me.website : "—"}</dd>
              </div>
              <div>
                <dt>City</dt>
                <dd>{[me.city, me.state].filter(Boolean).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt>Contact person</dt>
                <dd>
                  {me.name}
                  {me.role ? <span className="t-cap muted">{me.role}</span> : null}
                </dd>
              </div>
              {me.email ? (
                <div>
                  <dt>Sign-in email</dt>
                  <dd>
                    {me.email}
                    <span className="profile-ok">
                      <Icon n="check" />
                      Verified by link
                    </span>
                  </dd>
                </div>
              ) : null}
              {me.mobile ? (
                <div>
                  <dt>Mobile</dt>
                  <dd className="num">
                    {fmtMobile(me.mobile)}
                    <span className="profile-ok">
                      <Icon n="check" />
                      Verified by OTP
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="t-cap muted">
              Creators see your brand name, logo, website, industry and city. Never your mobile or billing
              details.
            </p>
          </section>

          <section className="profile-sec profile-card" id="billing" aria-labelledby="profile-bill">
            <div className="profile-sec-h">
              <h2 className="t-h2" id="profile-bill">
                Billing details
              </h2>
              <Lq className="lq-s lq-sm" data-editbill="" onClick={() => openEdit(true)}>
                <Icon n="edit" className="ic" />
                Edit billing
              </Lq>
            </div>
            <dl className="profile-dl">
              <div>
                <dt>Legal name</dt>
                <dd>{b.legal || "—"}</dd>
              </div>
              <div>
                <dt>GSTIN</dt>
                <dd className="num">{b.gstin || "Not added"}</dd>
              </div>
              <div className="is-wide">
                <dt>Billing address</dt>
                <dd>{b.address || "—"}</dd>
              </div>
              <div>
                <dt>Invoices go to</dt>
                <dd>{b.email || "—"}</dd>
              </div>
            </dl>
            <p className="t-cap muted">
              Printed on every Linkloom invoice and credit note. Taxes as per confirmed rules.
            </p>
          </section>
        </div>

        <div className="profile-col">
          {p ? (
            <section className="profile-sec profile-plan" aria-labelledby="profile-plan">
              <p className="t-eyebrow" id="profile-plan">
                Plan
              </p>
              <p className="profile-plan-l">
                {p.name}
                {p.status === "active" && p.renews ? " · renews " + L.fmtDate(p.renews) : ""}
              </p>
              <span className={`pill ${p.status === "active" ? "pill-ok" : "pill-warn"}`}>
                {p.status === "active" ? (
                  <>
                    <Icon n="check" />
                    Active
                  </>
                ) : (
                  p.status
                )}
              </span>
              <p className="profile-plan-s">
                No per-deal platform fee. Creators receive the agreed price you pay into escrow.
              </p>
            </section>
          ) : null}

          <section className="profile-sec profile-card" id="budget" aria-labelledby="profile-bud">
            <div className="profile-sec-h">
              <h2 className="t-h3" id="profile-bud">
                <Icon n="chart" />
                Creator budget
              </h2>
              <Lq
                className="lq-s lq-sm"
                data-editbud=""
                onClick={() =>
                  openReactSheet({
                    title: "Creator budget",
                    render: close => <BudgetSheet close={close} done={() => repaint("[data-editbud]")} />,
                  })
                }
              >
                <Icon n="edit" className="ic" />
                {bud && bud.total ? "Change" : "Set a budget"}
              </Lq>
            </div>
            {bud && bud.total ? (
              <>
                <p className="profile-bud-v">
                  <span className="t-money">{L.inr(bud.total)}</span>
                  <span className="muted">for {bud.label}</span>
                </p>
                <div className="profile-bud-bar" aria-hidden="true">
                  <i style={{ width: Math.min(100, (used / bud.total) * 100).toFixed(1) + "%" }}></i>
                </div>
                <p className="t-cap muted">
                  {used > 0 ? `${L.inr(used)} paid into escrow so far` : "Nothing paid into escrow yet"},{" "}
                  {bud.total - used > 0 ? `${L.inr(bud.total - used)} left` : "none left"}. A planning number
                  for Home and Reports; it never blocks a payment.
                </p>
              </>
            ) : (
              <p className="muted t-small">
                No budget set. Add one to see spend against it on Home and in Reports.
              </p>
            )}
          </section>

          <section className="profile-sec profile-card" aria-labelledby="profile-sec" data-settings="">
            <h2 className="t-h3" id="profile-sec">
              <Icon n="shield" />
              Sign-in and security
            </h2>
            <ul className="profile-rows">
              {L.live ? (
                <li>
                  <span>
                    <b>Sign-in</b>
                    <span className="t-cap muted">
                      Email and password{me.email ? ` (${me.email})` : ""}, a code sent to your email, or
                      Google
                    </span>
                  </span>
                  <Lq as="a" className="lq-s lq-sm" href="signin.html?role=brand&forgot=1">
                    Change password
                  </Lq>
                </li>
              ) : (
                <li>
                  <span>
                    <b>Password</b>
                    <span className="t-cap muted">
                      Last changed{" "}
                      {me.passwordChanged ? L.fmtDate(me.passwordChanged, { year: true }) : "never"}
                    </span>
                  </span>
                  <Lq className="lq-s lq-sm" data-pw="" onClick={() => openPassword(() => repaint())}>
                    Change password
                  </Lq>
                </li>
              )}
              <li>
                <span>
                  <b>This device</b>
                  <span className="t-cap muted">
                    {sess.remember !== false
                      ? "Remembered. You stay signed in for 30 days."
                      : "Not remembered. You're signed out when the tab closes."}
                  </span>
                </span>
              </li>
              <li>
                <span>
                  <b>Sign out</b>
                  <span className="t-cap muted">Ends your session on this device.</span>
                </span>
                <Lq
                  className="lq-s lq-sm"
                  data-signout=""
                  onClick={() =>
                    openReactSheet({ title: "Sign out?", render: close => <SignOutSheet close={close} /> })
                  }
                >
                  <Icon n="logout" className="ic" />
                  Sign out
                </Lq>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({ param }) {
  const [ver, setVer] = useState(0);
  /* after a sheet saves: redraw the profile from scratch, then put focus back on the button that opened it */
  const repaint = sel => {
    flushSync(() => setVer(v => v + 1));
    if (sel) {
      const b = document.querySelector(".profile " + sel);
      b && b.focus({ preventScroll: true });
    }
  };
  return <Profile key={ver} param={ver ? null : param} repaint={repaint} />;
}

L.register("setup", { title: "Set up your brand", shell: "focus", Component: Setup });
L.register("profile", { title: "Brand profile", nav: "profile", Component: ProfileScreen });
