/* profile screen (Builder A): the creator's own profile, laid out like a media kit.
   Header (photo, name, bio, Edit profile), audience numbers with source and last-updated date, platform rows,
   audience geography, track record, selected work, reviews, and a "Private to you" panel.
   "See what brands see" switches to the brand-safe view: no contact details, no date of birth, no KYC or payout data.
   #profile-brand opens straight in that view. Edit profile opens a sheet (profile-edit.jsx, built on the setup kit).
   Layout: header, then the dark Audience band (the one dark block on this screen: the three headline numbers), then
   section panels --space-section apart: Platforms and audience · Work · Reviews · Private to you.
   C7: no languages → no "Creates in" for brands; the owner gets an "Add languages" link to the edit sheet.
   React screen (see src/shared/react/view.jsx). */
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { kycWaitText } from "../../core/kyc-gate";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";
import { openEdit } from "./profile-edit";

const LLD = window.LLD,
  { store } = LLD;
const pct = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "") + "%";
/* an unshared number in the dark Audience band: words at a readable size, not a giant "—" that reads like a bar */
const NS = <span className="profile-nums-ns">Not shared</span>;
const href = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
const PLAT = { instagram: ["Instagram", "ig", "Followers"], youtube: ["YouTube", "yt", "Subscribers"] };
const STATUS = {
  not_started: ["pill-paper", "Not started", "Verify before your first bid"],
  in_progress: ["pill-info", "In progress", "Pick up where you left off"],
  under_review: ["pill-info", "Under review", "Usually within 2 hours"],
  verified: ["pill-ok", "Verified", "You can bid on any brief"],
  action_needed: ["pill-warn", "Action needed", "Fix one detail to keep bidding"],
  rejected: ["pill-err", "Rejected", "Try again with a different ID"],
};
const initial = n => (String(n || "").trim()[0] || "?").toUpperCase();
const pName = k => (PLAT[k] ? PLAT[k][0] : k);
const pIcon = k => (PLAT[k] ? PLAT[k][1] : "link");

function stats(me) {
  /* a platform counts once it has a handle or a follower count: brands see the follower count from
     /v1/creators/me/ even before a handle is added, so the owner must see it too (C6) */
  const ps = Object.entries(me.platforms || {}).filter(([, p]) => p && (p.handle || p.followers > 0));
  const f = ps.reduce((n, [, p]) => n + (p.followers || 0), 0);
  const w = k => (f ? ps.reduce((n, [, p]) => n + (p.followers || 0) * (p[k] || 0), 0) / f : 0);
  const upd = ps
    .map(([, p]) => p.updated)
    .filter(Boolean)
    .sort()
    .pop();
  const src = [...new Set(ps.map(([, p]) => p.source || "Self-reported"))].join(", ");
  return { ps, followers: f, views: Math.round(w("avgViews")), er: w("er"), updated: upd, source: src };
}

const SignOut = ({ close }) => (
  <div className="profile-sheet-q">
    <p className="muted">
      You'll need your email and password, or Google, to sign back in. Drafts on this device are cleared.
    </p>
    <div className="row wrap">
      <Lq
        className="lq-p"
        data-yes=""
        onClick={() => {
          store.set(s => {
            s.session.signedIn = false;
          }, "signed-out");
          close(true);
          LLD.go("#login");
        }}
      >
        Sign out
      </Lq>
      <Lq className="lq-s" data-no="" onClick={() => close()}>
        Stay signed in
      </Lq>
    </div>
  </div>
);

/** One paint of the profile. It is keyed by a version, so a save redraws it from scratch and the numbers count up again. */
function Profile({ brand, setBrand, edit }) {
  const root = useRef(null),
    sw = useRef(null);
  useLayoutEffect(() => {
    try {
      LLD.motion.press(sw.current);
    } catch (e) {}
    try {
      root.current.querySelectorAll(".profile-nums [data-n], .profile-rec [data-n]").forEach(d => {
        const n = +d.dataset.n;
        if (!n) return;
        LLD.motion.count(
          d,
          n,
          d.dataset.f === "c" ? LLD.compact : d.dataset.f === "p" ? pct : v => String(Math.round(v)),
        );
      });
      LLD.motion.stagger([...root.current.querySelectorAll("[data-st]")]);
    } catch (e) {}
  }, []);
  const s = store.s,
    me = s.me,
    k = s.kyc,
    sess = s.session,
    st = stats(me);
  const [kc, kt, kn0] = STATUS[k.status] || STATUS.not_started;
  const kn = k.status === "under_review" ? "We're checking · " + kycWaitText(k) : kn0;
  const langs = me.languages || [];
  const handles = st.ps.filter(([, p]) => p.handle);
  const payout =
    k.payoutMethod === "bank" && k.bank && k.bank.acc
      ? `Bank account ${k.bank.acc}`
      : k.upi
        ? `UPI ${k.upi}`
        : "";
  const age = me.dob ? LLD.ageFrom(me.dob) : null;
  const geoMax = Math.max(1, ...(me.audienceGeo || []).map(g => g[1]));
  const press = e => {
    try {
      LLD.motion.press(e.currentTarget);
    } catch (x) {}
  };
  const openAt = at => e => {
    press(e);
    edit(at);
  };
  const sp = me.startPrice;

  return (
    <div className={`view-in profile${brand ? " is-brand" : ""}`} ref={root}>
      <div className="profile-bv" data-bv="" role="status" hidden={!brand}>
        <Icon n="eye" />
        <p>
          <b>Brand view.</b> This is your profile as brands see it when you bid. Hidden from them: email,
          mobile, date of birth, PAN, ID and payout details.
        </p>
      </div>

      <header className="profile-mast">
        <div className="profile-photo">
          {me.photo ? (
            <img src={me.photo} alt={me.name} />
          ) : (
            <span aria-hidden="true">{initial(me.name)}</span>
          )}
        </div>
        <div className="profile-id">
          <p className="t-eyebrow">
            {["Creator", [me.city, me.region].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
          </p>
          <h1 className="t-display profile-name">{me.name}</h1>
          {handles.length ? (
            <ul className="profile-handles">
              {handles.map(([key, p]) => (
                <li key={key}>
                  <a href={href(p.url || "")} target="_blank" rel="noopener noreferrer">
                    <Icon n={pIcon(key)} />
                    <span>{p.handle}</span>
                    <span className="sr-only"> on {pName(key)}, opens in a new tab</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {me.bio ? <p className="profile-bio">{me.bio}</p> : null}
          <p className="profile-meta">
            {(me.categories || []).map(c => (
              <span key={c} className="pill pill-line">
                {c}
              </span>
            ))}
            {langs.length ? (
              <span className="profile-langs">Creates in {langs.join(", ")}</span>
            ) : (
              <Lq
                className="lq-s lq-sm profile-addlang"
                data-addlang=""
                data-own=""
                hidden={brand}
                onClick={openAt("langs")}
              >
                <Icon n="plus" className="ic" />
                Add languages
              </Lq>
            )}
          </p>
          {sp ? (
            <p className="profile-price">
              <span>From</span>
              <b className="t-money">{LLD.inr(sp.price)}</b>
              <span>
                per {sp.format}
                {sp.deliveryDays
                  ? ` · delivered in ${sp.deliveryDays} ${sp.deliveryDays === 1 ? "day" : "days"}`
                  : ""}
              </span>
            </p>
          ) : sp === null ? (
            <div className="profile-noprice" data-own="" hidden={brand}>
              <p>
                <b>Add your starting price.</b> Brands see "Rate on request" on your card until you do.
              </p>
              <Lq className="lq-s lq-sm" data-addprice="" onClick={openAt("price")}>
                <Icon n="plus" className="ic" />
                Add starting price
              </Lq>
            </div>
          ) : null}
        </div>
        <div className="profile-act">
          <button
            type="button"
            className="profile-switch"
            role="switch"
            aria-checked={String(brand)}
            data-switch=""
            ref={sw}
            onClick={() => setBrand(!brand)}
          >
            <span className="profile-knob" aria-hidden="true"></span>See what brands see
          </button>
          <Lq className="lq-p" data-edit="" hidden={brand} onClick={openAt("")}>
            Edit profile
          </Lq>
        </div>
      </header>

      <div className="ll-stack profile-stack">
        <section className="profile-band" aria-labelledby="profile-aud">
          <div className="profile-band-h">
            <h2 className="t-eyebrow" id="profile-aud">
              Audience
            </h2>
            <p className="profile-src">
              {st.source || "Self-reported"} · updated{" "}
              {st.updated ? LLD.fmtDate(st.updated, { year: true }) : "never"}
              {st.ps.length > 1 ? " · views and engagement weighted by followers" : ""}{" "}
              <span className="sample">Sample</span>
            </p>
          </div>
          {st.ps.length ? (
            <dl className="profile-nums">
              <div>
                <dt>Followers</dt>
                <dd className="t-money" data-n={st.followers} data-f="c">
                  {st.followers ? LLD.compact(st.followers) : NS}
                </dd>
                <p>{st.ps.map(([key]) => pName(key)).join(" and ")}</p>
              </div>
              <div>
                <dt>Avg views</dt>
                <dd className="t-money" data-n={st.views} data-f="c">
                  {st.views ? LLD.compact(st.views) : NS}
                </dd>
                <p>per post</p>
              </div>
              <div>
                <dt>Engagement</dt>
                <dd className="t-money" data-n={st.er} data-f="p">
                  {st.er ? pct(st.er) : NS}
                </dd>
                <p>engagement rate</p>
              </div>
            </dl>
          ) : (
            <p className="profile-band-empty">
              No audience numbers yet.
              <span data-own="" hidden={brand}>
                {" "}
                Add Instagram or YouTube in{" "}
                <button type="button" className="btn-q" data-edit2="" onClick={openAt("")}>
                  Edit profile
                </button>{" "}
                to show your audience here.
              </span>
            </p>
          )}
        </section>

        <section className="ll-panel profile-aud" aria-labelledby="profile-audp">
          <div className="ll-panel-head">
            <div>
              <h2 className="ll-panel-h" id="profile-audp">
                Platforms and audience
              </h2>
              <p className="ll-panel-sub">Numbers for each account, and where your followers live.</p>
            </div>
          </div>
          <div className="profile-aud-g">
            <section className="profile-sub" aria-labelledby="profile-plat">
              <h3 className="profile-sub-h" id="profile-plat">
                Platforms
              </h3>
              {st.ps.length ? (
                <ul className="profile-plats">
                  {st.ps.map(([key, p]) => (
                    <li key={key} className="profile-plat" data-st="">
                      <span className="profile-plat-ic">
                        <Icon n={pIcon(key)} />
                      </span>
                      <div className="profile-plat-id">
                        <p className="t-h3">{pName(key)}</p>
                        {p.handle ? (
                          <a
                            href={href(p.url || "")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="profile-plat-h"
                          >
                            {p.handle}
                            <span className="sr-only">, opens in a new tab</span>
                          </a>
                        ) : (
                          <span className="t-cap muted" data-own="" hidden={brand}>
                            Add your handle in Edit profile
                          </span>
                        )}
                        <p className="t-cap muted">
                          {p.source || "Self-reported"} · {p.updated ? LLD.fmtDate(p.updated) : "—"}
                        </p>
                      </div>
                      <dl className="profile-plat-n">
                        <div>
                          <dt>{PLAT[key] ? PLAT[key][2] : "Followers"}</dt>
                          <dd className="t-money">{p.followers ? LLD.compact(p.followers) : "—"}</dd>
                        </div>
                        <div>
                          <dt>Avg views</dt>
                          <dd className="t-money">{p.avgViews ? LLD.compact(p.avgViews) : "—"}</dd>
                        </div>
                        <div>
                          <dt>Engagement</dt>
                          <dd className="t-money">{p.er ? pct(p.er) : "—"}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  No platforms yet.
                  <span data-own="" hidden={brand}>
                    {" "}
                    Brands filter by platform, so add at least one.
                  </span>
                </p>
              )}
            </section>
            <section className="profile-sub" aria-labelledby="profile-geo">
              <h3 className="profile-sub-h" id="profile-geo">
                Where the audience is
              </h3>
              {(me.audienceGeo || []).length ? (
                <>
                  <ol className="profile-geo">
                    {me.audienceGeo.map(([city, v]) => (
                      <li key={city} data-st="">
                        <span className="profile-geo-l">{city}</span>
                        <span className="profile-geo-b" aria-hidden="true">
                          <i
                            style={{ width: Math.max(2, (v / geoMax) * 100).toFixed(1) + "%" }}
                            className={/other/i.test(city) ? "is-other" : ""}
                          ></i>
                        </span>
                        <span className="profile-geo-v num">{v}%</span>
                      </li>
                    ))}
                  </ol>
                  <p className="t-cap muted">
                    Share of followers by city · {st.source || "Self-reported"},{" "}
                    {st.updated ? LLD.fmtDate(st.updated, { year: true }) : "—"}
                  </p>
                </>
              ) : (
                <p className="muted">No audience data yet.</p>
              )}
            </section>
          </div>
        </section>

        <section className="ll-panel profile-workp" aria-labelledby="profile-work">
          <div className="ll-panel-head">
            <div>
              <h2 className="ll-panel-h" id="profile-work">
                Work
              </h2>
              <p className="ll-panel-sub">Posts you're proud of, and your record on Linkloom.</p>
            </div>
            <Lq className="lq-s lq-sm" data-edit3="" hidden={brand} onClick={openAt("links")}>
              <Icon n="plus" className="ic" />
              Add link
            </Lq>
          </div>
          <div className="profile-work-g">
            <section className="profile-sub" aria-labelledby="profile-sel">
              <h3 className="profile-sub-h" id="profile-sel">
                Selected work
              </h3>
              {(me.portfolio || []).length ? (
                <ol className="profile-work">
                  {me.portfolio.map((w, i) => (
                    <li key={i} data-st="">
                      <a href={href(w.url)} target="_blank" rel="noopener noreferrer">
                        <span className="profile-work-n num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="profile-work-t">
                          <b>{w.title}</b>
                          <span>
                            <Icon n={pIcon(w.platform)} />
                            {[PLAT[w.platform] ? PLAT[w.platform][0] : "Link", w.format]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {w.views ? (
                          <span className="profile-work-v">
                            <b className="t-money">{LLD.compact(w.views)}</b>
                            <span>views</span>
                          </span>
                        ) : null}
                        <span className="profile-work-go">
                          <Icon n="arrow" />
                          <span className="sr-only">Open, new tab</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted">
                  No work links yet.
                  <span data-own="" hidden={brand}>
                    {" "}
                    Add two or three posts you're proud of. Brands open these before they accept a bid.
                  </span>
                </p>
              )}
            </section>
            <section className="profile-sub" aria-labelledby="profile-rec">
              <h3 className="profile-sub-h" id="profile-rec">
                Track record
              </h3>
              {/* zeros feel like failure: a new creator gets the next step, numbers once there are any */}
              {(me.completedJobs || 0) + (me.totalBids || 0) > 0 ? (
                <dl className="profile-rec">
                  <div>
                    <dd className="t-money" data-n={me.completedJobs || 0}>
                      {me.completedJobs || 0}
                    </dd>
                    <dt>deals completed</dt>
                  </div>
                  <div>
                    <dd className="t-money" data-n={me.totalBids || 0}>
                      {me.totalBids || 0}
                    </dd>
                    <dt>bids sent</dt>
                  </div>
                </dl>
              ) : (
                <p className="muted">
                  New on Linkloom, no deals yet.
                  <span data-own="" hidden={brand}>
                    {" "}
                    Your record starts with your first bid.
                  </span>
                </p>
              )}
              <p className="t-cap muted">
                Completed means the brand approved the work. Counted by Linkloom, not self-reported.
              </p>
            </section>
          </div>
        </section>

        <section className="ll-panel profile-revp" aria-labelledby="profile-rev">
          <div className="ll-panel-head">
            <div>
              <h2 className="ll-panel-h" id="profile-rev">
                Reviews
              </h2>
              <p className="ll-panel-sub">What brands said after approving the work.</p>
            </div>
          </div>
          {(me.reviews || []).length ? (
            <div className="profile-revs">
              {me.reviews.map((r, i) => (
                <figure key={i} className="profile-rev" data-st="">
                  <blockquote>{r.text}</blockquote>
                  <figcaption>
                    <b>{r.brand}</b>
                    <span className="num">{r.rating} out of 5</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="muted">Reviews appear here after your first approved deal.</p>
          )}
        </section>

        <section
          className="ll-panel profile-priv"
          aria-labelledby="profile-priv"
          data-priv=""
          data-settings=""
          hidden={brand}
        >
          <div className="ll-panel-head">
            <div>
              <h2 className="ll-panel-h profile-priv-t" id="profile-priv">
                <Icon n="lock" />
                Private to you
              </h2>
              <p className="ll-panel-sub">Brands never see this section.</p>
            </div>
          </div>
          <dl className="profile-priv-g">
            <div>
              <dt>Email</dt>
              <dd>{sess.email || "Not added"}</dd>
            </div>
            {sess.mobile ? (
              <div>
                <dt>Mobile</dt>
                <dd className="num">{sess.mobile}</dd>
              </div>
            ) : null}
            <div>
              <dt>Date of birth</dt>
              <dd className="num">{me.dob ? LLD.fmtDate(me.dob, { year: true }) + " · " + age : "—"}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>
                <span className={`pill ${kc}`}>
                  {k.status === "verified" ? (
                    <Icon n="check" />
                  ) : ["action_needed", "rejected"].includes(k.status) ? (
                    <Icon n="alert" />
                  ) : null}
                  {kt}
                </span>
                <span className="t-cap muted">{kn}</span>
                {k.status !== "verified" ? (
                  <Lq as="a" className="lq-s lq-sm profile-kyc-go" href="#kyc">
                    {k.status === "not_started"
                      ? "Start"
                      : k.status === "under_review"
                        ? "See status"
                        : "Fix it"}
                  </Lq>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Payouts go to</dt>
              <dd className="num">{payout || "Not added yet"}</dd>
            </div>
            {s.plan ? (
              <div>
                <dt>Plan</dt>
                <dd>
                  {s.plan.name}
                  {s.plan.status === "active" && s.plan.renews ? (
                    <span className="t-cap muted">Renews {LLD.fmtDate(s.plan.renews)}</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="profile-priv-f">
            <Lq
              className="lq-s lq-sm"
              data-signout=""
              onClick={() =>
                openReactSheet({ title: "Sign out?", render: close => <SignOut close={close} /> })
              }
            >
              <Icon n="logout" className="ic" />
              Sign out
            </Lq>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileScreen({ param }) {
  const [brand, setBrandS] = useState(param === "brand");
  const [ver, setVer] = useState(0);
  const setBrand = on => {
    setBrandS(on);
    try {
      history.replaceState(null, "", on ? "#profile-brand" : "#profile");
    } catch (e) {}
  };
  const edit = at =>
    openEdit(at, saved => {
      flushSync(() => setVer(v => v + 1));
      if (saved) {
        const eb = document.querySelector(".profile [data-edit]");
        eb && eb.focus({ preventScroll: true });
      }
    });
  return <Profile key={ver} brand={brand} setBrand={setBrand} edit={edit} />;
}

LLD.register("profile", { title: "Your profile", nav: "profile", Component: ProfileScreen });
