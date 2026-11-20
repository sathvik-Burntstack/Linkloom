/* F4: the page-shaped placeholder shown at once while a dashboard or a screen is loading (never a blank area):
   title, one line, a panel, two cards. With `slowNote`, a "server is waking up" line appears after 4 s. */
import { useEffect, useState } from "react";
import { renderInto } from "./view";

export function Skeleton({ label = "Loading your dashboard", slowNote = true }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!slowNote) return;
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [slowNote]);
  return (
    <div className="view-in ll-skel" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{`${label}…`}</span>
      <i className="s-h" aria-hidden="true"></i>
      <i className="s-l" aria-hidden="true"></i>
      <i className="s-p" aria-hidden="true"></i>
      <div className="s-row" aria-hidden="true">
        <i></i>
        <i></i>
      </div>
      {slowNote ? (
        <p className="ll-skel-note" data-slow="" hidden={!slow}>
          The server is waking up. This can take up to a minute the first time.
        </p>
      ) : null}
    </div>
  );
}

/** Puts the skeleton in `el` (a screen outlet). */
export function showSkeleton(el, label) {
  if (!el) return;
  renderInto(el, <Skeleton label={label} />);
}
