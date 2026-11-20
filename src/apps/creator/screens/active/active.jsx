/* Active jobs (#active) and the production board for one deal (#work-<id>). Owned by Builder C.
   Work status (a.stage, six stages) and payment status (a.pay: 'escrow' | 'released') are separate fields on purpose:
   "completed" never implies "paid". Money is integer paise. The shared helpers (LLD_C) are in deal-kit.js.
   React screens (see src/shared/react/view.jsx). */
import "./deal-kit";
import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, Photo } from "@/shared/react/view";
import { EscrowPill, NetBanner, PayoutSlip, PayPill, WhoPill } from "./deal-ui";

const L = window.LLD;
const C = window.LLD_C;
const order = a => ({ you: 0, brand: 1, done: 2 })[C.who(a)];
const sorted = list => [...list].sort((x, y) => order(x) - order(y) || L.D(x.due) - L.D(y.due));
const log = (a, kind, extra) => {
  (a.log = a.log || []).push({ at: C.iso(), kind, ...extra });
};
const sizeOf = b =>
  b >= 1024 ** 3
    ? (b / 1024 ** 3).toFixed(1) + " GB"
    : b >= 1024 ** 2
      ? Math.max(1, Math.round(b / 1024 ** 2)) + " MB"
      : Math.max(1, Math.round(b / 1024)) + " KB";
const platIc = p => (p === "youtube" ? "yt" : "ig");

/* ====================================================================================
   #active: one ticket per deal. Whose move it is reads as colour (coral = you, violet = brand).
   ==================================================================================== */
const FILTERS = [
  ["all", "All"],
  ["you", "Your move"],
  ["brand", "With brand"],
  ["done", "Done"],
];

function Ticket({ a, hidden }) {
  const d = C.deal(a),
    i = C.ix(a),
    t = C.threadFor(a),
    who = C.who(a),
    used = C.revUsed(a) > 0;
  const late = a.stage !== "approved" && C.days(a.due) < 0;
  return (
    <li className="active-tk" data-who={who} data-id={a.id} hidden={hidden}>
      <div className="active-tk-a">
        <span className="avatar v" aria-hidden="true">
          <Photo src={a.logo || C.logo(a.brand)}>{C.bi(a.brand)}</Photo>
        </span>
        <div className="active-tk-tx">
          <p className="active-tk-brand">
            {a.brand}
            <span aria-hidden="true">·</span>
            <Icon n={platIc(d.platform)} />
            <span>{d.format || ""}</span>
          </p>
          <h2 className="active-tk-t">
            <a className="active-tk-link" href={`#work-${a.id}`}>
              {a.title}
            </a>
          </h2>
          <p className="active-tk-next">{C.next(a)}</p>
        </div>
      </div>
      <div className="active-tk-rail">
        <ol className="active-mini" aria-label={`Stage ${i + 1} of 6: ${C.STAGES[i].long}`}>
          {C.STAGES.map((st, k) => {
            const skip = st.k === "revision" && !used && k !== i;
            return (
              <li
                key={k}
                className={`${k < i && !skip ? "is-done" : k === i ? "is-now" : ""}${skip ? " is-skip" : ""}`}
              ></li>
            );
          })}
        </ol>
        <p className="active-tk-stage">
          <WhoPill a={a} />
          <span>{C.STAGES[i].long}</span>
        </p>
      </div>
      <div className="active-tk-m">
        <p className="t-money active-tk-price">{L.inr(a.price)}</p>
        <PayPill a={a} />
        <p className={`active-tk-due${late ? " is-late" : ""}`}>
          <Icon n="clock" />
          <span>{C.due(a)}</span>
        </p>
      </div>
      {t ? (
        <a
          className="active-tk-chat"
          href={`#chat-${t.id}`}
          aria-label={`Chat with ${a.brand}${t.unread ? `, ${t.unread} unread` : ""}`}
        >
          <Icon n="chat" />
          {t.unread ? <b>{t.unread}</b> : null}
        </a>
      ) : null}
    </li>
  );
}

function ActiveList() {
  const s = L.store.s,
    ui = s.workUI || (s.workUI = {});
  const [f, setF] = useState(FILTERS.some(x => x[0] === ui.activeFilter) ? ui.activeFilter : "all");
  const root = useRef(null),
    heldEl = useRef(null);
  const list = s.active.length ? sorted(s.active) : [];
  const held = C.sum(
    s.active.filter(a => a.pay === "escrow" && !a.awaitingPay),
    a => a.price,
  );
  useLayoutEffect(() => {
    if (!heldEl.current) return;
    L.motion.count(heldEl.current, held, L.inr);
    L.motion.stagger(L.$$(".active-tk:not([hidden])", root.current));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.active.length)
    return (
      <div className="view-in active">
        <header className="active-head">
          <div className="active-head-t">
            <h1 className="t-h1">Active deals</h1>
          </div>
        </header>
        <div className="empty active-empty">
          <img src="assets/trust-lock-coin.svg" width="200" height="140" alt="" />
          <p className="t-h2">No active work yet</p>
          <p className="muted">
            When a brand accepts your bid and pays into escrow, the deal lands here with its instructions, dates and
            chat.
          </p>
          <div className="row wrap active-empty-cta">
            <Lq as="a" className="lq-p" href="#jobs">
              Find collabs
            </Lq>
            <Lq as="a" className="lq-s" href="#bids">
              See my bids
            </Lq>
          </div>
        </div>
      </div>
    );
  const count = k => (k === "all" ? list.length : list.filter(a => C.who(a) === k).length);
  const on = a => f === "all" || C.who(a) === f;
  const shown = list.filter(on).length;
  return (
    <div className="view-in active" ref={root}>
      <header className="active-head">
        <div className="active-head-t">
          <h1 className="t-h1">Active deals</h1>
          <p className="muted">
            Brands accepted these bids and paid in first. <span className="sample">Sample data</span>
          </p>
        </div>
        <div className="active-held">
          <span className="active-coin" aria-hidden="true">
            ₹
          </span>
          <p>
            <span className="active-held-l">Held in escrow for you</span>
            <b className="t-money" data-held="" ref={heldEl}>
              {L.inr(held)}
            </b>
          </p>
          <p className="t-note active-held-note" aria-hidden="true">
            paid in before you start
          </p>
        </div>
      </header>
      <div className="seg active-seg" role="group" aria-label="Filter active deals">
        {FILTERS.map(([k, n]) => (
          <button
            key={k}
            type="button"
            data-f={k}
            aria-pressed={String(k === f)}
            onClick={() => {
              if (k === f) return;
              ui.activeFilter = k;
              L.motion.flip(() => flushSync(() => setF(k)), L.$$(".active-tk", root.current));
            }}
          >
            {n}
            <span className="active-seg-n">{count(k)}</span>
          </button>
        ))}
      </div>
      <ol className="active-list" aria-live="polite">
        {list.map(a => (
          <Ticket key={a.id} a={a} hidden={!on(a)} />
        ))}
      </ol>
      <p className="active-none muted" hidden={shown > 0}>
        Nothing here right now.
      </p>
    </div>
  );
}

L.register("active", { title: "Active deals", nav: "active", Component: ActiveList });

/* ====================================================================================
   #work-<id>: the production board for one deal.
   ==================================================================================== */
const LOGT = {
  accepted: a => `Bid accepted at ${L.inr(a.price)}`,
  funded: a => `${L.inr(a.price)} paid into escrow`,
  kickoff: () => "Work started",
  upload: (a, e) => `Uploaded ${e.file || "a file"}`,
  revision: () => "Revision asked",
  draftok: () => "Draft OKed by the brand",
  live: () => "Posted live, sent for final review",
  approved: () => "Approved, released from escrow",
};
const lastAt = (a, kind) => {
  const e = (a.log || []).filter(x => x.kind === kind).pop();
  return e && e.at;
};

/** The work rail. `from` is the stage last drawn, so the thread pulls only through new segments. */
function Rail({ a, from }) {
  const cur = C.ix(a),
    used = C.revUsed(a),
    pull0 = Math.max(0, Math.min(from == null ? cur - 1 : from, cur - 1));
  const dateOf = {
    kickoff: lastAt(a, "accepted") || a.accepted,
    in_progress: lastAt(a, "kickoff"),
    submitted: lastAt(a, "upload"),
    revision: lastAt(a, "revision") || a.revisionAt,
    review: lastAt(a, "live"),
    approved: lastAt(a, "approved"),
  };
  const ahead = {
    in_progress: "Next",
    submitted: `Draft due ${L.fmtDate(a.draftDue || a.due)}`,
    review: `Due ${L.fmtDate(a.due)}`,
    approved: "Releases payout",
  };
  return (
    <ol className={`work-rail${from === cur ? "" : " is-pulling"}`}>
      {C.STAGES.map((st, i) => {
        let cls = i < cur ? "is-done" : i === cur ? "is-now" : "is-next",
          sub,
          state = i < cur ? "done" : i === cur ? "current stage" : "not yet";
        if (i <= cur && dateOf[st.k]) sub = (i === cur ? "Now · " : "") + L.fmtDate(dateOf[st.k]);
        else if (i === cur) sub = "Now";
        else sub = ahead[st.k] || "";
        if (st.k === "revision" && i !== cur) {
          const n = a.revisionsIncluded || 2;
          if (used) {
            sub = `${used} of ${n} used`;
            if (i > cur) cls = "is-next is-used";
          } else {
            cls = (i < cur ? "is-done" : "is-next") + " is-skip";
            sub = i < cur ? "Not needed" : "Only if needed";
            state = i < cur ? "not needed" : "only if needed";
          }
        }
        const pull = i >= pull0 && i < cur;
        return (
          <li
            key={i}
            className={`work-node ${cls}${pull ? " is-pull" : ""}`}
            style={pull ? { "--k": i - pull0 } : i === cur ? { "--k": Math.max(0, cur - pull0) } : undefined}
            aria-current={i === cur ? "step" : undefined}
          >
            <span className="work-nh">
              <span className="work-n" aria-hidden="true">
                0{i + 1}
              </span>
              <span className="work-nt">
                {st.n}
                <span className="sr-only">
                  , {st.long}, {state}
                </span>
              </span>
            </span>
            <span className="work-rl" aria-hidden="true">
              <i></i>
            </span>
            <span className="work-nd">{sub}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* file upload with validation, simulated progress and pause on network loss (nothing leaves the browser) */
const OK = /\.(mp4|mov|m4v|jpe?g|png)$/i,
  TYPES = /^(video\/(mp4|quicktime|x-m4v)|image\/(jpeg|png))$/;
function Uploader({ a, fmt, verb, sub, onSend }) {
  const first = a.brand.split(" ")[0];
  const MAX = L.live ? 50 * 1024 ** 2 : 4 * 1024 ** 3; // the server takes deliverables up to 50 MB
  const [st, setSt] = useState("idle");
  const [pct, setPct] = useState(0);
  const [file, setFile] = useState(null);
  /* the error line keeps its last words while hidden, as the plain-DOM version did */
  const [err, setErrS] = useState({ text: "", on: false });
  const setErr = text => setErrS(e => (text ? { text, on: true } : { text: e.text, on: false }));
  const [pmsg, setPmsg] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const R = useRef({ timer: 0, pct: 0, step: 4, st: "idle" });
  const inp = useRef(null),
    note = useRef(null),
    submitBtn = useRef(null);
  const go = s => {
    R.current.st = s;
    setSt(s);
  };
  const stop = () => {
    clearInterval(R.current.timer);
    R.current.timer = 0;
    removeEventListener("online", resume);
    removeEventListener("offline", pause);
  };
  function pause() {
    if (R.current.st !== "busy") return;
    go("paused");
    setPmsg(`Connection lost at ${Math.round(R.current.pct)}%. It resumes when you are back online.`);
  }
  function resume() {
    if (R.current.st !== "paused") return;
    go("busy");
    setPmsg("Back online. Resuming…");
  }
  useLayoutEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const fail = m => {
    stop();
    setErr(m);
    go("error");
    inp.current.value = "";
  };
  const ready = () => {
    flushSync(() => go("done"));
    submitBtn.current && submitBtn.current.focus({ preventScroll: true });
  };
  const tick = () => {
    if (R.current.st !== "busy") return;
    if (!navigator.onLine) return pause();
    R.current.pct = Math.min(100, R.current.pct + R.current.step);
    setPct(R.current.pct);
    if (R.current.pct > 2) setPmsg(`Uploading · ${Math.round(R.current.pct)}%`);
    if (R.current.pct >= 100) {
      stop();
      ready();
    }
  };
  const start = f => {
    setErr("");
    if (!f) return;
    if (!OK.test(f.name) && !TYPES.test(f.type))
      return fail(`${f.name} can’t be uploaded. Use MP4, MOV, JPG or PNG.`);
    if (f.size === 0) return fail("That file is empty. Export it again and retry.");
    if (f.size > MAX)
      return fail(`That file is over ${L.live ? "50 MB" : "4 GB"}. Export a smaller version and retry.`);
    if (!navigator.onLine) return fail("You are offline. Connect to the internet, then upload again.");
    setFile({ name: f.name, size: sizeOf(f.size), raw: f });
    if (L.live) {
      /* the real upload happens on submit, with its own progress on the button */
      stop();
      ready();
      return;
    }
    R.current.pct = 0;
    setPct(0);
    const ms = Math.min(4200, Math.max(1600, (f.size / 1024 ** 2) * 28));
    R.current.step = 100 / (ms / 90);
    setPmsg("Starting upload…");
    go("busy");
    addEventListener("online", resume);
    addEventListener("offline", pause);
    R.current.timer = setInterval(tick, 90);
  };
  const send = async () => {
    if (!navigator.onLine)
      return setErr("You are offline. Your file is ready; send it when you are back online.");
    const n = note.current && note.current.value ? note.current.value.trim() : "";
    if (L.live) {
      setBusy(true);
      setErr("");
      const e = await onSend(file, n, true);
      if (e) {
        setBusy(false);
        setErr(e);
      }
      return;
    }
    onSend(file, n);
  };
  return (
    <div className="work-up" data-state={st}>
      <input
        className="sr-only"
        type="file"
        id="workFile"
        accept="video/mp4,video/quicktime,image/jpeg,image/png,.mp4,.mov,.m4v,.jpg,.jpeg,.png"
        aria-describedby="workFileHelp"
        ref={inp}
        onChange={e => start(e.target.files[0])}
      />
      <label
        className={`work-drop${over ? " is-over" : ""}`}
        htmlFor="workFile"
        hidden={st !== "idle" && st !== "error"}
        onDragEnter={e => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={e => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          start(e.dataTransfer.files[0]);
        }}
      >
        <span className="work-drop-ic">
          <Icon n="upload" />
        </span>
        <span className="work-drop-t">
          <b>Drop your {fmt.toLowerCase()} here</b> or <u>choose a file</u>
        </span>
        <span className="help" id="workFileHelp">
          MP4, MOV, JPG or PNG, up to {L.live ? "50 MB" : "4 GB"}
        </span>
      </label>
      <div className="work-prog" hidden={st !== "busy" && st !== "paused"}>
        <p className="work-prog-n">
          <b data-fname="">{file ? file.name : ""}</b>
          <span data-fsize="">{file ? file.size : ""}</span>
        </p>
        <div
          className="work-bar"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={String(Math.round(pct))}
        >
          <span style={{ width: pct + "%" }}></span>
        </div>
        <div className="row between">
          <p className="work-prog-s" aria-live="polite" data-pmsg="">
            {pmsg || "Uploading"}
          </p>
          <button
            className="btn-q"
            type="button"
            data-cancel=""
            onClick={() => {
              stop();
              go("idle");
              inp.current.value = "";
              L.toast("Upload cancelled", "close");
              inp.current.focus();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="err work-up-err" role="alert" hidden={!err.on}>
        {err.text ? (
          <>
            <Icon n="alert" />
            <span>{err.text}</span>
          </>
        ) : null}
      </p>
      <div className="work-ready" hidden={st !== "done"}>
        <p className="work-ready-f">
          <Icon n="check" />
          <span>
            <b data-rname="">{file ? file.name : ""}</b>
            <span className="muted" data-rsize="">
              {file ? " · " + file.size : ""}
            </span>
          </span>
          <button
            className="btn-q"
            type="button"
            data-replace=""
            onClick={() => {
              go("idle");
              inp.current.value = "";
              inp.current.click();
            }}
          >
            Replace
          </button>
        </p>
        <div className="field">
          <label htmlFor="workNote">
            Note for {first} <span className="muted">(optional)</span>
          </label>
          <input className="input" id="workNote" maxLength={200} placeholder={sub} ref={note} />
        </div>
        <Lq
          className="lq-p"
          data-submit=""
          ref={submitBtn}
          disabled={busy}
          aria-busy={busy ? "true" : undefined}
          onClick={send}
        >
          {busy ? "Uploading…" : verb}
        </Lq>
      </div>
    </div>
  );
}

function LiveLink({ d, onSend }) {
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const inp = useRef(null);
  return (
    <form
      className="work-live"
      noValidate
      onSubmit={e => {
        e.preventDefault();
        const v = inp.current.value.trim().replace(/^https?:\/\//, "");
        const ok = /^(www\.)?(instagram\.com|youtube\.com|youtu\.be)\/\S+$/i.test(v);
        if (!ok) {
          flushSync(() =>
            setErr({ bad: true, text: "Paste the link to the live post on Instagram or YouTube." }),
          );
          inp.current.focus();
          return;
        }
        setErr({ bad: false, text: "" });
        if (L.live) {
          setBusy(true);
          onSend(v).then(x => {
            if (x) {
              setBusy(false);
              setErr({ bad: false, text: x, shown: true });
            }
          });
          return;
        }
        onSend(v);
      }}
    >
      <div className={`field${err && err.bad ? " is-err" : ""}`}>
        <label htmlFor="workLive">Live link</label>
        <input
          className="input"
          id="workLive"
          inputMode="url"
          autoComplete="off"
          placeholder={d.platform === "youtube" ? "youtube.com/watch?v=…" : "instagram.com/reel/…"}
          aria-describedby="workLiveErr"
          aria-invalid={err ? String(!!err.bad) : undefined}
          ref={inp}
        />
        <p className="err" id="workLiveErr" hidden={!(err && (err.bad || err.shown))}>
          {err ? err.text : ""}
        </p>
      </div>
      <Lq className="lq-p" type="submit" disabled={busy}>
        Send for final review
      </Lq>
    </form>
  );
}

function NowPanel({ a, onStart, onUpload, onLive, brandSide }) {
  const d = C.deal(a),
    fmt = d.format || "content",
    first = a.brand.split(" ")[0];
  const Demo = ({ children }) => (
    <div className="work-demo" role="group" aria-label="Sample controls for the brand side">
      <p>
        <span className="sample">Sample</span> Brand side, for this demo
      </p>
      <div className="row wrap">{children}</div>
    </div>
  );
  const head = title => (
    <div className="work-now-h">
      <WhoPill a={a} />
      <h2 className="t-h2" id="workNowH">
        {title}
      </h2>
    </div>
  );
  switch (a.stage) {
    case "kickoff":
      if (a.awaitingPay)
        return (
          <>
            {head("Waiting for payment")}
            <p className="work-now-p">
              {a.brand} hasn't paid {L.inr(a.price)} into escrow yet. You can start and upload once the money
              is held, and we'll let you know when it lands.
            </p>
          </>
        );
      return (
        <>
          {head("Ready when you are")}
          <p className="work-now-p">
            {a.brand} paid {L.inr(a.price)} into escrow. Start when you have the collab details and any product you
            need.
          </p>
          <Lq className="lq-p" data-start="" onClick={onStart}>
            Start work
          </Lq>
        </>
      );
    case "in_progress":
      return (
        <>
          {head("Upload your " + fmt.toLowerCase())}
          <p className="work-now-p">
            Draft due {L.fmtDate(a.draftDue || a.due)}. {a.brand} reviews it before anything goes live.
          </p>
          <Uploader
            a={a}
            fmt={fmt}
            verb="Submit for review"
            sub="Anything they should check first?"
            onSend={onUpload}
          />
        </>
      );
    case "revision": {
      const n = a.revisionsIncluded || 2,
        used = C.revUsed(a);
      return (
        <>
          {head("Revision requested")}
          <figure className="work-note">
            <blockquote className="work-quote">
              <p>“{a.revision || "Please see the chat for the changes."}”</p>
            </blockquote>
            <figcaption>
              <span className="avatar v" aria-hidden="true">
                <Photo src={a.logo || C.logo(a.brand)}>{C.bi(a.brand)}</Photo>
              </span>
              <span>
                <b>{a.brand}</b>
                <span className="muted">
                  {a.revisionAt ? L.fmtDate(a.revisionAt) + ", " + C.time(a.revisionAt) : ""} · Revision{" "}
                  {used} of {n} included
                </span>
              </span>
            </figcaption>
          </figure>
          <Uploader
            a={a}
            fmt={fmt}
            verb={"Resubmit to " + first}
            sub="What did you change?"
            onSend={onUpload}
          />
        </>
      );
    }
    case "submitted": {
      const f = (a.uploads || []).slice(-1)[0];
      if (a.draftOk)
        return (
          <>
            {head("Draft OKed. Post it.")}
            <p className="work-now-p">
              Post on {C.plat(d.platform)} as agreed, then add the live link. {first} does a final check
              before the money leaves escrow.
            </p>
            <LiveLink d={d} onSend={onLive} />
          </>
        );
      return (
        <>
          {head("With " + a.brand)}
          <p className="work-now-p">
            Your draft is in. Brands on Linkloom usually reply within a day; you will see it here and in chat.
          </p>
          {f ? (
            <p className="work-file-now">
              <Icon n="check" />
              <span>
                <b>{f.name}</b>
                <span className="muted">
                  {f.size || ""} · sent {C.when(f.at)}
                </span>
              </span>
            </p>
          ) : null}
          <Demo>
            <Lq className="lq-s lq-sm" data-brand="revise" onClick={() => brandSide("revise")}>
              Ask for a revision
            </Lq>
            <Lq className="lq-s lq-sm" data-brand="ok" onClick={() => brandSide("ok")}>
              OK the draft
            </Lq>
          </Demo>
        </>
      );
    }
    case "review":
      return (
        <>
          {head("Final check with " + first)}
          <p className="work-now-p">
            You have delivered. {L.inr(a.price)} stays in escrow until {a.brand} approves, then it is released
            to you.
          </p>
          {a.liveUrl ? (
            <p className="work-file-now">
              <Icon n="link" />
              <span>
                <b>Live link</b>
                <span className="muted">{a.liveUrl}</span>
              </span>
            </p>
          ) : null}
          <Demo>
            <Lq className="lq-s lq-sm" data-brand="approve" onClick={() => brandSide("approve")}>
              Approve the work
            </Lq>
          </Demo>
        </>
      );
    default: {
      const net = L.payout(a.price).net,
        led = L.store.s.ledger.find(l => l.id === "l-" + a.id);
      return (
        <>
          {head("Approved")}
          <p className="work-now-p">
            {a.brand} approved on {L.fmtDate(lastAt(a, "approved") || C.iso())}. You receive {L.inr(net)}, the
            agreed price, released from escrow
            {led && led.clears ? " and clearing into your balance by " + L.fmtDate(led.clears) : ""}. Tax as
            per confirmed rules.
          </p>
          <Lq as="a" className="lq-p" href="#earnings">
            See it in earnings
          </Lq>
        </>
      );
    }
  }
}

function Work({ a }) {
  const [, redraw] = useState(0);
  const paint = () => flushSync(() => redraw(n => n + 1));
  const root = useRef(null),
    board = useRef(null),
    coin = useRef(null);
  const seen = useRef(null); // the stage index last drawn, so the thread pulls only through new segments
  const from = seen.current;
  const set = (fn, why) => L.store.set(() => fn(a), why);

  /* the coin is a plain element (not React's), so it can glide between money slots on approval */
  const placeCoin = () => {
    if (!coin.current) {
      coin.current = document.createElement("span");
      coin.current.className = "work-coin";
      coin.current.setAttribute("aria-hidden", "true");
      coin.current.textContent = "₹";
    }
    const slot = root.current.querySelector(`[data-slot="${a.pay === "released" ? "out" : "hold"}"]`);
    slot && coin.current.parentNode !== slot && slot.append(coin.current);
  };
  useLayoutEffect(() => {
    placeCoin();
    C.press(root.current);
    seen.current = C.ix(a);
  });
  useLayoutEffect(() => {
    L.motion.stagger(L.$$(".work-node", root.current));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onStart = () => {
    set(a => {
      a.stage = "in_progress";
      log(a, "kickoff");
    }, "work-start");
    L.toast("Work started. Draft due " + L.fmtDate(a.draftDue || a.due), "check");
    paint();
  };
  /* returns an error text when the live upload fails (the uploader shows it) */
  const onUpload = async (file, note) => {
    const t = C.threadFor(a);
    if (L.live) {
      try {
        await L.live.submitDeliverable(a.id, { file: file.raw, note });
      } catch (x) {
        return L.live.errorText(x);
      }
      void L.live.refreshOrders();
    }
    set(a => {
      (a.uploads = a.uploads || []).push({ name: file.name, size: file.size, at: C.iso() });
      log(a, "upload", { file: file.name });
      a.stage = "submitted";
      a.draftOk = false;
      if (t)
        t.msgs.push(
          { from: "sys", at: C.iso(), text: `You uploaded ${file.name} for review` },
          ...(note ? [{ from: "me", at: C.iso(), text: note, status: "delivered" }] : []),
        );
    }, "work-upload");
    L.toast("Sent to " + a.brand + " for review", "send");
    paint();
    return null;
  };
  const markLive = v => {
    set(a => {
      a.liveUrl = v;
      a.stage = "review";
      log(a, "live");
    }, "work-live");
    L.toast("Sent for final review", "send");
    paint();
  };
  const onLive = v => {
    if (L.live)
      return L.live.submitDeliverable(a.id, { url: v, note: "Live post" }).then(
        () => {
          markLive(v);
          void L.live.refreshOrders();
          return null;
        },
        x => L.live.errorText(x),
      );
    markLive(v);
  };
  const brandSide = kind => {
    const t = C.threadFor(a),
      at = C.iso();
    if (kind === "revise") {
      const note = "Looks great. Can you add the price on screen in the last 3 s?";
      set(a => {
        a.stage = "revision";
        a.revision = note;
        a.revisionAt = at;
        log(a, "revision");
        if (t) {
          t.msgs.push({ from: "brand", at, text: note });
          t.unread++;
        }
      }, "work-revision");
      paint();
    } else if (kind === "ok") {
      const note = "Draft approved. Go ahead and post it!";
      set(a => {
        a.draftOk = true;
        log(a, "draftok");
        if (t) {
          t.msgs.push({ from: "brand", at, text: note });
          t.unread++;
        }
      }, "work-draftok");
      paint();
    } else if (kind === "approve") {
      const out = root.current.querySelector('[data-slot="out"]'),
        money = root.current.querySelector(".work-money");
      set(() => {
        a.stage = "approved";
        a.pay = "released";
        log(a, "approved");
        const s = L.store.s,
          day = C.today();
        if (!s.ledger.some(l => l.id === "l-" + a.id))
          s.ledger.unshift({
            id: "l-" + a.id,
            date: day,
            brand: a.brand,
            job: a.title,
            amount: a.price,
            status: "pending",
            clears: C.addDays(day, 7),
          });
        const b = s.bids.find(x => x.job === a.job && x.status === "accepted");
        if (b) {
          b.status = "completed";
          b.note = "Approved and closed. Leave feedback for the brand.";
        }
        s.notifications.unshift({
          id: "n-" + a.id,
          at,
          text: `${a.brand} approved your work. ${L.inr(L.payout(a.price).net)} is clearing.`,
          go: "#earnings",
          read: false,
        });
        if (t)
          t.msgs.push(
            { from: "brand", at, text: "Approved. Thank you, this is lovely." },
            { from: "sys", at, text: `Approved. ${L.inr(a.price)} released from escrow` },
          );
      }, "work-approved");
      // move the coin out of escrow first, then redraw the board
      L.motion.flip(
        () => {
          out && coin.current && out.append(coin.current);
          if (money) money.dataset.pay = "released";
        },
        coin.current ? [coin.current] : [],
      );
      setTimeout(
        () => {
          if (!root.current) return;
          paint();
          L.motion.celebrate(board.current);
          L.toast("Approved. Payout released from escrow", "check");
        },
        L.RM ? 0 : 650,
      );
    }
  };

  const d = C.deal(a),
    t = C.threadFor(a),
    last = t && t.msgs.filter(m => m.from !== "sys").slice(-1)[0];
  const dl = d.deliverables || [],
    files = a.uploads || [];
  const late = a.stage !== "approved" && C.days(a.due) < 0;
  const draftDone = files.length > 0;
  const out = a.pay === "released",
    funded = lastAt(a, "funded") || a.funded;

  return (
    <div className="view-in work" data-who={C.who(a)} ref={root}>
      <NetBanner cls="work-net" text="You are offline. Uploads pause and resume when you are back." />
      <a className="btn-q work-back" href="#active">
        <Icon n="back" />
        <span>Active deals</span>
      </a>
      <header className="work-head">
        <div className="work-head-t">
          <p className="work-brand">
            <span className="avatar v" aria-hidden="true">
              <Photo src={a.logo || C.logo(a.brand)}>{C.bi(a.brand)}</Photo>
            </span>
            <span>
              <b>{a.brand}</b>
              <span className="muted">
                <Icon n={platIc(d.platform)} />
                {C.plat(d.platform)} {d.format || ""}
              </span>
            </span>
            <span className="sample">Sample</span>
          </p>
          <h1 className="t-h1">{a.title}</h1>
        </div>
        <div className="work-head-m">
          <p className="work-price">
            <span className="t-money" data-price="">
              {L.inr(a.price)}
            </span>
            <span className="muted">agreed price, locked at acceptance</span>
          </p>
          <div className="row wrap">
            <PayPill a={a} />
            {t ? (
              <Lq as="a" className="lq-s lq-sm" href={`#chat-${t.id}`}>
                <Icon n="chat" />
                Chat{t.unread ? ` · ${t.unread} new` : ""}
              </Lq>
            ) : null}
          </div>
        </div>
      </header>

      <section className="card work-board" aria-labelledby="workBoardH" ref={board}>
        <h2 className="sr-only" id="workBoardH">
          Where this deal stands
        </h2>
        <div className="work-lane">
          <p className="work-lane-h">Work</p>
          <Rail a={a} from={from} />
        </div>
        <div className="work-lane work-lane-m">
          <p className="work-lane-h">
            Money <span>tracked apart from the work</span>
          </p>
          <div className="work-money" data-pay={out ? "released" : "escrow"}>
            <div className="work-mn work-mn-in is-done">
              <span className="work-mdot" aria-hidden="true"></span>
              <b>Paid in</b>
              <span>{funded ? L.fmtDate(funded) : "Funded"}</span>
            </div>
            <div className={`work-mn work-mn-hold${out ? " is-done" : " is-now"}`}>
              <span className="work-mdot" data-slot="hold" aria-hidden="true"></span>
              <b>Held in escrow</b>
              <span>
                {out
                  ? "Released " + L.fmtDate(lastAt(a, "approved") || C.iso())
                  : "Since " + (funded ? L.fmtDate(funded) : "funding")}
              </span>
              <span className="work-band" aria-hidden="true"></span>
            </div>
            <div className={`work-mn work-mn-out${out ? " is-now" : ""}`}>
              <span className="work-mdot" data-slot="out" aria-hidden="true"></span>
              <b>Released to you</b>
              <span>
                {out ? "Clearing into your balance" : "When " + a.brand.split(" ")[0] + " approves"}
              </span>
            </div>
          </div>
          <p className="work-money-note">
            {out
              ? "Released on approval. It reaches your balance once it clears."
              : `Completed is not paid. The ${L.inr(a.price)} leaves escrow only when ${a.brand} approves.`}
          </p>
        </div>
      </section>

      <div className="work-grid">
        <div className="work-main">
          <section className="card work-now" aria-labelledby="workNowH" aria-live="polite">
            <NowPanel
              key={a.stage + (a.draftOk ? "+ok" : "")}
              a={a}
              onStart={onStart}
              onUpload={onUpload}
              onLive={onLive}
              brandSide={brandSide}
            />
          </section>

          <section className="ll-panel work-sec" aria-labelledby="workBriefH">
            <div className="ll-panel-head">
              <h2 className="ll-panel-h" id="workBriefH">
                Collab details
              </h2>
            </div>
            <p className="work-brief">{d.brief || "The brand’s instructions are attached to the accepted bid."}</p>
            <dl className="work-facts">
              <div>
                <dt>Platform</dt>
                <dd>{C.plat(d.platform) + " " + (d.format || "")}</dd>
              </div>
              <div>
                <dt>Usage rights</dt>
                <dd>{d.usage || "As agreed in the bid"}</dd>
              </div>
              {d.languages && d.languages.length ? (
                <div>
                  <dt>Languages</dt>
                  <dd>{d.languages.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="ll-panel work-sec" aria-labelledby="workDelH">
            <div className="ll-panel-head">
              <h2 className="ll-panel-h" id="workDelH">
                Deliverables
              </h2>
            </div>
            <ol className="work-dl">
              {dl.map((x, i) => (
                <li key={i} className={a.stage === "approved" ? "is-ok" : ""}>
                  <span className="work-dl-n" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <span>{x}</span>
                  {a.stage === "approved" ? <span className="pill pill-ok">Approved</span> : null}
                </li>
              ))}
            </ol>
          </section>

          <section className="ll-panel work-sec" aria-labelledby="workFilesH">
            <div className="ll-panel-head">
              <h2 className="ll-panel-h" id="workFilesH">
                Uploads
              </h2>
            </div>
            {files.length ? (
              <ol className="work-files">
                {files
                  .map((f, i) => (
                    <li key={i}>
                      <span className="work-v">v{i + 1}</span>
                      <span className="work-files-n">
                        <b>{f.name}</b>
                        <span className="muted">
                          {f.size || ""} · {L.fmtDate(f.at) + ", " + C.time(f.at)}
                        </span>
                      </span>
                      {i === files.length - 1 ? <span className="pill pill-paper">Latest</span> : null}
                    </li>
                  ))
                  .reverse()}
              </ol>
            ) : (
              <p className="muted work-files-none">
                Nothing uploaded yet. Your drafts and versions show up here.
              </p>
            )}
          </section>
        </div>

        <aside className="work-side" aria-label="Deal details">
          <PayoutSlip
            price={a.price}
            head={out ? "Payout slip" : "Payout if approved"}
            brand={a.brand}
            job={a.title}
            status={
              out ? (
                <span className="pill pill-ok">
                  <Icon n="check" />
                  Released from escrow
                </span>
              ) : (
                <EscrowPill text="Held in escrow until approval" />
              )
            }
          />

          <section className="ll-panel work-sec" aria-labelledby="workDatesH">
            <div className="ll-panel-head">
              <h2 className="ll-panel-h" id="workDatesH">
                Dates
              </h2>
            </div>
            <dl>
              <div className="kv">
                <dt>Bid accepted</dt>
                <dd>{a.accepted ? L.fmtDate(a.accepted) : "—"}</dd>
              </div>
              <div className="kv">
                <dt>Escrow funded</dt>
                <dd>{a.funded ? L.fmtDate(a.funded) : "—"}</dd>
              </div>
              <div className="kv">
                <dt>Draft due</dt>
                <dd>
                  {L.fmtDate(a.draftDue || a.due)}
                  {draftDone ? " · sent" : ""}
                </dd>
              </div>
              <div className="kv">
                <dt>Due</dt>
                <dd className={late ? "work-late" : ""}>{C.due(a).replace(/^Due /, "")}</dd>
              </div>
            </dl>
          </section>

          {t ? (
            <a className="work-chat" href={`#chat-${t.id}`}>
              <span className="avatar v" aria-hidden="true">
                <Photo src={a.logo || C.logo(a.brand)}>{C.bi(a.brand)}</Photo>
              </span>
              <span className="work-chat-t">
                <b>Chat with {a.brand.split(" ")[0]}</b>
                <span className="muted">
                  {last ? (last.from === "me" ? "You: " : "") + last.text : "Say hello"}
                </span>
              </span>
              {t.unread ? (
                <span className="work-chat-n" aria-label={`${t.unread} unread`}>
                  {t.unread}
                </span>
              ) : (
                <Icon n="chevron" />
              )}
            </a>
          ) : null}
          {a.brandId ? (
            <Lq as="a" className="lq-s work-brandlink" href={`#brand-${a.brandId}`}>
              <Icon n="user" className="ic" />
              View {a.brand}'s profile
            </Lq>
          ) : null}
          <Lq as="a" className="lq-s work-brandlink" href={`#support-new-${a.id}`}>
            <Icon n="info" className="ic" />
            Get help with this deal
          </Lq>

          <section className="ll-panel work-sec" aria-labelledby="workLogH">
            <div className="ll-panel-head">
              <h2 className="ll-panel-h" id="workLogH">
                Log
              </h2>
            </div>
            <ol className="work-log">
              {(a.log || [])
                .slice()
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    <span>{(LOGT[e.kind] || (() => e.kind))(a, e)}</span>
                    <time dateTime={e.at}>{L.fmtDate(e.at) + ", " + C.time(e.at)}</time>
                  </li>
                ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function WorkScreen({ param: id }) {
  const a = L.store.s.active.find(x => x.id === id);
  if (!a)
    return (
      <div className="view-in">
        <div className="empty">
          <img src="assets/step-05-stamp.svg" width="200" height="146" alt="" />
          <p className="t-h2">This deal is not in your active work</p>
          <p className="muted">It may have been closed or the link is old.</p>
          <Lq as="a" className="lq-p" href="#active">
            Back to active deals
          </Lq>
        </div>
      </div>
    );
  return <Work key={a.id} a={a} />;
}

L.register("work", {
  title: p => {
    const a = L.store.s.active.find(x => x.id === p);
    return a ? a.title : "Active deal";
  },
  crumb: p => {
    const a = L.store.s.active.find(x => x.id === p);
    return '<a href="#active">Active deals</a>' + (a ? " / " + L.esc(a.brand) : "");
  },
  nav: "active",
  Component: WorkScreen,
});
