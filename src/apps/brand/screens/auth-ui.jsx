/* The password and field pieces shared by the sample build's sign-in screens (auth.jsx) and the brand profile's
   "Change password" sheet: field errors, the password box with its show/hide eye, the rules list and the match line. */
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/shared/react/view";
import { RULES, mo } from "./auth-kit";

/** errors by field id; a message may carry a link (a React element) */
export function useErrs() {
  const [errs, setErrs] = useState({});
  return {
    errs,
    at: (id, msg) => setErrs(e => ({ ...e, [id]: msg })),
    clr: id => setErrs(e => (id in e ? (({ [id]: _, ...x }) => x)(e) : e)),
  };
}
export const focusFirstErr = root => {
  const i = root && root.querySelector(".field.is-err input");
  i && i.focus();
};
export function Fld({ id, label, help, E, children }) {
  const err = E.errs[id];
  return (
    <div className={`field${err ? " is-err" : ""}`} data-f={id}>
      <label htmlFor={`au-${id}`}>{label}</label>
      {children}
      {help ? (
        <p className="help" id={`au-${id}-h`}>
          {help}
        </p>
      ) : null}
      <p className="err" id={`au-${id}-e`} aria-live="polite">
        {err || null}
      </p>
    </div>
  );
}
export function PwField({ id, label, auto = "new-password", desc = "", E, inputRef, onInput }) {
  const [shown, setShown] = useState(false);
  const err = E.errs[id];
  return (
    <div className={`field${err ? " is-err" : ""}`} data-f={id}>
      <label htmlFor={`au-${id}`}>{label}</label>
      <div className="auth-pw">
        <input
          className="input"
          id={`au-${id}`}
          type={shown ? "text" : "password"}
          autoComplete={auto}
          spellCheck="false"
          autoCapitalize="off"
          maxLength={64}
          aria-describedby={[desc, `au-${id}-e`].filter(Boolean).join(" ")}
          aria-invalid={err ? "true" : undefined}
          ref={inputRef}
          onInput={onInput}
        />
        <button
          type="button"
          className={`auth-eye${shown ? " is-on" : ""}`}
          data-eye=""
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={String(shown)}
          onClick={() => setShown(s => !s)}
        >
          <Icon n="eye" />
        </button>
      </div>
      <p className="err" id={`au-${id}-e`} aria-live="polite">
        {err || null}
      </p>
    </div>
  );
}
/** the password rules list, ticking each one off as it's met */
export function Rules({ id, value }) {
  const box = useRef(null),
    was = useRef({});
  useEffect(() => {
    RULES.forEach(r => {
      const ok = r[2](value);
      if (ok && !was.current[r[0]])
        mo("check", box.current.querySelector(`[data-r="${r[0]}"] .auth-rule-ic`), { color: "ink" });
      was.current[r[0]] = ok;
    });
  }, [value]);
  return (
    <ul className="auth-rules" id={id} aria-label="Your password needs" ref={box}>
      {RULES.map(r => {
        const ok = r[2](value);
        return (
          <li key={r[0]} data-r={r[0]} className={ok ? "is-ok" : undefined}>
            <span className="auth-rule-ic" aria-hidden="true">
              <Icon n="check" />
            </span>
            <span>{r[1]}</span>
            <span className="sr-only" data-rs="">
              {ok ? ", done" : ", not yet"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
/** "Passwords match" under the confirm box */
export function Match({ p1, p2 }) {
  if (!p2) return <p className="auth-avail" data-match="" aria-live="polite"></p>;
  if (p1 === p2)
    return (
      <p className="auth-avail is-ok" data-match="" aria-live="polite">
        <Icon n="check" />
        Passwords match
      </p>
    );
  if (p2.length >= p1.length)
    return (
      <p className="auth-avail is-no" data-match="" aria-live="polite">
        <Icon n="close" />
        These don't match yet
      </p>
    );
  return <p className="auth-avail" data-match="" aria-live="polite"></p>;
}
