/* The brand app's small shared pieces as React components, used by every brand screen:
   - from the brief and deal kit (LLD.bk, jobs.js): Glyph, Cav, Ver, CrChip, StatusPill, JobMini, CrMini
   - from the creator kit (LLD.ck, creators.js): CkGlyph, CrAvatar, VerBadge, AvailPill, HeartBtn, CartLabel and the
     creator card used by Find creators and Saved creators.
   The cards are drawn once and kept: the kit's wiring (save, cart, hide, swipe) changes them directly. Their ER and
   price lines follow the Find creators filters through refreshCardLines(). */
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, Photo } from "@/shared/react/view";

const L = () => window.LLD;

/* ---------- brief and deal kit (bk) ---------- */
export const Glyph = ({ p }) => <Icon n={p === "youtube" ? "yt" : "ig"} />;

/** creators always read in the coral family: full coral, or the subtle coral with a coral ring */
export const Cav = ({ c, cls = "" }) => (
  <span
    className={`avatar bk-cav is-${c.tone === "b" ? "b" : "c"}${cls ? " " + cls : ""}`}
    aria-hidden="true"
  >
    <Photo src={c.avatarUrl}>{L().initials(c.name || "?")}</Photo>
  </span>
);

export const Ver = ({ c }) =>
  c.verified ? (
    <span className="bk-ver" title="Verified creator">
      <Icon n="verified" />
      <span className="sr-only">, verified</span>
    </span>
  ) : null;

export const CrChip = ({ c, sub }) => (
  <span className="bk-cr">
    <Cav c={c} />
    <span className="bk-cr-t">
      <b>
        {c.name}
        <Ver c={c} />
      </b>
      <span>{sub == null ? c.handle : sub}</span>
    </span>
  </span>
);

/** a brief (JST) or bid (BST) status pill */
export function StatusPill({ map, k, label }) {
  const m = map[k] || Object.values(map)[0];
  return (
    <span className={`pill ${m.pill}`} data-pill="">
      <Icon n={m.ic} />
      {label || m.label}
    </span>
  );
}

/** the brief at the top of a confirm sheet */
export const JobMini = ({ j }) => (
  <div className="jl-mini">
    <span className="bk-plat">
      <Glyph p={j.platform} />
      <span>{L().bk.platLine(j)}</span>
    </span>
    <p className="t-money jl-mini-p">{L().inr(j.budget)}</p>
    <p className="t-small muted">{j.title}</p>
  </div>
);

/** a creator, a price and a line, at the top of a confirm sheet */
export const CrMini = ({ c, price, line }) => (
  <div className="jl-mini">
    <CrChip c={c} />
    {price != null ? <p className="t-money jl-mini-p">{L().inr(price)}</p> : null}
    <p className="t-small muted">{line}</p>
  </div>
);

/* ---------- creator kit (ck) ---------- */
export const CkGlyph = ({ p }) => {
  const P = L().ck.PLAT;
  return <Icon n={P[p] ? P[p].ic : "link"} />;
};

export const CrAvatar = ({ c, cls = "" }) => (
  <span className={`creators-av ${cls}`} aria-hidden="true">
    <Photo src={c.avatarUrl}>{L().initials(c.name)}</Photo>
  </span>
);

export const VerBadge = ({ c }) =>
  c.verified ? (
    <span className="creators-ver" title="Verified by Linkloom">
      <Icon n="verified" />
      <span className="sr-only">, verified</span>
    </span>
  ) : null;

export const AvailPill = ({ c }) => {
  const K = L().ck;
  return K.availDays(c) <= 0 ? (
    <span className="pill pill-ok creators-av-pill">
      <span className="dot" aria-hidden="true"></span>
      {K.availLabel(c)}
    </span>
  ) : (
    <span className="pill pill-line creators-av-pill">
      <Icon n="cal" />
      {K.availLabel(c)}
    </span>
  );
};

export const HeartBtn = ({ c, cls = "ibtn creators-fav" }) => {
  const on = L().ck.isFav(c.id);
  return (
    <button
      className={cls}
      type="button"
      aria-pressed={String(on)}
      aria-label={`${on ? "Saved" : "Save"}: ${c.name}`}
      title={`${on ? "Remove from saved creators" : "Save this creator"} (or swipe right)`}
    >
      <Icon n="bookmark" />
    </button>
  );
};

export const CartLabel = ({ id }) =>
  L().ck.inCart(id) ? (
    <>
      <Icon n="check" className="ic" />
      In cart
    </>
  ) : (
    <>
      <Icon n="cart" className="ic" />
      Add to cart
    </>
  );

const RatingTxt = ({ c }) =>
  c.rating ? (
    <>
      <Icon n="star" />
      <span>{c.rating.toFixed(1)}</span>
      <span className="muted">({c.reviews})</span>
    </>
  ) : (
    <span className="muted">New</span>
  );

/** the card's "From ₹x per Reel" line */
export function Price({ c, types }) {
  const K = L().ck;
  if (!K.hasRates(c)) return <span className="creators-from">{K.RATE_ON_REQUEST}</span>;
  const r = K.fromRate(c, types);
  return r ? (
    <>
      <span className="creators-from">From</span>
      <b className="t-money">{L().inr(r.price)}</b>
      <span className="creators-per">per {r.fmt}</span>
    </>
  ) : (
    <span className="creators-from">No rate for that format</span>
  );
}

/* the ER and price lines of every drawn card follow the Find creators filters */
const lines = new Set();
function useLines() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick(n => n + 1);
    lines.add(f);
    return () => lines.delete(f);
  }, []);
}
/** redraws every card's ER and price line now (after a filter change) */
export const refreshCardLines = () => flushSync(() => lines.forEach(f => f()));

const CardEr = ({ c, platform }) => {
  useLines();
  const K = L().ck;
  return K.erTxt(K.erOf(c, platform !== undefined ? platform : window.LLD_DATA.ui.creators.platform));
};
const CardPrice = ({ c, content }) => {
  useLines();
  return <Price c={c} types={content !== undefined ? content : window.LLD_DATA.ui.creators.content} />;
};

/** order on the card: name and badge, niches, followers, engagement and rating, then the from-price */
export function CreatorCard({ c, ctx, hide, platform, content }) {
  const K = L().ck,
    P = K.PLAT;
  const tid = `cc-${ctx || "x"}-${c.id}`;
  const inCart = K.inCart(c.id);
  const fol = n => (n > 0 ? L().compact(n) : "—");
  return (
    <article
      className={`creators-card${K.isFav(c.id) ? " is-fav" : ""}`}
      data-id={c.id}
      aria-labelledby={tid}
    >
      <div className="creators-top">
        <CrAvatar c={c} />
        <div className="creators-id">
          <h3 className="creators-name" id={tid}>
            <a className="creators-card-link" href={`#creator-${c.id}`}>
              {c.name}
            </a>
            <VerBadge c={c} />
          </h3>
          <p className="creators-handle">{[c.handle, c.city].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {(c.categories || []).length ? <p className="creators-cats">{c.categories.join(" · ")}</p> : null}
      <dl className="creators-meta">
        {c.platforms.map((p, i) => (
          <div key={i}>
            <dt title={`${P[p.p].name} ${P[p.p].unit.toLowerCase()}`}>
              <CkGlyph p={p.p} />
              <span>{p.p === "youtube" ? "Subs" : "Followers"}</span>
              <span className="sr-only">{` on ${P[p.p].name}`}</span>
            </dt>
            <dd>{fol(p.followers)}</dd>
          </div>
        ))}
        <div>
          <dt>
            <abbr title="Engagement rate">ER</abbr>
          </dt>
          <dd data-erv="">
            <CardEr c={c} platform={platform} />
          </dd>
        </div>
        <div>
          <dt>Rating</dt>
          <dd className="creators-rate">
            <RatingTxt c={c} />
          </dd>
        </div>
      </dl>
      <div className="creators-pricerow">
        <p className="creators-price" data-price="">
          <CardPrice c={c} content={content} />
        </p>
        <AvailPill c={c} />
      </div>
      <div className="creators-acts">
        <Lq className={`${inCart ? "lq-s is-in" : "lq-p"} lq-sm creators-cart`} data-cart="">
          <CartLabel id={c.id} />
        </Lq>
        <span className="creators-acts-grow"></span>
        <HeartBtn c={c} />
        {hide === false ? null : (
          <button
            className="ibtn creators-hide"
            type="button"
            aria-label={`Hide: ${c.name}`}
            title="Hide (or swipe left)"
          >
            <Icon n="close" />
          </button>
        )}
      </div>
    </article>
  );
}
