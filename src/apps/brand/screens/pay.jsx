/* Brand side · LLD.payEscrow(campaignId), the pay-into-escrow sheet, and previewDelivery(delivery). Builder C.
   Other screens open the pay sheet (the brief page after a hire, Home, a deal). Sample mode pays with a saved method after a
   short wait; live mode opens Razorpay Checkout over the page and the backend verifies the payment and funds the deal.
   React sheets (see src/shared/react/view.jsx). */
import { useEffect, useRef, useState } from "react";
import { fromHtml, Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD;
const S = () => window.LLD_DATA;
const K = () => L.bk;
const HELD = ["funded", "in_progress", "submitted", "revision", "approved"];
const paidAlready = c => c.stage === "released" || c.stage === "refunded" || HELD.includes(c.stage);
const thread = c =>
  S().threads.find(t => t.id === c.thread) || S().threads.find(t => t.campaign === c.id) || null;
const MIC = { upi: "send", nb: "home", card: "wallet" };

const Rules = ({ f }) => (
  <ul className="jl-conseq pe-rules">
    <li>Linkloom holds the money. {f} sees it is paid and starts.</li>
    <li>It is released only when you approve the delivery.</li>
    <li>Refunded in full if {f} cannot deliver.</li>
  </ul>
);

/* ---------- the sample pay sheet: pick a saved method, pay, then the receipt ---------- */
function PaySheet({ cid, close }) {
  const c = S().campaigns.find(x => x.id === cid);
  const k = K().cr(c.creator),
    f = K().first(k),
    u = K().ui("pay"),
    methods = S().payMethods || [];
  const [sel, setSel] = useState(methods.some(m => m.id === u.method) ? u.method : (methods[0] || {}).id);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const box = useRef(null);
  useEffect(() => {
    if (!done) return;
    const first = box.current.querySelector("[data-go-close],[data-done]");
    first && first.focus({ preventScroll: true });
    K().mo("lock", box.current.querySelector("[data-amt]"));
  }, [done]);
  const pay = () => {
    const m = methods.find(x => x.id === sel);
    if (!m) return setErr("Choose how you want to pay.");
    if (!navigator.onLine)
      return setErr("You are offline. Nothing was charged. Try again when you are back online.");
    const cur = S().campaigns.find(x => x.id === cid);
    if (!cur || cur.stage !== "accepted") return setErr("This deal changed. Close this and check it again.");
    setErr("");
    setBusy(true);
    setTimeout(
      () => {
        const at = K().nowISO(),
          inv = K().nextInvoice(),
          tid = "t" + Date.now().toString(36),
          pid = "p" + Date.now().toString(36);
        const method =
          m.id === "upi"
            ? `UPI ${m.detail}`
            : m.id === "card"
              ? `Card ${m.detail.replace(/\s+/g, "")}`
              : `${m.label} · ${m.detail}`;
        L.store.set(st => {
          const x = st.campaigns.find(y => y.id === cid);
          st.payments.unshift({
            id: pid,
            date: K().todayISO(),
            kind: "escrow",
            campaign: x.id,
            creator: x.creator,
            amount: x.price,
            status: "held",
            method,
            invoice: inv,
          });
          x.stage = "funded";
          x.funded = at;
          (x.log = x.log || []).push([at, "funded"]);
          if (!x.thread) {
            st.threads.unshift({
              id: tid,
              campaign: x.id,
              creator: x.creator,
              unread: 0,
              messages: [
                {
                  from: "system",
                  kind: "escrow",
                  text: `You paid ${L.inr(x.price)} into escrow. Chat is open.`,
                  at,
                },
              ],
            });
            x.thread = tid;
          }
        }, "escrow-paid");
        K().notify(
          "payment",
          `${L.inr(c.price)} paid into escrow for ${c.title}. Chat with ${k.name} is open.`,
          "#campaign-" + c.id,
        );
        setDone({
          method,
          inv,
          at,
          here: location.hash === "#campaign-" + c.id,
          t: thread(S().campaigns.find(y => y.id === cid)),
        });
      },
      L.RM ? 0 : 650,
    );
  };
  if (done)
    return (
      <div className="pe pe-done" ref={box}>
        <div className="pe-slip">
          <span className="pill pill-escrow">
            <Icon n="lock" />
            In escrow
          </span>
          <p className="pe-lab">Held by Linkloom</p>
          <p className="t-money pe-amt" data-amt="">
            {L.inr(c.price)}
          </p>
          <p className="pe-line">No platform fee. Taxes as per confirmed rules.</p>
          <dl className="pe-kv">
            <div className="kv">
              <dt>Paid with</dt>
              <dd>{done.method}</dd>
            </div>
            <div className="kv">
              <dt>Invoice</dt>
              <dd>{done.inv}</dd>
            </div>
            <div className="kv">
              <dt>Date</dt>
              <dd>{L.fmtDate(done.at, { year: true })}</dd>
            </div>
          </dl>
        </div>
        <p className="pe-ok">
          <Icon n="chat" />
          <span>
            Chat with {f} is open. {f} has been told to start.
          </span>
        </p>
        <div className="row wrap pe-acts">
          {done.t ? (
            <Lq
              as="a"
              className="lq-p"
              href={`#chat-${done.t.id}`}
              data-go-close=""
              onClick={() => close(true)}
            >
              Open chat
            </Lq>
          ) : null}
          {done.here ? null : (
            <Lq
              as="a"
              className="lq-s"
              href={`#campaign-${c.id}`}
              data-go-close=""
              onClick={() => close(true)}
            >
              Open deal
            </Lq>
          )}
          <Lq className="lq-s" data-done="" onClick={() => close()}>
            Done
          </Lq>
        </div>
      </div>
    );
  return (
    <div className="pe" ref={box}>
      <div className="pe-slip">
        <div className="pe-who">{fromHtml(K().crChip(k))}</div>
        <p className="t-small muted">{c.title}</p>
        <p className="pe-lab">Agreed price</p>
        <p className="t-money pe-amt" data-amt="">
          {L.inr(c.price)}
        </p>
        <p className="pe-line">No platform fee. Taxes as per confirmed rules.</p>
      </div>
      <fieldset className="pe-methods">
        <legend className="t-label">Pay with</legend>
        {methods.map(m => (
          <label key={m.id} className="pe-m">
            <input
              type="radio"
              name="pm"
              value={m.id}
              checked={m.id === sel}
              onChange={() => {
                u.method = m.id;
                setSel(m.id);
              }}
            />
            <span className="pe-m-ic" aria-hidden="true">
              <Icon n={MIC[m.id] || "coin"} />
            </span>
            <span className="pe-m-t">
              <b>{m.label}</b>
              <span>{m.detail}</span>
            </span>
            <span className="pe-m-k" aria-hidden="true">
              <Icon n="check" />
            </span>
          </label>
        ))}
      </fieldset>
      <Rules f={f} />
      <p className="err" id="peErr" role="alert">
        {err}
      </p>
      <div className="row wrap pe-acts">
        <Lq
          className="lq-p"
          data-paynow=""
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
          onClick={pay}
        >
          {busy ? (
            "Paying…"
          ) : (
            <>
              <Icon n="lock" />
              Pay {L.inr(c.price)}
            </>
          )}
        </Lq>
        <Lq className="lq-s" data-no="" onClick={() => close()}>
          Not now
        </Lq>
      </div>
      <p className="ll-trust">
        <Icon n="lock" />
        Held safely until you approve.
      </p>
    </div>
  );
}

/* ---------- live escrow: Razorpay Checkout opens over the page; the backend verifies the payment and funds the deal ---------- */
function LivePaySheet({ c, close }) {
  const k = K().cr(c.creator),
    f = K().first(k);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  if (off)
    return (
      <div className="stack pe">
        <p className="t-h2">Online payment isn't switched on yet</p>
        <p className="muted">
          Our team will contact you at {S().me.email || "your registered email"} to collect {L.inr(c.price)}{" "}
          for this hire. The deal moves to In escrow as soon as it lands.
        </p>
        <div className="row wrap">
          <Lq
            as="a"
            className="lq-p"
            href={`mailto:support@linkloom.in?subject=${encodeURIComponent("Escrow payment: " + c.title)}`}
          >
            Email support
          </Lq>
          <Lq className="lq-s" data-no="" onClick={() => close()}>
            Close
          </Lq>
        </div>
      </div>
    );
  const pay = async () => {
    if (!navigator.onLine)
      return setErr("You are offline. Nothing was charged. Try again when you are back online.");
    setErr("");
    setBusy(true);
    try {
      const r = await L.live.payEscrow(c.id, `${c.title} · ${k ? k.name : "creator"}`);
      if (r.status === "paid") {
        close(true);
        L.toast(`Paid ${L.inr(c.price)} into escrow. Chat with ${f} is open.`, "check");
        L.go("#campaign-" + c.id);
        return;
      }
      if (r.status === "failed") setErr(`${r.message} Nothing was charged. Try again or use another method.`);
    } catch (e) {
      if (e && e.code === L.live.PAYMENTS_OFF) return setOff(true);
      if (L.live.isKycRequired(e)) {
        close();
        return L.kycGate("#campaign-" + c.id);
      }
      setErr(L.live.errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pe">
      <div className="pe-slip">
        <div className="pe-who">{fromHtml(K().crChip(k))}</div>
        <p className="t-small muted">{c.title}</p>
        <p className="pe-lab">Agreed price</p>
        <p className="t-money pe-amt">{L.inr(c.price)}</p>
        <p className="pe-line">Pay by UPI, card or net banking in the secure Razorpay window.</p>
      </div>
      <Rules f={f} />
      <p className="err" id="peErr" role="alert">
        {err}
      </p>
      <div className="row wrap pe-acts">
        <Lq
          className="lq-p"
          data-paynow=""
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
          onClick={pay}
        >
          <Icon n="lock" />
          Pay {L.inr(c.price)}
        </Lq>
        <Lq className="lq-s" data-no="" onClick={() => close()}>
          Not now
        </Lq>
      </div>
      <p className="ll-trust">
        <Icon n="lock" />
        Held safely until you approve. Payments by Razorpay.
      </p>
    </div>
  );
}

L.payEscrow = function (cid) {
  const c = S().campaigns.find(x => x.id === cid);
  if (L.live && c && c.stage === "accepted" && !String(c.id).startsWith("offer-"))
    return openReactSheet({
      title: "Pay into escrow",
      render: close => <LivePaySheet c={c} close={close} />,
    });
  /* not accepted yet, already paid, or gone: the same sheets as the sample */
  if (!c) {
    L.toast("That deal could not be found", "alert");
    return;
  }
  if (c.stage !== "accepted") {
    const paid = paidAlready(c),
      f = K().first(K().cr(c.creator));
    return openReactSheet({
      title: "Pay into escrow",
      render: close => (
        <div className="stack pe">
          <p className="t-h2">{paid ? "This deal is already paid." : `Waiting for ${f} to accept.`}</p>
          <p className="muted">
            {paid
              ? "The money is in escrow or already released. See the deal for where it stands."
              : "You pay only after the creator accepts. You get a notification when they do."}
          </p>
          <div className="row wrap">
            <Lq
              as="a"
              className="lq-p"
              href={`#campaign-${c.id}`}
              data-close-go=""
              onClick={() => close(true)}
            >
              Open deal
            </Lq>
          </div>
        </div>
      ),
    });
  }
  openReactSheet({ title: "Pay into escrow", render: close => <PaySheet cid={cid} close={close} /> });
};

/* ---------- a delivery opens in a sheet: images, videos and PDFs show in place; anything else gets Download and New tab ---------- */
const kindOf = (dv, url) => {
  const t = String(dv.contentType || "").toLowerCase();
  const name = (String(dv.file || "") + " " + String(url || "").split("?")[0]).toLowerCase();
  if (/^image\//.test(t) || /\.(jpe?g|png|webp|gif)/.test(name)) return "image";
  if (/^video\//.test(t) || /\.(mp4|mov|webm|m4v)/.test(name)) return "video";
  if (/pdf/.test(t) || /\.pdf/.test(name)) return "pdf";
  return "";
};
function Preview({ dv }) {
  const [st, setSt] = useState({ msg: "Loading the file…" });
  useEffect(() => {
    let gone = false;
    L.live
      .deliveryLink(dv)
      .then(({ url, uploaded }) => {
        if (gone) return;
        if (!uploaded)
          return setSt({ url, uploaded, msg: "This delivery is a link. Open it in a new tab to see it." });
        const k = kindOf(dv, url);
        /* images first; an unknown type that isn't an image is tried as a video */
        setSt({
          url,
          uploaded,
          media: k === "pdf" ? "pdf" : k === "video" ? "video" : "image",
          imageOnly: k === "image",
        });
      })
      .catch(e => !gone && setSt({ msg: L.live.errorText(e) }));
    return () => (gone = true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fail = () =>
    setSt(s => ({
      ...s,
      media: null,
      msg: "Preview isn't available for this file type. Download it to watch it.",
    }));
  const { url, uploaded, media } = st;
  /* other sites ignore the download attribute; Supabase storage links take ?download= to send it as a file */
  const dl =
    url && /supabase\.co\/storage\//.test(url)
      ? url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(dv.file)
      : url;
  return (
    <div className="dvp">
      {dv.file === `delivery-v${dv.v}` ? null : <p className="t-small muted dvp-name">{dv.file}</p>}
      <div className="dvp-box" aria-live="polite">
        {media === "pdf" ? (
          <iframe className="dvp-media dvp-pdf" src={url} title={dv.file}></iframe>
        ) : media === "video" ? (
          <video
            className="dvp-media"
            src={url}
            controls
            playsInline
            preload="metadata"
            onError={fail}
          ></video>
        ) : media === "image" ? (
          <img
            className="dvp-media"
            src={url}
            alt={dv.file}
            onError={st.imageOnly ? fail : () => setSt(s => ({ ...s, media: "video" }))}
          />
        ) : (
          <p className="muted">{st.msg}</p>
        )}
      </div>
      <div className="row wrap dvp-acts">
        {url && uploaded ? (
          <Lq as="a" className="lq-p" href={dl} download={dv.file} rel="noopener">
            <Icon n="download" className="ic" />
            Download
          </Lq>
        ) : null}
        {url ? (
          <Lq as="a" className={uploaded ? "lq-s" : "lq-p"} href={url} target="_blank" rel="noopener">
            Open in new tab
          </Lq>
        ) : null}
      </div>
    </div>
  );
}
export function previewDelivery(dv) {
  openReactSheet({ title: `Delivery v${dv.v}`, render: () => <Preview dv={dv} /> });
}
