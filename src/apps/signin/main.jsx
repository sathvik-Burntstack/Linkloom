/* Shared sign-in page: pick a side, then sign in with a password, or sign up. Everything is email-only: there is no
   mobile-number sign-in or SMS code anywhere in the app.
   - Sign in: email, password.
   - Sign up: name (and brand name for brands), email with Verify beside it, the emailed one-time code underneath,
     then password and confirm password. The email is verified once, here; after that the account signs in with it.
   - Forgot password: a code emailed to them signs them in, then they choose a new password (/auth/password/change/).
     A new account found this way finishes signing up as usual.
   The chosen colour carries the person into that dashboard.
   React: signin.html keeps the page frame (rings, logo); the card and the lede are drawn here, into the same elements. */
import "./signin.css";
import "../../shared/analytics";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "../../shared/vendor-gsap";
import {} from "./handoff";
import { attachGoogle } from "../../shared/api/google";
import {
  authMessage,
  changePassword,
  completeSignup,
  emailDestination,
  fetchMe,
  googleSignIn,
  passwordSignIn,
  requestOtp,
  signOut,
  verifyOtp,
} from "../../shared/api/auth";
import { ApiError, clearAuth, isSignedIn } from "../../shared/api/client";

const G = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : gsap;
const q = new URLSearchParams(location.search);
const COPY = {
  creator: {
    eyebrow: "For creators",
    sub: "Bid on brand briefs, do the work, and get paid from escrow the day they approve.",
    btn: "Sign in as a creator",
    create: "Create creator account",
    dash: "app.html#home",
    setup: "app.html#setup",
    hello: "Opening your creator dashboard",
  },
  brand: {
    eyebrow: "For brands",
    sub: "Find creators, post a brief, and pay into escrow. Money moves only when you approve the work.",
    btn: "Sign in as a brand",
    create: "Create brand account",
    dash: "brand.html#home",
    setup: "brand.html#setup",
    hello: "Opening your brand dashboard",
  },
};
const isNew = u => !!u.needsOnboarding || !u.role;
const badEmail = v =>
  !v.trim() ? "Enter your email." : "That email looks incomplete, for example you@brand.in.";
const RULES = [
  ["len", "at least 8 characters", p => p.length >= 8, "8+ characters"],
  ["letter", "a letter", p => /[a-z]/i.test(p), "A letter"],
  ["num", "a number", p => /\d/.test(p), "A number"],
  ["sym", "a symbol", p => /[^a-z0-9]/i.test(p), "A symbol"],
];
const missing = p => RULES.filter(([, , ok]) => !ok(p)).map(([, t]) => t);
const listText = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
const Arrow = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const EyeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/* the butter thread: a running stitch that draws across the rings and pulls through */
const thread = document.getElementById("thread");
const len = thread.getTotalLength();
const stitch = () => {
  if (!G) return;
  G.killTweensOf(thread);
  G.set(thread, { opacity: 1, strokeDasharray: `${len}`, strokeDashoffset: len });
  G.timeline()
    .to(thread, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" })
    .set(thread, { strokeDasharray: "4 7" })
    .to(thread, { strokeDashoffset: -44, opacity: 0, duration: 0.7, ease: "power2.in" });
};

function SignIn() {
  /* the page's state, kept as one object as the plain-DOM version kept module variables; `draw` paints it */
  const S = useRef(null);
  if (!S.current)
    S.current = {
      role: q.get("role") === "brand" ? "brand" : "creator",
      mode: q.get("join") ? "signup" : q.get("forgot") ? "reset" : "signin",
      /* set once a code (or Google, or a password) has signed the person in on this page */
      verifiedUser: null,
      /* "code": verified with the emailed code here; "other": Google or an existing session */
      verifiedBy: null,
      /* the account is new and still needs its name (and brand name) */
      needsProfile: false,
      /* an existing account that signed in with a code ("Forgot password?") and is choosing a password */
      setPw: false,
      challengeId: "",
      dest: null,
      cooldownEnd: 0,
      cooldownTimer: 0,
      busy: false,
      vstate: "verify",
      otpHidden: true,
      otpRO: false,
      errs: {},
      inv: {},
      emailOk: "",
      codeHelp: null,
      goBusy: null,
      suGoBusy: null,
      eyes: {},
      pw: "",
      sub: "",
      locked: false,
    };
  const s = S.current;
  const [, tick] = useState(0);
  const draw = () => flushSync(() => tick(n => n + 1));
  const R = {
    email: useRef(null),
    pw: useRef(null),
    remember: useRef(null),
    suName: useRef(null),
    suBrand: useRef(null),
    suEmail: useRef(null),
    otp: useRef(null),
    suPw: useRef(null),
    suPw2: useRef(null),
    go: useRef(null),
    google: useRef(null),
    sub: useRef(null),
  };
  const showNames = () => (s.verifiedUser ? s.needsProfile : s.mode === "signup");
  const setErr = (input, errId, msg) => {
    s.errs[errId] = msg;
    if (input) s.inv[input] = String(!!msg);
  };
  const shake = () => {
    if (G)
      G.fromTo(".card form:not([hidden])", { x: -6 }, { x: 0, duration: 0.45, ease: "elastic.out(1,.35)" });
  };
  const remember = () => R.remember.current.checked;

  /* role: copy, colours, links; the chosen ring steps forward and the butter thread re-stitches */
  function setRole(r, animate) {
    s.role = r;
    document.body.dataset.role = r;
    const c = COPY[r];
    const sub = R.sub.current;
    if (G && animate && sub) {
      G.to(sub, {
        opacity: 0,
        y: 6,
        duration: 0.18,
        ease: "power2.in",
        onComplete: () => {
          s.sub = c.sub;
          draw();
          G.to(sub, { opacity: 1, y: 0, duration: 0.36, ease: "power3.out" });
        },
      });
      paint();
      const fwd = r === "creator" ? ["#gC", "#gCw"] : ["#gB"];
      const back = r === "creator" ? ["#gB"] : ["#gC", "#gCw"];
      G.fromTo(
        fwd,
        { scale: 0.97 },
        { scale: 1.03, duration: 0.5, ease: "back.out(2.2)", yoyo: true, repeat: 1, repeatDelay: 0.05 },
      );
      G.to(back, { scale: 0.99, duration: 0.4, ease: "power2.out", yoyo: true, repeat: 1 });
      stitch();
    } else {
      s.sub = c.sub;
      paint();
    }
  }

  function verifyState(v) {
    s.vstate = v;
  }
  function paintResend() {
    clearInterval(s.cooldownTimer);
    const tickDown = () => {
      const left = Math.ceil((s.cooldownEnd - Date.now()) / 1000);
      if (left > 0) s.codeHelp = { left };
      else {
        clearInterval(s.cooldownTimer);
        s.codeHelp = { resend: true };
      }
      draw();
    };
    tickDown();
    s.cooldownTimer = window.setInterval(tickDown, 1000);
  }
  function resetVerification() {
    if (s.verifiedUser) clearAuth();
    s.verifiedUser = null;
    s.verifiedBy = null;
    s.needsProfile = false;
    s.setPw = false;
    s.challengeId = "";
    s.dest = null;
    clearInterval(s.cooldownTimer);
    s.otpHidden = true;
    if (R.otp.current) R.otp.current.value = "";
    s.otpRO = false;
    s.emailOk = "";
    verifyState("verify");
  }
  function setMode(m, focus = true) {
    if (m === "signin" || (m === "reset" && s.verifiedUser)) resetVerification();
    s.mode = m;
    Object.keys(s.inv).forEach(k => s.inv[k] === "true" && (s.inv[k] = "false"));
    Object.keys(s.errs).forEach(k => (s.errs[k] = ""));
    paint();
    if (focus)
      (m === "signin"
        ? R.email
        : s.verifiedUser
          ? R.suPw
          : showNames()
            ? R.suName
            : R.suEmail
      ).current.focus();
  }
  const setBusy = (k, on, text) => {
    s.busy = on;
    s[k] = { on, text };
  };
  /* a repaint (role, mode, verified) puts the buttons' idle words back, as the plain-DOM paint() did */
  const paint = () => {
    if (s.goBusy) s.goBusy.text = null;
    if (!s.busy && s.suGoBusy) s.suGoBusy.text = null;
    draw();
  };

  /* ---------- sign in: email, password ---------- */
  async function signIn(e) {
    e.preventDefault();
    if (s.busy) return;
    const d = emailDestination(R.email.current.value);
    let bad = null;
    const flag = (input, id, msg) => {
      setErr(input, id, msg);
      if (msg && !bad) bad = R[input].current;
    };
    flag("email", "emailErr", d ? "" : badEmail(R.email.current.value));
    flag("pw", "pwErr", R.pw.current.value ? "" : "Enter your password.");
    if (bad) {
      draw();
      bad.focus();
      shake();
      return;
    }
    setBusy("goBusy", true, "Signing in…");
    draw();
    try {
      const user = await passwordSignIn(d, R.pw.current.value, remember());
      await afterSignIn(user);
    } catch (err) {
      s.errs.formErr =
        err instanceof ApiError && err.status === 401 && !err.code
          ? authMessage(new ApiError(401, "", "INVALID_CREDENTIALS"))
          : authMessage(err);
      R.pw.current.select();
      shake();
      setBusy("goBusy", false, COPY[s.role].btn);
      draw();
    }
  }

  /* ---------- sign up: the email and its code ---------- */
  async function sendCode(resend = false) {
    if (s.busy) return;
    const d = emailDestination(R.suEmail.current.value);
    if (!d) {
      setErr("suEmail", "suEmailErr", badEmail(R.suEmail.current.value));
      draw();
      R.suEmail.current.focus();
      shake();
      return;
    }
    s.dest = d;
    s.busy = true;
    verifyState("sending");
    if (resend) s.codeHelp = { text: "Sending a new code…" };
    draw();
    try {
      const ch = await requestOtp(d.channel, d.destination);
      s.challengeId = ch.challengeId;
      s.cooldownEnd = Date.now() + 30000;
      R.otp.current.value = "";
      setErr("otp", "suOtpErr", "");
      s.otpHidden = false;
      verifyState("change");
      paintResend();
      R.otp.current.focus();
    } catch (er) {
      verifyState(s.otpHidden ? "verify" : "change");
      if (s.otpHidden) setErr("suEmail", "suEmailErr", authMessage(er));
      else setErr("otp", "suOtpErr", authMessage(er));
      draw();
      shake();
    } finally {
      s.busy = false;
      draw();
    }
  }
  async function checkCode() {
    const otp = R.otp.current;
    if (s.busy || !/^\d{6}$/.test(otp.value)) return;
    s.busy = true;
    s.otpRO = true;
    clearInterval(s.cooldownTimer);
    s.codeHelp = { text: "Checking the code…" };
    draw();
    try {
      const user = await verifyOtp(s.challengeId, otp.value, remember());
      s.busy = false;
      verified(user, "code");
    } catch (er) {
      s.busy = false;
      setErr("otp", "suOtpErr", authMessage(er));
      s.otpRO = false;
      draw();
      otp.select();
      paintResend();
      shake();
    }
  }
  /** The sign-up code matched an email that already has an account. */
  async function alreadyRegistered() {
    const email = R.suEmail.current.value;
    /* finish signing out first, so it can't clear a password sign-in made straight after */
    s.busy = true;
    s.codeHelp = { text: "Checking…" };
    draw();
    await signOut();
    s.busy = false;
    resetVerification();
    R.suEmail.current.value = email;
    s.inv.suEmail = "true";
    s.errs.suEmailErr = (
      <>
        This email already has a Linkloom account.{" "}
        <button
          className="link"
          type="button"
          data-to-signin=""
          onClick={() => {
            setMode("signin");
            R.email.current.value = email.trim();
            R.pw.current.focus();
          }}
        >
          Sign in with your password
        </button>
        , or use{" "}
        <button
          className="link"
          type="button"
          data-to-code=""
          onClick={() => {
            setMode("reset");
            R.suEmail.current.value = email;
          }}
        >
          Forgot password?
        </button>{" "}
        to get a code by email.
      </>
    );
    draw();
    shake();
  }
  /** The person is signed in (code, Google, or an existing session). A new account adds its details and a password. */
  function verified(user, by) {
    if (!isNew(user)) {
      /* Creating an account with an email that already has one: never sign in silently. End the session the code
         just opened and point them to sign-in. */
      if (s.mode === "signup") return void alreadyRegistered();
      /* "Forgot password?": the code signed the account in; now they choose the password to use from now on */
      s.verifiedUser = user;
      s.verifiedBy = by;
      s.needsProfile = false;
      s.setPw = true;
      s.otpHidden = true;
      s.otpRO = false;
      clearInterval(s.cooldownTimer);
      verifyState("done");
      setErr("suEmail", "suEmailErr", "");
      s.emailOk = by === "code" && s.dest ? `${s.dest.destination} is verified.` : "";
      if (user.role && user.role !== s.role) setRole(user.role, false);
      else paint();
      R.suPw.current.focus();
      return;
    }
    s.verifiedUser = user;
    s.verifiedBy = by;
    s.needsProfile = isNew(user);
    s.otpHidden = true;
    s.otpRO = false;
    clearInterval(s.cooldownTimer);
    verifyState("done");
    setErr("suEmail", "suEmailErr", "");
    s.emailOk = by === "code" && s.dest ? `${s.dest.destination} is verified.` : "";
    if (s.mode === "signin") s.mode = "signup";
    if (!R.suName.current.value && user.fullName) R.suName.current.value = String(user.fullName);
    paint();
    (!R.suName.current.value ? R.suName : R.suPw).current.focus();
  }

  /* ---------- sign up: create the account and save the password ---------- */
  async function signUp(e) {
    e.preventDefault();
    if (s.busy) return;
    s.errs.suErr = "";
    const names = showNames();
    const brand = s.role === "brand";
    const n = R.suName.current.value.trim(),
      b = R.suBrand.current.value.trim(),
      pw = R.suPw.current.value,
      pw2 = R.suPw2.current.value;
    let bad = null;
    const flag = (input, id, msg) => {
      setErr(input, id, msg);
      if (msg && !bad) bad = R[input].current;
    };
    if (names) {
      flag("suName", "suNameErr", n.length < 2 ? "Enter your name." : "");
      if (brand) flag("suBrand", "suBrandErr", b.length < 2 ? "Enter your brand name." : "");
    }
    if (!s.verifiedUser) {
      if (s.otpHidden) flag("suEmail", "suEmailErr", "Verify your email first.");
      else flag("otp", "suOtpErr", "Enter the 6-digit code we sent you.");
    }
    if (names || s.setPw) {
      const miss = missing(pw);
      flag(
        "suPw",
        "suPwErr",
        !pw ? "Choose a password." : miss.length ? `Your password needs ${listText(miss)}.` : "",
      );
      flag(
        "suPw2",
        "suPw2Err",
        !pw2 ? "Type the password again to confirm it." : pw2 !== pw ? "The two passwords don't match." : "",
      );
    }
    if (bad) {
      draw();
      bad.focus();
      shake();
      return;
    }
    if (s.setPw) {
      setBusy("suGoBusy", true, "Saving…");
      draw();
      try {
        await changePassword(pw);
        open(s.verifiedUser.role || s.role);
      } catch (err) {
        const pwMsg = err instanceof ApiError ? err.field("password") || err.field("confirmPassword") : null;
        if (pwMsg) setErr("suPw", "suPwErr", pwMsg);
        else s.errs.suErr = authMessage(err);
        shake();
        setBusy("suGoBusy", false, "Save password and sign in");
        draw();
      }
      return;
    }
    setBusy("suGoBusy", true, "Creating your account…");
    draw();
    try {
      /* one call: the account's details and its password (API reference v1, 2.6) */
      const u = await completeSignup({
        role: s.role,
        fullName: n,
        ...(brand ? { brandName: b } : { displayName: n }),
        password: pw,
      });
      const r = u.role || s.role;
      if (r !== s.role) setRole(r, false);
      /* new creators fill in their profile next; new brands finish their brand profile */
      handoff(COPY[r].setup);
    } catch (err) {
      /* a field the server refused goes under that field */
      const x = err instanceof ApiError ? err : null;
      const pwMsg = x?.field("password") || x?.field("confirmPassword");
      const nameMsg = x?.field("fullName") || x?.field("displayName");
      const brandMsg = x?.field("brandName");
      if (pwMsg) setErr("suPw", "suPwErr", pwMsg);
      if (nameMsg) setErr("suName", "suNameErr", nameMsg);
      if (brandMsg) setErr("suBrand", "suBrandErr", brandMsg);
      if (!pwMsg && !nameMsg && !brandMsg) s.errs.suErr = authMessage(err);
      shake();
      setBusy("suGoBusy", false, COPY[s.role].create);
      draw();
    }
  }

  /* ---------- after sign-in: finish sign-up if needed, then open the right dashboard ---------- */
  async function afterSignIn(user) {
    if (isNew(user)) {
      s.mode = "signup";
      verified(user, "other");
      return;
    }
    open(user.role);
  }
  function open(r) {
    /* An account keeps the side it signed up on, whichever tab is selected here. */
    if (r !== s.role) setRole(r, false);
    handoff(COPY[r].dash);
  }
  /* hand-off: the rings slide together and lock, the chosen colour weaves up, then the dashboard opens */
  const handoff = href => {
    document.getElementById("curtainT").textContent = COPY[s.role].hello + "…";
    if (!G) {
      location.href = href;
      return;
    }
    R.go.current.setAttribute("aria-busy", "true");
    G.killTweensOf(["#gC", "#gCw", "#gB"]);
    G.timeline({ onComplete: () => (location.href = href) })
      .to(["#gC", "#gCw"], { x: 26, duration: 0.45, ease: "power3.inOut" }, 0)
      .to("#gB", { x: -26, duration: 0.45, ease: "power3.inOut" }, 0)
      .to(["#gC", "#gCw", "#gB"], { opacity: 1, duration: 0.2 }, 0)
      .to("#curtain", { clipPath: "inset(0% 0 0 0)", duration: 0.6, ease: "power3.inOut" }, 0.32)
      .to("#curtainT", { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.7)
      .to({}, { duration: 0.25 });
  };

  /* ---------- once: the first paint, the motion, Google, and a session that's already here ---------- */
  useLayoutEffect(() => {
    setRole(s.role, false);
    /* idle: the rings breathe a little, never more than a few pixels */
    if (G) {
      G.from("#rings", { opacity: 0, scale: 0.94, duration: 1.1, ease: "power3.out" });
      G.from(["#gC", "#gCw"], { x: -60, duration: 1.3, ease: "power3.out" });
      G.from("#gB", { x: 60, duration: 1.3, ease: "power3.out" });
      G.from([".eyebrow", ".h1", ".sub"], {
        y: 18,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.2,
      });
      G.from(".card > *", {
        y: 12,
        opacity: 0,
        duration: 0.6,
        stagger: 0.04,
        ease: "power3.out",
        delay: 0.25,
      });
      G.to(["#gC", "#gCw"], { x: -5, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
      G.to("#gB", { x: 5, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
      setTimeout(stitch, 900);
    }
    /* Google: Google's own button sits invisibly over the designed one */
    attachGoogle(
      R.google.current,
      async token => {
        s.errs.googleErr = "";
        draw();
        try {
          const user = await googleSignIn(token, s.role, remember());
          await afterSignIn(user);
        } catch (err) {
          s.errs.googleErr = authMessage(err);
          draw();
        }
      },
      msg => {
        s.errs.googleErr = msg;
        draw();
      },
    );
    /* Already signed in on this device: go straight to the dashboard, or finish signing up. */
    /* (Not when they came to change their password: that starts with a fresh code.) */
    if (isSignedIn() && !q.get("out") && !q.get("forgot")) {
      fetchMe()
        .then(u => (isNew(u) ? ((s.mode = "signup"), verified(u, "other")) : open(u.role)))
        .catch(() => clearAuth());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* typing clears that field's error, and the form's */
  const typed = (input, errId) => () => {
    if (errId) setErr(input, errId, "");
    s.errs.formErr = "";
    s.errs.suErr = "";
  };
  const eye = k => (
    <button
      className="eye"
      type="button"
      data-eye=""
      aria-label={s.eyes[k] ? "Hide password" : "Show password"}
      aria-pressed={String(!!s.eyes[k])}
      onClick={() => {
        s.eyes[k] = !s.eyes[k];
        draw();
      }}
    >
      <EyeIcon />
    </button>
  );
  const err = id => s.errs[id] || "";
  const signin = s.mode === "signin";
  const names = showNames();
  const brand = s.role === "brand";
  const newOnly = !names && !s.setPw;
  const locked = !!s.verifiedUser && !s.needsProfile;
  const flash = q.get("out")
    ? "You are signed out. Sign in again whenever you are ready."
    : q.get("suspended")
      ? "Your account is suspended, so you can't sign in or use Linkloom right now. If you think this is a mistake, write to support@linkloom.in."
      : q.get("expired")
        ? "Your session expired, so we signed you out to keep your account safe. Sign in again to continue."
        : "";
  const v = s.vstate;
  const help = s.codeHelp;
  const lede = document.querySelector(".lede");

  return (
    <>
      {lede
        ? createPortal(
            <>
              <p className="eyebrow" id="eyebrow">
                {COPY[s.role].eyebrow}
              </p>
              <h1 className="h1" id="h1">
                Two threads. <em>One loom.</em>
              </h1>
              <p className="sub" id="sub" aria-live="polite" ref={R.sub}>
                {s.sub}
              </p>
            </>,
            lede,
          )
        : null}
      <a className="back" href="index.html">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        Back to linkloom
      </a>
      <h2 className="t-h2" id="formH">
        {signin
          ? "Sign in"
          : s.setPw
            ? "Choose a new password"
            : names
              ? brand
                ? "Create your brand account"
                : "Create your creator account"
              : "Sign in with a code"}
      </h2>
      <p className="help" id="formHelp">
        {signin
          ? "Welcome back. Use the email and password you signed up with."
          : s.setPw
            ? "You're signed in. Choose the password you'll sign in with from now on."
            : names
              ? s.verifiedBy === "other"
                ? "Almost there. Add your details and choose a password."
                : "Verify your email with a code once, then choose a password. You'll sign in with your email and password from now on."
              : "Forgot your password? We'll email you a one-time code to sign you in, then you can choose a new password."}
      </p>
      <p className="flash" id="flash" role="status" hidden={!flash}>
        {flash}
      </p>

      <div
        className="seg"
        role="radiogroup"
        aria-label={signin ? "I am signing in as" : "I am signing up as"}
      >
        <span className="seg-glide" aria-hidden="true"></span>
        {[
          ["creator", "I'm a creator"],
          ["brand", "I'm a brand"],
        ].map(([r, t]) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={String(s.role === r)}
            data-role={r}
            disabled={locked}
            onClick={e => !e.currentTarget.disabled && setRole(r, true)}
            onKeyDown={e => {
              if (
                e.currentTarget.disabled ||
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
              )
                return;
              e.preventDefault();
              const n = s.role === "creator" ? "brand" : "creator";
              setRole(n, true);
              document.querySelector(`.seg button[data-role="${n}"]`).focus();
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* sign in: email, password */}
      <form id="form" noValidate hidden={!signin} onSubmit={signIn}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <div className="in">
            <input
              id="email"
              name="username"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck="false"
              placeholder="you@example.com"
              aria-describedby="emailErr"
              aria-invalid={s.inv.email}
              ref={R.email}
              onInput={() => (typed("email", "emailErr")(), draw())}
            />
          </div>
          <p className="err" id="emailErr">
            {err("emailErr")}
          </p>
        </div>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <div className="in">
            <input
              className="has-eye"
              id="pw"
              name="password"
              type={s.eyes.pw ? "text" : "password"}
              autoComplete="current-password"
              aria-describedby="pwErr"
              aria-invalid={s.inv.pw}
              ref={R.pw}
              onInput={() => (typed("pw", "pwErr")(), draw())}
            />
            {eye("pw")}
          </div>
          <p className="err" id="pwErr">
            {err("pwErr")}
          </p>
        </div>
        <div className="row">
          <label className="check">
            <input
              type="checkbox"
              id="remember"
              defaultChecked
              ref={R.remember}
              onInput={() => (typed()(), draw())}
            />{" "}
            Keep me signed in on this device
          </label>
          <button className="link" type="button" id="forgot" onClick={() => setMode("reset")}>
            Forgot password?
          </button>
        </div>
        <p className="err form-err" id="formErr" aria-live="assertive">
          {err("formErr")}
        </p>
        <button
          className="lq"
          type="submit"
          id="go"
          ref={R.go}
          disabled={!!(s.goBusy && s.goBusy.on)}
          aria-busy={s.goBusy ? String(s.goBusy.on) : undefined}
        >
          <span id="goL">{(s.goBusy && s.goBusy.text) || COPY[s.role].btn}</span>
          <Arrow />
        </button>
      </form>

      {/* sign up: name (+ brand name), email + Verify, the emailed code underneath, password, confirm. Also "Forgot password?". */}
      <form id="signupForm" noValidate hidden={signin} onSubmit={signUp}>
        <div className="field" data-names="" hidden={!names}>
          <label htmlFor="suName">Your name</label>
          <div className="in">
            <input
              id="suName"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              aria-describedby="suNameErr"
              aria-invalid={s.inv.suName}
              ref={R.suName}
              onInput={() => (typed("suName", "suNameErr")(), draw())}
            />
          </div>
          <p className="err" id="suNameErr">
            {err("suNameErr")}
          </p>
        </div>
        <div className="field" data-names="" data-brand-only="" hidden={!names || !brand}>
          <label htmlFor="suBrand">Brand name</label>
          <div className="in">
            <input
              id="suBrand"
              name="organization"
              type="text"
              autoComplete="organization"
              placeholder="Your brand"
              aria-describedby="suBrandErr"
              aria-invalid={s.inv.suBrand}
              ref={R.suBrand}
              onInput={() => (typed("suBrand", "suBrandErr")(), draw())}
            />
          </div>
          <p className="err" id="suBrandErr">
            {err("suBrandErr")}
          </p>
        </div>
        <div className="field" id="suEmailField" hidden={s.verifiedBy === "other"}>
          <label htmlFor="suEmail">Email</label>
          <div className="in-row">
            <div className="in">
              <input
                id="suEmail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="you@example.com"
                aria-describedby="suEmailErr suEmailOk"
                aria-invalid={s.inv.suEmail}
                readOnly={v !== "verify"}
                ref={R.suEmail}
                onInput={() => (typed("suEmail", "suEmailErr")(), draw())}
                onKeyDown={e => {
                  if (e.key === "Enter" && s.vstate === "verify") {
                    e.preventDefault();
                    void sendCode();
                  }
                }}
              />
            </div>
            <button
              className={`vbtn${v === "done" ? " is-ok" : ""}`}
              type="button"
              id="suVerify"
              disabled={v === "sending" || v === "done"}
              onClick={() => {
                if (s.vstate === "change") {
                  resetVerification();
                  draw();
                  R.suEmail.current.focus();
                } else void sendCode();
              }}
            >
              {{ verify: "Verify", sending: "Sending…", change: "Change", done: "Verified" }[v]}
            </button>
          </div>
          <p className="err" id="suEmailErr">
            {err("suEmailErr")}
          </p>
          <p className="ok" id="suEmailOk" aria-live="polite">
            {s.emailOk}
          </p>
        </div>
        <div className="field" id="suOtpField" hidden={s.otpHidden}>
          <label htmlFor="suOtp">6-digit code</label>
          <div className="in">
            <input
              id="suOtp"
              name="one-time-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              aria-describedby="suOtpErr codeHelp"
              aria-invalid={s.inv.otp}
              readOnly={s.otpRO}
              ref={R.otp}
              onInput={e => {
                typed("otp", "suOtpErr")();
                const o = e.currentTarget;
                o.value = o.value.replace(/\D/g, "").slice(0, 6);
                draw();
                if (o.value.length === 6) void checkCode();
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!/^\d{6}$/.test(e.currentTarget.value)) {
                    setErr("otp", "suOtpErr", "Enter the 6-digit code we sent you.");
                    draw();
                  } else void checkCode();
                }
              }}
            />
          </div>
          <p className="err" id="suOtpErr" aria-live="assertive">
            {err("suOtpErr")}
          </p>
          <p className="help" id="codeHelp" aria-live="polite">
            {!help ? null : help.text ? (
              help.text
            ) : help.left ? (
              <>
                Sent to <b>{s.dest.destination}</b>. You can ask for a new code in {help.left} s.
              </>
            ) : (
              <>
                Sent to <b>{s.dest.destination}</b>. Didn't get it?{" "}
                <button className="link" type="button" id="resend" onClick={() => void sendCode(true)}>
                  Send a new code
                </button>
              </>
            )}
          </p>
        </div>
        <div className="field" data-new-only="" hidden={newOnly}>
          <label htmlFor="suPw">Password</label>
          <div className="in">
            <input
              className="has-eye"
              id="suPw"
              name="new-password"
              type={s.eyes.suPw ? "text" : "password"}
              autoComplete="new-password"
              aria-describedby="suPwErr suRules"
              aria-invalid={s.inv.suPw}
              ref={R.suPw}
              onInput={e => {
                typed("suPw", "suPwErr")();
                s.pw = e.currentTarget.value;
                draw();
              }}
            />
            {eye("suPw")}
          </div>
          <p className="err" id="suPwErr">
            {err("suPwErr")}
          </p>
          <ul className="rules" id="suRules" aria-label="Your password needs">
            {RULES.map(([k, , ok, label]) => (
              <li key={k} data-rule={k} className={ok(s.pw) ? "is-met" : undefined}>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="field" data-new-only="" hidden={newOnly}>
          <label htmlFor="suPw2">Confirm password</label>
          <div className="in">
            <input
              className="has-eye"
              id="suPw2"
              name="confirm-password"
              type={s.eyes.suPw2 ? "text" : "password"}
              autoComplete="new-password"
              aria-describedby="suPw2Err"
              aria-invalid={s.inv.suPw2}
              ref={R.suPw2}
              onInput={() => (typed("suPw2", "suPw2Err")(), draw())}
            />
            {eye("suPw2")}
          </div>
          <p className="err" id="suPw2Err" aria-live="polite">
            {err("suPw2Err")}
          </p>
        </div>
        <p className="err form-err" id="suErr" aria-live="assertive">
          {err("suErr")}
        </p>
        <p className="join" id="skipPw" hidden={!s.setPw}>
          <button
            className="link"
            type="button"
            id="skipPwBtn"
            onClick={() => s.verifiedUser && open(s.verifiedUser.role || s.role)}
          >
            Not now, open my dashboard
          </button>
        </p>
        <button
          className="lq"
          type="submit"
          id="suGo"
          data-new-only=""
          hidden={newOnly}
          disabled={!!(s.suGoBusy && s.suGoBusy.on)}
          aria-busy={s.suGoBusy ? String(s.suGoBusy.on) : undefined}
        >
          <span id="suGoL">
            {(s.suGoBusy && s.suGoBusy.text) || (s.setPw ? "Save password and sign in" : COPY[s.role].create)}
          </span>
          <Arrow />
        </button>
      </form>
      <div id="google" hidden={!!s.verifiedUser}>
        <p className="or">or</p>
        <button className="alt" type="button" id="googleBtn" ref={R.google}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"
            />
            <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" />
            <path
              fill="#EA4335"
              d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z"
            />
          </svg>
          Continue with Google
        </button>
        <p className="err" id="googleErr" aria-live="assertive">
          {err("googleErr")}
        </p>
      </div>
      <div className="join" id="join" hidden={!signin}>
        <p>New to Linkloom?</p>
        <button className="alt" type="button" id="toSignup" onClick={() => setMode("signup")}>
          Sign up
        </button>
      </div>
      <p className="join" id="haveAcc" hidden={signin}>
        Already have an account?{" "}
        <button className="link" type="button" id="toSignin" onClick={() => setMode("signin")}>
          Sign in
        </button>
      </p>
      <p className="fine">
        Your email is verified once with a code, when you sign up. After that you sign in with your email and
        password.
        <br />
        <span className="pill">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
          </svg>
          Money stays in escrow until work is approved
        </span>
      </p>
    </>
  );
}

const card = document.querySelector(".card");
flushSync(() => createRoot(card).render(<SignIn />));
