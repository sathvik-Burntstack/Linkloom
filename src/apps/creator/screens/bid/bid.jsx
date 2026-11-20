/* Bid form (#bid-<id>): a bid slip with live payout receipt, every validation, final summary sheet.
   Sending needs verified KYC; the draft survives the KYC detour in LLD_DATA.bidDrafts. Owner: Builder B.
   C10 trial (flags.js BID_BEFORE_KYC): the bid is sent without the ID check, which is asked for once a brand accepts.
   TODO(backend): accept bids from unverified creators; block payout until the ID check is approved.
   React screen (see src/shared/react/view.jsx). The price and views boxes stay uncontrolled: they regroup the digits
   as you type (Indian grouping) and keep the caret where it was, counted from the right. */
import { BrandChip, Glyph, StatusPill } from "../../ui/brief-card";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BID_BEFORE_KYC } from "../../flags";
import { openKyc } from "../../core/kyc-gate";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD;
const SS_KEY = "ll.bidDrafts";
const digits = v =>
  String(v ?? "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
const group = d => (d ? Number(d).toLocaleString("en-IN") : "");
const addDays = (iso, n) => {
  const d = new Date(iso + "T12:00:00+05:30");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};
const daysBetween = (a, b) =>
  Math.round((new Date(b + "T12:00:00+05:30") - new Date(a + "T12:00:00+05:30")) / 864e5);

/* URL check: accepts "instagram.com/reel/x" or a full https:// link; needs a real-looking host */
function checkUrl(raw) {
  const v = String(raw || "").trim();
  if (!v) return { empty: true };
  if (/\s/.test(v) || /^(javascript|data|file):/i.test(v)) return { ok: false };
  const withP = /^https?:\/\//i.test(v) ? v : "https://" + v;
  try {
    const u = new URL(withP);
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)) return { ok: false };
    return {
      ok: true,
      href: u.href,
      short:
        u.hostname.replace(/^www\./, "") +
        (u.pathname.length > 1 ? u.pathname.replace(/\/$/, "") : "") +
        u.search,
    };
  } catch (e) {
    return { ok: false };
  }
}

const saveDrafts = () => {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(LLD_DATA.bidDrafts || {}));
  } catch (e) {}
};
try {
  const raw = sessionStorage.getItem(SS_KEY);
  if (raw) LLD_DATA.bidDrafts = Object.assign({}, JSON.parse(raw), LLD_DATA.bidDrafts || {});
} catch (e) {}

const KYC_BANNER = {
  not_started: [
    "pill-paper",
    "ID not verified",
    "Verify your ID once to send bids. Your draft stays right here.",
    "Verify ID",
  ],
  in_progress: [
    "pill-info",
    "Verification in progress",
    "Finish verification to send this bid. Your draft is saved.",
    "Continue verification",
  ],
  under_review: [
    "pill-info",
    "Under review",
    "Your ID is being checked. Finish the draft now and send it once you are verified.",
    "See status",
  ],
  action_needed: ["pill-warn", "Action needed", "Verification needs one fix before you can send.", "Fix it"],
  rejected: [
    "pill-err",
    "Not approved",
    "Verification was not approved. See what to change, then send.",
    "See what to fix",
  ],
};
const NAMES = {
  price: "your price",
  why: "why this price",
  post: "post date",
  views: "expected views",
  links: "similar work",
  linkItems: "a link",
};

/* ---------- the "Check your bid" sheet ---------- */
function Review({ j, d, price, pd, views, why, maxDate, save, close }) {
  const K = L.jobkit,
    p = L.payout(price);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef(null),
    sendBtn = useRef(null);
  useEffect(() => {
    K.mo("stagger", L.$$(".bid-rv > *", box.current));
    K.mo("print", box.current.querySelector(".bid-rv-rc"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const links = d.links.map(checkUrl).filter(c => c.ok);
  const uniq = [...new Map(links.map(c => [c.href, c])).values()];
  const kycNow = LLD_DATA.kyc.status,
    ok = kycNow === "verified" || BID_BEFORE_KYC,
    later = kycNow !== "verified"; // only reachable unverified with the C10 trial on
  const lead = daysBetween(pd, maxDate);
  const sent = nb =>
    L.store.set(st => {
      st.bids = st.bids.filter(x => x.id !== nb.id);
      st.bids.unshift(nb);
      const jj = st.jobs.find(x => x.id === j.id);
      if (jj) jj.bids += 1;
      if (st.me) st.me.totalBids = (st.me.totalBids || 0) + 1;
      delete st.bidDrafts[j.id];
      st.justSent = nb.id;
    }, "bid-sent");
  const send = () => {
    if (LLD_DATA.kyc.status !== "verified" && !BID_BEFORE_KYC)
      return setErr("Verify your ID before sending.");
    if (!navigator.onLine)
      return setErr("You are offline. Your bid is saved here; send it when you are back online.");
    flushSync(() => setBusy(true));
    if (L.live) {
      setErr("");
      L.live
        .placeBid(j.id, {
          price,
          why,
          views: views ? Number(views) : null,
          postDate: pd,
          links: uniq.map(c => c.href),
        })
        .then(nb => {
          sent(nb);
          saveDrafts();
          K.mo("celebrate", sendBtn.current);
          close(true);
          L.go("#bids");
        })
        .catch(er => {
          setBusy(false);
          save();
          if (er && er.code === "KYC_REQUIRED") {
            /* the server still wants the ID check first (with the C10 trial on, until the backend allows it):
               straight to #kyc, not through the gate, which would open this form again */
            close(true);
            if (BID_BEFORE_KYC) L.toast("Verify your ID to send this bid. Your draft is saved.", "shield");
            openKyc("#bid-" + j.id);
            return;
          }
          setErr(L.live.errorText(er));
        });
      return;
    }
    sent({
      id: "b" + Date.now().toString(36),
      job: j.id,
      price,
      status: "submitted",
      sent: L.today().toISOString(),
      note: "Waiting for the brand to review.",
      postDate: pd,
      views: views ? Number(views) : null,
      why,
      links: uniq.map(c => c.href),
    });
    saveDrafts();
    K.mo("celebrate", sendBtn.current);
    close(true);
    L.go("#bids");
  };
  return (
    <div className="bid-rv" ref={box}>
      <div className="bid-rv-slip">
        <div className="job-src">
          <BrandChip j={j} />
          <span className="t-small muted">{j.title}</span>
        </div>
        <p className="bid-rv-lab">Your price</p>
        <p className="t-money bid-rv-price">{L.inr(price)}</p>
        <dl className="bid-rv-kv">
          <div className="kv">
            <dt>Post date</dt>
            <dd>
              {L.fmtDate(pd, { year: true })}
              <span className="muted"> · {lead === 0 ? "deadline day" : lead + " days early"}</span>
            </dd>
          </div>
          <div className="kv">
            <dt>Expected views</dt>
            <dd>
              {views ? (
                <>
                  {group(views)}
                  <span className="muted"> · your estimate</span>
                </>
              ) : (
                <span className="muted">Not given</span>
              )}
            </dd>
          </div>
          <div className="kv">
            <dt>Similar work</dt>
            <dd>
              <ul className="bid-rv-links">
                {uniq.map(c => (
                  <li key={c.href}>{c.short}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
        <div className="bid-rv-why">
          <p className="bid-rv-lab">Why this price</p>
          <p>{why}</p>
        </div>
      </div>
      <div className="bid-rv-rc ink-card">
        <dl>
          <div className="bid-rv-net">
            <dt>You receive</dt>
            <dd>
              <span className="t-money">{L.inr(p.net)}</span>
            </dd>
          </div>
          <div>
            <dt>Tax / withholding</dt>
            <dd>As per confirmed rules</dd>
          </div>
        </dl>
        <p className="bid-rv-s">The agreed price, in full. Tax as per confirmed rules.</p>
      </div>
      <p className="help bid-rv-rule">
        <Icon n="info" />
        You can withdraw until the brand accepts. Once accepted, the price and post date are locked.
      </p>
      {ok && later ? (
        <p className="bid-rv-kyc is-ok">
          <Icon n="info" />
          No ID check needed to send. If the brand accepts, you verify your ID once (about 4 minutes) to
          start.
        </p>
      ) : ok ? (
        <p className="bid-rv-kyc is-ok">
          <Icon n="check" />
          ID verified
        </p>
      ) : (
        <div className="bid-rv-kyc is-no">
          <Icon n="shield" />
          <span>Verify your ID to send. Your draft is saved.</span>
          <Lq
            className="lq-s lq-sm"
            data-kyc2=""
            onClick={() => {
              save();
              L.kycGate(j.id);
            }}
          >
            Verify ID
          </Lq>
        </div>
      )}
      <p className="err" id="bidSendErr" aria-live="assertive">
        {err}
      </p>
      <div className="bid-rv-acts">
        <Lq
          className="lq-p"
          data-send=""
          ref={sendBtn}
          disabled={!ok || busy}
          aria-disabled={ok ? undefined : "true"}
          aria-busy={busy && L.live ? "true" : undefined}
          onClick={send}
        >
          <Icon n="send" className="ic" />
          Send bid
        </Lq>
        <Lq className="lq-s" data-edit="" onClick={() => close()}>
          Keep editing
        </Lq>
      </div>
      <p className="ll-trust bid-rv-trust">
        <Icon n="lock" />
        The brand sees your price and note. Never your ID or payout details.
      </p>
    </div>
  );
}

/* ---------- the bid form ---------- */
function BidForm({ j }) {
  const K = L.jobkit,
    s = K.ensure(),
    R = s.bidRules;
  const [, redraw] = useState(0);
  const draw = () => flushSync(() => redraw(n => n + 1));
  const [live, setLive] = useState("");
  const today = K.todayISO(),
    minDate = addDays(today, 1),
    maxDate = j.deadline;
  const maxPaise = Math.round((j.budget * (1 + R.overBudgetPct / 100)) / 100) * 100;
  const pf = s.me.platforms[j.platform];
  const portfolio = (s.me.portfolio || []).map(p => ({ ...p, chk: checkUrl(p.url) })).filter(p => p.chk.ok);
  const d =
    s.bidDrafts[j.id] || (s.bidDrafts[j.id] = { price: "", why: "", views: "", postDate: "", links: [""] });
  if (!d.links || !d.links.length) d.links = [""];
  const kyc = s.kyc.status,
    verified = kyc === "verified" || BID_BEFORE_KYC; // the trial asks for the ID check after acceptance instead
  const kb = KYC_BANNER[kyc] || KYC_BANNER.not_started;
  const st = useRef(null);
  if (!st.current) {
    /* returning to a draft (for example after KYC): show where it stands */
    const touched = new Set();
    if (d.price) touched.add("price");
    if (d.why) touched.add("why");
    if (d.postDate) touched.add("post");
    st.current = { touched, tried: false, typed: false, focusLink: undefined, liveT: 0 };
  }
  const { touched } = st.current;
  const root = useRef(null),
    priceIn = useRef(null),
    whyIn = useRef(null),
    postIn = useRef(null),
    viewsIn = useRef(null),
    linksUl = useRef(null),
    addBtn = useRef(null),
    netEl = useRef(null),
    dockEl = useRef(null);

  /* the boxes' current text (before mount: the draft's) */
  const vals = () => ({
    price: priceIn.current ? priceIn.current.value : group(d.price),
    why: whyIn.current ? whyIn.current.value : d.why,
    post: postIn.current ? postIn.current.value : d.postDate,
    views: viewsIn.current ? viewsIn.current.value : group(d.views),
  });
  const readPrice = () => {
    const dg = digits(vals().price);
    return dg ? L.rupees(Number(dg)) : 0;
  };
  const save = () => {
    const v = vals();
    d.price = digits(v.price);
    d.why = v.why;
    d.postDate = v.post;
    d.views = digits(v.views);
    saveDrafts();
  };

  /* ---------- validation ---------- */
  function errors() {
    const e = {},
      v = vals();
    const price = readPrice();
    if (!price) e.price = "Enter your price in rupees.";
    else if (price < R.minPaise) e.price = `The lowest bid on Linkloom is ${L.inr(R.minPaise)}.`;
    else if (price > maxPaise) e.price = `This brand takes bids up to ${L.inr(maxPaise)}.`;
    const why = v.why.trim();
    if (!why) e.why = "Tell the brand why this price is fair.";
    else if (why.length < R.whyMin)
      e.why = `Add ${R.whyMin - why.length} more characters. Say what the brand gets for this price.`;
    const pd = v.post;
    if (!pd) e.post = "Pick the day you will post.";
    else if (pd < minDate) e.post = `Pick a date from ${L.fmtDate(minDate)} onwards.`;
    else if (pd > maxDate)
      e.post = `The brand needs it live by ${L.fmtDate(maxDate)}. Pick that day or earlier.`;
    const vd = digits(v.views);
    if (v.views.trim() && !vd) e.views = "Use a whole number, like 60,000.";
    else if (vd && Number(vd) > 1e8) e.views = "That is more than 10 crore views. Check the number.";
    const linkErr = {};
    const seen = new Set();
    let good = 0;
    d.links.forEach((x, i) => {
      const c = checkUrl(x);
      if (c.empty) return;
      if (!c.ok) linkErr[i] = "Enter a full link, like instagram.com/reel/abc.";
      else if (seen.has(c.href)) linkErr[i] = "You added this link already.";
      else {
        seen.add(c.href);
        good++;
      }
    });
    if (!good && !Object.keys(linkErr).length) e.links = "Add at least one link to similar work.";
    if (Object.keys(linkErr).length) e.linkItems = linkErr;
    return e;
  }

  /* ---------- receipt: the total ticks to the new amount in Indian grouping (LLD.motion.count) ---------- */
  function tick(node, to) {
    if (!node) return;
    if (L.motion && L.motion.ready && !L.RM) K.mo("count", node, to, L.inr, { duration: 320 });
    else node.textContent = L.inr(to);
    if (!L.RM && node.dataset.v !== undefined && +node.dataset.v !== to) {
      node.classList.remove("is-tick");
      void node.offsetWidth;
      node.classList.add("is-tick");
    }
    node.dataset.v = to;
  }
  function receipt() {
    const p = L.payout(readPrice());
    /* no price typed yet: show a quiet dash, not "₹0" */
    [netEl.current, dockEl.current].forEach(n => {
      if (!n) return;
      if (p.price) tick(n, p.net);
      else {
        n.textContent = "₹ —";
        delete n.dataset.v;
      }
    });
    clearTimeout(st.current.liveT);
    st.current.liveT = setTimeout(
      () =>
        setLive(p.price ? `You receive ${L.inr(p.net)}, the agreed price. Tax as per confirmed rules.` : ""),
      700,
    );
  }

  /* format money-like inputs as you type (Indian grouping), caret kept from the right */
  function grouped(inp, maxDigits) {
    const fromRight = inp.value.length - (inp.selectionEnd ?? inp.value.length);
    const dg = digits(inp.value).slice(0, maxDigits);
    inp.value = group(dg);
    const pos = Math.max(0, inp.value.length - fromRight);
    try {
      inp.setSelectionRange(pos, pos);
    } catch (e) {}
  }

  useLayoutEffect(() => {
    receipt();
    K.mo("stagger", L.$$(".bid-sec, .bid-receipt", root.current));
    K.mo("press", root.current.querySelector(".bid-review-btn"));
    return () => {
      save();
      clearTimeout(st.current.liveT);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const f = st.current.focusLink;
    if (f === undefined) return;
    st.current.focusLink = undefined;
    const i = linksUl.current.querySelector("#bidL" + f);
    i && i.focus();
  });

  const blur = k => () => {
    touched.add(k);
    draw();
  };
  const linksChanged = focusIdx => {
    save();
    st.current.focusLink = focusIdx;
    draw();
  };
  function review() {
    st.current.tried = true;
    const keys = Object.keys(errors());
    draw();
    if (keys.length) {
      const first = {
        price: priceIn.current,
        why: whyIn.current,
        post: postIn.current,
        views: viewsIn.current,
        links: linksUl.current.querySelector("input"),
        linkItems: linksUl.current.querySelector(".bid-link.is-err input"),
      }[keys[0]];
      first && first.focus();
      return;
    }
    const v = vals();
    openReactSheet({
      title: "Check your bid",
      render: close => (
        <Review
          j={j}
          d={d}
          price={readPrice()}
          pd={v.post}
          views={digits(v.views)}
          why={v.why.trim()}
          maxDate={maxDate}
          save={save}
          close={close}
        />
      ),
    });
  }

  /* what the form shows: errors only for touched fields until the first Review, then for all */
  const { tried } = st.current;
  const e = errors(),
    v = vals(),
    price = readPrice();
  const show = k => tried || touched.has(k);
  /* the boxes carry aria-invalid once the form has been checked (the first price keystroke, blur or Review) */
  const checked = tried || st.current.typed || touched.size > 0;
  const inv = bad => (checked ? String(bad) : undefined);
  const msg = k => (show(k) ? e[k] || "" : "");
  const linkMsg = i => (show("links") && e.linkItems ? e.linkItems[i] || "" : "");
  const sumKeys = tried ? Object.keys(e) : [];
  const nWhy = v.why.length;
  const have = new Set(d.links.map(x => checkUrl(x).href || ""));
  const portLeft = portfolio.filter(p => !have.has(p.chk.href));
  const postHelp =
    !e.post && v.post
      ? `${L.fmtDate(v.post)} is ${daysBetween(v.post, maxDate) === 0 ? "the deadline day" : daysBetween(v.post, maxDate) + " days before the deadline"}.`
      : `Live by ${L.fmtDate(maxDate)}, the brand's deadline.`;

  return (
    <div className="view-in bid" ref={root}>
      <a className="btn-q bid-back" href={`#job-${j.id}`}>
        <Icon n="back" />
        Back to the collab
      </a>
      <header className="bid-h">
        <div className="job-src">
          <BrandChip j={j} />
          <span className="jobs-plat">
            <Glyph p={j.platform} />
            <span>
              {K.platName(j.platform)} {j.format}
            </span>
          </span>
        </div>
        <h1 className="t-h1">Your bid for {j.title}</h1>
        <p className="muted t-small">
          {[
            `Budget ${L.inr(j.budget)}`,
            `post by ${L.fmtDate(j.deadline)}`,
            j.bids > 0 ? `${j.bids} ${j.bids === 1 ? "bid" : "bids"} so far` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          <span className="sample bid-h-s">
            {" "}
            · <span className="sample">Sample collab</span>
          </span>
        </p>
      </header>
      {verified ? null : (
        <div className="bid-kyc" role="status">
          <img src="assets/trust-id-card.svg" width="72" height="56" alt="" />
          <div className="bid-kyc-t">
            <span className={`pill ${kb[0]}`}>
              {kb[0] === "pill-err" ? <Icon n="alert" /> : null}
              {kb[1]}
            </span>
            <p>{(/action_needed|rejected/.test(kyc) && s.kyc.note) || kb[2]}</p>
          </div>
          <div className="bid-kyc-a">
            <Lq
              className="lq-s lq-sm"
              data-kyc=""
              onClick={() => {
                save();
                L.kycGate(j.id);
              }}
            >
              <Icon n="lock" className="ic" />
              {kb[3]}
            </Lq>
            <p className="ll-trust">
              <Icon n="lock" />
              Encrypted. Never shown to brands.
            </p>
          </div>
        </div>
      )}
      <div className="bid-layout">
        <form
          className="bid-slip"
          id="bidForm"
          noValidate
          onSubmit={ev => {
            ev.preventDefault();
            review();
          }}
        >
          <section className="bid-sec" aria-labelledby="bidPriceL">
            <span className="bid-n" aria-hidden="true">
              01
            </span>
            <div className={`field${msg("price") ? " is-err" : ""}`} id="fPrice">
              <label id="bidPriceL" htmlFor="bidPrice">
                Your price
              </label>
              <div className="money-in bid-money">
                <span aria-hidden="true">₹</span>
                <input
                  id="bidPrice"
                  name="price"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={11}
                  placeholder={group(String(Math.round(j.budget / 100)))}
                  defaultValue={group(d.price)}
                  aria-describedby="bidPriceHelp bidPriceErr bidPriceWarn"
                  aria-invalid={inv(!!(e.price && tried))}
                  ref={priceIn}
                  onInput={ev => {
                    grouped(ev.currentTarget, 8);
                    st.current.typed = true;
                    receipt();
                    save();
                    draw();
                  }}
                  onBlur={blur("price")}
                />
                {[
                  [-500, "minus", "Lower by ₹500"],
                  [500, "plus", "Raise by ₹500"],
                ].map(([n, ic, lab]) => (
                  <button
                    key={n}
                    className="bid-step"
                    type="button"
                    data-step={n}
                    aria-label={lab}
                    onClick={ev => {
                      const cur = Number(digits(priceIn.current.value)) || j.budget / 100;
                      priceIn.current.value = group(String(Math.max(0, cur + n)));
                      touched.add("price");
                      receipt();
                      save();
                      draw();
                      K.mo("press", ev.currentTarget);
                    }}
                  >
                    <Icon n={ic} />
                  </button>
                ))}
              </div>
              <p className="help" id="bidPriceHelp">
                Indian rupees (INR). Budget {L.inr(j.budget)}; this brand takes bids from {L.inr(R.minPaise)}{" "}
                to {L.inr(maxPaise)}.
              </p>
              <p className="err" id="bidPriceErr">
                {msg("price")}
              </p>
              <p className="bid-warn" id="bidPriceWarn">
                {!e.price && price > j.budget
                  ? `${L.inr(price - j.budget)} over the brand's budget. Say why in your note.`
                  : ""}
              </p>
            </div>
          </section>

          <section className="bid-sec" aria-labelledby="bidWhyL">
            <span className="bid-n" aria-hidden="true">
              02
            </span>
            <div className={`field${msg("why") ? " is-err" : ""}`} id="fWhy">
              <div className="bid-why-h">
                <label id="bidWhyL" htmlFor="bidWhy">
                  Why this price
                </label>
                <span className="t-note bid-note" aria-hidden="true">
                  brands read this first
                </span>
              </div>
              <textarea
                className="textarea"
                id="bidWhy"
                name="why"
                maxLength={R.whyMax}
                rows={4}
                aria-describedby="bidWhyHelp bidWhyN bidWhyErr"
                aria-invalid={inv(!!(e.why && tried))}
                placeholder="Audience fit, effort, past results. For example: 34% of my audience is in Mumbai and my last skincare Reel reached 2.1 lakh views."
                defaultValue={d.why}
                ref={whyIn}
                onInput={() => {
                  save();
                  draw();
                }}
                onBlur={blur("why")}
              />
              <div className="bid-why-f">
                <p className="help" id="bidWhyHelp">
                  At least {R.whyMin} characters.
                </p>
                <p
                  className={`bid-count num${nWhy >= R.whyMax - 40 ? " is-near" : ""}${nWhy > 0 && v.why.trim().length < R.whyMin ? " is-short" : ""}`}
                  id="bidWhyN"
                >
                  {nWhy} / {R.whyMax}
                </p>
              </div>
              <p className="err" id="bidWhyErr">
                {msg("why")}
              </p>
            </div>
          </section>

          <section className="bid-sec" aria-label="Post date and expected views">
            <span className="bid-n" aria-hidden="true">
              03
            </span>
            <div className="bid-pair">
              <div className={`field${msg("post") ? " is-err" : ""}`} id="fPost">
                <label htmlFor="bidPost">Post date</label>
                <input
                  className="input"
                  id="bidPost"
                  name="postDate"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  defaultValue={d.postDate}
                  aria-describedby="bidPostHelp bidPostErr"
                  aria-invalid={inv(!!(e.post && tried))}
                  ref={postIn}
                  onChange={() => {
                    touched.add("post");
                    save();
                    draw();
                  }}
                  onBlur={blur("post")}
                />
                <p className="help" id="bidPostHelp">
                  {postHelp}
                </p>
                <p className="err" id="bidPostErr">
                  {msg("post")}
                </p>
              </div>
              <div className={`field${msg("views") ? " is-err" : ""}`} id="fViews">
                <label htmlFor="bidViews">
                  Expected views <span className="bid-opt">optional</span>
                </label>
                <input
                  className="input"
                  id="bidViews"
                  name="views"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={13}
                  placeholder={pf ? group(String(pf.avgViews)) : "50,000"}
                  defaultValue={group(d.views)}
                  aria-describedby="bidViewsHelp bidViewsErr"
                  aria-invalid={inv(!!(e.views && tried))}
                  ref={viewsIn}
                  onInput={ev => {
                    grouped(ev.currentTarget, 10);
                    save();
                    draw();
                  }}
                  onBlur={blur("views")}
                />
                <p className="help" id="bidViewsHelp">
                  Your estimate, not a guarantee.
                  {pf ? ` Your ${K.platName(j.platform)} average is ${L.compact(pf.avgViews)}.` : ""}
                </p>
                <p className="err" id="bidViewsErr">
                  {msg("views")}
                </p>
              </div>
            </div>
          </section>

          <section className="bid-sec" aria-labelledby="bidLinksL">
            <span className="bid-n" aria-hidden="true">
              04
            </span>
            <div className="field" id="fLinks">
              <p className="lab" id="bidLinksL">
                Similar work links
              </p>
              <ul className="bid-links" id="bidLinks" aria-labelledby="bidLinksL" ref={linksUl}>
                {d.links.map((x, i) => {
                  const m = linkMsg(i);
                  return (
                    <li key={i} className={`bid-link${m ? " is-err" : ""}`} data-i={i}>
                      <div className="bid-link-row">
                        <span className="bid-link-ic" aria-hidden="true">
                          <Icon n="link" />
                        </span>
                        <label className="sr-only" htmlFor={`bidL${i}`}>
                          Link {i + 1}
                        </label>
                        <input
                          className="input"
                          id={`bidL${i}`}
                          type="url"
                          inputMode="url"
                          autoComplete="off"
                          spellCheck="false"
                          placeholder="instagram.com/reel/…"
                          value={x}
                          aria-describedby={`bidLErr${i}`}
                          aria-invalid={inv(!!m)}
                          onChange={ev => {
                            d.links[i] = ev.target.value;
                            save();
                            draw();
                          }}
                          onBlur={blur("links")}
                        />
                        <button
                          className="ibtn bid-link-x"
                          type="button"
                          data-rmlink={i}
                          aria-label={`Remove link ${i + 1}`}
                          hidden={d.links.length === 1 && !x}
                          onClick={() => {
                            d.links.splice(i, 1);
                            if (!d.links.length) d.links = [""];
                            linksChanged(Math.min(i, d.links.length - 1));
                          }}
                        >
                          <Icon n="close" />
                        </button>
                      </div>
                      <p className="err" id={`bidLErr${i}`}>
                        {m}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <div className="bid-links-f">
                <Lq
                  className="lq-s lq-sm"
                  data-addlink=""
                  ref={addBtn}
                  disabled={d.links.length >= R.maxLinks}
                  aria-disabled={String(d.links.length >= R.maxLinks)}
                  onClick={() => {
                    if (d.links.length >= R.maxLinks) return;
                    d.links.push("");
                    linksChanged(d.links.length - 1);
                  }}
                >
                  <Icon n="plus" className="ic" />
                  Add link
                </Lq>
                <span className="help" id="bidLinksMax">
                  Up to {R.maxLinks}. Reels, videos or pages from past deals.
                </span>
              </div>
              {portfolio.length ? (
                <div className="bid-port">
                  <p className="help">From your profile</p>
                  <div className="chips" id="bidPort">
                    {portLeft.length ? (
                      portLeft.map(p => (
                        <button
                          key={p.url}
                          className="chip"
                          type="button"
                          data-port={p.url}
                          onClick={() => {
                            const empty = d.links.findIndex(x => !x.trim());
                            if (empty >= 0) d.links[empty] = p.url;
                            else if (d.links.length < R.maxLinks) d.links.push(p.url);
                            else return L.toast(`Up to ${R.maxLinks} links`, "info");
                            touched.add("links");
                            save();
                            draw();
                            (addBtn.current.disabled ? priceIn.current : addBtn.current).focus();
                          }}
                        >
                          <Icon n="plus" />
                          <span>{p.title}</span>
                        </button>
                      ))
                    ) : (
                      <span className="help">All added.</span>
                    )}
                  </div>
                </div>
              ) : null}
              <p className="err" id="bidLinksErr">
                {msg("links")}
              </p>
            </div>
          </section>

          <div className="bid-foot">
            <p className="bid-sum" id="bidSum" aria-live="polite">
              {sumKeys.length ? (
                <>
                  <Icon n="alert" />
                  <span>
                    Fix {sumKeys.length === 1 ? "one thing" : sumKeys.length + " things"} first:{" "}
                    {sumKeys.map(k => NAMES[k]).join(", ")}.
                  </span>
                </>
              ) : null}
            </p>
            <Lq className="lq-p bid-review-btn" type="submit">
              Review bid
            </Lq>
            <p className="help">Nothing is sent until you confirm on the next step.</p>
          </div>
        </form>

        <aside className="bid-side" aria-label="Payout preview">
          <div className="bid-receipt ink-card">
            <p className="bid-rc-h">Payout preview</p>
            <dl className="bid-rows">
              <div>
                <dt>Your price</dt>
                <dd data-r="price">{price ? L.inr(price) : "₹ —"}</dd>
              </div>
              <div>
                <dt>Tax / withholding</dt>
                <dd>As per confirmed rules</dd>
              </div>
            </dl>
            <p className="bid-rc-l">You receive</p>
            <p className="bid-rc-net">
              <span className="t-money" data-r="net" ref={netEl}></span>
            </p>
            <p className="bid-rc-s">The agreed price, in full. Tax as per confirmed rules.</p>
            <span className="pill pill-escrow">
              <Icon n="lock" />
              Paid from escrow after the brand approves
            </span>
          </div>
          <p className="help bid-side-note">
            <Icon n="lock" />
            The brand sees your price, note, date, views and links. Never your ID or payout details.
          </p>
        </aside>
      </div>
      <p className="sr-only" id="bidLive" aria-live="polite">
        {live}
      </p>
      <div className="bid-dock dark" role="region" aria-label="Bid total">
        <p className="bid-dock-t">
          <span>You receive, the agreed price</span>
          <b className="t-money bid-dock-v" data-r="dock" ref={dockEl}></b>
        </p>
        <Lq className="lq-p" data-dockreview="" onClick={review}>
          Review bid
        </Lq>
      </div>
    </div>
  );
}

function BidScreen({ param: id }) {
  const K = L.jobkit;
  K.ensure();
  const j = K.job(id);
  if (!j)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
          <p className="t-h2">This collab is no longer open.</p>
          <p className="muted">Nothing to bid on here.</p>
          <Lq as="a" className="lq-p" href="#jobs">
            See open collabs
          </Lq>
        </div>
      </div>
    );
  const existing = K.openBid(j.id);
  if (existing)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-02-plane.svg" width="72" height="72" alt="" className="bid-plane" />
          <p className="t-h2">You already bid on this collab.</p>
          <p className="row wrap bid-already">
            <StatusPill status={existing.status} />
            <span className="num">{L.inr(existing.price)}</span>
            <span className="muted">sent {L.fmtDate(existing.sent)}</span>
          </p>
          <Lq as="a" className="lq-p" href="#bids">
            See it in My Bids
          </Lq>
        </div>
      </div>
    );
  return <BidForm j={j} />;
}

L.register("bid", {
  title: id => {
    const j = L.jobkit && L.jobkit.job(id);
    return j ? "Bid · " + j.title : "Bid";
  },
  crumb: id => {
    const j = L.jobkit && L.jobkit.job(id);
    return j
      ? `<a href="#jobs">Find collabs</a> / <a href="#job-${L.esc(j.id)}">${L.esc(j.title)}</a> / Your bid`
      : '<a href="#jobs">Find collabs</a> / Your bid';
  },
  nav: "jobs",
  Component: BidScreen,
});
