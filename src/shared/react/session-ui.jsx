/* What both dashboards' session code (each app's session.js) shows: the "couldn't load" note in the screen outlet, and
   the sheet that asks a guest to sign in. */
import { Lq, openReactSheet, renderInto } from "./view";

const WORDS = {
  creator: [
    "Create a free creator account or sign in to bid on collabs, message brands and get paid from escrow.",
    "Create a creator account",
  ],
  brand: [
    "Create a free brand account or sign in to post collabs, save creators, message them and hire with escrow.",
    "Create a brand account",
  ],
};

/** "We couldn't load your dashboard" with a Try again button (one retry per showing). */
export function showLoadFailed(el, retry) {
  if (!el) return;
  let done = false;
  renderInto(
    el,
    <div className="empty" role="alert">
      <p className="t-h2">We couldn't load your dashboard</p>
      <p className="muted">Check your connection and try again.</p>
      <button
        className="lq lq-p"
        type="button"
        data-retry=""
        onClick={() => {
          if (done) return;
          done = true;
          retry();
        }}
      >
        Try again
      </button>
    </div>,
  );
}

/** Guest mode: look, don't touch. Asks to sign in or create an account for `role`. */
export function promptSignInSheet(why, role) {
  const [text, join] = WORDS[role];
  openReactSheet({
    title: why,
    render: () => (
      <div className="stack">
        <p className="muted">{text}</p>
        <div className="row wrap">
          <Lq as="a" className="lq-p" href={`signin.html?role=${role}`}>
            Sign in
          </Lq>
          <Lq as="a" className="lq-s" href={`signin.html?role=${role}&join=1`}>
            {join}
          </Lq>
        </div>
      </div>
    ),
  });
}
