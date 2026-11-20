/* Help & support (#support, #support-new, #support-new-<orderId>, #support-<ticketId>), the same in the brand and the
   creator app. Each app calls installSupport() with its own deal list and deal links; everything else is shared.
   A ticket is a conversation with Linkloom Support (replies come from super admin), not live chat.
   React screens (see src/shared/react/view.jsx); the ticket list lives in a small store both screens read. */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon, Lq } from "@/shared/react/view";
import { support, supportError, SUPPORT_EMAIL, SUPPORT_OFF, TOPICS } from "./api";

const MAX_FILES = 3,
  MAX_MSG = 5000;
const STATUS_TXT = {
  open: "Open",
  waiting_on_user: "Waiting on you",
  resolved: "Resolved",
  closed: "Closed",
};
const topicTxt = t => (TOPICS.find(x => x[0] === t) || [, "Something else"])[1];

export function installSupport(host) {
  const L = window.LLD;

  /* ---------- the list, shared by the screens ---------- */
  const st = { tickets: null, off: false }; // tickets: null = not loaded yet
  let lastLoad = 0,
    version = 0;
  const subs = new Set();
  const changed = () => {
    version++;
    subs.forEach(f => f());
  };
  const useSupport = () =>
    useSyncExternalStore(
      f => (subs.add(f), () => subs.delete(f)),
      () => version,
    );
  const cache = {}; // ticketId → Ticket with messages

  const errText = e =>
    supportError(e, x =>
      L.live && L.live.errorText ? L.live.errorText(x) : "Something went wrong. Please try again.",
    );
  const fmt = iso => {
    try {
      const d = new Date(iso);
      const t = d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      return `${L.fmtDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }))}, ${t}`;
    } catch {
      return "";
    }
  };
  const setTicket = (id, t) => {
    const i = (st.tickets || []).findIndex(x => x.id === id);
    if (i >= 0) st.tickets[i] = t;
  };

  function badges() {
    const n = (st.tickets || []).filter(t => t.unread > 0).length;
    L.$$('[data-badge="support"]').forEach(b => {
      b.textContent = n;
      b.hidden = !n;
    });
  }

  /** Loads the user's tickets (at most every 20 s unless forced); the list screen redraws from the store. */
  function load(force) {
    if (!L.live || L.live.guest) return Promise.resolve();
    if (!force && Date.now() - lastLoad < 20000) return Promise.resolve();
    lastLoad = Date.now();
    return support.list().then(
      t => {
        st.tickets = t;
        st.off = false;
        badges();
        changed();
      },
      e => {
        if (e && e.code === SUPPORT_OFF) st.off = true;
        if (st.tickets === null) st.tickets = [];
        changed();
      },
    );
  }
  L.store.on(why => {
    if (why === "live-loaded" || why === "live-refresh") void load(false);
    else if (/^notif/.test(String(why))) void load(true); // a support reply may have just come in
  });
  L.supportRefresh = () => load(true);

  /* ---------- small pieces ---------- */
  const StatusPill = ({ s }) => <span className={`sp-st sp-st-${s}`}>{STATUS_TXT[s] || "Open"}</span>;
  const Soon = () => (
    <section className="card sp-soon">
      <p className="t-h2">Support requests open soon</p>
      <p className="muted">
        You'll be able to write to us here and follow the replies. Until then, email us and we'll get back to
        you.
      </p>
      <Lq
        as="a"
        className="lq-p"
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Help with Linkloom")}`}
      >
        <Icon n="send" className="ic" />
        Email {SUPPORT_EMAIL}
      </Lq>
    </section>
  );
  const NewBtn = () => (
    <Lq as="a" className="lq-p" href="#support-new">
      <Icon n="plus" className="ic" />
      New request
    </Lq>
  );

  /* ---------- the list ---------- */
  function SupportList() {
    useSupport();
    useEffect(() => {
      if (L.live) void load(st.tickets === null);
    }, []);
    const head = (
      <header className="sp-head">
        <div>
          <h1 className="t-h1">Help & support</h1>
          <p className="muted">
            Write to us about payments, a deal, your account, or anything that isn't working. You'll get a
            notification when we reply.
          </p>
        </div>
        {L.live && !st.off ? <NewBtn /> : null}
      </header>
    );
    if (!L.live)
      return (
        <div className="view-in sp">
          {head}
          <section className="card sp-soon">
            <p className="t-h2">Support works in the live app.</p>
            <p className="muted">Email {SUPPORT_EMAIL} and we'll help.</p>
          </section>
        </div>
      );
    if (st.tickets === null)
      return (
        <div className="view-in sp">
          {head}
          <section className="card sp-soon" aria-busy="true">
            <p className="muted">Loading your requests…</p>
          </section>
        </div>
      );
    const rows = st.tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return (
      <div className="view-in sp">
        {head}
        {st.off ? (
          <Soon />
        ) : rows.length ? (
          <ul className="sp-list">
            {rows.map(t => (
              <li key={t.id}>
                <a className={`sp-row${t.unread ? " is-unread" : ""}`} href={`#support-${t.id}`}>
                  <span className="sp-row-t">
                    <span className="sp-row-ref">
                      {t.ref} · {topicTxt(t.topic)}
                      {t.order ? ` · ${t.order.title}` : ""}
                    </span>
                    <b>
                      {t.unread ? <i className="sp-dot" aria-label="New reply"></i> : null}
                      {t.subject}
                    </b>
                    {t.lastText ? (
                      <span className="muted sp-row-last">
                        {t.lastAuthor === "admin" ? "Support: " : t.lastAuthor === "user" ? "You: " : ""}
                        {t.lastText}
                      </span>
                    ) : null}
                  </span>
                  <span className="sp-row-r">
                    <StatusPill s={t.status} />
                    <span className="t-small muted">{fmt(t.updatedAt)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <section className="card sp-soon">
            <p className="t-h2">No requests yet</p>
            <p className="muted">
              When something isn't right, send us a request. We reply here, and you get a notification.
            </p>
            <NewBtn />
          </section>
        )}
        <p className="t-small muted sp-mail">
          Prefer email? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    );
  }

  /* ---------- files picked for a request or a reply ---------- */
  function FileField({ files, setFiles, label }) {
    const input = useRef(null);
    const [err, setErr] = useState("");
    const pick = () => {
      setErr("");
      const next = [...files];
      for (const f of input.current.files) {
        if (next.length >= MAX_FILES) break;
        if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
          setErr(`${f.name}: only JPG, PNG, WebP or PDF files.`);
          continue;
        }
        if (f.size > 10 << 20) {
          setErr(`${f.name} is over 10 MB.`);
          continue;
        }
        next.push(f);
      }
      input.current.value = "";
      setFiles(next);
    };
    return (
      <div className="sp-files">
        <input
          type="file"
          data-files=""
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          hidden
          ref={input}
          onChange={pick}
        />
        <div className="sp-fchips" data-fchips="">
          {files.map((f, i) => (
            <span className="sp-fchip" key={i + f.name}>
              <Icon n="upload" className="ic" />
              <span>{f.name}</span>
              <button
                className="ibtn"
                type="button"
                data-frm={i}
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                <Icon n="close" />
              </button>
            </span>
          ))}
        </div>
        <Lq
          className="lq-s lq-sm"
          data-fadd=""
          hidden={files.length >= MAX_FILES}
          onClick={() => input.current.click()}
        >
          <Icon n="upload" className="ic" />
          {label}
        </Lq>
        <p className="err" data-ferr="" hidden={!err}>
          {err}
        </p>
      </div>
    );
  }

  /* ---------- a new request ---------- */
  function NewRequest({ orderId }) {
    useSupport();
    const [topic, setTopic] = useState(orderId ? "deal" : TOPICS[0][0]);
    const [deal, setDeal] = useState(orderId || "");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState([]);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);
    const subjRef = useRef(null),
      msgRef = useRef(null);
    if (!L.live || st.off)
      return (
        <div className="view-in sp">
          <header className="sp-head">
            <div>
              <h1 className="t-h1">New request</h1>
            </div>
          </header>
          <Soon />
        </div>
      );
    const deals = host.deals();
    const submit = async e => {
      e.preventDefault();
      setErr("");
      const s = subject.trim(),
        m = message.trim();
      if (s.length < 5) {
        subjRef.current.focus();
        return setErr("Add a short subject (at least 5 characters).");
      }
      if (m.length < 10) {
        msgRef.current.focus();
        return setErr("Tell us a little more in the message.");
      }
      setBusy(true);
      try {
        const t = await support.create({ topic, orderId: deal || null, subject: s, message: m, files });
        cache[t.id] = t.messages.length ? t : null;
        (st.tickets = st.tickets || []).unshift(t);
        changed();
        L.toast(`Request ${t.ref} sent. We'll reply here.`, "check");
        L.go("#support-" + t.id);
      } catch (x) {
        setBusy(false);
        if (x && x.code === SUPPORT_OFF) {
          st.off = true;
          return changed();
        }
        setErr(errText(x));
      }
    };
    return (
      <div className="view-in sp">
        <header className="sp-head">
          <div>
            <h1 className="t-h1">New request</h1>
            <p className="muted">
              Tell us what happened and what you expected. Screenshots help us fix it faster.
            </p>
          </div>
        </header>
        <form className="card sp-form" noValidate onSubmit={submit}>
          <div className="field">
            <label htmlFor="spTopic">What's it about?</label>
            <select className="select" id="spTopic" value={topic} onChange={e => setTopic(e.target.value)}>
              {TOPICS.map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="spDeal">
              Which deal? <span className="muted">(optional)</span>
            </label>
            <select className="select" id="spDeal" value={deal} onChange={e => setDeal(e.target.value)}>
              <option value="">Not about a deal</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>
                  {d.title}
                  {d.sub ? " · " + d.sub : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="spSubject">Subject</label>
            <input
              className="input"
              id="spSubject"
              maxLength={120}
              placeholder="For example: Paid, but the deal still says unpaid"
              ref={subjRef}
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="spMsg">Message</label>
            <textarea
              className="input"
              id="spMsg"
              rows={7}
              maxLength={MAX_MSG}
              placeholder="What happened, when, and what you expected to happen."
              ref={msgRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="label">
              Screenshots or PDFs <span className="muted">(optional, up to {MAX_FILES}, 10 MB each)</span>
            </span>
            <FileField files={files} setFiles={setFiles} label="Attach a file" />
          </div>
          <p className="err" id="spErr" role="alert" hidden={!err}>
            {err}
          </p>
          <div className="row wrap">
            <Lq
              className="lq-p"
              type="submit"
              data-send=""
              disabled={busy}
              aria-busy={busy ? "true" : undefined}
            >
              <Icon n="send" className="ic" />
              Send request
            </Lq>
            <Lq as="a" className="lq-s" href="#support">
              Cancel
            </Lq>
          </div>
          <p className="ll-trust">
            <Icon n="lock" />
            Never send your PAN, Aadhaar, bank or UPI details here.
          </p>
        </form>
      </div>
    );
  }

  /* ---------- one request ---------- */
  function Bubble({ m }) {
    if (m.author === "system")
      return (
        <li className="sp-sys">
          <span>{m.text}</span>
          <span className="t-small muted">{fmt(m.at)}</span>
        </li>
      );
    const mine = m.author === "user";
    return (
      <li className={`sp-msg${mine ? " is-mine" : ""}`}>
        <p className="sp-msg-h">
          <b>{mine ? "You" : m.authorName || "Linkloom Support"}</b>
          <span className="t-small muted">{fmt(m.at)}</span>
        </p>
        {m.text ? <p className="sp-msg-t">{m.text}</p> : null}
        {m.attachments.length ? (
          <div className="sp-atts">
            {m.attachments.map(a => (
              <button
                key={a.uploadId}
                className="sp-att"
                type="button"
                data-att={a.uploadId}
                onClick={() => support.openFile(a.uploadId).catch(x => L.toast(errText(x), "alert"))}
              >
                <Icon n="eye" className="ic" />
                <span>{a.fileName}</span>
              </button>
            ))}
          </div>
        ) : null}
      </li>
    );
  }

  function Ticket({ id }) {
    useSupport();
    const [t, setT] = useState(null);
    const [loadErr, setLoadErr] = useState(null);
    const [text, setText] = useState("");
    const [files, setFiles] = useState([]);
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState("");
    useEffect(() => {
      if (!L.live) return;
      let on = true;
      support.get(id).then(
        r => {
          cache[id] = r;
          setTicket(id, { ...r, unread: 0 });
          badges();
          if (on) setT(r);
        },
        e => {
          if (!on) return;
          if (e && e.code === SUPPORT_OFF) {
            st.off = true;
            changed();
          }
          setLoadErr(e);
        },
      );
      return () => void (on = false);
    }, [id]);
    useEffect(() => {
      const cr = document.getElementById("crumb");
      if (t && cr) cr.innerHTML = `<a href="#support">Help & support</a> / ${L.esc(t.ref)}`;
    }, [t]);

    if (!L.live || st.off) return <SupportList />;
    if (loadErr)
      return (
        <div className="view-in sp">
          <section className="card sp-soon">
            <p className="t-h2">
              {loadErr.status === 404 ? "We couldn't find that request." : "The request couldn't load."}
            </p>
            <p className="muted">{errText(loadErr)}</p>
            <Lq as="a" className="lq-p" href="#support">
              All requests
            </Lq>
          </section>
        </div>
      );
    if (!t)
      return (
        <div className="view-in sp">
          <section className="card sp-soon" aria-busy="true">
            <p className="muted">Loading the request…</p>
          </section>
        </div>
      );

    const fail = x => {
      if (x && x.code === SUPPORT_OFF) {
        st.off = true;
        return changed();
      }
      setErr(errText(x));
    };
    const swap = r => {
      const next = { ...r, messages: r.messages.length ? r.messages : t.messages };
      cache[id] = next;
      setTicket(id, { ...next, unread: 0 });
      setBusy("");
      setT(next);
      changed();
    };
    const act = (what, call, msg) => {
      setErr("");
      setBusy(what);
      call(id).then(
        r => {
          L.toast(msg, "check");
          swap(r);
        },
        x => {
          setBusy("");
          fail(x);
        },
      );
    };
    const reply = async e => {
      e.preventDefault();
      setErr("");
      const body = text.trim();
      if (!body && !files.length) return setErr("Write a reply first.");
      setBusy("send");
      try {
        const m = await support.reply(id, body, files);
        const next = {
          ...t,
          status: "open",
          messages: [...t.messages, m.text || m.attachments.length ? m : { ...m, text: body }],
        };
        cache[id] = next;
        setTicket(id, {
          ...next,
          lastText: body,
          lastAuthor: "user",
          updatedAt: new Date().toISOString(),
          unread: 0,
        });
        setText("");
        setFiles([]);
        setBusy("");
        setT(next);
        changed();
      } catch (x) {
        setBusy("");
        fail(x);
      }
    };

    let foot;
    if (t.status === "closed")
      foot = (
        <section className="card sp-end">
          <p>This request is closed. If you still need help, open a new one.</p>
          <NewBtn />
        </section>
      );
    else if (t.status === "resolved")
      foot = (
        <section className="card sp-end">
          <p>
            Marked resolved{t.resolvedAt ? " " + fmt(t.resolvedAt) : ""}.
            {t.canReopen ? " Not fixed after all? Reopen it within 7 days." : ""}
          </p>
          <div className="row wrap">
            {t.canReopen ? (
              <Lq
                className="lq-p"
                data-reopen=""
                disabled={busy === "reopen"}
                onClick={() => act("reopen", support.reopen, `${t.ref} reopened`)}
              >
                Reopen request
              </Lq>
            ) : null}
            <Lq as="a" className="lq-s" href="#support-new">
              New request
            </Lq>
          </div>
          <p className="err" id="spErr" role="alert" hidden={!err}>
            {err}
          </p>
        </section>
      );
    else
      foot = (
        <form className="card sp-reply" noValidate onSubmit={reply}>
          <label className="label" htmlFor="spReply">
            {t.status === "waiting_on_user" ? "Support is waiting for your reply" : "Add to this request"}
          </label>
          <textarea
            className="input"
            id="spReply"
            rows={4}
            maxLength={MAX_MSG}
            placeholder="Write a reply"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <FileField files={files} setFiles={setFiles} label="Attach" />
          <p className="err" id="spErr" role="alert" hidden={!err}>
            {err}
          </p>
          <div className="row wrap sp-reply-a">
            <Lq
              className="lq-p"
              type="submit"
              data-send=""
              disabled={busy === "send"}
              aria-busy={busy === "send" ? "true" : undefined}
            >
              <Icon n="send" className="ic" />
              Send reply
            </Lq>
            <Lq
              className="lq-s"
              data-resolve=""
              disabled={busy === "resolve"}
              onClick={() => act("resolve", support.resolve, `${t.ref} marked resolved`)}
            >
              <Icon n="check" className="ic" />
              Mark as resolved
            </Lq>
          </div>
        </form>
      );

    return (
      <div className="view-in sp">
        <a className="sp-back" href="#support">
          <Icon n="back" className="ic" />
          All requests
        </a>
        <header className="card sp-thead">
          <div className="sp-thead-t">
            <p className="sp-row-ref">
              {t.ref} · {topicTxt(t.topic)}
            </p>
            <h1 className="t-h2">{t.subject}</h1>
            {t.order ? (
              <Lq as="a" className="lq-s lq-sm" href={host.dealHref(t.order.id)}>
                <Icon n="rail" className="ic" />
                {t.order.title}
              </Lq>
            ) : null}
          </div>
          <StatusPill s={t.status} />
        </header>
        <ol className="sp-conv">
          {t.messages.map((m, i) => (
            <Bubble key={m.id || i} m={m} />
          ))}
        </ol>
        {foot}
      </div>
    );
  }

  function SupportScreen({ param: p }) {
    if (!p) return <SupportList />;
    if (p === "new" || p.startsWith("new-"))
      return <NewRequest key={p} orderId={p === "new" ? "" : p.slice(4)} />;
    return <Ticket key={p} id={p} />;
  }

  L.register("support", {
    title: p => (!p ? "Help & support" : p.startsWith("new") ? "New support request" : "Support request"),
    crumb: p =>
      !p ? "" : `<a href="#support">Help & support</a> / ${p.startsWith("new") ? "New request" : "Request"}`,
    nav: "support",
    Component: SupportScreen,
  });
}
