/* auth screens (Builder A): #login, #signup, #forgot, #reset-<token>. All shell:'focus', auth:false.
   Security rules shown in the UI (the server enforces them in production):
   - one email = one account, one mobile = one account (LLD_DATA.taken)
   - email verified by link, mobile by a 6-digit OTP; both resend with a 30 s cooldown, 3 resends each
   - password: at least 8 characters with a letter, a number and a symbol
   - reset links work once and expire after 30 minutes
   - account status is checked on sign-in: verified, pending (verify email first) or blocked (contact support)
   - remember me keeps the session for 30 days on this device (JWT access + refresh tokens, server-side)
   The live app signs in on signin.html; these are the sample build's. The kit (rules, accounts, LLD.auth) is auth-kit.js.
   React screens (see src/shared/react/view.jsx). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";
import {
  ACC,
  COOL,
  FS,
  L,
  LS,
  MAX_SENDS,
  OTP,
  OTP_TRIES,
  PW_LOCK,
  PW_TRIES,
  RESET_TTL,
  SAMPLES,
  SAMPLE_EMAIL,
  SAMPLE_PW,
  STEPS,
  SU,
  SUPPORT,
  TOK,
  emailTaken,
  fmtPhone,
  freshSU,
  maskEmail,
  mmss,
  mo,
  mobileTaken,
  newToken,
  now,
  pwOk,
  store,
  vEmail,
  vMobile,
} from "./auth-kit";
import { Fld, focusFirstErr, Match, PwField, Rules, useErrs } from "./auth-ui";

/* ---------- shared parts ---------- */
const Art = ({ line, foot, children }) => (
  <section className="focus-art dark auth-art" aria-label="Linkloom for brands">
    <p className="auth-brand">
      <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
      <span>linkloom</span>
      <span className="auth-for">for brands</span>
    </p>
    <h2 className="t-display auth-line">{line}</h2>
    {children}
    <img className="auth-rings" src="assets/hero-rings.svg" width="610" height="660" alt="" />
    <p className="auth-art-foot">{foot}</p>
  </section>
);
const Shell = ({ art, live, cls = "", children, root }) => (
  <div className={`focus auth ${cls}`} ref={root}>
    {art}
    <section className="focus-form light auth-form">
      <div className="auth-in">{children}</div>
      <p className="sr-only" aria-live="polite" data-live="">
        {live}
      </p>
    </section>
  </div>
);
const Note = ({ kind, ic, children, ...attrs }) => (
  <div className={`auth-note auth-note-${kind}`} {...attrs}>
    <Icon n={ic} />
    <div>{children}</div>
  </div>
);
/** a resend line with a live cooldown; `st` holds { coolEnd, sends } */
function Resend({ st, what, onSend, as = "p", className = "auth-resend", ...rest }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.ceil((st.coolEnd - now()) / 1000);
  const T = as;
  return (
    <T className={className} {...rest}>
      {st.sends >= MAX_SENDS ? (
        <span className="muted">
          You've asked for {MAX_SENDS} new {what}s. Wait 30 min, or write to{" "}
          <a className="btn-q" href={`mailto:${SUPPORT}`}>
            {SUPPORT}
          </a>
          .
        </span>
      ) : left > 0 ? (
        <span className="muted">
          Didn't get it? Resend in{" "}
          <b className="num" data-cd="">
            {mmss(left)}
          </b>
        </span>
      ) : (
        <>
          <span className="muted">Didn't get it?</span>{" "}
          <button
            type="button"
            className="btn-q"
            data-resend=""
            onClick={() => {
              if (!navigator.onLine)
                return L.toast("You're offline. Try again when you're connected.", "alert");
              st.sends++;
              st.coolEnd = now() + COOL * 1000;
              onSend && onSend();
              tick(n => n + 1);
            }}
          >
            Resend {what}
          </button>
        </>
      )}
    </T>
  );
}
/** the label of a liquid button, once a busy word has replaced it (its icon goes with the first change, as before) */
const useLabel = () => useState(null);

/* =====================================================================
   #login  (#login-expired, #login-out, #login-new, #login-reset)
   ===================================================================== */
const FLASH = {
  expired: [
    "info",
    "clock",
    "Your session expired, so we signed you out to keep your account safe. Sign in again to pick up where you left off.",
  ],
  out: ["info", "logout", "You're signed out on this device. Your collabs, deals and escrow are unchanged."],
  new: [
    "ok",
    "check",
    <>
      <b>Account created.</b> Sign in with your new password to set up your brand profile.
    </>,
  ],
  reset: [
    "ok",
    "check",
    <>
      <b>Password updated.</b> Sign in with the new one. Other devices were signed out.
    </>,
  ],
};
function LoginScreen({ param }) {
  const flash = FLASH[param];
  const E = useErrs();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [remember, setRemember] = useState(store.s.session.remember !== false);
  const [acct, setAcct] = useState(LS.acct);
  const [status, setStatus] = useState(null);
  const [ferr, setFerr] = useState(null);
  const [label, setLabel] = useLabel();
  const [locked, setLocked] = useState(false);
  const [live, setLive] = useState("");
  const root = useRef(null),
    email = useRef(null),
    pw = useRef(null),
    go = useRef(null),
    form = useRef(null);
  const R = useRef({ alive: true, busy: false, timer: 0 });
  LS.remember = remember;
  const lockTick = () => {
    const left = Math.ceil((LS.lockEnd - now()) / 1000);
    if (left > 0) {
      setLocked(true);
      setStatus({ lock: left });
    } else if (LS.lockEnd) {
      LS.lockEnd = 0;
      LS.tries = 0;
      setLocked(false);
      setStatus(null);
    }
  };
  useEffect(() => {
    const onNet = () => setOffline(!navigator.onLine);
    addEventListener("online", onNet);
    addEventListener("offline", onNet);
    if (flash) root.current.querySelector("[data-h]").focus({ preventScroll: true });
    if (LS.lockEnd > now()) {
      lockTick();
      R.current.timer = setInterval(lockTick, 1000);
    }
    return () => {
      R.current.alive = false;
      clearInterval(R.current.timer);
      removeEventListener("online", onNet);
      removeEventListener("offline", onNet);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const showPending = addr => {
    const st = { coolEnd: LS.pendCool, sends: LS.pendSends };
    if (!st.coolEnd) st.coolEnd = LS.pendCool = now() + COOL * 1000;
    setStatus({ pending: addr, st });
  };
  const submit = e => {
    e.preventDefault();
    if (R.current.busy) return;
    setFerr(null);
    const em = email.current.value.trim().toLowerCase(),
      p = pw.current.value;
    let bad = false;
    const ee = vEmail(em);
    if (ee) {
      E.at("email", ee);
      bad = true;
    }
    if (!p) {
      E.at("pw", "Enter your password.");
      bad = true;
    }
    if (bad) {
      flushSync(() => {});
      return focusFirstErr(root.current);
    }
    if (!navigator.onLine) {
      setOffline(true);
      return setFerr("You're offline, so we couldn't sign you in. Try again when you're connected.");
    }
    if (LS.lockEnd > now()) return lockTick();
    R.current.busy = true;
    go.current.setAttribute("aria-busy", "true");
    setLabel("Signing in…");
    clearInterval(R.current.timer);
    setTimeout(() => {
      R.current.busy = false;
      if (!R.current.alive) return;
      go.current.removeAttribute("aria-busy");
      setLabel("Sign in");
      if (!emailTaken(em) && !ACC[em]) {
        flushSync(() =>
          E.at(
            "email",
            <>
              There's no Linkloom account for this email. Check for a typo, or{" "}
              <a className="btn-q" href="#signup">
                create one
              </a>
              .
            </>,
          ),
        );
        email.current.focus();
        return;
      }
      const a = ACC[em];
      if (!a || a.pw !== p) {
        LS.tries++;
        const left = PW_TRIES - LS.tries;
        mo("shake", form.current.querySelector(".auth-pw"));
        if (left <= 0) {
          LS.lockEnd = now() + PW_LOCK * 1000;
          lockTick();
          R.current.timer = setInterval(lockTick, 1000);
          setLive("Sign-in paused for 15 minutes.");
          return;
        }
        flushSync(() =>
          E.at(
            "pw",
            `Email or password is wrong. ${left} ${left === 1 ? "try" : "tries"} left before we pause sign-in for 15 minutes.`,
          ),
        );
        pw.current.select();
        pw.current.focus();
        return;
      }
      LS.tries = 0;
      if (a.status === "pending") {
        showPending(em);
        setLive("Verify your email first.");
        return;
      }
      if (a.status === "blocked") return setStatus({ blocked: true });
      store.set(s => {
        const ss = s.session;
        ss.signedIn = true;
        ss.status = "verified";
        ss.remember = LS.remember;
        ss.expired = false;
        ss.email = em;
        ss.firstRun = !!a.first;
        ss.since = new Date().toISOString();
      }, "signed-in");
      a.first = false;
      if (em === SAMPLE_EMAIL && LS.acct === "first") LS.acct = "returning";
      LS.email = em;
      pw.current.value = "";
      L.toast(store.s.session.firstRun ? "Signed in. Set up your brand profile." : "Signed in", "check");
      L.go(store.s.session.firstRun ? "#setup" : "#home");
    }, 650);
  };
  const openLink = addr => {
    const a = ACC[addr];
    if (a) a.status = "verified";
    if (addr === SAMPLE_EMAIL) {
      LS.acct = "returning";
      setAcct("returning");
    }
    flushSync(() => setStatus({ verified: true }));
    mo("check", root.current.querySelector("[data-status] svg"));
    go.current.focus();
  };
  return (
    <Shell
      root={root}
      live={live}
      art={
        <Art
          line={
            <>
              Hire creators. Pay{" "}on{" "}approval.
            </>
          }
          foot="For brands hiring Instagram and YouTube creators across India"
        />
      }
    >
      <div className="auth-head">
        <h1 className="t-h1" tabIndex={-1} data-h="">
          Sign in
        </h1>
        <p className="muted">
          Find creators, post collabs, and pay from escrow only when you approve the work.
        </p>
      </div>
      {flash ? (
        <Note kind={flash[0]} ic={flash[1]} role="status">
          <p>{flash[2]}</p>
        </Note>
      ) : null}
      <Note kind="err" ic="alert" data-offline="" role="status" hidden={!offline}>
        <p>You're offline. Check your connection, then try again.</p>
      </Note>
      <form className="auth-stack" noValidate data-form="" onSubmit={submit} ref={form}>
        <Fld id="email" label="Work email" E={E}>
          <input
            className="input"
            id="au-email"
            type="email"
            autoComplete="username"
            spellCheck="false"
            autoCapitalize="off"
            placeholder="name@brand.in"
            defaultValue={LS.email}
            aria-describedby="au-email-e"
            aria-invalid={E.errs.email ? "true" : undefined}
            ref={email}
            onInput={e => {
              E.clr("email");
              setFerr(null);
              LS.email = e.currentTarget.value;
              setStatus(s => (s && s.lock ? s : null));
            }}
          />
        </Fld>
        <PwField
          id="pw"
          label="Password"
          auto="current-password"
          E={E}
          inputRef={pw}
          onInput={() => {
            E.clr("pw");
            setFerr(null);
          }}
        />
        <div className="auth-row">
          <label className="check auth-remember">
            <input
              type="checkbox"
              data-remember=""
              defaultChecked={remember}
              aria-describedby="au-rem-h"
              onChange={e => setRemember(e.currentTarget.checked)}
            />
            <span>
              <b>Remember me</b>
              <span className="help" id="au-rem-h" data-remh="">
                {remember
                  ? "Stay signed in for 30 days on this device."
                  : "You'll be signed out when you close this tab."}
              </span>
            </span>
          </label>
          <a
            className="btn-q"
            href="#forgot"
            data-forgot=""
            onClick={() => {
              if (email.current.value.trim()) FS.email = email.current.value.trim();
            }}
          >
            Forgot password?
          </a>
        </div>
        <div data-status="">
          {!status ? null : status.lock ? (
            <Note kind="warn" ic="lock">
              <p className="t-label">Sign-in paused for {mmss(status.lock)}</p>
              <p>
                Too many wrong passwords for this email, so we paused it to keep the account safe.{" "}
                <a className="btn-q" href="#forgot">
                  Reset your password
                </a>{" "}
                instead.
              </p>
            </Note>
          ) : status.pending ? (
            <Note kind="info" ic="brief" role="status">
              <p className="t-label">Verify your email first</p>
              <p>
                This account is <b>pending</b>. Open the link we sent to <b>{maskEmail(status.pending)}</b>,
                then sign in.
              </p>
              <Resend
                st={status.st}
                what="link"
                data-prow=""
                onSend={() => {
                  LS.pendCool = status.st.coolEnd;
                  LS.pendSends = status.st.sends;
                  L.toast("New link sent to " + maskEmail(status.pending), "send");
                }}
              />
              <button
                type="button"
                className="btn-q auth-samplebtn"
                data-openlink=""
                onClick={() => openLink(status.pending)}
              >
                <span className="sample">Sample</span> Open the verification link
              </button>
            </Note>
          ) : status.verified ? (
            <Note kind="ok" ic="check" role="status">
              <p className="t-label">Email verified</p>
              <p>Your account is active. Sign in to continue.</p>
            </Note>
          ) : (
            <Note kind="err" ic="alert" role="alert">
              <p className="t-label">This account is blocked</p>
              <p>
                You can't sign in while it's blocked. Contact support and quote reference{" "}
                <b className="num">LL-B-2041</b>. We reply within one working day.
              </p>
              <a className="btn-q" href={`mailto:${SUPPORT}?subject=Blocked%20account%20LL-B-2041`}>
                <Icon n="send" />
                {SUPPORT}
              </a>
            </Note>
          )}
        </div>
        <p className="err" role="alert" data-ferr="" hidden={ferr === null}>
          {ferr || ""}
        </p>
        <Lq className="lq-p auth-go" type="submit" data-submit="" ref={go} disabled={locked}>
          {label || (
            <>
              Sign in <Icon n="arrow" className="ic" />
            </>
          )}
        </Lq>
      </form>
      <p className="auth-switch">
        New to Linkloom?{" "}
        <a className="btn-q" href="#signup">
          Create a brand account
        </a>
      </p>
      {import.meta.env.VITE_TEST_HOOKS ? null : (
        <p className="auth-switch">
          Are you a creator?{" "}
          <a className="btn-q" href="app.html#login">
            Creator sign-in
          </a>
        </p>
      )}
      <div className="auth-sample" role="group" aria-labelledby="au-acc-l">
        <span id="au-acc-l" className="sample">
          Sample account
        </span>
        <div className="auth-acc">
          {Object.entries(SAMPLES).map(([k, v]) => (
            <button
              key={k}
              type="button"
              data-acc={k}
              aria-pressed={String(acct === k)}
              onClick={() => {
                LS.acct = k;
                const [, st, first] = SAMPLES[k];
                ACC[SAMPLE_EMAIL].status = st;
                ACC[SAMPLE_EMAIL].first = first;
                setAcct(k);
                email.current.value = SAMPLE_EMAIL;
                pw.current.value = SAMPLE_PW;
                LS.email = SAMPLE_EMAIL;
                E.clr("email");
                E.clr("pw");
                setFerr(null);
                setStatus(null);
                setLive(`Sample filled: ${SAMPLES[k][0]}`);
              }}
            >
              {v[0]}
            </button>
          ))}
        </div>
        <p className="auth-hint">
          Fills <b>{SAMPLE_EMAIL}</b> and <b className="num">{SAMPLE_PW}</b>
        </p>
      </div>
      <p className="auth-legal">Linkloom is on a subscription. There is no per-deal platform fee.</p>
    </Shell>
  );
}

/* ---------- 6-box OTP input: `api` (a ref) gets { code, clear, bad, disable, focus, boxes } ---------- */
function OtpBoxes({ api, onFull }) {
  const host = useRef(null);
  const boxes = () => [...host.current.querySelectorAll(".auth-box")];
  const code = () =>
    boxes()
      .map(b => b.value)
      .join("");
  const changed = () => {
    host.current.classList.remove("is-err");
    boxes().forEach(b => b.removeAttribute("aria-invalid"));
    onFull && onFull(code().length === 6, code());
  };
  const fill = (str, from) => {
    const bs = boxes();
    String(str)
      .replace(/\D/g, "")
      .slice(0, 6 - from)
      .split("")
      .forEach((c, k) => (bs[from + k].value = c));
    changed();
    const nx = bs.find(x => !x.value);
    nx ? nx.focus() : bs[5].focus();
  };
  api.current = {
    code,
    boxes,
    clear() {
      boxes().forEach(b => (b.value = ""));
      changed();
    },
    bad() {
      host.current.classList.add("is-err");
      boxes().forEach(b => {
        b.setAttribute("aria-invalid", "true");
        b.value = "";
      });
      mo("shake", host.current.firstElementChild);
      boxes()[0].focus();
    },
    disable(on) {
      boxes().forEach(b => (b.disabled = on));
    },
    focus() {
      const bs = boxes();
      (bs.find(x => !x.value) || bs[0]).focus();
    },
  };
  return (
    <div data-otp="" ref={host}>
      <div className="auth-boxes" role="group" aria-label="6-digit code">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <input
            key={i}
            className="auth-box"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder=" "
            autoComplete={i ? "off" : "one-time-code"}
            aria-label={`Digit ${i + 1} of 6`}
            onInput={e => {
              const b = e.currentTarget,
                d = b.value.replace(/\D/g, "");
              if (d.length > 1) return fill(d, i);
              b.value = d;
              if (d && i < 5) boxes()[i + 1].focus();
              changed();
            }}
            onKeyDown={e => {
              const bs = boxes(),
                b = e.currentTarget;
              if (e.key === "Backspace" && !b.value && i > 0) {
                bs[i - 1].value = "";
                bs[i - 1].focus();
                e.preventDefault();
                changed();
              } else if (e.key === "ArrowLeft" && i > 0) {
                bs[i - 1].focus();
                e.preventDefault();
              } else if (e.key === "ArrowRight" && i < 5) {
                bs[i + 1].focus();
                e.preventDefault();
              }
            }}
            onFocus={e => e.currentTarget.select()}
            onPaste={e => {
              e.preventDefault();
              fill((e.clipboardData || window.clipboardData).getData("text"), 0);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function openDoc(kind) {
  openReactSheet({
    title: kind === "terms" ? "Terms, in short" : "Privacy, in short",
    render: () => (
      <div className="auth-doc">
        {kind === "terms" ? (
          <ul>
            <li>Brands pay the agreed price into escrow after a creator accepts. Linkloom holds it.</li>
            <li>Money is released to the creator only when you approve the work.</li>
            <li>If a creator rejects after payment or does not deliver, the escrow is refunded to you.</li>
            <li>
              Linkloom is a subscription. There is no per-deal platform fee. Taxes as per confirmed rules.
            </li>
          </ul>
        ) : (
          <ul>
            <li>Your email and mobile are used for sign-in, verification and payment alerts.</li>
            <li>
              Creators see your brand name, logo, website and industry. Never your mobile or billing details.
            </li>
            <li>Chat with a creator opens only after you pay into escrow.</li>
          </ul>
        )}
        <p className="sample">Sample summary. The full text appears here in the live product.</p>
      </div>
    ),
  });
}

/* =====================================================================
   #signup: email + mobile → verify email link → verify mobile OTP → password + terms → done
   ===================================================================== */
function StepContact({ ctx }) {
  const E = useErrs();
  const [avail, setAvail] = useState({});
  const em = useRef(null),
    mb = useRef(null),
    t = useRef({});
  const [label, setLabel] = useLabel();
  const [sending, setSending] = useState(false);
  const ok = (k, txt) => setAvail(a => ({ ...a, [k]: txt }));
  const off = k => setAvail(a => ({ ...a, [k]: null }));
  function checkEmail(final) {
    const v = em.current.value.trim().toLowerCase();
    off("email");
    const e = vEmail(v);
    if (e) {
      if (final) E.at("email", e);
      return false;
    }
    if (emailTaken(v)) {
      E.at(
        "email",
        <>
          This email already has a Linkloom account.{" "}
          <a className="btn-q" href="#login" data-signin="">
            Sign in instead
          </a>{" "}
          or use another email.
        </>,
      );
      return false;
    }
    E.clr("email");
    ok("email", "No account uses this email yet");
    return true;
  }
  function checkMobile(final) {
    const d = mb.current.value.replace(/\D/g, "");
    off("mobile");
    const e = vMobile(d);
    if (e) {
      if (final) E.at("mobile", e);
      return false;
    }
    if (mobileTaken(d)) {
      E.at(
        "mobile",
        <>
          This number is linked to another account. One mobile number can hold one account. Use a different
          number, or{" "}
          <a className="btn-q" href="#login">
            sign in
          </a>
          .
        </>,
      );
      return false;
    }
    E.clr("mobile");
    ok("mobile", "Number is free to use");
    return true;
  }
  useEffect(() => {
    if (SU.cur.email) checkEmail(false);
    if (SU.cur.mobile.length === 10) checkMobile(false);
    const x = t.current;
    return () => {
      clearTimeout(x.e);
      clearTimeout(x.m);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const Avail = ({ k }) => (
    <p
      className={`auth-avail${avail[k] ? " is-ok" : ""}`}
      id={`au-${k}-ok`}
      data-avail={k}
      aria-live="polite"
    >
      {avail[k] ? (
        <>
          <Icon n="check" />
          {avail[k]}
        </>
      ) : null}
    </p>
  );
  return (
    <form
      className="auth-stack"
      noValidate
      data-form=""
      onClick={e => {
        if (e.target.closest("[data-signin]")) LS.email = em.current.value.trim();
      }}
      onSubmit={e => {
        e.preventDefault();
        const a = checkEmail(true),
          b = checkMobile(true);
        if (!a || !b) {
          flushSync(() => {});
          return focusFirstErr(ctx.root.current);
        }
        if (!navigator.onLine) return L.toast("You're offline. Try again when you're connected.", "alert");
        setLabel("Sending…");
        setSending(true);
        setTimeout(() => {
          if (!ctx.alive.current) return;
          const S = SU.cur;
          const changedEmail = S.verifiedEmail !== S.email.trim().toLowerCase(),
            changedMobile = S.verifiedMobile !== S.mobile;
          S.email = S.email.trim().toLowerCase();
          if (changedEmail) Object.assign(S, { emailOk: false, eCool: now() + COOL * 1000, eSends: 0 });
          if (changedMobile) Object.assign(S, { mobileOk: false, mCool: 0, mSends: 0, tries: 0 });
          ctx.go(S.emailOk ? (S.mobileOk ? 3 : 2) : 1);
        }, 500);
      }}
    >
      <Fld id="email" label="Work email" E={E}>
        <input
          className="input"
          id="au-email"
          type="email"
          autoComplete="email"
          spellCheck="false"
          autoCapitalize="off"
          placeholder="name@brand.in"
          defaultValue={SU.cur.email}
          aria-describedby="au-email-e au-email-ok"
          aria-invalid={E.errs.email ? "true" : undefined}
          ref={em}
          onInput={e => {
            SU.cur.email = e.currentTarget.value;
            E.clr("email");
            off("email");
            clearTimeout(t.current.e);
            t.current.e = setTimeout(() => checkEmail(false), 450);
          }}
          onBlur={e => e.currentTarget.value.trim() && checkEmail(false)}
        />
      </Fld>
      <Avail k="email" />
      <Fld
        id="mobile"
        label="Mobile number"
        help="For sign-in alerts and payment confirmations. Never shown to creators."
        E={E}
      >
        <div className="auth-tel">
          <span aria-hidden="true">+91</span>
          <input
            className="input"
            id="au-mobile"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={11}
            placeholder="98765 43210"
            defaultValue={fmtPhone(SU.cur.mobile)}
            aria-describedby="au-mobile-h au-mobile-e au-mobile-ok"
            aria-invalid={E.errs.mobile ? "true" : undefined}
            ref={mb}
            onInput={e => {
              const i = e.currentTarget,
                d = i.value.replace(/\D/g, "").slice(0, 10);
              i.value = fmtPhone(d);
              SU.cur.mobile = d;
              E.clr("mobile");
              off("mobile");
              clearTimeout(t.current.m);
              if (d.length === 10) t.current.m = setTimeout(() => checkMobile(false), 300);
            }}
          />
        </div>
      </Fld>
      <Avail k="mobile" />
      <Lq className="lq-p auth-go" type="submit" data-next="" disabled={sending}>
        {label || (
          <>
            Send verification <Icon n="arrow" className="ic" />
          </>
        )}
      </Lq>
      <p className="auth-hint">
        <span className="sample">Sample</span> Already registered: <b>meera@mirevo.in</b> and{" "}
        <b className="num">98200 12345</b>
      </p>
    </form>
  );
}

function StepEmail({ ctx }) {
  const S = SU.cur;
  const [ok, setOk] = useState(S.emailOk);
  const st = useRef({ coolEnd: S.eCool, sends: S.eSends }).current;
  const pill = useRef(null),
    nx = useRef(null);
  useLayoutEffect(() => {
    if (!ok || S.emailOk !== true || !pill.current.dataset.fresh) return;
    delete pill.current.dataset.fresh;
    setTimeout(() => mo("check", pill.current), 120);
    nx.current.focus();
  }, [ok]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="auth-mail">
        <img src="assets/step-01-envelope.svg" width="140" height="103" alt="" />
        <div className="auth-mail-t">
          <p>
            Sent to <b>{S.email}</b>
          </p>
          <span className={`pill ${ok ? "pill-ok" : "pill-info"}`} data-epill="" ref={pill}>
            {ok ? (
              <>
                <Icon n="check" />
                Email verified
              </>
            ) : (
              <>
                <Icon n="clock" />
                Waiting for you to open it
              </>
            )}
          </span>
        </div>
      </div>
      <p className="help">
        The link works once and expires in 24 hours. Check spam or promotions if it isn't there.
      </p>
      {ok ? (
        <p className="auth-resend" data-erow="" hidden></p>
      ) : (
        <Resend
          st={st}
          what="link"
          data-erow=""
          onSend={() => {
            S.eCool = st.coolEnd;
            S.eSends = st.sends;
            L.toast("New link sent to " + S.email, "send");
            ctx.setLive("New link sent");
          }}
        />
      )}
      <div className="auth-acts">
        <Lq className="lq-p" data-next="" disabled={!ok} ref={nx} onClick={() => ctx.go(2)}>
          Continue
        </Lq>
        <button className="btn-q" type="button" data-change="" onClick={() => ctx.go(0, -1)}>
          Change email
        </button>
      </div>
      <button
        type="button"
        className="btn-q auth-samplebtn"
        data-openlink=""
        hidden={ok}
        onClick={() => {
          S.emailOk = true;
          S.verifiedEmail = S.email;
          pill.current.dataset.fresh = "1";
          setOk(true);
          ctx.setLive("Email verified. Continue to verify your mobile.");
        }}
      >
        <span className="sample">Sample</span> Open the link from the email
      </button>
    </>
  );
}

function StepMobile({ ctx }) {
  const S = SU.cur;
  if (!S.mCool) S.mCool = now() + COOL * 1000;
  const st = useRef({ coolEnd: S.mCool, sends: S.mSends }).current;
  const otp = useRef(null),
    v = useRef(null);
  const [err, setErr] = useState("");
  const [label, setLabel] = useLabel();
  useLayoutEffect(() => {
    v.current.disabled = true;
    mo("stagger", otp.current.boxes());
    if (S.tries >= OTP_TRIES) {
      otp.current.disable(true);
      setErr("Too many wrong codes. Ask for a new code to try again.");
    } else setTimeout(() => otp.current && otp.current.focus(), 50);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form
      className="auth-stack"
      noValidate
      data-form=""
      onSubmit={e => {
        e.preventDefault();
        if (v.current.disabled) return;
        setLabel("Checking…");
        v.current.disabled = true;
        setTimeout(() => {
          if (!ctx.alive.current) return;
          setLabel("Verify mobile");
          if (otp.current.code() === OTP) {
            S.mobileOk = true;
            S.verifiedMobile = S.mobile;
            L.toast("Mobile verified", "check");
            ctx.go(3);
            return;
          }
          S.tries++;
          const left = OTP_TRIES - S.tries;
          otp.current.bad();
          if (left <= 0) {
            otp.current.disable(true);
            return setErr("Too many wrong codes. Ask for a new code to try again.");
          }
          setErr(`That code doesn't match. ${left} ${left === 1 ? "try" : "tries"} left.`);
        }, 600);
      }}
    >
      <p className="muted">
        Sent to <b className="num">+91 {fmtPhone(S.mobile)}</b> ·{" "}
        <button type="button" className="btn-q" data-change="" onClick={() => ctx.go(0, -1)}>
          Change number
        </button>
      </p>
      <OtpBoxes
        api={otp}
        onFull={full => {
          v.current.disabled = !full;
          setErr("");
          if (full) v.current.focus();
        }}
      />
      <p className="err" aria-live="assertive" data-oerr="">
        {err}
      </p>
      <Lq className="lq-p auth-go" type="submit" data-verify="" disabled ref={v}>
        {label || "Verify mobile"}
      </Lq>
      <div className="auth-resend-wrap">
        <Resend
          st={st}
          what="code"
          data-mrow=""
          onSend={() => {
            S.mCool = st.coolEnd;
            S.mSends = st.sends;
            S.tries = 0;
            otp.current.clear();
            otp.current.disable(false);
            otp.current.focus();
            setErr("");
            L.toast("New code sent to +91 " + fmtPhone(S.mobile), "send");
          }}
        />
        <p className="auth-hint">
          <span className="sample">Sample</span> code:{" "}
          <b className="num">
            {OTP.slice(0, 3)} {OTP.slice(3)}
          </b>
        </p>
      </div>
    </form>
  );
}

function StepPassword({ ctx }) {
  const S = SU.cur;
  const E = useErrs();
  const [p1, setP1] = useState(""),
    [p2, setP2] = useState("");
  const [label, setLabel] = useLabel();
  const [busy, setBusy] = useState(false);
  const r1 = useRef(null),
    r2 = useRef(null),
    terms = useRef(null);
  useEffect(() => {
    if (p2 && p1 === p2) E.clr("pw2");
  }, [p1, p2]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form
      className="auth-stack"
      noValidate
      data-form=""
      onSubmit={e => {
        e.preventDefault();
        const a = r1.current.value,
          b = r2.current.value;
        let bad = false;
        if (!a) {
          E.at("pw", "Create a password.");
          bad = true;
        } else if (!pwOk(a)) {
          E.at("pw", "Your password needs everything in the list below.");
          bad = true;
        } else if (a.toLowerCase().includes(S.email.split("@")[0])) {
          E.at("pw", "Don't use your email name in the password.");
          bad = true;
        }
        if (!bad && b !== a) {
          E.at("pw2", b ? "The two passwords don't match." : "Type the password again to confirm it.");
          bad = true;
        }
        if (!terms.current.checked) {
          E.at("terms", "Accept the terms to create your account.");
          bad = true;
        }
        if (bad) {
          flushSync(() => {});
          return focusFirstErr(ctx.root.current);
        }
        setLabel("Creating account…");
        setBusy(true);
        setTimeout(() => {
          if (!ctx.alive.current) return;
          ACC[S.email] = { pw: a, status: "verified", first: true };
          store.set(s => {
            s.taken.emails.push(S.email);
            s.taken.mobiles.push(S.mobile);
          }, "account-created");
          S.done = true;
          LS.email = S.email;
          LS.acct = "";
          ctx.paint(true, 1);
        }, 700);
      }}
    >
      <div className="auth-verified">
        <span>
          <b>{S.email}</b>
          <span className="pill pill-ok">
            <Icon n="check" />
            Verified
          </span>
        </span>
        <span>
          <b className="num">+91 {fmtPhone(S.mobile)}</b>
          <span className="pill pill-ok">
            <Icon n="check" />
            Verified
          </span>
        </span>
      </div>
      <PwField
        id="pw"
        label="Password"
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
        label="Confirm password"
        E={E}
        inputRef={r2}
        onInput={e => setP2(e.currentTarget.value)}
      />
      <Match p1={p1} p2={p2} />
      <div className={`field${E.errs.terms ? " is-err" : ""}`} data-f="terms">
        <label className="check auth-terms">
          <input
            type="checkbox"
            id="au-terms"
            defaultChecked={S.terms}
            aria-describedby="au-terms-e"
            aria-invalid={E.errs.terms ? "true" : undefined}
            ref={terms}
            onChange={e => {
              S.terms = e.currentTarget.checked;
              E.clr("terms");
            }}
          />
          <span>
            I accept Linkloom's{" "}
            <button type="button" className="btn-q" data-doc="terms" onClick={() => openDoc("terms")}>
              Terms
            </button>{" "}
            and{" "}
            <button type="button" className="btn-q" data-doc="privacy" onClick={() => openDoc("privacy")}>
              Privacy Policy
            </button>
            , including escrow and refund rules.
          </span>
        </label>
        <p className="err" id="au-terms-e" aria-live="polite">
          {E.errs.terms || ""}
        </p>
      </div>
      <Lq className="lq-p auth-go" type="submit" data-create="" disabled={busy}>
        {label || "Create account"}
      </Lq>
    </form>
  );
}

function StepDone() {
  const ic = useRef(null),
    a = useRef(null);
  useEffect(() => {
    mo("check", ic.current, { color: "ink" });
    const t = setTimeout(() => a.current && a.current.focus({ preventScroll: true }), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="auth-done">
      <span className="auth-done-ic" data-doneic="" ref={ic}>
        <Icon n="check" />
      </span>
      <p className="auth-done-t">
        Your brand account for <b>{SU.cur.email}</b> is ready.
      </p>
      <p className="muted">
        Next, sign in and add your brand name, logo and billing details. It takes about two minutes.
      </p>
      <Lq as="a" className="lq-p auth-go" href="#login-new" data-tologin="" ref={a}>
        Go to sign in <Icon n="arrow" className="ic" />
      </Lq>
    </div>
  );
}

function SignupScreen() {
  /* a finished or missing draft starts afresh on arrival, not on each redraw (Done must stay on screen) */
  const arrived = useRef(false);
  if (!arrived.current) {
    arrived.current = true;
    if (!SU.cur || SU.cur.done) SU.cur = freshSU();
  }
  const S = SU.cur;
  const [paintN, setPaintN] = useState(0);
  const [live, setLive] = useState("");
  const root = useRef(null),
    body = useRef(null),
    head = useRef(null);
  const alive = useRef(true);
  const R = useRef({ railAt: null, focus: false });
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const liveText = () =>
    S.done ? "Account created" : `Step ${S.step + 1} of ${STEPS.length}: ${STEPS[S.step].t}`;
  useLayoutEffect(() => {
    setLive(liveText());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const ns = root.current.querySelectorAll(".auth-rail-n"),
      at = S.done ? STEPS.length - 1 : S.step;
    const was = R.current.railAt;
    if (was != null && at > was && ns[was] && ns[at]) mo("pull", ns[was], ns[at], { color: "butter" });
    R.current.railAt = at;
    if (R.current.focus) {
      R.current.focus = false;
      head.current.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [paintN]); // eslint-disable-line react-hooks/exhaustive-deps
  const paint = (focus, dir) => {
    R.current.focus = focus;
    const run = () => flushSync(() => setPaintN(n => n + 1));
    if (dir && L.motion && L.motion.swap) {
      try {
        L.motion.swap(body.current, run, { dir });
      } catch (e) {
        run();
      }
    } else run();
    setLive(liveText());
  };
  const go = (i, dir = 1) => {
    S.step = i;
    S.reached = Math.max(S.reached, i);
    paint(true, dir);
  };
  const ctx = { go, paint, setLive, alive, root };
  const done = S.done;
  const s = STEPS[S.step];
  const Step = done ? StepDone : [StepContact, StepEmail, StepMobile, StepPassword][S.step];
  return (
    <Shell
      root={root}
      cls="auth-signup"
      live={live}
      art={
        <Art
          line="Start hiring in four short steps."
          foot="Brands verify once. Creators see a real, checked brand."
        >
          <ol className="auth-rail" data-rail="">
            {STEPS.map((x, i) => {
              const state = done || i < S.step ? "done" : i === S.step ? "now" : "next";
              const can = !done && i < S.step && i === 0; // only the first step can be revisited (to change email or mobile)
              const inner = (
                <>
                  <span className="auth-rail-n">{state === "done" ? <Icon n="check" /> : "0" + (i + 1)}</span>
                  <span className="auth-rail-t">{x.t}</span>
                </>
              );
              return (
                <li
                  key={i}
                  className={`auth-rail-i is-${state}`}
                  aria-current={state === "now" ? "step" : undefined}
                >
                  {can ? (
                    <button type="button" data-goto={i} onClick={() => go(i, -1)}>
                      {inner}
                      <span className="sr-only">, change</span>
                    </button>
                  ) : (
                    <span className="auth-rail-b">{inner}</span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="auth-prog" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={done || i < S.step ? "is-done" : i === S.step ? "is-now" : ""}></span>
            ))}
          </div>
        </Art>
      }
    >
      <div className="auth-head">
        <p className="t-eyebrow muted" data-count="">
          {done ? "Done" : `Step ${S.step + 1} of ${STEPS.length}`}
        </p>
        <h1 className="t-h1" tabIndex={-1} data-h="" ref={head}>
          {done ? "Account created" : s.t}
        </h1>
        <p className="muted" data-sub="">
          {done ? "" : s.sub}
        </p>
      </div>
      <div className="auth-stack" data-body="" ref={body}>
        <Step key={paintN} ctx={ctx} />
      </div>
      <p className="auth-switch" data-switch="" hidden={done || S.step > 0}>
        Already have an account?{" "}
        <a className="btn-q" href="#login">
          Sign in
        </a>
      </p>
    </Shell>
  );
}

/* =====================================================================
   #forgot: email → reset link (single use, 30 min)
   ===================================================================== */
function ForgotScreen() {
  const [sent, setSent] = useState(FS.sent);
  const [fresh, setFresh] = useState(false);
  const [live, setLive] = useState("");
  const [label, setLabel] = useLabel();
  const [busy, setBusy] = useState(false);
  const E = useErrs();
  const root = useRef(null),
    em = useRef(null),
    body = useRef(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useLayoutEffect(() => {
    if (sent && fresh) {
      setLive("Reset link sent");
      mo("stagger", [...body.current.children]);
    }
    if (!sent && fresh) {
      em.current.select();
      em.current.focus();
    }
  }, [sent]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = !!FS.tok;
  return (
    <Shell
      root={root}
      live={live}
      art={
        <Art
          line="Locked out? Back in two minutes."
          foot="Reset links work once and expire after 30 minutes"
        />
      }
    >
      <div className="auth-head">
        <a className="btn-q auth-back" href="#login">
          <Icon n="back" />
          Back to sign in
        </a>
        <h1 className="t-h1" tabIndex={-1} data-h="">
          Reset your password
        </h1>
        <p className="muted" data-sub="">
          {sent ? "" : "Enter the email you sign in with. We'll send a link to choose a new password."}
        </p>
      </div>
      <div className="auth-stack" data-body="" ref={body}>
        {sent ? (
          <>
            <div className="auth-mail">
              <img src="assets/step-01-envelope.svg" width="140" height="103" alt="" />
              <div className="auth-mail-t">
                <p className="t-h3">Check your inbox</p>
                <p>
                  If <b>{FS.email}</b> has a Linkloom account, a reset link is on its way.
                </p>
              </div>
            </div>
            <ul className="auth-facts">
              <li>
                <Icon n="clock" />
                Expires in 30 minutes
              </li>
              <li>
                <Icon n="lock" />
                Works once, then it's used up
              </li>
            </ul>
            <Resend
              st={FS}
              what="link"
              data-row=""
              onSend={() => {
                if (FS.tok) {
                  Object.values(TOK).forEach(t => {
                    if (t.email === FS.email) t.used = true;
                  });
                  FS.tok = newToken(FS.email);
                }
                L.toast("New link sent. Older links no longer work.", "send");
              }}
            />
            <div className="auth-acts">
              <Lq as="a" className="lq-s" href="#login">
                Back to sign in
              </Lq>
              <button
                className="btn-q"
                type="button"
                data-other=""
                onClick={() => {
                  FS.sent = false;
                  setFresh(true);
                  setLabel(null);
                  setBusy(false);
                  setSent(false);
                }}
              >
                Use a different email
              </button>
            </div>
            <div className="auth-samples">
              <span className="sample">Sample</span>
              {known ? (
                <>
                  <button
                    type="button"
                    className="btn-q"
                    data-open=""
                    onClick={() => L.go("#reset-" + FS.tok)}
                  >
                    Open the reset link
                  </button>
                  <button
                    type="button"
                    className="btn-q"
                    data-old=""
                    onClick={() => L.go("#reset-" + newToken(FS.email, RESET_TTL + 600))}
                  >
                    Open an expired link
                  </button>
                </>
              ) : (
                <span className="auth-hint">
                  No link for this email: it has no account. Try {SAMPLE_EMAIL}.
                </span>
              )}
            </div>
          </>
        ) : (
          <form
            className="auth-stack"
            noValidate
            data-form=""
            onSubmit={e => {
              e.preventDefault();
              const v = em.current.value.trim().toLowerCase(),
                er = vEmail(v);
              if (er) {
                flushSync(() => E.at("email", er));
                return em.current.focus();
              }
              if (!navigator.onLine) return E.at("email", "You're offline, so we couldn't send the link.");
              setLabel("Sending…");
              setBusy(true);
              setTimeout(() => {
                if (!alive.current) return;
                Object.assign(FS, { email: v, sent: true, coolEnd: now() + COOL * 1000, sends: 0 });
                FS.tok = emailTaken(v) || ACC[v] ? newToken(v) : null;
                setFresh(true);
                setSent(true);
              }, 600);
            }}
          >
            <Fld id="email" label="Work email" E={E}>
              <input
                className="input"
                id="au-email"
                type="email"
                autoComplete="username"
                spellCheck="false"
                autoCapitalize="off"
                placeholder="name@brand.in"
                defaultValue={FS.email || LS.email}
                aria-describedby="au-email-e"
                aria-invalid={E.errs.email ? "true" : undefined}
                ref={em}
                onInput={() => E.clr("email")}
              />
            </Fld>
            <Lq className="lq-p auth-go" type="submit" data-send="" disabled={busy}>
              {label || (
                <>
                  Send reset link <Icon n="arrow" className="ic" />
                </>
              )}
            </Lq>
          </form>
        )}
      </div>
    </Shell>
  );
}

/* =====================================================================
   #reset-<token>: new password; link single use + expiry
   ===================================================================== */
function ResetScreen({ param: tok }) {
  const t = tok && TOK[tok];
  const age = t ? (now() - t.issued) / 1000 : Infinity;
  const state = !t || age > RESET_TTL ? "expired" : t.used ? "used" : "ok";
  const [saved, setSaved] = useState(false);
  const [left, setLeft] = useState(t ? Math.max(0, Math.ceil(RESET_TTL - age)) : 0);
  const [p1, setP1] = useState(""),
    [p2, setP2] = useState("");
  const [label, setLabel] = useLabel();
  const [busy, setBusy] = useState(false);
  const E = useErrs();
  const root = useRef(null),
    h = useRef(null),
    r1 = useRef(null),
    r2 = useRef(null),
    doneIc = useRef(null);
  const alive = useRef(true),
    timer = useRef(0);
  useEffect(() => {
    if (state === "ok") {
      const tick = () => {
        const s = Math.max(0, Math.ceil(RESET_TTL - (now() - t.issued) / 1000));
        setLeft(s);
        if (!s) {
          clearInterval(timer.current);
          L.route();
        }
      };
      timer.current = setInterval(tick, 1000);
    }
    return () => {
      alive.current = false;
      clearInterval(timer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (p2 && p1 === p2) E.clr("pw2");
  }, [p1, p2]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!saved) return;
    mo("check", doneIc.current, { color: "ink" });
    h.current.focus({ preventScroll: true });
  }, [saved]);
  const toForgot = () => {
    FS.sent = false;
    if (t) FS.email = t.email;
    L.go("#forgot");
  };
  const submit = e => {
    e.preventDefault();
    const a = ACC[t.email],
      v1 = r1.current.value,
      v2 = r2.current.value;
    let bad = false;
    if (!pwOk(v1)) {
      E.at("pw", v1 ? "Your password needs everything in the list below." : "Choose a new password.");
      bad = true;
    } else if (a && a.pw === v1) {
      E.at("pw", "That's your current password. Choose a new one.");
      bad = true;
    }
    if (!bad && v1 !== v2) {
      E.at("pw2", v2 ? "The two passwords don't match." : "Type the new password again.");
      bad = true;
    }
    if (bad) {
      flushSync(() => {});
      return focusFirstErr(root.current);
    }
    if (TOK[tok].used || (now() - t.issued) / 1000 > RESET_TTL) return L.route();
    setLabel("Saving…");
    setBusy(true);
    setTimeout(() => {
      if (!alive.current) return;
      clearInterval(timer.current);
      if (a) a.pw = v1;
      else ACC[t.email] = { pw: v1, status: "verified", first: false };
      Object.values(TOK).forEach(x => {
        if (x.email === t.email) x.used = true;
      });
      if (t.email === SAMPLE_EMAIL)
        store.set(s => {
          s.me.passwordChanged = new Date(L.today().getTime() + 198e5).toISOString().slice(0, 10);
        }, "password-reset");
      LS.email = t.email;
      FS.sent = false;
      setSaved(true);
    }, 600);
  };
  const heading = saved
    ? "Password updated"
    : state === "expired"
      ? "This link has expired"
      : state === "used"
        ? "This link was already used"
        : "Choose a new password";
  return (
    <Shell
      root={root}
      art={
        <Art
          line="A fresh password, and you're in."
          foot="Reset links work once and expire after 30 minutes"
        />
      }
    >
      <div className="auth-head">
        <a className="btn-q auth-back" href="#login">
          <Icon n="back" />
          Back to sign in
        </a>
        <h1 className="t-h1" tabIndex={-1} data-h="" ref={h}>
          {heading}
        </h1>
        <p className="muted" data-sub="">
          {saved ? (
            ""
          ) : state === "expired" ? (
            "Reset links work for 30 minutes after we send them. Ask for a new one; it only takes a moment."
          ) : state === "used" ? (
            "Each reset link works once. If you just changed your password, sign in with the new one."
          ) : (
            <>
              For <b>{t.email}</b>. This link expires in{" "}
              <b className="num" data-left="">
                {mmss(left)}
              </b>
              .
            </>
          )}
        </p>
      </div>
      <div className="auth-stack" data-body="">
        {saved ? (
          <div className="auth-done">
            <span className="auth-done-ic" data-doneic="" ref={doneIc}>
              <Icon n="check" />
            </span>
            <p className="auth-done-t">You can sign in with your new password now.</p>
            <p className="muted">
              This reset link is now used up. Other devices signed in to this account were signed out.
            </p>
            <Lq as="a" className="lq-p auth-go" href="#login-reset" data-tologin="">
              Sign in <Icon n="arrow" className="ic" />
            </Lq>
          </div>
        ) : state === "expired" ? (
          <>
            <Note kind="warn" ic="clock">
              <p>For your safety, old links stop working even if they were never opened.</p>
            </Note>
            <div className="auth-acts">
              <Lq className="lq-p" data-again="" onClick={toForgot}>
                Send a new link
              </Lq>
              <a className="btn-q" href="#login">
                Sign in
              </a>
            </div>
          </>
        ) : state === "used" ? (
          <>
            <Note kind="info" ic="lock">
              <p>
                Didn't change it yourself? Reset it again now and write to{" "}
                <a className="btn-q" href={`mailto:${SUPPORT}`}>
                  {SUPPORT}
                </a>
                .
              </p>
            </Note>
            <div className="auth-acts">
              <Lq as="a" className="lq-p" href="#login">
                Sign in
              </Lq>
              <button className="btn-q" type="button" data-again="" onClick={toForgot}>
                Send a new link
              </button>
            </div>
          </>
        ) : (
          <form className="auth-stack" noValidate data-form="" onSubmit={submit}>
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
            <Lq className="lq-p auth-go" type="submit" data-save="" disabled={busy}>
              {label || "Save new password"}
            </Lq>
          </form>
        )}
      </div>
    </Shell>
  );
}

L.register("login", { title: "Sign in", shell: "focus", auth: false, Component: LoginScreen });
L.register("signup", {
  title: "Create a brand account",
  shell: "focus",
  auth: false,
  Component: SignupScreen,
});
L.register("forgot", { title: "Reset your password", shell: "focus", auth: false, Component: ForgotScreen });
L.register("reset", { title: "Choose a new password", shell: "focus", auth: false, Component: ResetScreen });
