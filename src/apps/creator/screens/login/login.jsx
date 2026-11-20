/* login screen (Builder A): Continue with Google, or mobile number + 6-digit OTP.
   OTP rules: 30 s resend cooldown, 3 resends per number, 3 wrong codes locks the number for 10 min.
   Signing in sets session.signedIn; a first login goes to #setup, a returning creator to #home.
   #login-expired shows the expired-session notice. The live app signs in on signin.html; this is the sample build's.
   React screen (see src/shared/react/view.jsx). The six code boxes keep their typing, paste and focus handling on the
   boxes themselves; the panels, notes, errors, resend line and lock are drawn from state. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { attachGoogle } from "@/shared/api/google";
import { authMessage, googleSignIn, requestOtp, verifyOtp } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { Icon, Lq } from "@/shared/react/view";

const LLD = window.LLD,
  { store } = LLD;
const CODE = "246810"; // the parity build's sample code; the real app verifies on the server
const REAL = !import.meta.env.VITE_TEST_HOOKS;
const COOLDOWN = 30,
  MAX_RESENDS = 3,
  MAX_TRIES = 3,
  LOCK = 600;
const GOOGLE = { name: "Ananya Iyer", email: "ananya.iyer@example.com" }; // sample Google account
// state survives re-renders inside one visit (e.g. going back to change the number)
const S = {
  step: "phone",
  phone: "",
  tries: 0,
  resends: 0,
  cooldownEnd: 0,
  lockEnd: 0,
  busy: false,
  account: "new",
  challenge: "",
};
const now = () => Date.now();
const mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const fmtPhone = d => d.slice(0, 5) + " " + d.slice(5);
const maskPhone = d => "+91 " + d.slice(0, 2) + "•••••" + d.slice(7);
const setLabel = (btn, txt) =>
  btn.querySelectorAll(".t,.t2").forEach(s => {
    s.textContent = txt;
  });
const press = el => {
  try {
    LLD.motion.press(el);
  } catch (e) {}
};
const GIcon = () => (
  <svg
    className="ic"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M20.5 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h4.8a4.3 4.3 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.6z" />
    <path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.6-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z" />
    <path d="M7 13.8a5.4 5.4 0 0 1 0-3.6V7.9H4a9 9 0 0 0 0 8.2z" />
    <path d="M12 6.5c1.3 0 2.5.5 3.4 1.3L18 5.3A9 9 0 0 0 4 7.9l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
  </svg>
);
const reset = () => Object.assign(S, { step: "phone", phone: "", tries: 0, resends: 0, cooldownEnd: 0 });

/* ---------- step 1: Google or phone number ---------- */
function PhonePane({ ctx }) {
  const [err, setErr] = useState(null);
  const [gErr, setGErr] = useState(null);
  const inp = useRef(null),
    gBtn = useRef(null),
    send = useRef(null);
  useEffect(() => {
    if (!REAL) return;
    const detach = attachGoogle(
      gBtn.current,
      async token => {
        if (S.busy) return;
        S.busy = true;
        setGErr(null);
        gBtn.current.setAttribute("aria-busy", "true");
        setLabel(gBtn.current, "Signing in…");
        ctx.setLive("Signing in with Google");
        try {
          const user = await googleSignIn(token, "creator");
          if (ctx.alive.current) ctx.signIn("google", user);
        } catch (er) {
          setGErr(authMessage(er));
        } finally {
          S.busy = false;
          if (gBtn.current) {
            gBtn.current.removeAttribute("aria-busy");
            setLabel(gBtn.current, "Continue with Google");
          }
        }
      },
      msg => setGErr(msg),
    );
    return detach;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const bad = msg => {
    flushSync(() => setErr(msg));
    inp.current.focus();
  };
  const submit = ev => {
    ev.preventDefault();
    const d = inp.current.value.replace(/\D/g, "");
    let msg = "";
    if (!d) msg = "Enter your mobile number.";
    else if (d.length !== 10) msg = "Enter all 10 digits of your mobile number.";
    else if (!/^[6-9]/.test(d)) msg = "Indian mobile numbers start with 6, 7, 8 or 9.";
    else if (!navigator.onLine) {
      msg = "You're offline, so we couldn't send a code. Try again when you're connected.";
      ctx.onNet();
    }
    if (msg) return bad(msg);
    const btn = send.current;
    press(btn);
    if (S.phone !== d) Object.assign(S, { phone: d, tries: 0, resends: 0, lockEnd: 0 });
    S.busy = true;
    btn.setAttribute("aria-busy", "true");
    setLabel(btn, "Sending…");
    if (REAL) {
      requestOtp("sms", d)
        .then(ch => {
          S.challenge = ch.challengeId;
          if (!ctx.alive.current) return;
          S.step = "otp";
          S.cooldownEnd = now() + COOLDOWN * 1000;
          ctx.paint(true);
        })
        .catch(er => ctx.alive.current && bad(authMessage(er)))
        .finally(() => {
          S.busy = false;
          if (!send.current) return;
          send.current.removeAttribute("aria-busy");
          setLabel(send.current, "Send code");
        });
      return;
    }
    setTimeout(() => {
      S.busy = false;
      if (!ctx.alive.current) return;
      S.step = "otp";
      if (S.cooldownEnd < now()) S.cooldownEnd = now() + COOLDOWN * 1000;
      ctx.paint(true);
    }, 600);
  };
  return (
    <div className="login-pane">
      <Lq
        className="lq-s login-google"
        data-google=""
        ref={gBtn}
        onClick={() => {
          if (REAL) return; /* Google's own button, laid over this one, takes the click */
          if (S.busy) return;
          press(gBtn.current);
          setGErr(null);
          if (!navigator.onLine) {
            setGErr("Google sign-in needs a connection. Check your internet and try again.");
            ctx.onNet();
            return;
          }
          S.busy = true;
          gBtn.current.setAttribute("aria-busy", "true");
          setLabel(gBtn.current, "Opening Google…");
          ctx.setLive("Opening Google sign-in");
          setTimeout(() => {
            S.busy = false;
            if (ctx.alive.current) ctx.signIn("google");
          }, 900);
        }}
      >
        <GIcon />
        Continue with Google
      </Lq>
      <p className="err" data-gerr="" hidden={gErr === null}>
        {gErr || ""}
      </p>
      <p className="login-or">
        <span>or use your mobile number</span>
      </p>
      <form className="login-phone" noValidate data-phone-form="" onSubmit={submit}>
        <div className={`field${err ? " is-err" : ""}`} data-f="">
          <label htmlFor="login-tel">Mobile number</label>
          <div className="login-tel">
            <span className="login-cc" aria-hidden="true">
              +91
            </span>
            <input
              className="input"
              id="login-tel"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={11}
              placeholder="98765 43210"
              defaultValue={S.phone ? fmtPhone(S.phone) : ""}
              aria-describedby="login-tel-h login-tel-e"
              aria-invalid={err ? "true" : undefined}
              ref={inp}
              onInput={e => {
                const i = e.currentTarget,
                  d = i.value.replace(/\D/g, "").slice(0, 10);
                i.value = d.length > 5 ? fmtPhone(d) : d;
                if (err) setErr(null);
              }}
            />
          </div>
          <p className="help" id="login-tel-h">
            We'll text a 6-digit code. Standard SMS rates may apply.
          </p>
          <p className="err" id="login-tel-e" aria-live="polite">
            {err || ""}
          </p>
        </div>
        <Lq className="lq-p login-go" type="submit" ref={send}>
          Send code <Icon n="arrow" className="ic" />
        </Lq>
      </form>
    </div>
  );
}

/* ---------- step 2: six OTP boxes ---------- */
function OtpPane({ fresh, ctx }) {
  const [err, setErr] = useState("");
  const [formErr, setFormErr] = useState(false);
  const [resend, setResend] = useState(null);
  const [lock, setLock] = useState(0);
  const box = useRef(null),
    verify = useRef(null);
  const boxes = () => [...box.current.querySelectorAll(".login-box")];
  const code = () =>
    boxes()
      .map(b => b.value)
      .join("");
  const sync = () => {
    if (verify.current) verify.current.disabled = code().length !== 6 || S.lockEnd > now() || S.busy;
  };
  const clearErr = () => {
    setErr("");
    boxes().forEach(b => b.removeAttribute("aria-invalid"));
    setFormErr(false);
  };
  const fill = (str, from) => {
    const bs = boxes();
    String(str)
      .replace(/\D/g, "")
      .slice(0, 6 - from)
      .split("")
      .forEach((c, k) => (bs[from + k].value = c));
    clearErr();
    sync();
    (bs.find(x => !x.value) || verify.current).focus();
  };
  const tick = () => {
    const left = Math.ceil((S.cooldownEnd - now()) / 1000);
    setResend(S.resends >= MAX_RESENDS ? { maxed: true } : left > 0 ? { left } : { can: true });
    const ll = Math.ceil((S.lockEnd - now()) / 1000);
    const locked = ll > 0;
    boxes().forEach(b => {
      b.disabled = locked;
      if (locked) b.value = "";
    });
    if (locked) setErr("");
    else if (S.lockEnd) {
      S.lockEnd = 0;
      S.tries = 0;
      boxes().forEach(b => (b.value = ""));
    }
    setLock(locked ? ll : 0);
    sync();
  };
  useLayoutEffect(() => {
    tick();
    const t = setInterval(tick, 1000);
    if (fresh) {
      ctx.setLive("Code sent to +91 " + fmtPhone(S.phone));
      try {
        LLD.motion.stagger(boxes());
      } catch (e) {}
    }
    if (S.lockEnd <= now()) boxes()[0].focus();
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function wrongCode() {
    S.tries++;
    const left = MAX_TRIES - S.tries;
    boxes().forEach(b => b.setAttribute("aria-invalid", "true"));
    setFormErr(true);
    if (left <= 0) {
      S.lockEnd = now() + LOCK * 1000;
      tick();
      ctx.setLive("Too many wrong codes. This number is paused for 10 minutes.");
    } else {
      setErr(`That code doesn't match. ${left} ${left === 1 ? "try" : "tries"} left.`);
      boxes().forEach(b => (b.value = ""));
      boxes()[0].focus();
      sync();
    }
  }
  const submit = e => {
    e.preventDefault();
    const v = verify.current;
    if (v.disabled) return;
    if (!navigator.onLine) {
      setErr("You're offline. We couldn't check the code; try again when you're connected.");
      ctx.onNet();
      return;
    }
    press(v);
    S.busy = true;
    sync();
    setLabel(v, "Checking…");
    v.setAttribute("aria-busy", "true");
    const done = () => {
      if (!verify.current) return;
      verify.current.removeAttribute("aria-busy");
      setLabel(verify.current, "Verify and continue");
    };
    if (REAL) {
      verifyOtp(S.challenge, code())
        .then(user => {
          if (!ctx.alive.current) return;
          ctx.setLive("Code verified");
          ctx.signIn("mobile", user);
        })
        .catch(er => {
          if (!ctx.alive.current) return;
          if (er instanceof ApiError && er.code === "OTP_INVALID") wrongCode();
          else setErr(authMessage(er));
        })
        .finally(() => {
          S.busy = false;
          if (!ctx.alive.current) return;
          done();
          sync();
        });
      return;
    }
    setTimeout(() => {
      S.busy = false;
      if (!ctx.alive.current) return;
      done();
      if (code() === CODE) {
        ctx.setLive("Code verified");
        ctx.signIn("mobile");
        return;
      }
      wrongCode();
    }, 700);
  };
  const doResend = () => {
    if (!navigator.onLine) {
      setErr("You're offline, so we couldn't resend the code.");
      ctx.onNet();
      return;
    }
    if (REAL)
      requestOtp("sms", S.phone)
        .then(ch => (S.challenge = ch.challengeId))
        .catch(er => setErr(authMessage(er)));
    S.resends++;
    S.tries = 0;
    S.cooldownEnd = now() + COOLDOWN * 1000;
    boxes().forEach(x => (x.value = ""));
    clearErr();
    sync();
    boxes()[0].focus();
    ctx.setLive(`New code sent. ${MAX_RESENDS - S.resends} resends left.`);
    LLD.toast("New code sent to +91 " + fmtPhone(S.phone), "send");
    tick();
  };
  return (
    <div className="login-pane">
      <div className="login-otp-h">
        <p className="t-h3">Enter the 6-digit code</p>
        <p className="muted">
          Sent to <b className="num">+91 {fmtPhone(S.phone)}</b> ·{" "}
          <button
            type="button"
            className="btn-q"
            data-change=""
            onClick={() => {
              S.step = "phone";
              ctx.paint(false, "#login-tel");
            }}
          >
            Change number
          </button>
        </p>
      </div>
      <form className={`login-otp${formErr ? " is-err" : ""}`} noValidate data-otp-form="" onSubmit={submit}>
        <div className="login-boxes" role="group" aria-label="6-digit code" ref={box}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <input
              key={i}
              className="login-box"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder=" "
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1} of 6`}
              data-i={i}
              onInput={e => {
                const b = e.currentTarget,
                  d = b.value.replace(/\D/g, "");
                if (d.length > 1) return fill(d, i); // some keyboards drop the whole code in one box
                b.value = d;
                clearErr();
                if (d && i < 5) boxes()[i + 1].focus();
                sync();
                if (code().length === 6) verify.current.focus();
              }}
              onKeyDown={e => {
                const bs = boxes(),
                  b = e.currentTarget;
                if (e.key === "Backspace" && !b.value && i > 0) {
                  bs[i - 1].value = "";
                  bs[i - 1].focus();
                  e.preventDefault();
                  sync();
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
        <p className="err login-otp-err" aria-live="assertive" data-oerr="">
          {err}
        </p>
        <div className="login-lock" data-lock="" hidden={!lock} role="status">
          {lock ? (
            <>
              <Icon n="lock" />
              <div>
                <p className="t-label">Too many wrong codes</p>
                <p>
                  For your safety this number is paused for <b className="num">{mmss(lock)}</b>. You can
                  continue with Google meanwhile.
                </p>
              </div>
            </>
          ) : null}
        </div>
        <Lq className="lq-p login-go" type="submit" data-verify="" disabled ref={verify}>
          Verify and continue
        </Lq>
      </form>
      <div className="login-resend">
        <p data-resend-row="" hidden={!!lock}>
          {!resend ? null : resend.maxed ? (
            <span className="muted">
              You've used all {MAX_RESENDS} resends for this number. Try again in 30 min, or continue with
              Google.
            </span>
          ) : resend.left ? (
            <span className="muted">
              Didn't get it? You can resend in <b className="num">{mmss(resend.left)}</b>
            </span>
          ) : (
            <>
              <span className="muted">Didn't get it?</span>{" "}
              <button type="button" className="btn-q" data-resend="" onClick={doResend}>
                Resend code
              </button>
            </>
          )}
        </p>
        <p className="login-hint">
          <span className="sample">Sample</span> code:{" "}
          <b className="num">
            {CODE.slice(0, 3)} {CODE.slice(3)}
          </b>
        </p>
      </div>
    </div>
  );
}

function LoginScreen({ param }) {
  const sess = store.s.session;
  const expired = param === "expired" || sess.expired;
  if (S.step === "otp" && !S.phone) S.step = "phone";
  const [paintN, setPaintN] = useState(0);
  const [live, setLive] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [account, setAccount] = useState(S.account);
  const alive = useRef(true),
    root = useRef(null),
    after = useRef(null),
    fresh = useRef(false);
  const onNet = () => setOffline(!navigator.onLine);
  useEffect(() => {
    alive.current = true;
    addEventListener("online", onNet);
    addEventListener("offline", onNet);
    try {
      LLD.motion.press([...root.current.querySelectorAll("[data-acc]")]);
    } catch (e) {}
    if (expired) root.current.querySelector("[data-login-h]").focus({ preventScroll: true });
    return () => {
      alive.current = false;
      removeEventListener("online", onNet);
      removeEventListener("offline", onNet);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const f = after.current;
    after.current = null;
    if (f) root.current.querySelector(f).focus();
  }, [paintN]);
  /* a paint draws the step again; `focus` (a selector) is focused after */
  const paint = (isFresh, focus) => {
    fresh.current = !!isFresh;
    after.current = focus || null;
    flushSync(() => setPaintN(n => n + 1));
  };
  function signIn(method, user) {
    if (REAL) {
      reset();
      S.challenge = "";
      LLD.live.afterSignIn(user, method);
      return;
    }
    const isNew = S.account === "new";
    store.set(s => {
      s.session.signedIn = true;
      s.session.method = method;
      s.session.expired = false;
      s.session.firstLogin = isNew;
      if (method === "google") {
        s.session.email = GOOGLE.email;
        s.session.googleName = GOOGLE.name;
      } else s.session.mobile = maskPhone(S.phone);
    }, "signed-in");
    reset();
    LLD.toast(isNew ? "Signed in. Let's set up your profile." : "Signed in", "check");
    LLD.go(isNew ? "#setup" : "#home");
  }
  const ctx = { paint, setLive, alive, onNet, signIn };
  return (
    <div className="focus login" ref={root}>
      <section className="focus-art dark login-art" aria-label="Linkloom">
        <p className="login-brand">
          <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
          <span>linkloom</span>
        </p>
        <h2 className="t-display login-line">
          Brand deals, paid{" "}on{" "}time.
        </h2>
        <img className="login-rings" src="assets/hero-rings.svg" width="610" height="660" alt="" />
        <p className="login-art-foot">For Instagram and YouTube creators across India</p>
      </section>

      <section className="focus-form light login-form">
        <div className="login-in">
          <div className="login-head">
            <h1 className="t-h1" tabIndex={-1} data-login-h="">
              Sign in
            </h1>
            <p className="muted">
              Find brand briefs, bid in a minute, and get paid from escrow once the work is approved.
            </p>
          </div>

          <div className="login-note login-note-info" data-expired="" hidden={!expired} role="status">
            <Icon n="clock" />
            <p>
              Your session expired, so we signed you out to keep your account safe. Sign in again to pick up
              where you left off.
            </p>
          </div>
          <div className="login-note login-note-err" data-offline="" hidden={!offline} role="status">
            <Icon n="alert" />
            <p>You're offline. Check your connection, then try again.</p>
          </div>

          <div data-pane="">
            {S.step === "otp" ? (
              <OtpPane key={paintN} fresh={fresh.current} ctx={ctx} />
            ) : (
              <PhonePane key={paintN} ctx={ctx} />
            )}
          </div>

          {REAL ? null : (
            <div className="login-sample" role="group" aria-labelledby="login-acc-l">
              <span id="login-acc-l" className="sample">
                Sample account
              </span>
              <div className="login-acc">
                {[
                  ["new", "New creator"],
                  ["returning", "Returning creator"],
                ].map(([a, t]) => (
                  <button
                    key={a}
                    type="button"
                    data-acc={a}
                    aria-pressed={String(account === a)}
                    onClick={() => {
                      S.account = a;
                      setAccount(a);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {import.meta.env.VITE_TEST_HOOKS ? null : (
            <p className="login-legal">
              Are you a brand?{" "}
              <a className="btn-q" href="brand.html#login">
                Brand sign-in
              </a>
            </p>
          )}
          <p className="login-legal">By continuing you agree to Linkloom's Terms and Privacy Policy.</p>
          <p className="sr-only" aria-live="polite" data-live="">
            {live}
          </p>
        </div>
      </section>
    </div>
  );
}

LLD.register("login", { title: "Sign in", shell: "focus", auth: false, Component: LoginScreen });
