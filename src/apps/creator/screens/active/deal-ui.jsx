/* The deal kit's markup pieces (see deal-kit.js for the rules) as React components, shared by Active deals and the
   deal board, Messages and Earnings: who moves next, the escrow and payment pills, the ink payout slip and the
   offline banner. */
import { useEffect, useState } from "react";
import { Icon } from "@/shared/react/view";

const C = () => window.LLD_C;

export const WhoPill = ({ a }) =>
  ({
    you: <span className="pill pill-coral">Your move</span>,
    brand: <span className="pill pill-violet">With the brand</span>,
    done: <span className="pill pill-ok">Done</span>,
  })[C().who(a)];

/** the lock icon split into shackle + body so the shackle can click shut when escrow is shown (CSS, reduced-motion safe) */
export const LockIc = () => (
  <svg
    className=""
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path className="active-shackle" d="M7 11V8a5 5 0 0 1 10 0v3" />
    <path d="M5 11h14v10H5z" />
  </svg>
);

export const EscrowPill = ({ text = "In escrow" }) => (
  <span className="pill pill-escrow active-lockin">
    <LockIc />
    {text}
  </span>
);

export const PayPill = ({ a }) =>
  a.pay === "released" ? (
    <span className="pill pill-ok">
      <Icon n="check" />
      Released
    </span>
  ) : a.awaitingPay ? (
    <span className="pill pill-violet">Awaiting payment</span>
  ) : (
    <EscrowPill />
  );

/** the ink payout slip with the scalloped edge (same object as the homepage receipt); no fee row: the creator
    receives the agreed price; the status pill (an element) takes the header slot */
export function PayoutSlip({ price, head = "Payout slip", status, brand, job, failed, foot }) {
  const p = window.LLD.payout(price),
    L = window.LLD;
  return (
    <div className="earnings-slip-w">
      <article className={`earnings-slip${failed ? " is-failed" : ""}`} aria-label={head}>
        <header className="earnings-slip-h">
          <span>{head}</span>
          {status || null}
        </header>
        {brand ? (
          <p className="earnings-slip-who">
            <b>{brand}</b>
            <span>{job || ""}</span>
          </p>
        ) : null}
        <dl className="earnings-slip-rows">
          <div>
            <dt>Agreed price</dt>
            <dd>{L.inr(p.price, { dec: true })}</dd>
          </div>
          <div>
            <dt>Tax / withholding</dt>
            <dd>As per confirmed rules</dd>
          </div>
        </dl>
        <div className="earnings-slip-net">
          <span>{failed ? "Not released" : "You receive"}</span>
          <span className="earnings-slip-amt">{L.inr(p.net)}</span>
        </div>
        {failed ? null : <p className="earnings-slip-why">The agreed price.</p>}
        {foot ? <p className="earnings-slip-f">{foot}</p> : null}
      </article>
    </div>
  );
}

/** the network banner: shows while the browser is offline */
export function NetBanner({ cls, text }) {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const sync = () => setOn(navigator.onLine);
    addEventListener("online", sync);
    addEventListener("offline", sync);
    return () => {
      removeEventListener("online", sync);
      removeEventListener("offline", sync);
    };
  }, []);
  return (
    <p className={cls} role="status" hidden={on}>
      <Icon n="alert" />
      <span>{text}</span>
    </p>
  );
}
