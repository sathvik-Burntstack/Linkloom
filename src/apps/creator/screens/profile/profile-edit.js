/* The creator's Edit profile sheet, opened from the profile screen (profile.jsx). Builder A.
   It is built from the setup screen's widgets (LLA.photo, LLA.chipPicker, LLA.wirePlace, LLA.V from setup.js),
   so it stays a plain DOM sheet until setup.js moves to React. */
const { esc, icon, store } = LLD;
const href = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
const platOf = u =>
  /instagram\.com/i.test(u) ? "instagram" : /youtube\.com|youtu\.be/i.test(u) ? "youtube" : "web";
const initial = n => (String(n || "").trim()[0] || "?").toUpperCase();

/* ---------- edit profile sheet ---------- */
/** `at`: "links" scrolls to Selected work, "langs" to the languages (C7's "Add languages").
    `done(saved)` redraws the profile: after a save, and again once the starting price is saved or put back. */
export function openEdit(at, done) {
  const A = window.LLA || {},
    V = A.V;
  if (!V || !A.photo) {
    LLD.toast("Editing is unavailable right now. Reload and try again.", "alert");
    return;
  }
  const me = store.s.me;
  const d = {
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
  const opt = (type, name, val, on) =>
    `<label class="setup-opt"><input type="${type}" name="${name}" value="${esc(val)}" ${on ? "checked" : ""}><span>${esc(val)}</span></label>`;
  const fld = (id, label, input, help = "") =>
    `<div class="field" data-pf="${id}"><label for="pe-${id}">${label}</label>${input}${help ? `<p class="help">${help}</p>` : ""}<p class="err" aria-live="polite"></p></div>`;
  const platRow = (k, name) => `
    <fieldset class="profile-pe-plat"><legend class="t-label">${icon(k)}${name} <span class="pill pill-paper">Self-reported</span></legend>
      ${fld(k + "-handle", "Username or link", `<input class="input" id="pe-${k}-handle" value="${esc(d[k].handle || "")}" autocomplete="off" spellcheck="false">`)}
      <div class="setup-metrics">
        ${fld(k + "-followers", k === "yt" ? "Subscribers" : "Followers", `<input class="input num" id="pe-${k}-followers" inputmode="numeric" value="${esc(d[k].followers || "")}">`)}
        ${fld(k + "-avgViews", "Avg views", `<input class="input num" id="pe-${k}-avgViews" inputmode="numeric" value="${esc(d[k].avgViews || "")}">`)}
        ${fld(k + "-er", "Engagement %", `<input class="input num" id="pe-${k}-er" inputmode="decimal" value="${esc(d[k].er || "")}">`)}
      </div>
    </fieldset>`;
  const body = `
    <form class="profile-pe" novalidate data-pe>
      <div data-ph></div>
      ${fld("name", "Display name", `<input class="input" id="pe-name" value="${esc(d.name)}" autocomplete="name">`)}
      <div class="field" data-pf="bio"><div class="row between"><label class="lab" for="pe-bio">Short bio</label><span class="setup-count num" data-bioc></span></div>
        <textarea class="textarea" id="pe-bio" rows="3">${esc(d.bio)}</textarea><p class="err" aria-live="polite"></p></div>
      ${A.placeFields(fld, "pe-", d.region, d.city)}
      <div class="field setup-pickf" data-pf="langs"><p class="lab">Languages you create in</p><div data-langpick></div><p class="err" aria-live="polite"></p></div>
      <div class="field setup-pickf" data-pf="cats"><p class="lab">What you make <span class="setup-opt-l">up to ${A.CAT_MAX}</span></p><div data-catpick></div><p class="err" aria-live="polite"></p></div>
      <fieldset class="setup-fs"><legend>Gender <span class="setup-opt-l">optional, never shown to brands</span></legend><div class="setup-opts">${A.GENDERS.map(g => opt("radio", "pe-gender", g, d.gender === g)).join("")}</div></fieldset>
      ${platRow("ig", "Instagram")}${platRow("yt", "YouTube")}
      ${A.priceFields ? A.priceFields(fld, "pe-", d.price) : ""}
      <fieldset class="setup-fs" data-links><legend>Selected work</legend><ul class="profile-pe-links" data-linklist></ul>
        <div class="profile-pe-add">
          ${fld("lt", "Title", `<input class="input" id="pe-lt" placeholder="30 days with a ceramide moisturiser">`)}
          ${fld("lu", "Link", `<input class="input" id="pe-lu" inputmode="url" spellcheck="false" placeholder="instagram.com/reel/…">`)}
          <button type="button" class="lq lq-s lq-sm" data-addlink>${icon("plus", "ic")}Add link</button>
        </div>
      </fieldset>
      <p class="setup-formerr" role="alert" data-pe-err hidden></p>
      <div class="profile-pe-f"><button class="lq lq-p" type="submit" data-save>Save changes</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
    </form>`;
  let picker = null;
  LLD.openSheet({
    title: "Edit profile",
    wide: true,
    body,
    onMount(b, close) {
      const q = s => b.querySelector(s);
      picker = A.photo(q("[data-ph]"), {
        src: me.photo,
        initials: () => initial(q("#pe-name").value || me.name),
      });
      const sheet = b.closest(".sheet");
      const obs = new MutationObserver(() => {
        if (!sheet.isConnected) {
          picker && picker.destroy();
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true });
      const bio = q("#pe-bio"),
        bc = q("[data-bioc]");
      const count = () => {
        const n = [...bio.value].length;
        bc.textContent = `${n} / ${A.BIO_MAX}`;
        bc.classList.toggle("is-near", n > A.BIO_MAX - 20 && n <= A.BIO_MAX);
        bc.classList.toggle("is-over", n > A.BIO_MAX);
      };
      bio.addEventListener("input", count);
      count();
      /* niches and languages: chosen ones as chips, a button opens the picker */
      A.chipPicker(q("[data-catpick]"), {
        title: "What you make",
        sub: `Pick up to ${A.CAT_MAX}. Brands search by these, so choose the ones most of your posts are about.`,
        groups: [
          ...A.NICHE_GROUPS,
          ...(d.categories.some(c => !A.CATS.includes(c))
            ? [{ label: "Yours", items: d.categories.filter(c => !A.CATS.includes(c)) }]
            : []),
        ],
        get: () => d.categories,
        set: v => (d.categories = v),
        max: A.CAT_MAX,
        noun: "niches",
      });
      A.chipPicker(q("[data-langpick]"), {
        title: "Languages you create in",
        sub: "Every language your posts are in. Brands filter by these.",
        groups: [{ label: "Languages", items: A.LANGS }],
        get: () => d.languages,
        set: v => {
          d.languages = v;
          clear(q('[data-pf="langs"]'));
        },
        noun: "languages",
      });
      const place = A.wirePlace(b, "pe-", () => {
        clear(q('[data-pf="city"]'));
        clear(q('[data-pf="region"]'));
      });
      const clear = f => {
        f.classList.remove("is-err");
        const e = f.querySelector(".err");
        if (e) e.textContent = "";
      };
      b.querySelectorAll("[data-pf] input,[data-pf] select,[data-pf] textarea").forEach(i =>
        i.addEventListener("input", () => clear(i.closest("[data-pf]"))),
      );
      const errAt = (id, msg) => {
        const f = q(`[data-pf="${id}"]`);
        if (!f) return;
        f.classList.add("is-err");
        const e = f.querySelector(".err");
        if (e) e.textContent = msg;
      };

      const links = () => {
        q("[data-linklist]").innerHTML = d.portfolio.length
          ? d.portfolio
              .map(
                (w, i) =>
                  `<li><span class="profile-pe-lt"><b>${esc(w.title)}</b><span>${esc(w.url)}</span></span><button type="button" class="btn-q" data-rm="${i}">Remove<span class="sr-only"> ${esc(w.title)}</span></button></li>`,
              )
              .join("")
          : '<li class="muted">No links yet.</li>';
        b.querySelectorAll("[data-rm]").forEach(x =>
          x.addEventListener("click", () => {
            d.portfolio.splice(+x.dataset.rm, 1);
            links();
            q("#pe-lt").focus();
          }),
        );
      };
      links();
      q("[data-addlink]").addEventListener("click", () => {
        const t = q("#pe-lt").value.trim(),
          u = q("#pe-lu").value.trim();
        let bad = false;
        if (!t) {
          errAt("lt", "Give it a short title.");
          bad = true;
        }
        const ue = V.url(u);
        if (ue) {
          errAt("lu", ue);
          bad = true;
        }
        if (!bad && d.portfolio.some(w => href(w.url).replace(/\/$/, "") === href(u).replace(/\/$/, ""))) {
          errAt("lu", "That link is already in your list.");
          bad = true;
        }
        if (!bad && d.portfolio.length >= 8) {
          errAt("lu", "Keep it to your best 8.");
          bad = true;
        }
        if (bad) return;
        d.portfolio.push({
          title: t,
          url: u.replace(/^https?:\/\//i, ""),
          platform: platOf(u),
          format: "",
        });
        q("#pe-lt").value = "";
        q("#pe-lu").value = "";
        links();
        q("#pe-lt").focus();
      });
      q("[data-cancel]").addEventListener("click", () => close());
      if (at === "links")
        setTimeout(() => {
          q("[data-links]").scrollIntoView({ block: "start" });
          q("#pe-lt").focus({ preventScroll: true });
        }, 60);
      else if (at === "price" && q("[data-price]"))
        setTimeout(() => {
          q("[data-price]").scrollIntoView({ block: "start" });
          q("#pe-price-format").focus({ preventScroll: true });
        }, 60);
      else if (at === "langs")
        setTimeout(() => {
          const fs = q('[data-pf="langs"]');
          fs.scrollIntoView({ block: "start" });
          const first = fs.querySelector("button");
          first && first.focus({ preventScroll: true });
        }, 60);

      q("[data-pe]").addEventListener("submit", e => {
        e.preventDefault();
        b.querySelectorAll("[data-pf].is-err").forEach(clear);
        const v = id => q("#pe-" + id).value;
        const errs = [];
        const ne = V.name(v("name"));
        if (ne) errs.push(["name", ne]);
        const bn = [...v("bio").trim()].length;
        if (bn < 20) errs.push(["bio", "Add a line or two, at least 20 characters."]);
        else if (bn > A.BIO_MAX)
          errs.push(["bio", `${bn - A.BIO_MAX} characters over. Trim it to ${A.BIO_MAX}.`]);
        if (!v("region")) errs.push(["region", "Choose your state or union territory."]);
        else if (!place.city()) errs.push(["city", "Choose your city, or Other city to type it."]);
        else if (!/^[\p{L}][\p{L} .'-]{1,40}$/u.test(place.city()))
          errs.push(["city", "Use the city name only, like Pune."]);
        const langs = d.languages;
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
          const f = V.count(v(kk + "-followers"), true);
          if (f) errs.push([kk + "-followers", f]);
          const a = V.count(v(kk + "-avgViews"), false);
          if (a) errs.push([kk + "-avgViews", a]);
          const er = V.er(v(kk + "-er"));
          if (er) errs.push([kk + "-er", er]);
        });
        const hasPrice = !!q("[data-price]");
        if (hasPrice) {
          const pf = V.format(v("price-format")),
            pa = V.price(v("price-amount")),
            pd = V.days(v("price-days"));
          if (pf) errs.push(["price-format", pf]);
          if (pa) errs.push(["price-amount", pa]);
          if (pd) errs.push(["price-days", pd]);
        }
        if (errs.length) {
          errs.forEach(x => errAt(x[0], x[1]));
          const f = q(
            `[data-pf="${errs[0][0]}"] input, [data-pf="${errs[0][0]}"] textarea, [data-pf="${errs[0][0]}"] select`,
          );
          f && f.focus();
          return;
        }
        if (!navigator.onLine) {
          const fe = q("[data-pe-err]");
          fe.hidden = false;
          fe.textContent =
            "You're offline, so nothing was saved. Your edits are still here; try again when you're connected.";
          return;
        }
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
            : {
                handle: "",
                url: "",
                followers: 0,
                avgViews: 0,
                er: 0,
                updated: day,
                source: "Self-reported",
              };
        };
        const photo = picker && picker.has() ? picker.exportURL() : null;
        const before = store.s.me.photo;
        const sp = store.s.me.startPrice;
        const price = hasPrice
          ? {
              format: v("price-format"),
              rupees: n(v("price-amount")),
              deliveryDays: n(v("price-days")),
            }
          : null;
        const priceChanged =
          price &&
          (!sp ||
            !sp.id ||
            sp.format !== price.format ||
            sp.price !== price.rupees * 100 ||
            sp.deliveryDays !== price.deliveryDays);
        store.set(s => {
          const m = s.me;
          m.name = v("name").trim().replace(/\s+/g, " ");
          m.bio = v("bio").trim();
          m.city = place.city();
          m.region = v("region");
          m.languages = langs;
          m.categories = [...d.categories];
          const g = b.querySelector("input[name=pe-gender]:checked");
          m.gender = g ? g.value : "";
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
          m.portfolio = d.portfolio;
          m.photo = photo;
          if (price)
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
            photo && photo.startsWith("data:") && photo !== before
              ? import("@/shared/api/uploads")
                  .then(u => LLD.live.uploadAvatar(u.dataUrlToBlob(photo)))
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
      });
    },
  });
}
