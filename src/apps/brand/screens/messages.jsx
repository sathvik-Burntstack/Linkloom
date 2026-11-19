/* Messages (#messages inbox) and one chat (#chat-<id>). Owned by Builder D.
   Mirrors the creator app's Messages screen: two panes on desktop, one stacked pane on phones.
   A chat exists only for a campaign the brand has paid into escrow (funded and later stages). Invited and accepted campaigns
   show a calm locked state that links to #campaign-<id> to pay. <id> may be a thread id (t1) or a campaign id (c3).
   Messages carry text and files (deliverables). Nothing is uploaded anywhere: files stay in this tab, delivery is simulated.
   The brand's own bubbles are violet, the creator's are coral-family, system cards (escrow, release) are plum.
   React screen (see src/shared/react/view.jsx). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { reportAbuse, supportError } from "@/shared/support/api";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD,
  M = () => L.motion;
const T0 = Date.now();
const FUNDED = ["funded", "in_progress", "submitted", "revision", "approved", "released"];
const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];
const LOCKED = ["invited", "accepted"];
const s = () => L.store.s;
const camp = id => s().campaigns.find(c => c.id === id);
/* In the real app a chat can open over a bid or an offer, before anything is paid: it then stands on its own. */
const loose = t => ({
  id: "",
  creator: t.creator,
  title: "Conversation",
  stage: "funded",
  price: 0,
  deliveries: [],
  loose: true,
});
const campOf = t => camp(t.campaign) || (L.live ? loose(t) : undefined);
const asked = new Set();
const first = n => n.split(" ")[0];
/* a steady React key per message (or delivery), so a bubble keeps its node when the server gives it an id */
const keys = new WeakMap();
let keyN = 0;
const keyOf = o => keys.get(o) || (keys.set(o, "m" + ++keyN), keys.get(o));

/* ---------- time ---------- */
const iso = () =>
  (import.meta.env.VITE_TEST_HOOKS
    ? new Date(L.today().getTime() + (Date.now() - T0))
    : new Date()
  ).toISOString();
const dayN = at => Math.floor((L.D(at).getTime() + 19800000) / 864e5);
const time = at =>
  L.D(at)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .replace(/\s?([ap])\.?m\.?/i, (m, x) => " " + x.toLowerCase() + "m");
const day = at => {
  const d = dayN(L.today().toISOString()) - dayN(at);
  return d === 0
    ? "Today"
    : d === 1
      ? "Yesterday"
      : L.D(at).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone: "Asia/Kolkata",
        });
};
const when = at => {
  if (!at) return "";
  const d = dayN(L.today().toISOString()) - dayN(at);
  return d === 0 ? time(at) : d === 1 ? "Yesterday" : L.fmtDate(at);
};

/* ---------- files ---------- */
const MAXB = 500 * 1024 * 1024,
  MAXN = 5;
const BAD_EXT = /\.(exe|bat|cmd|com|msi|apk|sh|js|vbs|scr|jar)$/i;
const fmtSize = b =>
  b >= 1073741824
    ? (b / 1073741824).toFixed(1).replace(/\.0$/, "") + " GB"
    : b >= 1048576
      ? Math.max(1, Math.round(b / 1048576)) + " MB"
      : b >= 1024
        ? Math.round(b / 1024) + " KB"
        : b + " bytes";
const ext = n => (n.match(/\.([a-z0-9]{1,5})$/i) || [, "file"])[1].toUpperCase();
const KIND = {
  MP4: "Video",
  MOV: "Video",
  WEBM: "Video",
  JPG: "Image",
  JPEG: "Image",
  PNG: "Image",
  HEIC: "Image",
  WEBP: "Image",
  PDF: "PDF",
  DOC: "Document",
  DOCX: "Document",
  ZIP: "Archive",
  MP3: "Audio",
  WAV: "Audio",
  PPTX: "Slides",
  KEY: "Slides",
  XLSX: "Sheet",
  CSV: "Sheet",
  TXT: "Text",
};
const blobs = new WeakMap(); // message -> object URL, for files the brand attached in this tab

/* ---------- PII guard (same rules as the creator app): KYC and bank details never go in chat ---------- */
const BLOCK = [
  [/\b[A-Z]{5}\d{4}[A-Z]\b/i, "a PAN number"],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, "an Aadhaar number"],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/i, "an IFSC code"],
  [/\b[\w.-]{2,}@[a-z]{2,}\b(?!\.)/i, "a UPI ID"],
  [/\b\d{9,18}\b/, "a bank account or phone number"],
];
const SOFT = /\b(pan card|aadhaa?r|passport|voter id|driving licen[cs]e|cancelled cheque|bank statement)\b/i;
const check = (v, names) => {
  for (const [re, what] of BLOCK) if (re.test(v)) return { block: true, what };
  return SOFT.test(v) || SOFT.test((names || []).join(" ").replace(/[-_.]/g, " ")) ? { block: false } : null;
};

/* ---------- threads ---------- */
const lastAt = t => (t.messages[t.messages.length - 1] || {}).at || "";
const lastText = t => {
  const m = t.messages.filter(x => x.from !== "system").slice(-1)[0] || t.messages.slice(-1)[0];
  if (!m) return "No messages yet";
  const body = m.file ? (m.text ? m.text : m.file.name) : m.text;
  return (m.from === "brand" ? "You: " : "") + (m.file && !m.text ? "Sent a file · " : "") + body;
};
/* a newly paid campaign (paid from Campaigns by Builder C) gets its chat here, opening with the plum escrow card */
const ensureThreads = () => {
  const st = s(),
    need = st.campaigns.filter(c => LIVE.includes(c.stage) && !st.threads.some(t => t.campaign === c.id));
  if (!need.length) return;
  if (L.live) {
    /* the server opens (or returns) the conversation with that creator */
    need.forEach(c => {
      if (asked.has(c.creator)) return;
      asked.add(c.creator);
      L.live.openChatWith(c.creator).catch(() => undefined);
    });
    return;
  }
  L.store.set(
    x =>
      need.forEach(c => {
        const id = "t" + c.id;
        x.threads.push({
          id,
          campaign: c.id,
          creator: c.creator,
          unread: 0,
          messages: [
            {
              from: "system",
              kind: "escrow",
              text: `You paid ${L.inr(c.price)} into escrow. Chat is open.`,
              at: c.funded || iso(),
            },
          ],
        });
        c.thread = id;
      }),
    "chat-thread-open",
  );
};
const threads = () =>
  s()
    .threads.filter(t => {
      const c = campOf(t);
      return c && FUNDED.includes(c.stage);
    })
    .sort((a, b) => L.D(lastAt(b)) - L.D(lastAt(a)));
const lockedCamps = () => s().campaigns.filter(c => LOCKED.includes(c.stage));
const resolve = p => {
  if (!p) return {};
  let t = s().threads.find(x => x.id === p);
  if (t)
    return {
      t: FUNDED.includes((campOf(t) || {}).stage) ? t : null,
      gone: !FUNDED.includes((campOf(t) || {}).stage),
    };
  const c = camp(p);
  if (!c) return { gone: true };
  t = s().threads.find(x => x.campaign === c.id);
  if (t && FUNDED.includes(c.stage)) return { t };
  if (LOCKED.includes(c.stage)) return { locked: c };
  return { gone: true };
};

const STAGE = {
  funded: "Paid into escrow · creator is starting",
  in_progress: "Creator is working",
  submitted: "Delivery to review",
  revision: "Revision requested",
  approved: "Approved · release on its way",
  released: "Paid to the creator",
};
const dueLine = c => {
  if (!c.due || ["released", "approved"].includes(c.stage)) return "";
  const d = L.daysLeft(c.due);
  return d < 0
    ? ` · ${-d} day${d === -1 ? "" : "s"} late`
    : d === 0
      ? " · due today"
      : ` · due ${L.fmtDate(c.due)}`;
};
const PayPill = ({ c }) =>
  c.stage === "released" ? (
    <span className="pill pill-ok">
      <Icon n="check" />
      Released
    </span>
  ) : (
    <span className="pill pill-escrow">
      <Icon n="lock" />
      In escrow
    </span>
  );
const Av = ({ cr }) => (
  <span className={`avatar msg-av${cr && cr.tone === "b" ? " is-b" : ""}`} aria-hidden="true">
    {L.initials(cr ? cr.name : "?")}
  </span>
);

function ThreadRow({ t, cur }) {
  const c = campOf(t),
    cr = L.creator(t.creator);
  return (
    <li data-t={t.id}>
      <a
        className="messages-th"
        href={`#chat-${t.id}`}
        aria-current={t.id === cur ? "true" : undefined}
        aria-label={`${cr.name}, ${c.title}${t.unread ? `, ${t.unread} unread` : ""}`}
      >
        <Av cr={cr} />
        <span className="messages-th-t">
          <span className="messages-th-r">
            <b>{cr.name}</b>
            <time dateTime={lastAt(t)}>{when(lastAt(t))}</time>
          </span>
          <span className="messages-th-job" data-done={String(c.stage === "released")}>
            <i aria-hidden="true"></i>
            {c.title}
          </span>
          <span className="messages-th-last">{lastText(t)}</span>
        </span>
        {t.unread && t.id !== cur ? (
          <span className="messages-th-n" aria-hidden="true">
            {t.unread}
          </span>
        ) : null}
      </a>
    </li>
  );
}
function LockedRow({ c, cur }) {
  const cr = L.creator(c.creator);
  return (
    <li data-c={c.id}>
      <a
        className="messages-th is-locked"
        href={`#chat-${c.id}`}
        aria-current={c.id === cur ? "true" : undefined}
        aria-label={`${cr.name}, ${c.title}, chat opens after payment`}
      >
        <Av cr={cr} />
        <span className="messages-th-t">
          <span className="messages-th-r">
            <b>{cr.name}</b>
            <span className="messages-th-lk">
              <Icon n="lock" />
              Locked
            </span>
          </span>
          <span className="messages-th-job">
            <i aria-hidden="true"></i>
            {c.title}
          </span>
          <span className="messages-th-last">
            {c.stage === "accepted"
              ? `Accepted. Pay ${L.inr(c.price)} to open chat`
              : "Invitation sent. Waiting for a reply"}
          </span>
        </span>
      </a>
    </li>
  );
}

const Placeholder = () => (
  <div className="chat-empty">
    <img src="assets/step-01-envelope.svg" width="200" height="146" alt="" />
    <p className="t-h2">Pick a chat</p>
    <ul className="chat-rules">
      <li>
        <Icon n="lock" />
        <span>Chats open only after you pay a deal into escrow.</span>
      </li>
      <li>
        <Icon n="file" />
        <span>
          Share briefs, product shots and feedback files here. Creators send their deliveries here too.
        </span>
      </li>
      <li>
        <Icon n="shield" />
        <span>Never send PAN, Aadhaar or bank details in chat. Payments stay on Linkloom.</span>
      </li>
    </ul>
  </div>
);
const Missing = () => (
  <div className="chat-empty">
    <img src="assets/step-03-lock.svg" width="200" height="146" alt="" className="chat-empty-ink" />
    <p className="t-h2">This chat isn’t open</p>
    <p className="muted">
      Chat is only for deals you have paid into escrow. If a deal was cancelled or refunded, its chat closes
      too.
    </p>
    <Lq as="a" className="lq-s" href="#messages">
      All chats
    </Lq>
  </div>
);

/* the calm locked state: why it is locked, where the campaign is, and the next step */
function LockedPane({ c }) {
  const cr = L.creator(c.creator),
    acc = c.stage === "accepted",
    fn = first(cr.name);
  const Step = ({ done, cur, label }) => (
    <li
      className={`chat-lk-s${done ? " is-done" : ""}${cur ? " is-cur" : ""}`}
      aria-current={cur ? "step" : undefined}
    >
      <i aria-hidden="true">{done ? <Icon n="check" /> : null}</i>
      <span>{label}</span>
    </li>
  );
  return (
    <div className="chat-empty chat-lk">
      <img src="assets/step-03-lock.svg" width="200" height="146" alt="" className="chat-empty-ink" />
      <p className="t-h2">Chat opens after you pay</p>
      <p className="muted">
        {acc ? (
          <>
            {cr.name} accepted your invitation for <b>{c.title}</b>. Pay {L.inr(c.price)} into escrow and the
            chat opens straight away. Linkloom holds the money until you approve the work.
          </>
        ) : (
          <>
            {fn} hasn’t replied to your invitation for <b>{c.title}</b> yet. Once {fn} accepts and you pay{" "}
            {L.inr(c.price)} into escrow, the chat opens here.
          </>
        )}
      </p>
      <ol className="chat-lk-rail" aria-label="Before chat opens">
        <Step done label="Invitation sent" />
        <Step done={acc} cur={!acc} label={acc ? "Accepted by " + fn : "Waiting for " + fn} />
        <Step cur={acc} label="Pay into escrow" />
        <Step label="Chat opens" />
      </ol>
      <div className="row wrap chat-lk-acts">
        <Lq as="a" className="lq-p" href={`#campaign-${c.id}`}>
          {acc ? "Pay into escrow" : "Open the deal"}
        </Lq>
        <Lq as="a" className="lq-s" href="#messages">
          All chats
        </Lq>
      </div>
      {acc ? (
        <p className="ll-trust">
          <Icon n="lock" />
          Held safely until you approve.
        </p>
      ) : null}
    </div>
  );
}

const REASONS = [
  "Asked to pay or talk outside Linkloom",
  "Asked for bank, PAN or Aadhaar details",
  "Sent something unsafe",
  "Rude or abusive",
  "Something else",
];
function ReportSheet({ t, cr, close, done }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    /* the report goes to Linkloom's Moderation queue (super admin), about the creator's profile */
    if (L.live) {
      setBusy(true);
      try {
        await reportAbuse({
          targetType: "profile",
          targetId: cr.id,
          reason,
          details: `Chat ${t.id}. ${note.trim()}`.trim(),
        });
      } catch (x) {
        if (!(x && x.code === "ALREADY_REPORTED")) {
          setBusy(false);
          L.toast(supportError(x, L.live.errorText), "alert");
          return;
        }
      }
    }
    L.store.set(() => {
      t.reported = { at: iso(), reason, note: note.trim() };
    }, "chat-report");
    close();
    L.toast("Report sent. The trust team replies within 24 hours.", "flag");
    done();
  };
  return (
    <form className="chat-sheet" noValidate onSubmit={submit}>
      <p className="muted">
        Linkloom’s trust team reads the chat and replies within 24 hours. {cr.name} is not told who reported
        it, and your escrow stays as it is.
      </p>
      <fieldset className="chat-reasons">
        <legend>What happened?</legend>
        {REASONS.map(r => (
          <label key={r} className="check">
            <input type="radio" name="rr" value={r} checked={reason === r} onChange={() => setReason(r)} />
            <span>{r}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="rrNote">
          Anything else? <span className="muted">(optional)</span>
        </label>
        <textarea
          className="textarea"
          id="rrNote"
          maxLength={500}
          placeholder="What should the team look at?"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>
      <div className="row wrap">
        <Lq className="lq-p" type="submit" disabled={busy}>
          Send report
        </Lq>
        <Lq className="lq-s" data-cancel="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}

/* ---------- the composer: text, file chips, the PII guard ---------- */
function Composer({ cr, fn, pending, setPending, fileErr, setFileErr, addFiles, onSend }) {
  const [v, setV] = useState("");
  const inp = useRef(null),
    warn = useRef(null),
    btn = useRef(null),
    clip = useRef(null),
    fileIn = useRef(null),
    att = useRef(null);
  useEffect(() => {
    M().press(btn.current);
    M().press(clip.current);
  }, []);
  /* toggled by hand: the press motion adds its own class to this button */
  useLayoutEffect(() => {
    clip.current.classList.toggle("is-on", !!pending.length);
  }, [pending.length]);
  useLayoutEffect(() => {
    const i = inp.current;
    i.style.height = "auto";
    i.style.height = Math.min(i.scrollHeight, 160) + "px";
  }, [v]);
  const r = check(
    v,
    pending.map(f => f.name),
  );
  const show = r || fileErr;
  const submit = e => {
    e.preventDefault();
    const text = v.trim();
    if ((!text && !pending.length) || (r && r.block)) {
      if (r && r.block && M().shake) M().shake(warn.current);
      inp.current.focus();
      return;
    }
    onSend(text, pending.slice());
    flushSync(() => {
      setPending([]);
      setFileErr("");
      setV("");
    });
    inp.current.focus();
  };
  return (
    <form className="chat-compose" noValidate onSubmit={submit}>
      <p
        className={`chat-warn${!fileErr && r && !r.block ? " is-soft" : ""}`}
        id="chatWarn"
        role="alert"
        hidden={!show}
        ref={warn}
      >
        {r && r.block ? (
          <>
            <Icon n="alert" />
            <span>This looks like {r.what}. Remove it to send; KYC and bank details never go in chat.</span>
          </>
        ) : fileErr ? (
          <>
            <Icon n="alert" />
            <span>{fileErr}</span>
          </>
        ) : r ? (
          <>
            <Icon n="shield" />
            <span>
              Reminder: ID documents and bank papers never go in chat. Linkloom handles payments for you.
            </span>
          </>
        ) : null}
      </p>
      <ul className="chat-att" aria-label="Files to send" hidden={!pending.length} ref={att}>
        {pending.map((f, i) => (
          <li key={f.name + f.size} className="chat-chip">
            <Icon n="file" />
            <span className="chat-chip-n" title={f.name}>
              {f.name}
            </span>
            <span className="chat-chip-s">{fmtSize(f.size)}</span>
            <button
              type="button"
              className="chat-chip-x"
              data-x={i}
              aria-label={`Remove ${f.name}`}
              onClick={() => {
                flushSync(() => {
                  setPending(p => p.filter((_, k) => k !== i));
                  setFileErr("");
                });
                (att.current.querySelector(".chat-chip-x") || inp.current).focus();
              }}
            >
              <Icon n="close" />
            </button>
          </li>
        ))}
      </ul>
      <div className="chat-compose-r">
        <input
          className="sr-only"
          type="file"
          id="chatFile"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          ref={fileIn}
          onChange={e => {
            addFiles(e.target.files);
            e.target.value = "";
            inp.current.focus();
          }}
        />
        <button
          className="chat-clip"
          type="button"
          aria-label="Attach files"
          aria-describedby="chatHint"
          data-press=""
          ref={clip}
          onClick={() => fileIn.current.click()}
        >
          <Icon n="paperclip" />
        </button>
        <label className="sr-only" htmlFor="chatIn">
          Message {cr.name}
        </label>
        <textarea
          className="chat-in"
          id="chatIn"
          rows={1}
          maxLength={1000}
          placeholder={`Write to ${fn}`}
          aria-describedby="chatWarn chatHint"
          ref={inp}
          value={v}
          onChange={e => setV(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form.requestSubmit();
            }
          }}
        />
        <button
          className="chat-send"
          type="submit"
          aria-label="Send"
          data-press=""
          ref={btn}
          disabled={(!v.trim() && !pending.length) || !!(r && r.block)}
        >
          <Icon n="send" />
        </button>
      </div>
      <p className="chat-hint" id="chatHint">
        <span className="chat-hint-k">
          <Icon n="lock" />
          Never send PAN, Aadhaar or bank details here.
        </span>
        <span className="chat-hint-e">Files up to 500 MB each · Enter to send</span>
      </p>
    </form>
  );
}

/* ---------- one chat ---------- */
function Chat({ t, onInbox }) {
  const c = campOf(t),
    cr = L.creator(t.creator),
    fn = first(cr.name);
  const [, redraw] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState([]); // File objects waiting to be sent
  const [fileErr, setFileErr] = useState("");
  const fresh = useRef(t.unread);
  const newOnes = useRef(new Set()); // bubbles added in this visit, which animate in
  const dragN = useRef(0);
  const chat = useRef(null),
    log = useRef(null),
    opt = useRef(null),
    menu = useRef(null);
  const draw = () => flushSync(() => redraw(n => n + 1));
  const bottom = () => log.current && (log.current.scrollTop = log.current.scrollHeight);

  /* mark read: the thread and its message notifications (before the first paint, as the inbox badge goes with it) */
  const marked = useRef(false);
  if (!marked.current) {
    marked.current = true;
    if (L.live) L.live.markRead(t.id).catch(() => undefined);
    const goKey = "#chat-" + t.id;
    if (t.unread || s().notifications.some(n => !n.read && n.kind === "message" && n.go === goKey))
      L.store.set(x => {
        t.unread = 0;
        x.notifications.forEach(n => {
          if (n.kind === "message" && n.go === goKey) n.read = true;
        });
      }, "chat-read");
  }

  useEffect(() => {
    const onNet = () => setOnline(navigator.onLine);
    addEventListener("offline", onNet);
    addEventListener("online", onNet);
    requestAnimationFrame(bottom);
    const newMark = log.current.querySelector(".chat-new");
    newMark && requestAnimationFrame(() => (log.current.scrollTop = Math.max(0, newMark.offsetTop - 80)));
    /* escrow is held: the plum stitch wraps the pinned pill once per session per chat */
    const pill = chat.current.querySelector(".chat-job .pill-escrow");
    if (pill && !t._locked) {
      t._locked = true;
      setTimeout(() => M().lock && pill.isConnected && M().lock(pill, { color: "plum" }), 420);
    }
    let shown = t.messages.length;
    const offLive = L.store.on(why => {
      if (why === "chat-send") shown = t.messages.length;
      if (why !== "chat-live" || t.messages.length <= shown) return;
      t.messages.slice(shown).forEach(m => newOnes.current.add(m));
      shown = t.messages.length;
      if (t.unread) {
        L.store.set(() => (t.unread = 0), "chat-read");
        L.live && L.live.markRead(t.id).catch(() => undefined);
      }
      draw();
      bottom();
      onInbox();
    });
    addEventListener("online", retryAll);
    const outside = e => {
      if (menu.current && !menu.current.hidden && !e.target.closest(".chat-more")) setMenuOpen(false);
    };
    document.addEventListener("click", outside);
    return () => {
      offLive();
      removeEventListener("online", retryAll);
      removeEventListener("offline", onNet);
      removeEventListener("online", onNet);
      document.removeEventListener("click", outside);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- files ---------- */
  const addFiles = list => {
    const errs = [],
      next = pending.slice();
    [...list].forEach(f => {
      if (next.length >= MAXN) return errs.push(`You can attach up to ${MAXN} files at a time.`);
      if (BAD_EXT.test(f.name))
        return errs.push(`${f.name} can’t be sent. Program files are blocked for safety.`);
      if (f.size > MAXB)
        return errs.push(
          `${f.name} is ${fmtSize(f.size)}. Files can be up to 500 MB; share a cloud link for bigger cuts.`,
        );
      if (!f.size) return errs.push(`${f.name} is empty.`);
      if (!next.some(p => p.name === f.name && p.size === f.size)) next.push(f);
    });
    const err = [...new Set(errs)].join(" ");
    flushSync(() => {
      setPending(next);
      setFileErr(err);
    });
    if (err && M().shake) M().shake(chat.current.querySelector("#chatWarn"));
    const last = chat.current.querySelector(".chat-att")?.lastElementChild;
    last && !errs.length && M().bump && M().bump(last, 1.02);
  };
  const hasFiles = e => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");

  /* ---------- delivery ---------- */
  const deliver = m => {
    if (L.live) {
      if (!navigator.onLine) {
        m.status = "queued";
        return draw();
      }
      L.live.sendMessage(t.id, m.text || "", m._raw).then(
        saved => {
          m.status = "delivered";
          m.id = saved.id;
          if (saved.file) m.file.uploadId = saved.file.uploadId;
          draw();
        },
        er => {
          m.status = "queued";
          draw();
          L.toast(L.live.errorText(er), "alert");
        },
      );
      return;
    }
    setTimeout(
      () => {
        if (!navigator.onLine) {
          m.status = "queued";
          return draw();
        }
        m.status = "sent";
        draw();
        setTimeout(() => {
          if (m.status === "sent") {
            m.status = "delivered";
            draw();
          }
        }, 900);
      },
      m.file ? 900 : 550,
    );
  };
  function retryAll() {
    t.messages
      .filter(m => m.status === "queued")
      .forEach(m => {
        m.status = "sending";
        draw();
        deliver(m);
      });
  }
  /* sending adds no notification for the brand: it is the brand's own action */
  const send = (text, files) => {
    const st = navigator.onLine ? "sending" : "queued",
      made = [];
    files.forEach((f, i) => {
      const m = {
        from: "brand",
        at: iso(),
        file: { name: f.name, size: fmtSize(f.size), type: f.type || "" },
        text: i === 0 && files.length === 1 ? text : "",
        status: st,
      };
      try {
        blobs.set(m, URL.createObjectURL(f));
      } catch (e) {}
      Object.defineProperty(m, "_raw", { value: f, enumerable: false });
      made.push(m);
    });
    if (text && files.length !== 1) made.push({ from: "brand", at: iso(), text, status: st });
    L.store.set(() => {
      made.forEach(m => t.messages.push(m));
    }, "chat-send");
    made.forEach(m => newOnes.current.add(m));
    draw();
    made.forEach(m => m.status === "sending" && deliver(m));
    bottom();
    onInbox();
    if (files.length)
      L.toast(
        files.length === 1 ? `${files[0].name} sent to ${fn}` : `${files.length} files sent to ${fn}`,
        "check",
      );
  };

  /* ---------- options menu ---------- */
  const items = () => L.$$("[role=menuitem]", menu.current);
  const closeMenu = focus => {
    setMenuOpen(false);
    if (focus) opt.current.focus();
  };
  const openMenu = () => {
    flushSync(() => setMenuOpen(true));
    items()[0].focus();
  };
  const onMenuKey = e => {
    const its = items(),
      i = its.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      its[(i + 1) % its.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      its[(i - 1 + its.length) % its.length].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      its[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      its[its.length - 1].focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") closeMenu();
  };

  /* ---------- the log ---------- */
  const meta = m => {
    if (m.from !== "brand") return <time dateTime={m.at}>{time(m.at)}</time>;
    const st = m.status || "delivered";
    const label = {
      sending: ["clock", "Sending…"],
      sent: ["check", "Sent"],
      delivered: ["check", "Delivered"],
      queued: ["alert", "Not sent · waiting for network"],
    }[st] || ["", ""];
    return (
      <>
        <time dateTime={m.at}>{time(m.at)}</time>
        <span className="chat-st" data-st={st}>
          {label[0] ? <Icon n={label[0]} /> : null}
          {label[1]}
        </span>
        {st === "queued" ? (
          <button
            className="btn-q chat-retry"
            type="button"
            onClick={() =>
              navigator.onLine ? retryAll() : L.toast("Still offline. It sends when you reconnect.", "alert")
            }
          >
            Retry
          </button>
        ) : null}
      </>
    );
  };
  const delivOf = m => m.file && (c.deliveries || []).find(d => d.file === m.file.name);
  const fileCard = m => {
    const f = m.file,
      d = m._deliv || delivOf(m),
      x = ext(f.name),
      url = blobs.get(m);
    const kind = (KIND[x] || "File") + " · " + x + (f.size ? " · " + f.size : "");
    const act = d ? (
      <a className="chat-file-a" href={`#campaign-${c.id}`}>
        <Icon n="eye" />
        Review delivery
      </a>
    ) : url ? (
      <a className="chat-file-a" href={url} download={f.name}>
        <Icon n="download" />
        Download
      </a>
    ) : f.uploadId ? (
      <button
        className="chat-file-a btn-q"
        type="button"
        data-upload={f.uploadId}
        onClick={() =>
          L.live &&
          L.live.openDelivery({ uploadId: f.uploadId }).catch(er => L.toast(L.live.errorText(er), "alert"))
        }
      >
        <Icon n="download" />
        Open
      </button>
    ) : (
      <span className="chat-file-n">{m.from === "brand" ? "Shared" : "File"}</span>
    );
    return (
      <div className={`chat-file${d ? " is-deliv" : ""}`}>
        <span className="chat-file-ic" aria-hidden="true">
          <Icon n="file" />
          <b>{x.slice(0, 4)}</b>
        </span>
        <span className="chat-file-t">
          {d ? (
            <span className="chat-file-k">
              Delivery v{d.v}
              {c.stage === "submitted" && d === (c.deliveries || []).slice(-1)[0] ? " · to review" : ""}
            </span>
          ) : null}
          <b title={f.name}>{f.name}</b>
          <span className="chat-file-m">{kind}</span>
        </span>
        {act}
        {d && d.note ? <p className="chat-file-note">{d.note}</p> : null}
      </div>
    );
  };
  /* deliveries from the campaign that never came through chat still show, as creator file cards */
  const synth = (c.deliveries || [])
    .filter(d => !t.messages.some(m => m.file && m.file.name === d.file))
    .map(d => ({
      from: "creator",
      at: d.at,
      file: { name: d.file, size: d.size || "" },
      _deliv: d,
      _syn: true,
    }));
  const msgs = [...t.messages, ...synth].sort((x, y) => L.D(x.at) - L.D(y.at));
  let dk = "",
    newFrom = -1;
  for (let i = msgs.length - 1, left = fresh.current; i >= 0 && left > 0; i--)
    if (msgs[i].from === "creator") {
      newFrom = i;
      left--;
    }
  const rows = [];
  msgs.forEach((m, i) => {
    const k = dayN(m.at);
    if (k !== dk) {
      dk = k;
      rows.push(
        <li key={"d" + k} className="chat-day">
          <span>{day(m.at)}</span>
        </li>,
      );
    }
    if (i === newFrom)
      rows.push(
        <li key="new" className="chat-new">
          <span>{fresh.current} new</span>
        </li>,
      );
    const key = keyOf(m._syn ? m._deliv : m);
    if (m.from === "system") {
      const kk = m.kind || (/release/i.test(m.text) ? "released" : "escrow");
      rows.push(
        <li key={key} className="chat-sys is-plum" data-k={kk}>
          <span className="chat-sys-c">
            <Icon n={kk === "released" ? "coin" : kk === "refund" ? "refund" : "lock"} />
            <span>
              <b>{kk === "released" ? "Released" : kk === "refund" ? "Refunded" : "Escrow paid"}</b>
              {m.text}
            </span>
          </span>
          <time dateTime={m.at}>{time(m.at)}</time>
        </li>,
      );
      return;
    }
    const me = m.from === "brand",
      isNew = newOnes.current.has(m);
    rows.push(
      <li
        key={key}
        className={`chat-msg ${me ? "is-me" : "is-them"}${m.file ? " has-file" : ""}${isNew ? " is-new" : ""}`}
        onAnimationEnd={isNew ? () => newOnes.current.delete(m) && redraw(n => n + 1) : undefined}
      >
        {m.file ? fileCard(m) : null}
        {m.text ? <p className="chat-b">{m.text}</p> : null}
        <p className="chat-meta">{meta(m)}</p>
      </li>,
    );
  });
  if (t.reported)
    rows.push(
      <li key="flag" className="chat-sys is-flag">
        <span className="chat-sys-c">
          <Icon n="flag" />
          <span>
            You reported this chat on {L.fmtDate(t.reported.at)}. Linkloom’s trust team reviews it within 24
            hours.
          </span>
        </span>
      </li>,
    );

  return (
    <div
      className={`chat${drag ? " is-drag" : ""}`}
      ref={chat}
      onDragEnter={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragN.current++;
        setDrag(true);
      }}
      onDragLeave={e => {
        if (!hasFiles(e)) return;
        dragN.current = Math.max(0, dragN.current - 1);
        if (!dragN.current) setDrag(false);
      }}
      onDragOver={e => hasFiles(e) && e.preventDefault()}
      onDrop={e => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragN.current = 0;
        setDrag(false);
        addFiles(e.dataTransfer.files);
        chat.current.querySelector("#chatIn").focus();
      }}
    >
      <header className="chat-h">
        <a className="ibtn chat-back" href="#messages" aria-label="All chats">
          <Icon n="back" />
        </a>
        <Av cr={cr} />
        <div className="chat-h-t">
          <h2 className="chat-name">{cr.name}</h2>
          <p className="help">
            {cr.handle} · paid into escrow {L.fmtDate(c.funded || lastAt(t))}
          </p>
        </div>
        <div className="chat-more">
          <button
            className="chat-opt"
            type="button"
            aria-haspopup="menu"
            aria-expanded={String(menuOpen)}
            aria-controls="chatMenu"
            ref={opt}
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
            onKeyDown={e => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                openMenu();
              }
            }}
          >
            Options
            <Icon n="down" />
          </button>
          <ul
            className="chat-menu"
            id="chatMenu"
            role="menu"
            aria-label="Chat options"
            hidden={!menuOpen}
            ref={menu}
            onKeyDown={onMenuKey}
          >
            {c.loose ? null : (
              <li role="none">
                <a role="menuitem" tabIndex={-1} href={`#campaign-${c.id}`}>
                  <Icon n="rail" />
                  Open the deal
                </a>
              </li>
            )}
            <li role="none">
              <a role="menuitem" tabIndex={-1} href={`#creator-${cr.id}`}>
                <Icon n="user" />
                View {fn}’s profile
              </a>
            </li>
            <li role="none">
              <button
                role="menuitem"
                tabIndex={-1}
                type="button"
                data-report=""
                onClick={() => {
                  closeMenu();
                  openReactSheet({
                    title: "Report this chat",
                    render: close => (
                      <ReportSheet
                        t={t}
                        cr={cr}
                        close={close}
                        done={() => {
                          draw();
                          bottom();
                        }}
                      />
                    ),
                  });
                }}
              >
                <Icon n="flag" />
                Report this chat
              </button>
            </li>
          </ul>
        </div>
      </header>
      <a
        className="chat-job"
        href={`#campaign-${c.id}`}
        data-done={String(c.stage === "released")}
        hidden={!!c.loose}
      >
        <span className="chat-job-t">
          <span className="chat-job-k">Deal</span>
          <b>{c.title}</b>
          <span className="chat-job-s">
            <i aria-hidden="true"></i>
            {(STAGE[c.stage] || "") + dueLine(c)}
          </span>
        </span>
        <span className="chat-job-m">
          <b className="t-money">{L.inr(c.price)}</b>
          <PayPill c={c} />
        </span>
        <Icon n="chevron" />
      </a>
      <p className="chat-net" role="status" hidden={online}>
        <Icon n="alert" />
        <span>You are offline. New messages wait and send when you are back.</span>
      </p>
      <ol
        className="chat-log"
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${cr.name}`}
        tabIndex={0}
        ref={log}
      >
        <li className="chat-safe">
          <Icon n="lock" />
          <span>
            Never send PAN, Aadhaar or bank details in chat. Keep payments on Linkloom so your money stays in
            escrow.
          </span>
        </li>
        {rows}
      </ol>
      <div className="chat-foot">
        <Composer
          cr={cr}
          fn={fn}
          pending={pending}
          setPending={setPending}
          fileErr={fileErr}
          setFileErr={setFileErr}
          addFiles={addFiles}
          onSend={send}
        />
      </div>
      <div className="chat-drop" aria-hidden="true">
        <span>
          <Icon n="paperclip" />
          Drop files to attach
        </span>
      </div>
    </div>
  );
}

/** A chat that is still loading its messages from the server. */
function ChatLoader({ t, onInbox }) {
  const [st, setSt] = useState(L.live && !t.loaded ? "loading" : "ready");
  useEffect(() => {
    if (st !== "loading") return;
    let gone = false;
    L.live.loadThread(t.id).then(
      () => !gone && setSt("ready"),
      () => !gone && setSt("failed"),
    );
    return () => (gone = true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (st === "loading")
    return (
      <div className="chat-empty" role="status">
        <p className="t-h2">Loading messages…</p>
      </div>
    );
  if (st === "failed")
    return (
      <div className="chat-empty" role="alert">
        <p className="t-h2">We couldn't load this chat</p>
        <p className="muted">Check your connection and try again.</p>
        <Lq as="a" className="lq-s" href="#messages">
          All chats
        </Lq>
      </div>
    );
  return <Chat t={t} onInbox={onInbox} />;
}

function MessagesScreen({ param }) {
  const [, redraw] = useState(0);
  const ul = useRef(null),
    root = useRef(null);
  const once = useRef(false);
  if (!once.current) {
    once.current = true;
    ensureThreads();
  }
  useEffect(() => {
    root.current && M().stagger(L.$$(".messages-scroll li", root.current));
  }, []);
  const list = threads(),
    locked = lockedCamps(),
    r = resolve(param);
  if (!list.length && !locked.length)
    return (
      <div className="view-in messages-none-v">
        <h1 className="t-h1">Messages</h1>
        <div className="empty">
          <img src="assets/step-01-envelope.svg" width="220" height="160" alt="" />
          <p className="t-h2">No chats yet</p>
          <p className="muted">
            A chat opens when a creator accepts your invitation or bid and you pay into escrow. Until then,
            nobody can message you here.
          </p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <Lq as="a" className="lq-p" href="#creators">
              Find creators
            </Lq>
            <Lq as="a" className="lq-s" href="#campaigns">
              See deals
            </Lq>
          </div>
        </div>
      </div>
    );
  const t = r.t,
    lockC = r.locked;
  const cr = t ? L.creator(t.creator) : lockC ? L.creator(lockC.creator) : null;
  /* keep the inbox in step: preview text, time, and order (FLIP when a thread jumps to the top) */
  const onInbox = () => {
    if (!ul.current) return;
    M().flip(() => flushSync(() => redraw(n => n + 1)), L.$$(":scope > li", ul.current));
  };
  return (
    <div className="view-in messages" data-mode={param ? "thread" : "list"} ref={root}>
      <div className="messages-wrap">
        <aside className="messages-list" aria-labelledby="msgH">
          <header className="messages-list-h">
            <h1 className="t-h2" id="msgH">
              Messages
            </h1>
            <p className="help">
              A chat opens once you pay a deal into escrow. <span className="sample">Sample</span>
            </p>
          </header>
          <div className="messages-scroll">
            {list.length ? (
              <ul className="messages-threads" aria-label="Open chats" ref={ul}>
                {list.map(x => (
                  <ThreadRow key={x.id} t={x} cur={t && t.id} />
                ))}
              </ul>
            ) : (
              <p className="messages-nolist muted">No open chats yet.</p>
            )}
            {locked.length ? (
              <>
                <p className="messages-grp" id="lockH">
                  <Icon n="lock" />
                  Opens after payment
                </p>
                <ul className="messages-threads messages-locked" aria-labelledby="lockH">
                  {locked.map(c => (
                    <LockedRow key={c.id} c={c} cur={lockC && lockC.id} />
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </aside>
        <section
          className="chat-pane"
          aria-label={t ? "Chat with " + cr.name : lockC ? "Chat with " + cr.name + ", locked" : "Chat"}
        >
          {t ? (
            <ChatLoader key={t.id} t={t} onInbox={onInbox} />
          ) : lockC ? (
            <LockedPane c={lockC} />
          ) : param ? (
            <Missing />
          ) : (
            <Placeholder />
          )}
        </section>
      </div>
    </div>
  );
}

const nameFor = p => {
  const r = resolve(p),
    x = r.t ? L.creator(r.t.creator) : r.locked ? L.creator(r.locked.creator) : null;
  return x ? x.name : "";
};
L.register("messages", {
  title: "Messages",
  nav: "messages",
  Component: () => <MessagesScreen param={null} />,
});
L.register("chat", {
  title: p => {
    const n = nameFor(p);
    return n ? "Chat with " + n : "Chat";
  },
  crumb: p => {
    const n = nameFor(p);
    return '<a href="#messages">Messages</a>' + (n ? " / " + L.esc(n) : "");
  },
  nav: "messages",
  Component: MessagesScreen,
});
