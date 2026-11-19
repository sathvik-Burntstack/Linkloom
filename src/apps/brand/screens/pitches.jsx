/* Pitches (#pitches, #pitches-<briefId>): what creators pitched this brand, from the brand profile creators can open.
   One pitch per creator (edited at most once). The brand can only view the creator, message them, or decline;
   a decline lets that creator pitch again after 15 days (the backend enforces every rule).
   React screen (see src/shared/react/view.jsx). PitchCard is also used on the brief page (screens/job.jsx). */
import { useEffect, useState } from "react";
import { Html, Icon, Lq, useStore } from "@/shared/react/view";

const L = window.LLD,
  esc = L.esc,
  ic = L.icon;
const S = () => window.LLD_DATA;
const K = () => L.bk;
const TABS = [
  ["all", "All"],
  ["new", "New"],
  ["declined", "Declined"],
];
const ui = { tab: "all" };
const inTab = (p, t) =>
  t === "all"
    ? p.status !== "declined"
    : t === "new"
      ? !p.read && p.status !== "declined"
      : p.status === "declined";
const hrefOf = u => (/^https?:\/\//.test(u) ? u : "https://" + u);
const shortUrl = u => u.replace(/^https?:\/\/(www\.)?/, "");
const whenTxt = p => `${L.fmtDate(p.at)}${p.edited ? ` · edited ${L.fmtDate(p.editedAt || p.at)}` : ""}`;
const creatorOf = p => K().cr(p.creator) || { id: p.creator, name: "Creator", handle: "" };
const aboutTitle = p => p.jobTitle || (K().job(p.job) || {}).title || "a brief";

/* ---------- actions (shared by the React card and the HTML card) ---------- */
/** Opens the chat with the pitch's creator; `busy(true|false)` disables the button meanwhile. */
function message(p, busy) {
  const t = S().threads.find(x => x.creator === p.creator);
  if (t) return L.go("#chat-" + t.id);
  if (!L.live) return L.toast("Sample data. In the live app this opens your chat with them.", "chat");
  busy(true);
  L.live.openChatWith(p.creator).then(
    id => L.go("#chat-" + id),
    er => {
      busy(false);
      L.toast(L.live.errorText(er), "alert");
    },
  );
}
/** Asks to confirm, then declines; `done` runs after. */
function decline(p, done) {
  const c = K().cr(p.creator) || { name: "this creator" };
  const f = K().first ? K().first(c) : c.name;
  K().confirm({
    title: "Decline this pitch?",
    yes: "Decline pitch",
    no: "Keep it",
    danger: true,
    mini: `<div class="jl-mini">${K().crChip(c)}<p class="t-small muted">${esc(p.job ? "About " + (p.jobTitle || "a brief") : "General pitch")}</p></div>`,
    bullets: [
      `${f} is told you passed on it.`,
      `${f} can pitch you again after 15 days.`,
      "The pitch stays in your Declined tab.",
    ],
    onYes() {
      const ok = () => {
        L.toast("Pitch declined", "check");
        done();
      };
      if (!L.live) {
        L.store.set(s => {
          const x = s.pitches.find(y => y.id === p.id);
          if (x) x.status = "declined";
        }, "pitch-declined");
        return ok();
      }
      L.live.declinePitch(p.id).then(ok, er => L.toast(L.live.errorText(er), "alert"));
    },
  });
}

/** Marks what the brand has now seen as read (on the server too); the "New" tags stay until the next visit. */
function markSeen(list) {
  const unread = list.filter(p => !p.read && p.status !== "declined");
  if (!unread.length) return;
  if (L.live) unread.forEach(p => L.live.readPitch(p.id).catch(() => undefined));
  setTimeout(
    () =>
      L.store.set(s => {
        for (const p of s.pitches) if (unread.some(u => u.id === p.id)) p.read = true;
      }, "pitches-read"),
    1500,
  );
}

/* ---------- the React card ---------- */
export function PitchCard({ p, compact, onChange }) {
  const [busy, setBusy] = useState(false);
  const c = creatorOf(p);
  return (
    <article className={`card pt-card${p.status === "declined" ? " is-declined" : ""}`} data-pitch={p.id}>
      <div className="pt-top">
        <Html as="a" className="pt-who" href={`#creator-${c.id}`} html={K().crChip(c)} />
        <div className="pt-tags">
          {!p.read && p.status !== "declined" ? <span className="pill pill-violet">New</span> : null}
          {p.edited ? <span className="pill">Edited</span> : null}
          {p.status === "declined" ? <span className="pill pill-err">Declined</span> : null}
        </div>
      </div>
      <div className="pt-meta">
        {p.job ? (
          <a className="pt-about" href={`#job-${p.job}`}>
            <Icon n="brief" className="ic" />
            <span>
              About <b>{aboutTitle(p)}</b>
            </span>
          </a>
        ) : (
          <span className="pt-about is-general">
            <Icon n="chat" className="ic" />
            <span>General pitch</span>
          </span>
        )}
        <span className="t-small muted">{whenTxt(p)}</span>
      </div>
      <p className={`pt-msg${compact ? " is-clamp" : ""}`}>{p.message}</p>
      {p.links.length ? (
        <div className="pt-links">
          {p.links.map(u => (
            <a key={u} className="pt-link" href={hrefOf(u)} target="_blank" rel="noopener noreferrer">
              <Icon n="link" className="ic" />
              <span>{shortUrl(u)}</span>
            </a>
          ))}
        </div>
      ) : null}
      <div className="row wrap pt-acts">
        <Lq as="a" className="lq-s lq-sm" href={`#creator-${c.id}`}>
          <Icon n="user" className="ic" />
          View creator
        </Lq>
        <Lq className="lq-s lq-sm" data-pmsg={p.id} disabled={busy} onClick={() => message(p, setBusy)}>
          <Icon n="chat" className="ic" />
          Message
        </Lq>
        {p.status === "declined" ? null : (
          <Lq className="lq-s lq-sm pt-decline" data-pdecl={p.id} onClick={() => decline(p, onChange)}>
            Decline
          </Lq>
        )}
      </div>
    </article>
  );
}

/* ---------- the screen ---------- */
function PitchesScreen({ param: briefId }) {
  const s = useStore(/^(live-loaded|live-refresh|pitch-declined)$/);
  const [tab, setTab] = useState(ui.tab);
  const [, redraw] = useState(0);
  const all = (s.pitches || [])
    .filter(p => !briefId || p.job === briefId)
    .sort((a, b) => (b.editedAt || b.at).localeCompare(a.editedAt || a.at));
  const list = all.filter(p => inTab(p, tab));
  const ids = list.map(p => p.id + p.read).join();
  useEffect(() => markSeen(list), [tab, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const j = briefId ? K().job(briefId) : null;
  const off = L.live && !s.pitchesOn;
  const pick = k => {
    ui.tab = k;
    setTab(k);
  };
  return (
    <div className="view-in pt">
      <header className="jl-head">
        <div className="jl-head-t">
          <h1 className="t-h1">{j ? "Pitches about " + j.title : "Pitches"}</h1>
          <p className="muted">
            Creators pitch you once from your brand profile, about a brief or a fresh idea. They can edit a
            pitch once. {L.live ? null : <span className="sample">Sample data</span>}
          </p>
        </div>
        {j ? (
          <Lq as="a" className="lq-s" href="#pitches">
            All pitches
          </Lq>
        ) : null}
      </header>
      {off || !all.length ? null : (
        <div className="chips jl-filter" role="group" aria-label="Show pitches">
          {TABS.map(([k, n]) => (
            <button
              key={k}
              className="chip"
              type="button"
              data-tab={k}
              aria-pressed={String(tab === k)}
              onClick={() => pick(k)}
            >
              {n} <span className="jl-cn">{all.filter(p => inTab(p, k)).length}</span>
            </button>
          ))}
        </div>
      )}
      <div className="pt-list">
        {off ? (
          <div className="empty">
            <p className="t-h2">Pitches open soon</p>
            <p className="muted">
              Creators will be able to open your brand profile and pitch you an idea. They show up here, and
              you get a notification for each one.
            </p>
          </div>
        ) : !all.length ? (
          <div className="empty">
            <p className="t-h2">No pitches yet</p>
            <p className="muted">
              Creators can open your brand profile and pitch you once, about one of your briefs or a fresh
              idea. Each new pitch lands here and in your notifications.
            </p>
            <Lq as="a" className="lq-s" href="#profile">
              Check your brand profile
            </Lq>
          </div>
        ) : !list.length ? (
          <div className="empty is-small">
            <p className="muted">Nothing in {TABS.find(t => t[0] === tab)[1]}.</p>
          </div>
        ) : (
          list.map(p => <PitchCard key={p.id} p={p} onChange={() => redraw(n => n + 1)} />)
        )}
      </div>
    </div>
  );
}

L.register("pitches", {
  title: "Pitches",
  nav: "pitches",
  crumb: id => {
    const j = id && K().job(id);
    return j ? `<a href="#pitches">Pitches</a> / ${esc(j.title)}` : "";
  },
  Component: PitchesScreen,
});
