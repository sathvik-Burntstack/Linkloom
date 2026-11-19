/* Direct offers. A brand can hire a creator without a brief: POST /v1/offers/ on their side,
   GET /v1/creators/me/offers/ and PATCH { status } on this side. The prototype had no screen for it, so the offers
   that are still open are shown at the top of My Bids, in the same card language as the bid slips.
   <DirectOffers> is rendered by the My bids screen (screens/bids/bids.jsx); wireCreatorOffers() keeps it fresh. */
import { useEffect, useState } from "react";
import { LLD, store } from "@/apps/creator/core";
import { ApiError } from "@/shared/api/client";
import { creatorApi, refreshSoft } from "./creator";
import { amount, day, nameOf } from "../../../shared/live";
import { Icon, Lq } from "@/shared/react/view";

/* The backend's offer status names aren't documented (pending? invited? sent?), so an offer counts as open unless
   its status says it is finished. A whitelist hid every offer whose status it didn't know. */
const CLOSED = /^(accepted|rejected|declined|withdrawn|cancell?ed|expired|completed|closed)$/i;
const isOpen = o => !CLOSED.test(String(o.status || "").trim());
/* "refresh" asks a shown <DirectOffers> to load the list again */
const bus = new EventTarget();

function OfferCard({ o, onGone }) {
  const { inr, fmtDate, initials } = LLD;
  const brand = nameOf(o.brand, "A brand");
  const due = day(o.deadline);
  const sent = day(o.createdAt);
  const id = String(o.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const answer = async accept => {
    if (accept && store.s.kyc.status !== "verified") {
      store.set(s => (s.kyc.returnTo = "#bids"), "kyc-return");
      LLD.toast("Verify your ID to accept offers. It takes about 4 minutes.", "shield");
      LLD.go("#kyc");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await creatorApi.answerOffer(id, accept ? "accepted" : "rejected");
      LLD.toast(
        accept ? "Offer accepted. It's in Active deals once the brand pays in." : "Offer declined",
        "check",
      );
      onGone(id);
    } catch (x) {
      setBusy(false);
      if (x instanceof ApiError && x.code === "KYC_REQUIRED") {
        store.set(s => (s.kyc.returnTo = "#bids"), "kyc-return");
        LLD.go("#kyc");
        return;
      }
      setErr(creatorApi.errorText(x));
    }
  };
  return (
    <article className="bids-slip is-submitted" data-offer={id} aria-labelledby={`of-${id}`}>
      <div className="bids-stub">
        <p className="bids-stub-l">Their offer</p>
        <p className="bids-price t-money">{inr(amount(o.budget))}</p>
        {sent ? <p className="bids-stub-d">Sent {fmtDate(sent)}</p> : null}
      </div>
      <div className="bids-body">
        <div className="bids-top">
          <span className="jobs-brand">
            <span className="jobs-bi" aria-hidden="true">
              {initials(brand)}
            </span>
            <span className="jobs-bn">{brand}</span>
          </span>
          <span className="pill pill-info">
            <Icon n="send" />
            Direct offer
          </span>
        </div>
        <h3 className="bids-t" id={`of-${id}`}>
          {String(o.deliverable || "Content")}
        </h3>
        <p className="bids-sub">
          <span>
            {due ? `Deliver by ${fmtDate(due, { year: true })}` : ""}
            {o.usageRights ? `${due ? " · " : ""}Usage: ${String(o.usageRights)}` : ""}
          </span>
        </p>
        {o.message ? <p className="bids-note">“{String(o.message)}”</p> : null}
        <p className="err" aria-live="assertive" data-err="">
          {err}
        </p>
        <div className="bids-acts">
          <Lq className="lq-p lq-sm" data-accept="" disabled={busy} onClick={() => answer(true)}>
            Accept offer
          </Lq>
          <Lq className="lq-s lq-sm" data-decline="" disabled={busy} onClick={() => answer(false)}>
            Decline
          </Lq>
        </div>
      </div>
    </article>
  );
}

/** The open direct offers, shown under My bids' header; nothing when there are none. */
export function DirectOffers() {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    let on = true;
    const load = async () => {
      if (!store.s.session.signedIn || !LLD.live) return;
      try {
        const list = (await creatorApi.offers()).filter(isOpen);
        if (on) setOffers(list);
      } catch (x) {
        console.warn("[offers] could not load direct offers", x);
      }
    };
    void load();
    bus.addEventListener("refresh", load);
    return () => {
      on = false;
      bus.removeEventListener("refresh", load);
    };
  }, []);
  if (!offers.length) return null;
  return (
    <section data-offers="" aria-labelledby="offersH" className="bids-group">
      <h2 className="bids-gh" id="offersH">
        <span className="t-h2">Direct offers</span>
        <span className="bids-gn num">{offers.length}</span>
      </h2>
      <p className="muted">
        Brands that want to hire you without a brief. Accepting starts the deal once they pay into escrow.
      </p>
      <div className="bids-list">
        {offers.map(o => (
          <OfferCard key={o.id} o={o} onGone={id => setOffers(l => l.filter(x => String(x.id) !== id))} />
        ))}
      </div>
    </section>
  );
}

/** Keeps the offers and the rest of the creator's data fresh when they come back to the tab. */
export function wireCreatorOffers() {
  const run = () => {
    if (location.hash.replace(/^#/, "") === "bids" && store.s.session.signedIn)
      bus.dispatchEvent(new Event("refresh"));
  };
  /* an offer sent while My bids is open shows up when the creator comes back to the tab */
  let lastSoft = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !store.s.session.signedIn) return;
    run();
    /* new briefs, bid replies and deals since the page loaded; at most once every 30 s */
    if (Date.now() - lastSoft > 30_000) {
      lastSoft = Date.now();
      void refreshSoft().catch(() => undefined);
    }
  });
  store.on(why => why === "signed-in" && run());
}
