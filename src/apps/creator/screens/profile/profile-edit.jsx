/* The creator's Edit profile sheet, opened from the profile screen (profile.jsx). Builder A.
   Built from the setup kit (setup-kit.jsx): the photo picker, chip pickers, state-then-city and price fields, validators.
   React sheet (see src/shared/react/view.jsx). */
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";
import {
  BIO_MAX,
  CAT_MAX,
  CATS,
  ChipPicker,
  GENDERS,
  LANGS,
  NICHE_GROUPS,
  PhotoPicker,
  PlaceFields,
  PriceFields,
  V,
  useErrors,
} from "../setup/setup-kit";

const LLD = window.LLD,
  { store } = LLD;
const href = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
const platOf = u =>
  /instagram\.com/i.test(u) ? "instagram" : /youtube\.com|youtu\.be/i.test(u) ? "youtube" : "web";
const initial = n => (String(n || "").trim()[0] || "?").toUpperCase();

function Fld({ id, label, help, E, children }) {
  return (
    <div className={`field${E.errs[id] != null ? " is-err" : ""}`} data-pf={id}>
      <label htmlFor={`pe-${id}`}>{label}</label>
      {children}
      {help ? <p className="help">{help}</p> : null}
      <p className="err" aria-live="polite">
        {E.errs[id] || ""}
      </p>
    </div>
  );
}

function EditSheet({ at, close, done }) {
  const me = store.s.me;
  /* the working copy: what's typed lives here until Save */
  const d = useRef(null);
  if (!d.current)
    d.current = {
      name: me.name,
      bio: me.bio || "",
      city: me.city || "",
      region: me.region || "",
      gender: me.gender || "",
      languages: [...(me.languages || [])],
      categories: [...(me.categories || [])],
      ig: {
        ...(me.platforms.instagram || {}),
        handle: ((me.platforms.instagram || {}).handle || "").replace(/^@/, ""),
      },
      yt: { ...(me.platforms.youtube || {}) },
      portfolio: (me.portfolio || []).map(w => ({ ...w })),
      price: {
        format: (me.startPrice && me.startPrice.format) || "",
        price: me.startPrice ? String(Math.round(me.startPrice.price / 100)) : "",
        days: me.startPrice && me.startPrice.deliveryDays ? String(me.startPrice.deliveryDays) : "",
      },
    };
  const D = d.current;
  const [, tick] = useState(0);
  const redraw = () => tick(n => n + 1);
  /* the edit sheet marks a field red with its message; it never set aria-invalid */
  const E0 = useErrors(),
    E = { ...E0, inv: () => undefined };
  const [ferr, setFerr] = useState(null);
  const box = useRef(null),
    photo = useRef(null),
    lt = useRef(null),
    lu = useRef(null);
  const f = id => (box.current ? box.current.querySelector("#pe-" + id) : null);
  const v = id => (f(id) || {}).value || "";
  useLayoutEffect(() => {
    const q = s => box.current.querySelector(s);
    const t = setTimeout(() => {
      if (at === "links") {
        q("[data-links]").scrollIntoView({ block: "start" });
        q("#pe-lt").focus({ preventScroll: true });
      } else if (at === "price" && q("[data-price]")) {
        q("[data-price]").scrollIntoView({ block: "start" });
        q("#pe-price-format").focus({ preventScroll: true });
      } else if (at === "langs") {
        const fs = q('[data-pf="langs"]');
        fs.scrollIntoView({ block: "start" });
        const first = fs.querySelector("button");
        first && first.focus({ preventScroll: true });
      }
    }, 60);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inp = (id, extra = {}) => ({
    id: "pe-" + id,
    "aria-invalid": E.inv(id),
    onInput: () => E.clear(id),
    ...extra,
  });

  const addLink = () => {
    const t = lt.current.value.trim(),
      u = lu.current.value.trim();
    const bad = [];
    if (!t) bad.push(["lt", "Give it a short title."]);
    const ue = V.url(u);
    if (ue) bad.push(["lu", ue]);
    if (!bad.length && D.portfolio.some(w => href(w.url).replace(/\/$/, "") === href(u).replace(/\/$/, "")))
      bad.push(["lu", "That link is already in your list."]);
    if (!bad.length && D.portfolio.length >= 8) bad.push(["lu", "Keep it to your best 8."]);
    if (bad.length) return E.show(bad);
    D.portfolio.push({ title: t, url: u.replace(/^https?:\/\//i, ""), platform: platOf(u), format: "" });
    lt.current.value = "";
    lu.current.value = "";
    flushSync(redraw);
    lt.current.focus();
  };

  const submit = e => {
    e.preventDefault();
    E.reset();
    const errs = [];
    const ne = V.name(v("name"));
    if (ne) errs.push(["name", ne]);
    const bn = [...v("bio").trim()].length;
    if (bn < 20) errs.push(["bio", "Add a line or two, at least 20 characters."]);
    else if (bn > BIO_MAX) errs.push(["bio", `${bn - BIO_MAX} characters over. Trim it to ${BIO_MAX}.`]);
    if (!D.region) errs.push(["region", "Choose your state or union territory."]);
    else if (!D.city) errs.push(["city", "Choose your city, or Other city to type it."]);
    else if (!/^[\p{L}][\p{L} .'-]{1,40}$/u.test(D.city))
      errs.push(["city", "Use the city name only, like Pune."]);
    const langs = D.languages;
    if (!langs.length) errs.push(["langs", "Pick at least one language."]);
    const ig = V.ig(v("ig-handle")),
      yt = V.yt(v("yt-handle"));
    if (ig.e) errs.push(["ig-handle", ig.e]);
    if (yt.e) errs.push(["yt-handle", yt.e]);
    if (!ig.e && !yt.e && !ig.h && !yt.h) errs.push(["ig-handle", "Keep at least one platform."]);
    [
      ["ig", ig],
      ["yt", yt],
    ].forEach(([kk, r]) => {
      if (!r.h) return;
      const fe = V.count(v(kk + "-followers"), true);
      if (fe) errs.push([kk + "-followers", fe]);
      const a = V.count(v(kk + "-avgViews"), false);
      if (a) errs.push([kk + "-avgViews", a]);
      const er = V.er(v(kk + "-er"));
      if (er) errs.push([kk + "-er", er]);
    });
    const pf = V.format(D.price.format),
      pa = V.price(D.price.price),
      pd = V.days(D.price.days);
    if (pf) errs.push(["price-format", pf]);
    if (pa) errs.push(["price-amount", pa]);
    if (pd) errs.push(["price-days", pd]);
    if (errs.length) {
      flushSync(() => E.show(errs));
      const x = box.current.querySelector(
        `[data-pf="${errs[0][0]}"] input, [data-pf="${errs[0][0]}"] textarea, [data-pf="${errs[0][0]}"] select`,
      );
      x && x.focus();
      return;
    }
    if (!navigator.onLine)
      return setFerr(
        "You're offline, so nothing was saved. Your edits are still here; try again when you're connected.",
      );
    const n = x => +String(x || "").replace(/[,\s]/g, "") || 0,
      day = new Date(LLD.today().getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
    const plat = (old, h, url, kk) => {
      const nv = {
        followers: n(v(kk + "-followers")),
        avgViews: n(v(kk + "-avgViews")),
        er: +String(v(kk + "-er")).replace("%", "") || 0,
      };
      const same =
        old &&
        old.handle === h &&
        old.followers === nv.followers &&
        old.avgViews === nv.avgViews &&
        old.er === nv.er;
      return h
        ? {
            handle: h,
            url,
            ...nv,
            updated: same ? old.updated : day,
            source: (old && old.source) || "Self-reported",
          }
        : { handle: "", url: "", followers: 0, avgViews: 0, er: 0, updated: day, source: "Self-reported" };
    };
    const ph = photo.current && photo.current.has() ? photo.current.exportURL() : null;
    const before = store.s.me.photo;
    const sp = store.s.me.startPrice;
    const price = { format: D.price.format, rupees: n(D.price.price), deliveryDays: n(D.price.days) };
    const priceChanged =
      !sp ||
      !sp.id ||
      sp.format !== price.format ||
      sp.price !== price.rupees * 100 ||
      sp.deliveryDays !== price.deliveryDays;
    store.set(s => {
      const m = s.me;
      m.name = v("name").trim().replace(/\s+/g, " ");
      m.bio = v("bio").trim();
      m.city = D.city;
      m.region = D.region;
      m.languages = langs;
      m.categories = [...D.categories];
      m.gender = D.gender;
      m.platforms.instagram = plat(
        m.platforms.instagram,
        ig.h ? "@" + ig.h : "",
        ig.h ? "instagram.com/" + ig.h : "",
        "ig",
      );
      m.platforms.youtube = plat(
        m.platforms.youtube,
        yt.h ? (yt.h.startsWith("@") ? yt.h : yt.h.split("/").pop()) : "",
        yt.h ? "youtube.com/" + yt.h : "",
        "yt",
      );
      m.handle = ig.h ? "@" + ig.h : yt.h || m.handle;
      m.portfolio = D.portfolio;
      m.photo = ph;
      m.startPrice = {
        id: (sp && sp.id) || "",
        format: price.format,
        platform: price.format === "Video" || price.format === "Short" ? "youtube" : "instagram",
        price: price.rupees * 100,
        deliveryDays: price.deliveryDays,
      };
    }, "profile-edited");
    if (LLD.live) {
      const m = store.s.me;
      /* the photo first: saveProfile reads the profile back, and that read must already see the new photo */
      const upload =
        ph && ph.startsWith("data:") && ph !== before
          ? import("@/shared/api/uploads")
              .then(u => LLD.live.uploadAvatar(u.dataUrlToBlob(ph)))
              .then(url => {
                if (url) store.set(s => (s.me.photo = url), "profile-edited");
              })
          : Promise.resolve();
      upload
        .then(() =>
          LLD.live.saveProfile({
            name: m.name,
            bio: m.bio,
            categories: m.categories,
            city: m.city,
            region: m.region,
            primaryPlatform:
              m.platforms.instagram && m.platforms.instagram.handle
                ? "instagram"
                : m.platforms.youtube && m.platforms.youtube.handle
                  ? "youtube"
                  : undefined,
            languages: m.languages,
            platforms: m.platforms,
            extras: { gender: m.gender, portfolio: m.portfolio },
          }),
        )
        .then(r => {
          /* C6: the screen shows what the server keeps; say plainly what it can't keep yet */
          if (r && r.unsaved && r.unsaved.length)
            LLD.toast(
              `Saved. Linkloom can't store your ${r.unsaved.join(" and ")} yet, so brands don't see them.`,
              "info",
            );
        })
        .catch(er => LLD.toast(LLD.live.errorText(er), "alert"));
      if (priceChanged)
        LLD.live
          .saveStartPrice(price)
          .then(() => done(false))
          .catch(er => {
            /* say it plainly and put back what the server has, so the screen never shows an unsaved price */
            store.set(s => (s.me.startPrice = sp === undefined ? null : sp), "profile-edited");
            done(false);
            LLD.toast("Your starting price wasn't saved. " + LLD.live.errorText(er), "alert");
          });
    }
    close();
    done(true);
    LLD.toast("Profile updated", "check");
  };

  const platRow = (k, name) => {
    const p = D[k];
    return (
      <fieldset className="profile-pe-plat">
        <legend className="t-label">
          <Icon n={k} />
          {name} <span className="pill pill-paper">Self-reported</span>
        </legend>
        <Fld id={k + "-handle"} label="Username or link" E={E}>
          <input
            className="input"
            defaultValue={p.handle || ""}
            autoComplete="off"
            spellCheck="false"
            {...inp(k + "-handle")}
          />
        </Fld>
        <div className="setup-metrics">
          <Fld id={k + "-followers"} label={k === "yt" ? "Subscribers" : "Followers"} E={E}>
            <input
              className="input num"
              inputMode="numeric"
              defaultValue={p.followers || ""}
              {...inp(k + "-followers")}
            />
          </Fld>
          <Fld id={k + "-avgViews"} label="Avg views" E={E}>
            <input
              className="input num"
              inputMode="numeric"
              defaultValue={p.avgViews || ""}
              {...inp(k + "-avgViews")}
            />
          </Fld>
          <Fld id={k + "-er"} label="Engagement %" E={E}>
            <input className="input num" inputMode="decimal" defaultValue={p.er || ""} {...inp(k + "-er")} />
          </Fld>
        </div>
      </fieldset>
    );
  };
  const bioN = [...(f("bio") ? f("bio").value : D.bio)].length;
  return (
    <form className="profile-pe" noValidate data-pe="" onSubmit={submit} ref={box}>
      <div data-ph="">
        <PhotoPicker
          src={me.photo}
          initials={initial((f("name") && f("name").value) || me.name)}
          api={photo}
          onChange={redraw}
        />
      </div>
      <Fld id="name" label="Display name" E={E}>
        <input
          className="input"
          defaultValue={D.name}
          autoComplete="name"
          {...inp("name", { onInput: () => (E.clear("name"), redraw()) })}
        />
      </Fld>
      <div className={`field${E.errs.bio != null ? " is-err" : ""}`} data-pf="bio">
        <div className="row between">
          <label className="lab" htmlFor="pe-bio">
            Short bio
          </label>
          <span
            className={`setup-count num${bioN > BIO_MAX - 20 && bioN <= BIO_MAX ? " is-near" : ""}${bioN > BIO_MAX ? " is-over" : ""}`}
            data-bioc=""
          >
            {bioN} / {BIO_MAX}
          </span>
        </div>
        <textarea
          className="textarea"
          rows={3}
          defaultValue={D.bio}
          {...inp("bio", { onInput: () => (E.clear("bio"), redraw()) })}
        />
        <p className="err" aria-live="polite">
          {E.errs.bio || ""}
        </p>
      </div>
      <PlaceFields
        attr="data-pf"
        pre="pe-"
        ids={false}
        region={D.region}
        city={D.city}
        E={E}
        onChange={(st, c) => {
          D.region = st;
          D.city = c;
          E.clear("city");
          E.clear("region");
          redraw();
        }}
      />
      <div className={`field setup-pickf${E.errs.langs != null ? " is-err" : ""}`} data-pf="langs">
        <p className="lab">Languages you create in</p>
        <div data-langpick="">
          <ChipPicker
            title="Languages you create in"
            sub="Every language your posts are in. Brands filter by these."
            groups={[{ label: "Languages", items: LANGS }]}
            value={D.languages}
            noun="languages"
            onChange={x => {
              D.languages = x;
              E.clear("langs");
              redraw();
            }}
          />
        </div>
        <p className="err" aria-live="polite">
          {E.errs.langs || ""}
        </p>
      </div>
      <div className={`field setup-pickf${E.errs.cats != null ? " is-err" : ""}`} data-pf="cats">
        <p className="lab">
          What you make <span className="setup-opt-l">up to {CAT_MAX}</span>
        </p>
        <div data-catpick="">
          <ChipPicker
            title="What you make"
            sub={`Pick up to ${CAT_MAX}. Brands search by these, so choose the ones most of your posts are about.`}
            groups={[
              ...NICHE_GROUPS,
              ...(D.categories.some(c => !CATS.includes(c))
                ? [{ label: "Yours", items: D.categories.filter(c => !CATS.includes(c)) }]
                : []),
            ]}
            value={D.categories}
            max={CAT_MAX}
            noun="niches"
            onChange={x => {
              D.categories = x;
              redraw();
            }}
          />
        </div>
        <p className="err" aria-live="polite">
          {E.errs.cats || ""}
        </p>
      </div>
      <fieldset className="setup-fs">
        <legend>
          Gender <span className="setup-opt-l">optional, never shown to brands</span>
        </legend>
        <div className="setup-opts">
          {GENDERS.map(g => (
            <label key={g} className="setup-opt">
              <input
                type="radio"
                name="pe-gender"
                value={g}
                defaultChecked={D.gender === g}
                onChange={() => (D.gender = g)}
              />
              <span>{g}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {platRow("ig", "Instagram")}
      {platRow("yt", "YouTube")}
      <PriceFields attr="data-pf" pre="pe-" ids={false} d={D.price} E={E} />
      <fieldset className="setup-fs" data-links="">
        <legend>Selected work</legend>
        <ul className="profile-pe-links" data-linklist="">
          {D.portfolio.length ? (
            D.portfolio.map((w, i) => (
              <li key={i}>
                <span className="profile-pe-lt">
                  <b>{w.title}</b>
                  <span>{w.url}</span>
                </span>
                <button
                  type="button"
                  className="btn-q"
                  data-rm={i}
                  onClick={() => {
                    D.portfolio.splice(i, 1);
                    flushSync(redraw);
                    lt.current.focus();
                  }}
                >
                  Remove<span className="sr-only"> {w.title}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="muted">No links yet.</li>
          )}
        </ul>
        <div className="profile-pe-add">
          <Fld id="lt" label="Title" E={E}>
            <input
              className="input"
              placeholder="30 days with a ceramide moisturiser"
              ref={lt}
              {...inp("lt")}
            />
          </Fld>
          <Fld id="lu" label="Link" E={E}>
            <input
              className="input"
              inputMode="url"
              spellCheck="false"
              placeholder="instagram.com/reel/…"
              ref={lu}
              {...inp("lu")}
            />
          </Fld>
          <Lq className="lq-s lq-sm" data-addlink="" onClick={addLink}>
            <Icon n="plus" className="ic" />
            Add link
          </Lq>
        </div>
      </fieldset>
      <p className="setup-formerr" role="alert" data-pe-err="" hidden={ferr === null}>
        {ferr || ""}
      </p>
      <div className="profile-pe-f">
        <Lq className="lq-p" type="submit" data-save="">
          Save changes
        </Lq>
        <Lq className="lq-s" data-cancel="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}

/** `at`: "links" scrolls to Selected work, "langs" to the languages (C7's "Add languages"), "price" to the price.
    `done(saved)` redraws the profile: after a save, and again once the starting price is saved or put back. */
export function openEdit(at, done) {
  openReactSheet({
    title: "Edit profile",
    wide: true,
    render: close => <EditSheet at={at} close={close} done={done} />,
  });
}
