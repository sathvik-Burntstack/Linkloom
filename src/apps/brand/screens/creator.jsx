/* Creator profile as a brand sees it (#creator-<id>). Owner: Builder B.
   Mirrors the creator app's "See what brands see" profile: masthead, ink audience band, platform rows, work, reviews.
   Actions: save the creator, add to cart, Invite now (adds to the cart, then opens #cart on that creator).
   Uses the creator kit (LLD.ck) from creators.js. Classes are .creator-*; styles in creator.css.
   React screen (see src/shared/react/view.jsx). */
import { useEffect, useRef, useState } from "react";
import { Icon, Lq, Photo } from "@/shared/react/view";
import { AvailPill, CkGlyph } from "./kit";

const L = window.LLD,
  S = () => window.LLD_DATA;
const mo = (fn, ...a) => {
  try {
    const m = L.motion;
    return m && m[fn] ? m[fn](...a) : null;
  } catch (e) {
    return null;
  }
};

const STAGE = {
  invited: ["pill-info", "send", "Invitation sent"],
  accepted: ["pill-butter", "check", "Accepted · pay to start"],
  funded: ["pill-escrow", "lock", "In escrow"],
  in_progress: ["pill-escrow", "lock", "In progress"],
  submitted: ["pill-info", "file", "Delivered for review"],
  revision: ["pill-warn", "edit", "Revision requested"],
  approved: ["pill-ok", "check", "Approved"],
  released: ["pill-ok", "check", "Paid out"],
  declined: ["pill-err", "alert", "Declined"],
  cancelled: ["pill-paper", "close", "Cancelled"],
  refunded: ["pill-paper", "refund", "Refunded"],
};
const StagePill = ({ st }) => {
  const m = STAGE[st] || STAGE.invited;
  return (
    <span className={`pill ${m[0]}`}>
      <Icon n={m[1]} />
      {m[2]}
    </span>
  );
};
const LIVE = ["invited", "accepted", "funded", "in_progress", "submitted", "revision"];
const first = n => String(n || "").split(/\s+/)[0];
/* the creator's own account on the platform: the stored link, else one built from the handle, else none */
const profileUrl = p => {
  const u = String(p.url || "").trim();
  if (u) return /^https?:\/\//i.test(u) ? u : "https://" + u.replace(/^\/+/, "");
  const h = String(p.handle || "")
    .trim()
    .replace(/^@/, "");
  if (!/^[\w.-]{1,60}$/.test(h)) return "";
  return p.p === "youtube" ? `https://www.youtube.com/@${h}` : `https://www.instagram.com/${h}`;
};
const Stars = ({ r }) => (
  <span className="creator-stars" aria-hidden="true">
    {[1, 2, 3, 4, 5].map(i => (
      <i key={i} className={r >= i - 0.25 ? "is-on" : ""}>
        <Icon n="star" />
      </i>
    ))}
  </span>
);

function Gone() {
  return (
    <div className="view-in">
      <div className="empty">
        <img src="assets/step-04-orbit.svg" width="160" height="117" alt="" />
        <p className="t-h2">This creator is no longer listed.</p>
        <p className="muted">They may have paused their profile. Your saved list and cart are unchanged.</p>
        <Lq className="lq-p" data-go="#creators">
          Find creators
        </Lq>
      </div>
    </div>
  );
}

function CreatorScreen({ param: id }) {
  const K = L.ck;
  const s = S();
  const c = L.creator(id);
  const [, redraw] = useState(0);
  const root = useRef(null);
  const favBtn = useRef(null);
  useEffect(() => {
    if (!root.current) return;
    root.current.querySelectorAll(".creator-nums [data-n]").forEach(d => {
      const n = +d.dataset.n;
      if (!n) return;
      mo("count", d, n, d.dataset.f === "c" ? L.compact : K.pct);
    });
    mo("stagger", [...root.current.querySelectorAll("[data-st]")]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!K || !c) return <Gone />;
  K.ensure();
  const me = s.me,
    P = K.PLAT;
  const fol = K.reach(c),
    er = K.erOf(c),
    views = K.viewsOf(c);
  const mine = s.campaigns.filter(x => x.creator === c.id);
  const live = mine.filter(x => LIVE.includes(x.stage));
  const reviews = mine.filter(x => x.review && x.review.text);
  const from = K.fromRate(c);
  const rates = K.rateList(c).sort((a, b) => a[1] - b[1]);
  /* numbers the creator has not shared read as a dash, as on the creator cards, never as a bare 0 */
  const nTxt = n => (n > 0 ? L.compact(n) : "—"),
    pTxt = n => (n > 0 ? K.pct(n) : "—");
  const fromSaved = !!(s.ui && s.ui.creators && s.ui.creators.from === "saved");
  const fav = K.isFav(c.id),
    cart = K.inCart(c.id);

  const toggleFav = () => {
    const on = K.toggleFav(c.id);
    redraw(n => n + 1);
    if (on) requestAnimationFrame(() => favBtn.current && K.stitch(favBtn.current, true));
  };
  const toCart = e => {
    if (K.inCart(c.id)) return L.go("#cart");
    K.addToCart(c.id, e.currentTarget);
    redraw(n => n + 1);
  };
  const invite = () => {
    if (!K.inCart(c.id))
      L.store.set(st => {
        st.cart.push(c.id);
      }, "cart-add");
    S().ui.cart = S().ui.cart || {};
    S().ui.cart.focus = c.id;
    L.go("#cart");
  };
  const CartBtn = ({ cls }) => (
    <Lq
      className={cls}
      data-cart=""
      aria-label={cart ? `${c.name} is in your cart. Open cart` : `Add ${c.name} to cart`}
      onClick={toCart}
    >
      <Icon n={cart ? "check" : "cart"} className="ic" />
      {cart ? "In cart" : "Add to cart"}
    </Lq>
  );

  return (
    <>
      <div className="view-in creator" ref={root}>
        <a className="btn-q creator-back" href={fromSaved ? "#saved" : "#creators"}>
          <Icon n="back" />
          {fromSaved ? "Saved creators" : "Find creators"}
        </a>
        <header className="creator-mast">
          <div className="creator-photo" aria-hidden="true">
            <Photo src={c.avatarUrl}>
              <span>{c.name.trim()[0].toUpperCase()}</span>
            </Photo>
          </div>
          <div className="creator-id">
            <p className="t-eyebrow">
              {["Creator", [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            </p>
            <h1 className="t-display creator-name">
              {c.name}
              {c.verified ? (
                <span className="creator-ver" title="Verified by Linkloom">
                  <Icon n="verified" />
                  <span className="sr-only">, verified</span>
                </span>
              ) : null}
            </h1>
            <ul className="creator-handles">
              {c.platforms.map((p, i) => {
                const url = profileUrl(p);
                const h = p.handle ? <span className="creator-handle">{p.handle}</span> : null;
                return url ? (
                  <li key={i}>
                    <a className="creator-ext" href={url} target="_blank" rel="noopener">
                      <CkGlyph p={p.p} />
                      <span>View on {P[p.p].name}</span>
                      <span className="sr-only">, opens in a new tab</span>
                    </a>
                    {h}
                  </li>
                ) : (
                  <li key={i}>
                    <CkGlyph p={p.p} />
                    <span>{p.handle || P[p.p].name}</span>
                    {p.handle ? <span className="sr-only"> on {P[p.p].name}</span> : null}
                  </li>
                );
              })}
            </ul>
            {c.bio ? <p className="creator-bio">{c.bio}</p> : null}
            <p className="creator-meta">
              {c.categories.map(x => (
                <span key={x} className="pill pill-line">
                  {x}
                </span>
              ))}
              {(c.languages || []).length ? (
                <span className="creator-langs">Creates in {c.languages.join(", ")}</span>
              ) : null}
            </p>
          </div>
          <div className="creator-act">
            <AvailPill c={c} />
            <div className="creator-btns">
              <Lq
                className="lq-s creator-fav"
                data-fav=""
                ref={favBtn}
                aria-pressed={String(fav)}
                aria-label={fav ? `Saved. Remove ${c.name} from saved creators` : `Save ${c.name}`}
                onClick={toggleFav}
              >
                <Icon n="bookmark" className="ic" />
                {fav ? "Saved" : "Save"}
              </Lq>
              <CartBtn cls="lq-s" />
              <Lq className="lq-p" data-invite="" onClick={invite}>
                Invite now
              </Lq>
            </div>
            {live.length ? (
              <p className="creator-live">
                <Icon n="info" />
                <span>
                  {live[0].title}: {(STAGE[live[0].stage] || STAGE.invited)[2].toLowerCase()}. A new
                  invitation is a separate deal.
                </span>
              </p>
            ) : null}
          </div>
        </header>

        <section className="creator-band" aria-labelledby="creator-aud">
          <div className="creator-band-h">
            <h2 className="t-eyebrow" id="creator-aud">
              Audience
            </h2>
            <p className="creator-src">
              Shared by {first(c.name)}
              {c.platforms.length > 1 ? " · views and engagement weighted by followers" : ""}{" "}
              <span className="sample">Sample</span>
            </p>
          </div>
          <dl className="creator-nums">
            <div>
              <dt>Followers</dt>
              <dd className="t-money" data-n={fol} data-f="c">
                {nTxt(fol)}
              </dd>
              <p>{c.platforms.map(p => P[p.p].name).join(" and ")}</p>
            </div>
            <div>
              <dt>Avg views</dt>
              <dd className="t-money" data-n={views} data-f="c">
                {nTxt(views)}
              </dd>
              <p>{views > 0 ? "per post" : "not shared yet"}</p>
            </div>
            <div>
              <dt>Engagement</dt>
              <dd className="t-money" data-n={er} data-f="p">
                {pTxt(er)}
              </dd>
              <p>{er > 0 ? "engagement rate" : "not shared yet"}</p>
            </div>
          </dl>
        </section>

        <div className="creator-grid">
          <div className="creator-col">
            <section className="creator-sec creator-card" aria-labelledby="creator-plat">
              <h2 className="t-h3" id="creator-plat">
                Platforms
              </h2>
              <ul className="creator-plats">
                {c.platforms.map((p, i) => (
                  <li key={i} className="creator-plat" data-st="">
                    {profileUrl(p) ? (
                      <a
                        className="creator-plat-ic"
                        href={profileUrl(p)}
                        target="_blank"
                        rel="noopener"
                        aria-label={`View on ${P[p.p].name}, opens in a new tab`}
                      >
                        <CkGlyph p={p.p} />
                      </a>
                    ) : (
                      <span className="creator-plat-ic">
                        <CkGlyph p={p.p} />
                      </span>
                    )}
                    <div className="creator-plat-id">
                      <p className="t-h3">{P[p.p].name}</p>
                      {p.handle ? <p className="creator-plat-h">{p.handle}</p> : null}
                    </div>
                    <dl className="creator-plat-n">
                      <div>
                        <dt>{P[p.p].unit}</dt>
                        <dd className="t-money">{nTxt(p.followers)}</dd>
                      </div>
                      <div>
                        <dt>Avg views</dt>
                        <dd className="t-money">{nTxt(p.avgViews)}</dd>
                      </div>
                      <div>
                        <dt>Engagement</dt>
                        <dd className="t-money">{pTxt(p.er)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </section>

            <section className="creator-sec creator-card" aria-labelledby="creator-work">
              <h2 className="t-h3" id="creator-work">
                Past work
              </h2>
              {c.work.length ? (
                <ol className="creator-work">
                  {c.work.map((w, i) => (
                    <li key={i} data-st="">
                      <span className="creator-work-n num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="creator-work-t">
                        <b>{w.title}</b>
                        <span>
                          {w.brand}
                          {w.brand === me.brand ? (
                            <>
                              {" "}
                              <span className="pill pill-paper">With you</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      {w.views ? (
                        <span className="creator-work-v">
                          <b className="t-money">{L.compact(w.views)}</b>
                          <span>views</span>
                        </span>
                      ) : (
                        <span className="creator-work-v">
                          <span>Not live yet</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty">
                  <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
                  <p className="t-h3">No past work on Linkloom yet</p>
                  <p className="muted">
                    {first(c.name)} is new here. Check the platform numbers above, or start with a small
                    brief.
                  </p>
                </div>
              )}
            </section>

            <section className="creator-sec creator-card" aria-labelledby="creator-rev">
              <h2 className="t-h3" id="creator-rev">
                Rating and reviews
              </h2>
              <div className="creator-rating">
                {c.rating ? (
                  <>
                    <p className="t-money creator-rating-v">{c.rating.toFixed(1)}</p>
                    <div>
                      <Stars r={c.rating} />
                      <p className="muted">
                        {c.reviews} {c.reviews === 1 ? "review" : "reviews"} from brands on Linkloom
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="muted">No ratings yet. Brands rate creators after approving their work.</p>
                )}
              </div>
              {reviews.length ? (
                reviews.map(x => (
                  <figure key={x.id} className="creator-rev" data-st="">
                    <blockquote>{x.review.text}</blockquote>
                    <figcaption>
                      <b>{me.brand}</b>
                      <span>{x.title}</span>
                      <span className="num">
                        {x.review.rating} out of 5 · {L.fmtDate(x.review.at, { year: true })}
                      </span>
                    </figcaption>
                  </figure>
                ))
              ) : c.rating ? (
                <p className="creator-rev-none muted">
                  You have not reviewed {first(c.name)} yet. Your reviews appear here after you approve their
                  work.
                </p>
              ) : null}
            </section>
          </div>

          <div className="creator-col">
            <section className="creator-sec creator-card" aria-labelledby="creator-rates">
              <h2 className="t-h3" id="creator-rates">
                Rates
              </h2>
              {rates.length ? (
                <dl className="creator-rates">
                  {rates.map(([k, v]) => (
                    <div key={k} className="kv">
                      <dt>{K.cap(k)}</dt>
                      <dd className="t-money">{L.inr(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="creator-rates-none">{K.RATE_ON_REQUEST}</p>
              )}
              <p className="t-cap muted">
                Listed by {first(c.name)}. You set the agreed price in the cart. It goes into escrow only
                after {first(c.name)} accepts. No platform fee.
              </p>
            </section>

            <section className="creator-sec creator-card" aria-labelledby="creator-avail">
              <h2 className="t-h3" id="creator-avail">
                Availability
              </h2>
              <p className="creator-avail">
                <AvailPill c={c} />
              </p>
              <p className="muted">
                {K.availDays(c) <= 0
                  ? `Open to new briefs now. Give at least 3 days for a first draft.`
                  : `Can start a new brief ${K.availDays(c) === 1 ? "tomorrow" : "in " + K.availDays(c) + " days"}. Set your due date after that.`}
              </p>
              {(c.content || []).length ? <p className="t-cap muted">Posts {c.content.join(", ")}</p> : null}
            </section>

            <section className="creator-sec creator-card" aria-labelledby="creator-you">
              <h2 className="t-h3" id="creator-you">
                With {me.brand}
              </h2>
              {mine.length ? (
                <ul className="creator-you">
                  {mine.map(x => (
                    <li key={x.id}>
                      <a href={`#campaign-${x.id}`}>
                        <span className="creator-you-t">
                          <b>{x.title}</b>
                          <span className="num">
                            {L.inr(x.price)} · due {L.fmtDate(x.due)}
                          </span>
                        </span>
                        <StagePill st={x.stage} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">You have not worked together yet.</p>
              )}
            </section>
          </div>
        </div>
      </div>
      <div className="creator-dock" role="region" aria-label={`Hire ${c.name}`}>
        <p className="creator-dock-t">
          {from ? (
            <>
              <span>From</span>
              <b className="t-money">{L.inr(from.price)}</b>
            </>
          ) : (
            <span>{K.RATE_ON_REQUEST}</span>
          )}
        </p>
        <CartBtn cls="lq-s lq-sm" />
        <Lq className="lq-p lq-sm" data-invite="" onClick={invite}>
          Invite now
        </Lq>
      </div>
    </>
  );
}

L.register("creator", {
  title: id => {
    const c = L.creator(id);
    return c ? c.name : "Creator";
  },
  nav: "creators",
  crumb: id => {
    const c = L.creator(id);
    return `<a href="#creators">Find creators</a>${c ? " / " + L.esc(c.name) : ""}`;
  },
  Component: CreatorScreen,
});
