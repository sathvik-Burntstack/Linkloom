/* Messages (#messages inbox) and one chat (#chat-<id>). Owned by Builder C.
   Chat exists only with brands that accepted a bid: a thread shows only while it is tied to an accepted, funded job (t.job -> active[]).
   Two panes on desktop; on phones the inbox and the chat are separate stacked views. Nothing is sent anywhere: delivery is simulated.
   React screen (see src/shared/react/view.jsx). */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { reportAbuse, supportError } from "@/shared/support/api";
import { fromHtml, Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD;
const C = (window.LLD_C = window.LLD_C || {});
/* In the real app a chat can also open over a bid or an offer, before any order exists: it then stands on its own. */
const loose = t => ({
  id: "",
  job: "",
  brand: t.brand,
  title: "Conversation",
  platform: "instagram",
  format: "",
  price: 0,
  stage: "kickoff",
  pay: "escrow",
  due: "",
  uploads: [],
  deliverables: [],
  thread: t.id,
  log: [],
  loose: true,
});
const jobOf = t => L.store.s.active.find(a => a.id === t.job) || (L.live ? loose(t) : undefined);
const lastAt = t => (t.msgs[t.msgs.length - 1] || {}).at || "";
const lastText = t => {
  const m = t.msgs.filter(x => x.from !== "sys").slice(-1)[0] || t.msgs.slice(-1)[0];
  return m ? (m.from === "me" ? "You: " : "") + m.text : "No messages yet";
};
const threads = () => L.store.s.threads.filter(jobOf).sort((a, b) => L.D(lastAt(b)) - L.D(lastAt(a)));
const first = n => n.split(" ")[0];
/* a steady React key per message, so a bubble keeps its node when the server gives it an id */
const keys = new WeakMap();
let keyN = 0;
const keyOf = m => keys.get(m) || (keys.set(m, "m" + ++keyN), keys.get(m));

/* KYC and payout details never go in chat: numbers that look like them block sending; ID words get a gentle reminder */
const BLOCK = [
  [/\b[A-Z]{5}\d{4}[A-Z]\b/i, "a PAN number"],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, "an Aadhaar number"],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/i, "an IFSC code"],
  [/\b[\w.-]{2,}@[a-z]{2,}\b(?!\.)/i, "a UPI ID"],
  [/\b\d{9,18}\b/, "an account or phone number"],
];
const SOFT = /\b(pan card|aadhaa?r|passport|voter id|driving licen[cs]e|selfie)\b/i;
const check = v => {
  for (const [re, what] of BLOCK) if (re.test(v)) return { block: true, what };
  return SOFT.test(v) ? { block: false } : null;
};
const stageLine = a =>
  a.stage === "approved" ? C.STAGES[C.ix(a)].long : `${C.STAGES[C.ix(a)].long} · ${C.due(a)}`;

function ThreadRow({ t, cur }) {
  const a = jobOf(t),
    who = C.who(a);
  return (
    <li data-t={t.id}>
      <a
        className="messages-th"
        href={`#chat-${t.id}`}
        aria-current={t.id === cur ? "true" : undefined}
        aria-label={`${t.brand}, ${a.title}${t.unread ? `, ${t.unread} unread` : ""}`}
      >
        <span className="avatar v" aria-hidden="true">
          {t.bi || C.bi(t.brand)}
        </span>
        <span className="messages-th-t">
          <span className="messages-th-r">
            <b>{t.brand}</b>
            <time dateTime={lastAt(t)}>{C.when(lastAt(t))}</time>
          </span>
          <span className="messages-th-job" data-who={who}>
            <i aria-hidden="true"></i>
            {a.title}
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

const Placeholder = () => (
  <div className="chat-empty">
    <img src="assets/step-01-envelope.svg" width="200" height="146" alt="" />
    <p className="t-h2">Pick a chat</p>
    <ul className="chat-rules">
      <li>
        <Icon n="check" />
        <span>Chats open only after a brand accepts your bid.</span>
      </li>
      <li>
        <Icon n="lock" />
        <span>Keep the deal here. The money stays in escrow until approval.</span>
      </li>
      <li>
        <Icon n="shield" />
        <span>Never send PAN, Aadhaar, bank details or ID photos in chat.</span>
      </li>
    </ul>
  </div>
);
const Missing = () => (
  <div className="chat-empty">
    <img src="assets/step-03-lock.svg" width="200" height="146" alt="" className="chat-empty-ink" />
    <p className="t-h2">This chat isn’t open</p>
    <p className="muted">
      Chat unlocks only with a brand that accepted your bid. If a deal was cancelled, the chat closes too.
    </p>
    <Lq as="a" className="lq-s" href="#messages">
      All chats
    </Lq>
  </div>
);

const REASONS = [
  "Asked for KYC, bank or UPI details",
  "Wants to pay or talk outside Linkloom",
  "Spam or scam",
  "Rude or abusive",
  "Something else",
];
function ReportSheet({ t, close, done }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    /* the report goes to Linkloom's Moderation queue (super admin), about the brand's profile */
    if (L.live) {
      setBusy(true);
      try {
        await reportAbuse({
          targetType: t.brandId ? "profile" : "content",
          targetId: t.brandId || t.id,
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
      t.reported = { at: C.iso(), reason, note: note.trim() };
    }, "chat-report");
    close();
    L.toast("Report sent. The trust team replies within 24 hours.", "flag");
    done();
  };
  return (
    <form className="chat-sheet" noValidate onSubmit={submit}>
      <p className="muted">
        Linkloom’s trust team reads the chat and replies within 24 hours. {t.brand} is not told who reported
        it.
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
      <p className="help chat-sheet-note">
        <Icon n="lock" />
        <span>Don’t paste ID or bank details here either.</span>
      </p>
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
function BlockSheet({ t, a, close, yes }) {
  return (
    <div className="chat-sheet">
      <ul className="chat-rules">
        <li>
          <Icon n="close" />
          <span>They can’t send you messages.</span>
        </li>
        <li>
          <Icon n="lock" />
          <span>The deal and the {L.inr(a.price)} in escrow stay as they are.</span>
        </li>
        <li>
          <Icon n="shield" />
          <span>Linkloom support handles anything urgent about the deal.</span>
        </li>
      </ul>
      <div className="row wrap">
        <Lq
          className="lq-p"
          data-yes=""
          onClick={() => {
            close();
            yes();
          }}
        >
          Block {first(t.brand)}
        </Lq>
        <Lq className="lq-s" data-no="" onClick={() => close()}>
          Keep chatting
        </Lq>
      </div>
    </div>
  );
}

/* ---------- the composer ---------- */
function Composer({ t, onSend }) {
  const [v, setV] = useState("");
  const inp = useRef(null),
    warn = useRef(null),
    btn = useRef(null);
  useEffect(() => {
    L.motion.press(btn.current);
  }, []);
  useLayoutEffect(() => {
    const i = inp.current;
    i.style.height = "auto";
    i.style.height = Math.min(i.scrollHeight, 160) + "px";
  }, [v]);
  const r = check(v);
  const submit = e => {
    e.preventDefault();
    const text = v.trim();
    if (!text || (r && r.block)) {
      if (r && r.block && L.motion.shake) L.motion.shake(warn.current);
      inp.current.focus();
      return;
    }
    onSend(text);
    setV("");
    inp.current.focus();
  };
  return (
    <form className="chat-compose" noValidate onSubmit={submit}>
      <p
        className={`chat-warn${r && !r.block ? " is-soft" : ""}`}
        id="chatWarn"
        role="alert"
        hidden={!r}
        ref={warn}
      >
        {r ? (
          <>
            <Icon n={r.block ? "alert" : "shield"} />
            <span>
              {r.block
                ? `This looks like ${r.what}. Remove it to send; KYC and payout details never go in chat.`
                : "Reminder: never send ID documents or photos here. Linkloom collects them only in verification."}
            </span>
          </>
        ) : null}
      </p>
      <div className="chat-compose-r">
        <label className="sr-only" htmlFor="chatIn">
          Message {t.brand}
        </label>
        <textarea
          className="chat-in"
          id="chatIn"
          rows={1}
          maxLength={1000}
          placeholder={`Write to ${first(t.brand)}`}
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
          disabled={!v.trim() || !!(r && r.block)}
        >
          <Icon n="send" />
        </button>
      </div>
      <p className="chat-hint" id="chatHint">
        <span className="chat-hint-k">
          <Icon n="lock" />
          Never send PAN, Aadhaar, bank or UPI details here.
        </span>
        <span className="chat-hint-e">Enter to send, Shift + Enter for a new line</span>
      </p>
    </form>
  );
}

/* ---------- one chat ---------- */
function Chat({ t, onInbox }) {
  const a = jobOf(t);
  const [, redraw] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const fresh = useRef(t.unread); // the "new" divider sits above the last `fresh` messages from the brand
  const newOnes = useRef(new Set()); // bubbles sent in this visit, which animate in
  const chat = useRef(null),
    log = useRef(null),
    opt = useRef(null),
    menu = useRef(null);
  const draw = () => flushSync(() => redraw(n => n + 1));
  const bottom = () => log.current && (log.current.scrollTop = log.current.scrollHeight);

  useEffect(() => {
    if (L.live) L.live.markRead(t.id).catch(() => undefined);
    if (t.unread)
      L.store.set(() => {
        t.unread = 0;
      }, "chat-read");
    const detachNet = C.net(
      chat.current,
      "chat-net",
      "You are offline. New messages wait and send when you are back.",
    );
    const net = chat.current.querySelector(".chat-net");
    net && chat.current.querySelector(".chat-h").after(net);
    requestAnimationFrame(bottom);
    const newMark = log.current.querySelector(".chat-new");
    newMark && requestAnimationFrame(() => (log.current.scrollTop = Math.max(0, newMark.offsetTop - 80)));
    L.liquid(chat.current);
    let shown = t.msgs.length;
    const offLive = L.store.on(why => {
      if (why !== "chat-live" || t.msgs.length <= shown) return;
      shown = t.msgs.length;
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
      detachNet && detachNet();
      removeEventListener("online", retryAll);
      document.removeEventListener("click", outside);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* delivery: the live API, or the sample's simulated sent → delivered */
  const deliver = m => {
    if (L.live) {
      if (!navigator.onLine) {
        m.status = "queued";
        return draw();
      }
      L.live.sendMessage(t.id, m.text).then(
        saved => {
          m.status = "delivered";
          m.id = saved.id;
          m.at = saved.at || m.at;
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
    setTimeout(() => {
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
    }, 550);
  };
  function retryAll() {
    t.msgs
      .filter(m => m.status === "queued")
      .forEach(m => {
        m.status = "sending";
        draw();
        deliver(m);
      });
  }
  const send = text => {
    const m = { from: "me", at: C.iso(), text, status: navigator.onLine ? "sending" : "queued" };
    L.store.set(() => {
      t.msgs.push(m);
    }, "chat-send");
    newOnes.current.add(m);
    draw();
    bottom();
    if (m.status === "sending") deliver(m);
    onInbox();
  };
  const setBlocked = on => {
    L.store.set(
      () => {
        t.blocked = on;
      },
      on ? "chat-block" : "chat-unblock",
    );
    draw();
    L.toast(on ? `${t.brand} is blocked` : `${t.brand} is unblocked`, on ? "close" : "check");
    if (!on) {
      const i = chat.current.querySelector("#chatIn");
      i && i.focus();
    }
  };

  /* options menu: report, block, open job */
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

  /* the log: day dividers, the "new" marker, system lines and bubbles */
  const meta = m => {
    if (m.from !== "me") return <time dateTime={m.at}>{C.time(m.at)}</time>;
    const st = m.status || "delivered";
    const label = {
      sending: ["clock", "Sending…"],
      sent: ["check", "Sent"],
      delivered: ["check", "Delivered"],
      queued: ["alert", "Not sent · waiting for network"],
    }[st] || ["", ""];
    return (
      <>
        <time dateTime={m.at}>{C.time(m.at)}</time>
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
  const opening = a.funded || a.accepted;
  const msgs = [...t.msgs];
  if (opening)
    msgs.unshift({
      from: "sys",
      at: opening,
      text: `${t.brand} accepted your bid. ${L.inr(a.price)} is in escrow.`,
      _syn: true,
    });
  msgs.sort((x, y) => L.D(x.at) - L.D(y.at));
  let newFrom = -1;
  for (let i = msgs.length - 1, left = fresh.current; i >= 0 && left > 0; i--)
    if (msgs[i].from === "brand") {
      newFrom = i;
      left--;
    }
  let day = "";
  const rows = [];
  msgs.forEach((m, i) => {
    const k = C.key(L.D(m.at));
    if (k !== day) {
      day = k;
      rows.push(
        <li key={"d" + k} className="chat-day">
          <span>{C.day(m.at)}</span>
        </li>,
      );
    }
    if (i === newFrom)
      rows.push(
        <li key="new" className="chat-new">
          <span>{fresh.current} new</span>
        </li>,
      );
    const key = m._syn ? "open" : keyOf(m);
    if (m.from === "sys") {
      const e = /escrow/i.test(m.text);
      rows.push(
        <li key={key} className={`chat-sys${e ? " is-escrow" : ""}`}>
          <span className={e ? "active-lockin" : undefined}>
            {e ? fromHtml(C.lock()) : <Icon n="info" />}
            {m.text}
          </span>
          <time dateTime={m.at}>{C.time(m.at)}</time>
        </li>,
      );
    } else {
      const isNew = newOnes.current.has(m);
      rows.push(
        <li
          key={key}
          className={`chat-msg ${m.from === "me" ? "is-me" : "is-brand"}${isNew ? " is-new" : ""}`}
          onAnimationEnd={isNew ? () => newOnes.current.delete(m) || redraw(n => n + 1) : undefined}
        >
          <p className="chat-b">{m.text}</p>
          <p className="chat-meta">{meta(m)}</p>
        </li>,
      );
    }
  });
  if (t.reported)
    rows.push(
      <li key="flag" className="chat-sys is-flag">
        <span>
          <Icon n="flag" />
          You reported this chat on {L.fmtDate(t.reported.at)}. Linkloom’s trust team reviews it within 24
          hours.
        </span>
      </li>,
    );

  return (
    <div className="chat" ref={chat}>
      <header className="chat-h">
        <a className="ibtn chat-back" href="#messages" aria-label="All chats">
          <Icon n="back" />
        </a>
        <span className="avatar v" aria-hidden="true">
          {t.bi || C.bi(t.brand)}
        </span>
        <div className="chat-h-t">
          <h2 className="chat-name">
            {t.brandId ? (
              <a className="chat-name-a" href={`#brand-${t.brandId}`}>
                {t.brand}
              </a>
            ) : (
              t.brand
            )}
          </h2>
          <p className="help">
            {a.loose ? "Linkloom chat" : `Bid accepted${a.accepted ? " " + L.fmtDate(a.accepted) : ""}`}
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
            {a.loose ? null : (
              <li role="none">
                <a role="menuitem" tabIndex={-1} href={`#work-${a.id}`}>
                  <Icon n="rail" />
                  Open the deal
                </a>
              </li>
            )}
            {t.brandId ? (
              <li role="none">
                <a role="menuitem" tabIndex={-1} href={`#brand-${t.brandId}`}>
                  <Icon n="user" />
                  View brand profile
                </a>
              </li>
            ) : null}
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
            <li role="none">
              <button
                role="menuitem"
                tabIndex={-1}
                type="button"
                data-block=""
                onClick={() => {
                  closeMenu();
                  t.blocked
                    ? setBlocked(false)
                    : openReactSheet({
                        title: `Block ${t.brand}?`,
                        render: close => (
                          <BlockSheet t={t} a={a} close={close} yes={() => setBlocked(true)} />
                        ),
                      });
                }}
              >
                <Icon n="close" />
                <span data-block-l="">
                  {t.blocked ? "Unblock" : "Block"} {t.brand}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </header>
      <a
        className="chat-job"
        href={a.loose ? "#bids" : "#work-" + a.id}
        data-who={C.who(a)}
        hidden={!!a.loose}
      >
        <span className="chat-job-t">
          <span className="chat-job-k">Deal</span>
          <b>{a.title}</b>
          <span className="chat-job-s">
            <i aria-hidden="true"></i>
            {stageLine(a)}
          </span>
        </span>
        <span className="chat-job-m">
          <b className="t-money">{L.inr(a.price)}</b>
          {fromHtml(C.payPill(a))}
        </span>
        <Icon n="chevron" />
      </a>
      <ol
        className="chat-log"
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${t.brand}`}
        tabIndex={0}
        ref={log}
      >
        <li className="chat-safe">
          <Icon n="lock" />
          <span>
            Never send PAN, Aadhaar, bank or UPI details, or ID photos, in chat. Linkloom never asks for KYC
            documents here.
          </span>
        </li>
        {rows}
      </ol>
      <div className="chat-foot">
        {t.blocked ? (
          <div className="chat-blocked">
            <p>
              <b>You blocked {t.brand}.</b> They can’t message you. The deal and the {L.inr(a.price)} in
              escrow are unchanged; Linkloom support steps in if anything is urgent.
            </p>
            <Lq className="lq-s lq-sm" data-unblock="" onClick={() => setBlocked(false)}>
              Unblock
            </Lq>
          </div>
        ) : (
          <Composer t={t} onSend={send} />
        )}
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
  const s = L.store.s;
  const [, redraw] = useState(0);
  const ul = useRef(null);
  useEffect(() => {
    ul.current && L.motion.stagger(L.$$("li", ul.current));
  }, []);
  const list = threads();
  if (!list.length)
    return (
      <div className="view-in messages-none-v">
        <h1 className="t-h1">Messages</h1>
        <div className="empty">
          <img src="assets/step-01-envelope.svg" width="220" height="160" alt="" />
          <p className="t-h2">No chats yet</p>
          <p className="muted">
            A chat opens when a brand accepts your bid and pays into escrow. Until then, brands can’t message
            you.
          </p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <Lq as="a" className="lq-p" href="#bids">
              See my bids
            </Lq>
            <Lq as="a" className="lq-s" href="#jobs">
              Find briefs
            </Lq>
          </div>
        </div>
      </div>
    );
  const t = param ? s.threads.find(x => x.id === param) : null;
  const ok = t && jobOf(t);
  /* keep the inbox in step: preview text, time, and order (FLIP when a thread jumps to the top) */
  const onInbox = () => {
    const items = L.$$("li", ul.current);
    L.motion.flip(() => flushSync(() => redraw(n => n + 1)), items);
  };
  return (
    <div className="view-in messages" data-mode={param ? "thread" : "list"}>
      <div className="messages-wrap">
        <aside className="messages-list" aria-labelledby="msgH">
          <header className="messages-list-h">
            <h1 className="t-h2" id="msgH">
              Messages
            </h1>
            <p className="help">
              Only brands that accepted your bid can message you. <span className="sample">Sample</span>
            </p>
          </header>
          <ul className="messages-threads" ref={ul}>
            {list.map(x => (
              <ThreadRow key={x.id} t={x} cur={param} />
            ))}
          </ul>
        </aside>
        <section className="chat-pane" aria-label={ok ? "Chat with " + t.brand : "Chat"}>
          {ok ? <ChatLoader key={t.id} t={t} onInbox={onInbox} /> : param ? <Missing /> : <Placeholder />}
        </section>
      </div>
    </div>
  );
}

L.register("messages", {
  title: "Messages",
  nav: "messages",
  Component: () => <MessagesScreen param={null} />,
});
L.register("chat", {
  title: p => {
    const t = L.store.s.threads.find(x => x.id === p);
    return t ? "Chat with " + t.brand : "Chat";
  },
  crumb: p => {
    const t = L.store.s.threads.find(x => x.id === p);
    return '<a href="#messages">Messages</a>' + (t ? " / " + L.esc(t.brand) : "");
  },
  nav: "messages",
  Component: MessagesScreen,
});
