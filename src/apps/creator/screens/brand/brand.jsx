/* Brand profile (#brand-<brandId>): what a creator sees of a brand (basic info and its open briefs, no deal counts),
   and the one pitch they can send it. Rules (the backend enforces them too): one pitch per brand, about one of its
   briefs or a fresh idea; message + links only; edited at most once; never deleted. A declined pitch frees the creator
   to pitch again after 15 days. React screen (see src/shared/react/view.jsx). */
import { Fragment, useEffect, useRef, useState } from "react";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";

const L = window.LLD;
const MAX_MSG = 1500,
  MIN_MSG = 20,
  MAX_LINKS = 5;
const cache = {}; // brandId → { p: BrandProfile } | { err }
const initials = n =>
  String(n || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
const fmt = d => (d ? L.fmtDate(String(d).slice(0, 10)) : "");
const platName = p => (p === "youtube" ? "YouTube" : "Instagram");
const hrefOf = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
const shortUrl = u =>
  String(u)
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/$/, "");
const future = d => d && Date.parse(d) > Date.now();

const PITCH_ERR = {
  ALREADY_PITCHED: "You've already pitched this brand. You can pitch each brand once.",
  EDIT_USED: "You've already used your one edit, so this pitch is locked.",
  PITCH_DECLINED: "The brand passed on this pitch, so it can't be edited.",
  PITCH_COOLDOWN: "The brand passed on your last pitch. You can pitch them again once 15 days have passed.",
  BRIEF_NOT_THIS_BRAND: "That collab isn't open any more. Pick another one, or pitch a fresh idea.",
};
const errText = e => PITCH_ERR[e && e.code] || (L.live ? L.live.errorText(e) : "Something went wrong.");
const BLOCKED_TXT = "Pitching isn't open for your account yet.";

/** Where the pitch stands, for the button and the card. */
function state(p) {
  const mp = p.myPitch;
  if (!p.pitchingOn) return { k: "soon", label: `Pitch ${p.name}` };
  if (mp && mp.status !== "declined")
    return mp.canEdit
      ? { k: "edit", label: "Edit pitch", sub: "1 edit left" }
      : { k: "locked", label: "Pitched", sub: "Edit used" };
  if (future(p.pitchBlockedUntil) || (!p.canPitch && mp && mp.status === "declined"))
    return {
      k: "cooldown",
      label: p.pitchBlockedUntil ? `Pitch again on ${fmt(p.pitchBlockedUntil)}` : "Pitch again later",
    };
  /* the server says no, with no pitch of theirs and no cooldown: say so (with its reason when it gives one) */
  if (!p.canPitch) return { k: "blocked", label: "Can't pitch right now" };
  return { k: "new", label: `Pitch ${p.name}` };
}

function ActionBtn({ p, wide, onPitch, onView }) {
  const st = state(p);
  const done = st.k === "locked" || st.k === "cooldown" || st.k === "blocked";
  const cls = `${done ? "lq-s bp-pitchbtn is-done" : "lq-p bp-pitchbtn"}${wide ? " is-wide" : ""}`;
  return (
    <Lq
      className={cls}
      onClick={done ? onView : onPitch}
      {...(done ? { "data-pitchview": "", "aria-disabled": "true" } : { "data-pitch": "" })}
    >
      <Icon
        n={st.k === "locked" ? "check" : done ? "clock" : st.k === "edit" ? "plus" : "send"}
        className="ic"
      />
      <span>{st.label}</span>
      {st.sub ? <small>{st.sub}</small> : null}
    </Lq>
  );
}

function PitchCard({ p, cardRef }) {
  const mp = p.myPitch;
  if (!mp) return null;
  const about = mp.campaignId ? (
    <>
      About{" "}
      <b>{mp.campaignTitle || (p.openBriefs.find(b => b.id === mp.campaignId) || {}).title || "a collab"}</b>
    </>
  ) : (
    "A fresh idea, not a specific collab"
  );
  const tag =
    mp.status === "declined" ? (
      <span className="pill pill-err">Declined</span>
    ) : mp.canEdit ? (
      <span className="pill pill-violet">Sent · 1 edit left</span>
    ) : (
      <span className="pill pill-ok">
        <Icon n="check" />
        Sent{mp.status === "edited" ? " · edited" : ""}
      </span>
    );
  const note =
    mp.status === "declined"
      ? future(p.pitchBlockedUntil)
        ? `${p.name} passed on this pitch. You can pitch them again on ${fmt(p.pitchBlockedUntil)}.`
        : `${p.name} passed on this pitch. You can send them a new one.`
      : mp.canEdit
        ? "You can edit this pitch once. After that it's locked. Pitches can't be deleted."
        : `This pitch is locked: you've used your one edit. ${p.name} can message you if they're interested.`;
  return (
    <section className="card bp-sec bp-mine" id="bpMine" aria-labelledby="bpMineH" ref={cardRef}>
      <div className="bp-sec-h">
        <h2 className="t-h2" id="bpMineH">
          Your pitch
        </h2>
        {tag}
      </div>
      <p className="bp-about-line">
        <Icon n="brief" className="ic" />
        <span>{about}</span>
        <span className="muted">
          · {fmt(mp.createdAt)}
          {mp.editedAt ? `, edited ${fmt(mp.editedAt)}` : ""}
        </span>
      </p>
      <p className="bp-msg">{mp.message}</p>
      {mp.links.length ? (
        <div className="bp-links">
          {mp.links.map(u => (
            <a key={u} className="bp-link" href={hrefOf(u)} target="_blank" rel="noopener noreferrer">
              <Icon n="link" className="ic" />
              <span>{shortUrl(u)}</span>
            </a>
          ))}
        </div>
      ) : null}
      <p className="t-small muted bp-note">{note}</p>
    </section>
  );
}

function Page({ p, onPitch, onView, cardRef }) {
  const meta = [p.industry, p.location].filter(Boolean);
  const st = state(p);
  return (
    <div className="view-in bp">
      <section className="card bp-head">
        {p.logoUrl ? (
          <img className="bp-logo" src={p.logoUrl} alt="" width="88" height="88" />
        ) : (
          <span className="bp-logo is-txt" aria-hidden="true">
            {initials(p.name)}
          </span>
        )}
        <div className="bp-id">
          <h1 className="t-h1">{p.name}</h1>
          {meta.length ? (
            <p className="bp-meta">
              {meta.map((m, i) => (
                <Fragment key={m + i}>
                  {i ? <span aria-hidden="true">·</span> : null}
                  <span>{m}</span>
                </Fragment>
              ))}
            </p>
          ) : null}
          {p.website ? (
            <Lq
              as="a"
              className="lq-s lq-sm bp-web"
              href={hrefOf(p.website)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon n="link" className="ic" />
              {shortUrl(p.website)}
            </Lq>
          ) : null}
        </div>
        <div className="bp-act">
          <ActionBtn p={p} onPitch={onPitch} onView={onView} />
          <p className="t-small muted bp-act-n">
            {st.k === "new"
              ? "One pitch per brand. You can edit it once."
              : st.k === "blocked"
                ? p.blockedReason || BLOCKED_TXT
                : ""}
          </p>
        </div>
      </section>
      {p.about ? (
        <section className="card bp-sec" aria-labelledby="bpAboutH">
          <h2 className="t-h2" id="bpAboutH">
            About {p.name}
          </h2>
          <p className="bp-msg">{p.about}</p>
        </section>
      ) : null}
      <PitchCard p={p} cardRef={cardRef} />
      <section className="card bp-sec" aria-labelledby="bpBriefsH">
        <div className="bp-sec-h">
          <h2 className="t-h2" id="bpBriefsH">
            Open collabs
          </h2>
          <span className="pill">{p.openBriefs.length}</span>
        </div>
        {p.openBriefs.length ? (
          <ul className="bp-briefs">
            {p.openBriefs.map(b => (
              <li key={b.id}>
                <a className="bp-brief" href={`#job-${b.id}`}>
                  <span className="bp-brief-t">
                    <b>{b.title}</b>
                    <span className="muted">
                      {platName(b.platform)}
                      {b.closesAt ? ` · closes ${fmt(b.closesAt)}` : ""}
                    </span>
                  </span>
                  <Lq as="span" className="lq-s lq-sm">
                    View collab
                  </Lq>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No open collabs right now. You can still pitch them a fresh idea.</p>
        )}
      </section>
      <div className="bp-bar">
        <ActionBtn p={p} wide onPitch={onPitch} onView={onView} />
      </div>
    </div>
  );
}

/* ---------- the pitch sheet ---------- */
function SoonSheet({ p, close }) {
  return (
    <div className="stack bp-sheet">
      <p>
        Soon you'll be able to pitch {p.name} an idea, about one of their collabs or something new. You'll get
        one pitch per brand.
      </p>
      <p className="muted">For now, bid on one of their open collabs.</p>
      <div className="row wrap">
        <Lq className="lq-p" data-no="" onClick={() => close()}>
          OK
        </Lq>
      </div>
    </div>
  );
}

function PitchSheet({ p, editing, close, onDone, onOff, onStale }) {
  const mp = editing ? p.myPitch : null;
  const [about, setAbout] = useState(mp ? mp.campaignId || "" : "");
  const [msg, setMsg] = useState(mp ? mp.message : "");
  const [links, setLinks] = useState(mp && mp.links.length ? mp.links : [""]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const msgRef = useRef(null);
  const lastLink = useRef(null);
  const focusNew = useRef(false);
  useEffect(() => {
    if (focusNew.current && lastLink.current) lastLink.current.focus();
    focusNew.current = false;
  }, [links.length]);
  const n = msg.trim().length;
  const earlier = mp && mp.campaignId && !p.openBriefs.some(b => b.id === mp.campaignId);

  const submit = async e => {
    e.preventDefault();
    setErr("");
    const text = msg.trim();
    if (text.length < MIN_MSG) {
      msgRef.current && msgRef.current.focus();
      return setErr(`Write at least ${MIN_MSG} characters so ${p.name} knows what you have in mind.`);
    }
    const list = links.map(u => u.trim()).filter(Boolean);
    const bad = list.find(u => !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(u));
    if (bad)
      return setErr(`"${bad}" doesn't look like a link. Paste the full address, like instagram.com/reel/…`);
    const body = { campaignId: about || null, message: text, links: list.map(hrefOf) };
    setBusy(true);
    try {
      const r = editing ? await L.live.editPitch(mp.id, body) : await L.live.sendPitch(p.id, body);
      const camp = p.openBriefs.find(x => x.id === body.campaignId);
      close();
      onDone({
        ...r,
        campaignTitle: r.campaignTitle || (camp ? camp.title : ""),
        ...(editing
          ? { canEdit: false, status: "edited", editedAt: r.editedAt || new Date().toISOString() }
          : {}),
      });
    } catch (x) {
      setBusy(false);
      if (x && x.code === L.live.PITCHING_OFF) {
        close();
        return onOff();
      }
      setErr(errText(x));
      if (x && /ALREADY_PITCHED|EDIT_USED|PITCH_DECLINED|PITCH_COOLDOWN/.test(x.code || "")) onStale();
    }
  };

  return (
    <form className="stack bp-sheet" noValidate onSubmit={submit}>
      <p className="bp-rule">
        <Icon n="info" className="ic" />
        <span>
          {editing ? (
            <>
              <b>This is your one edit.</b> After you save, the pitch is locked. Pitches can't be deleted.
            </>
          ) : (
            <>
              <b>You can pitch {p.name} once</b> and edit it once. Pitches can't be deleted.
            </>
          )}
        </span>
      </p>
      <div className="field">
        <label htmlFor="bpAbout">What's it about?</label>
        <select className="input" id="bpAbout" value={about} onChange={e => setAbout(e.target.value)}>
          <option value="">A fresh idea (not a specific collab)</option>
          {p.openBriefs.map(b => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
          {earlier ? <option value={mp.campaignId}>{mp.campaignTitle || "Your earlier collab"}</option> : null}
        </select>
      </div>
      <div className="field">
        <label htmlFor="bpMsg">Your pitch</label>
        <textarea
          className="input"
          id="bpMsg"
          rows={6}
          maxLength={MAX_MSG}
          ref={msgRef}
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder={`The idea, why it fits ${p.name}, and what you'd make. Be specific.`}
        />
        <p className="help bp-count" id="bpCount">
          {n < MIN_MSG ? `${n} / ${MAX_MSG} · at least ${MIN_MSG} characters` : `${n} / ${MAX_MSG}`}
        </p>
      </div>
      <div className="field">
        <span className="label" id="bpLinksL">
          Links to your work <span className="muted">(optional, up to {MAX_LINKS})</span>
        </span>
        <div className="bp-lrows" id="bpLinks" role="group" aria-labelledby="bpLinksL">
          {links.map((v, i) => (
            <div className="bp-lrow" key={i}>
              <input
                className="input"
                type="url"
                inputMode="url"
                autoComplete="off"
                maxLength={300}
                placeholder="instagram.com/reel/…"
                aria-label="Link to your work"
                value={v}
                ref={i === links.length - 1 ? lastLink : null}
                onChange={e => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                className="ibtn"
                type="button"
                data-lx=""
                aria-label="Remove this link"
                onClick={() => setLinks(links.length > 1 ? links.filter((_, j) => j !== i) : [""])}
              >
                <Icon n="close" />
              </button>
            </div>
          ))}
        </div>
        <Lq
          className="lq-s lq-sm bp-addl"
          data-addl=""
          hidden={links.length >= MAX_LINKS}
          onClick={() => {
            focusNew.current = true;
            setLinks([...links, ""]);
          }}
        >
          <Icon n="plus" className="ic" />
          Add link
        </Lq>
      </div>
      <p className="err" id="bpErr" role="alert" hidden={!err}>
        {err}
      </p>
      <div className="row wrap">
        <Lq className="lq-p" type="submit" data-send="" disabled={busy} aria-busy={busy ? "true" : undefined}>
          <Icon n="send" className="ic" />
          {editing ? "Save my one edit" : "Send pitch"}
        </Lq>
        <Lq className="lq-s" data-no="" onClick={() => close()}>
          Cancel
        </Lq>
      </div>
    </form>
  );
}

/* ---------- the screen ---------- */
function BrandScreen({ param: id }) {
  const [c, setC] = useState(() => cache[id] || null);
  const cardRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  /** Fetches the profile (always fresh on open); `quiet` keeps a shown profile if the refresh fails. */
  const load = quiet =>
    L.live.brandProfile(id).then(
      p => {
        cache[id] = { p };
        if (alive.current) setC(cache[id]);
      },
      e => {
        if (!quiet || !cache[id]) cache[id] = { err: e };
        if (alive.current) setC(cache[id]);
      },
    );
  useEffect(() => {
    if (L.live) load(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!c || !c.p) return;
    document.title = c.p.name + " · Linkloom";
    const cr = document.getElementById("crumb");
    if (cr) {
      cr.innerHTML = `<a href="#jobs">Find collabs</a> / ${L.esc(c.p.name)}`;
      cr.hidden = false;
    }
  }, [c]);

  if (!L.live)
    return (
      <div className="view-in">
        <div className="empty">
          <p className="t-h2">Brand profiles open in the live app.</p>
          <Lq as="a" className="lq-p" href="#jobs">
            See open collabs
          </Lq>
        </div>
      </div>
    );
  if (!c)
    return (
      <div className="view-in bp">
        <section className="card bp-head is-loading" aria-busy="true">
          <span className="bp-logo is-txt"></span>
          <div className="bp-id">
            <p className="t-h2">Loading the brand…</p>
          </div>
        </section>
      </div>
    );
  if (c.err) {
    const gone = c.err.status === 404 || c.err.status === 403;
    return (
      <div className="view-in">
        <div className="empty">
          <p className="t-h2">{gone ? "This brand isn't available." : "The brand profile couldn't load."}</p>
          <p className="muted">{gone ? "The brand may have closed its account." : errText(c.err)}</p>
          <div className="row wrap">
            {gone ? null : (
              <Lq
                className="lq-p"
                data-retry=""
                onClick={() => {
                  delete cache[id];
                  setC(null);
                  load(false);
                }}
              >
                Try again
              </Lq>
            )}
            <Lq as="a" className="lq-s" href="#jobs">
              See open collabs
            </Lq>
          </div>
        </div>
      </div>
    );
  }

  const p = c.p;
  const repaint = () => setC({ ...cache[id] });
  const openPitch = () => {
    const st = state(p);
    if (st.k === "soon")
      return openReactSheet({
        title: "Pitching opens soon",
        render: close => <SoonSheet p={p} close={close} />,
      });
    const editing = st.k === "edit";
    openReactSheet({
      title: editing ? "Edit your pitch" : `Pitch ${p.name}`,
      render: close => (
        <PitchSheet
          p={p}
          editing={editing}
          close={close}
          onDone={mine => {
            p.myPitch = mine;
            p.canPitch = false;
            L.toast(editing ? "Pitch updated. It's locked now." : `Pitch sent to ${p.name}`, "check");
            repaint();
          }}
          onOff={() => {
            p.pitchingOn = false;
            repaint();
            openPitch();
          }}
          onStale={() => load(true)}
        />
      ),
    });
  };
  const onView = () => {
    if (state(p).k === "blocked") return L.toast(p.blockedReason || BLOCKED_TXT, "info");
    if (cardRef.current)
      cardRef.current.scrollIntoView({ behavior: L.RM ? "auto" : "smooth", block: "start" });
  };
  return <Page p={p} onPitch={openPitch} onView={onView} cardRef={cardRef} />;
}

L.register("brand", {
  title: id => (cache[id] && cache[id].p ? cache[id].p.name : "Brand"),
  crumb: id =>
    `<a href="#jobs">Find collabs</a> / ${L.esc(cache[id] && cache[id].p ? cache[id].p.name : "Brand")}`,
  nav: "jobs",
  Component: BrandScreen,
});
