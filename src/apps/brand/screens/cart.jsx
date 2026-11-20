/* Hiring cart (#cart): direct hiring steps 3–6. One row per creator in LLD_DATA.cart:
   deliverables (platform, format, count, notes) → timeline (due date) → revisions → agreed price (prefilled from the rate card) → Send invitation.
   Sending pushes a campaign {stage:'invited', source:'direct'} with a log entry, removes the creator from the cart, adds a notification,
   and a thread runs from the row to Campaigns in the nav. Payment into escrow happens only after the creator accepts (Builder C).
   Drafts live in LLD_DATA.ui.cart.drafts. Owner: Builder B. Classes .cart-*; styles in cart.css.
   React screen (see src/shared/react/view.jsx): each row edits its draft object and redraws itself. */
import { Fragment, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq } from "@/shared/react/view";
import { AvailPill, CkGlyph, CrAvatar, VerBadge } from "./kit";

const L = window.LLD,
  S = () => window.LLD_DATA;
const mo = (fn, ...a) => {
  try {
    const m = L.motion;
    return m && m[fn] ? m[fn](...a) : null;
  } catch (e) {
    return null;
  }
};
const flip = (mutate, nodes) => {
  let done = false;
  const m = () => {
    done = true;
    mutate();
  };
  try {
    L.motion && L.motion.flip && L.motion.flip(m, nodes);
  } catch (e) {}
  if (!done) mutate();
};

const MIN_DAYS = 3,
  MAX_DAYS = 180,
  MIN_PRICE = 500,
  MAX_ITEMS = 6;
const first = n => String(n || "").split(/\s+/)[0];
const iso = d => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const addDays = n => {
  const t = new Date(L.today());
  t.setDate(t.getDate() + n);
  return iso(t);
};
const todayISO = () => iso(L.today());
const daysTo = v =>
  Math.round((new Date(v + "T12:00:00+05:30") - new Date(todayISO() + "T12:00:00+05:30")) / 864e5);
const digits = v => String(v ?? "").replace(/[^\d]/g, "");
const group = v => {
  const d = digits(v);
  return d ? Number(d).toLocaleString("en-IN") : "";
};
const plural = (n, w) => (n === 1 ? w : w === "Story" ? "Stories" : w + "s");

function ui() {
  const s = S();
  s.ui = s.ui || {};
  const u = s.ui.cart || (s.ui.cart = {});
  u.drafts = u.drafts || {};
  return u;
}
const K = () => L.ck;
const formatsFor = (c, p) => {
  const f = K().FORMATS[p] || [];
  const have = f.filter(x => c.content.includes(x));
  return have.length ? have : f;
};
const rateOf = (c, f) => (c.rates || {})[String(f).toLowerCase()] || 0;
const listed = (c, d) => d.items.reduce((n, it) => n + rateOf(c, it.f) * it.n, 0);
function draft(c) {
  const u = ui();
  if (!u.drafts[c.id]) {
    const p = c.platforms[0].p,
      f = formatsFor(c, p)[0];
    const start = Math.max(0, K().availDays(c));
    u.drafts[c.id] = {
      title: "",
      items: [{ p, f, n: 1, notes: "" }],
      due: addDays(Math.max(21, start + 14)),
      rev: 1,
      price: "",
      touched: false,
    };
  }
  const d = u.drafts[c.id];
  if (!d.touched) d.price = String(listed(c, d) / 100);
  return d;
}
const itemTxt = it => `${it.n} ${plural(it.n, it.f)}${it.notes.trim() ? ", " + it.notes.trim() : ""}`;
const priceP = d => (parseInt(digits(d.price), 10) || 0) * 100;

function validate(c, d) {
  const e = {};
  if (d.title.trim().length < 3) e.title = `Add a short title so ${first(c.name)} knows what this is for.`;
  if (!d.items.length) e.items = "Add at least one deliverable.";
  if (!d.due) e.due = "Pick a due date.";
  else {
    const n = daysTo(d.due);
    if (n < MIN_DAYS) e.due = `Give at least ${MIN_DAYS} days. Creators need time to shoot and edit.`;
    else if (n > MAX_DAYS) e.due = "Pick a date within the next 6 months.";
  }
  const p = priceP(d);
  if (!p) e.price = "Enter the agreed price.";
  else if (p < MIN_PRICE * 100) e.price = `The agreed price must be at least ${L.inr(MIN_PRICE * 100)}.`;
  return e;
}
const dueHelp = d => {
  if (!d.due) return "They submit the content for your review by this date.";
  const n = daysTo(d.due);
  return `${L.fmtDate(d.due)}, ${n < 0 ? "in the past" : n === 0 ? "today" : n === 1 ? "tomorrow" : n + " days from today"} · they submit the content for your review by this date.`;
};

/* ---------- one deliverable line ---------- */
function ItemRow({ c, it, i, rid, only, onChange, onDel }) {
  const P = K().PLAT,
    many = c.platforms.length > 1,
    fmts = formatsFor(c, it.p);
  const Lab = many ? "label" : "span";
  return (
    <li className="cart-item" data-i={i}>
      <div className="field cart-f-p">
        <Lab className="lab" {...(many ? { htmlFor: `${rid}-p${i}` } : {})}>
          Platform
        </Lab>
        {many ? (
          <select
            className="select"
            id={`${rid}-p${i}`}
            data-k="p"
            value={it.p}
            onChange={e => onChange("p", e.target.value)}
          >
            {c.platforms.map(p => (
              <option key={p.p} value={p.p}>
                {P[p.p].name}
              </option>
            ))}
          </select>
        ) : (
          <span className="cart-fixed">
            <CkGlyph p={it.p} />
            {P[it.p].name}
          </span>
        )}
      </div>
      <div className="field cart-f-f">
        <label htmlFor={`${rid}-f${i}`}>Format</label>
        <select
          className="select"
          id={`${rid}-f${i}`}
          data-k="f"
          value={it.f}
          onChange={e => onChange("f", e.target.value)}
        >
          {fmts.map(f => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div className="field cart-f-n">
        <label htmlFor={`${rid}-n${i}`}>Count</label>
        <select
          className="select num"
          id={`${rid}-n${i}`}
          data-k="n"
          value={it.n}
          onChange={e => onChange("n", +e.target.value)}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="field cart-f-notes">
        <label htmlFor={`${rid}-x${i}`}>
          Notes <span className="cart-opt">Optional</span>
        </label>
        <input
          className="input"
          id={`${rid}-x${i}`}
          data-k="notes"
          maxLength={120}
          autoComplete="off"
          placeholder="e.g. 30–45 s, product in the first 3 s"
          value={it.notes}
          onChange={e => onChange("notes", e.target.value)}
        />
      </div>
      {only ? (
        <span className="cart-item-x" aria-hidden="true"></span>
      ) : (
        <button
          className="ibtn cart-item-x"
          type="button"
          data-delitem={i}
          aria-label={`Remove deliverable ${i + 1}, ${it.n + " " + plural(it.n, it.f)}`}
          onClick={onDel}
        >
          <Icon n="close" />
        </button>
      )}
    </li>
  );
}

/* ---------- one cart row ---------- */
function CartRow({ c, onRemove, onSend, rowRef, onDirty }) {
  const d = draft(c),
    rid = "cart-" + c.id,
    K_ = K(),
    fn = first(c.name);
  const [, redraw] = useState(0);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [focusSel, setFocusSel] = useState(null);
  const row = useRef(null);
  useEffect(() => {
    if (!focusSel || !row.current) return;
    const f = row.current.querySelector(focusSel);
    f && f.focus({ preventScroll: true });
    if (focusSel.startsWith(".cart-item")) {
      const li = f && f.closest(".cart-item");
      li && mo("stagger", [li]);
    }
    setFocusSel(null);
  }, [focusSel]);
  const up = () => {
    draft(c);
    redraw(n => n + 1);
    onDirty && onDirty(); // the screen's total follows the row's price
  };
  const clear = k => errs[k] && setErrs(e => ({ ...e, [k]: "" }));
  const live = S().campaigns.filter(
    x =>
      x.creator === c.id &&
      ["invited", "accepted", "funded", "in_progress", "submitted", "revision"].includes(x.stage),
  );
  const ad = K_.availDays(c);
  const p = priceP(d),
    total = listed(c, d);
  const parts = d.items
    .filter(it => rateOf(c, it.f))
    .map(it => `${it.n} ${plural(it.n, it.f)} × ${L.inr(rateOf(c, it.f))}`);
  const field = (k, cls, children, extra = {}) => (
    <div className={`${cls}${errs[k] ? " is-err" : ""}`} data-err={k} {...extra}>
      {children}
    </div>
  );

  const send = async btn => {
    if (busy) return;
    if (L.live && L.needKyc("#cart")) return; // the draft stays in the cart for after verification
    const e = validate(c, d);
    flushSync(() => setErrs(e));
    const keys = Object.keys(e);
    if (keys.length) {
      mo("shake", btn);
      const f = row.current.querySelector(`[data-err="${keys[0]}"]`),
        inp = f && f.querySelector("input,select,button");
      inp && inp.focus({ preventScroll: false });
      return;
    }
    setBusy(true);
    if (L.live) {
      try {
        await L.live.sendOffer({
          creatorId: c.id,
          deliverable: d.items.map(itemTxt).join(" + "),
          budget: priceP(d),
          deadline: d.due,
          message: d.title.trim() + (d.rev ? `\n\n${d.rev} revision${d.rev === 1 ? "" : "s"} included.` : ""),
          usageRights: S().ui.cart && S().ui.cart.usage ? S().ui.cart.usage : "As agreed in chat",
        });
      } catch (er) {
        setBusy(false);
        if (L.live.isKycRequired(er)) return L.kycGate("#cart");
        L.toast(L.live.errorText(er), "alert");
        setErrs(x => ({ ...x, title: L.live.errorText(er) }));
        return;
      }
    }
    await onSend(c, d, row.current);
  };

  return (
    <article
      className="cart-row"
      data-id={c.id}
      aria-labelledby={`${rid}-n`}
      ref={n => {
        row.current = n;
        rowRef && rowRef(c.id, n);
      }}
    >
      <header className="cart-row-h">
        <CrAvatar c={c} cls="cart-av" />
        <div className="cart-who">
          <h2 className="t-h3" id={`${rid}-n`}>
            <a href={`#creator-${c.id}`}>{c.name}</a>
            <VerBadge c={c} />
          </h2>
          <p className="muted">
            {c.handle} · {c.city}
          </p>
        </div>
        <AvailPill c={c} />
        <button
          className="ibtn cart-remove"
          type="button"
          data-remove=""
          aria-label={`Remove ${c.name} from the cart`}
          title="Remove from cart"
          onClick={() => onRemove(c, row.current)}
        >
          <Icon n="trash" />
        </button>
      </header>
      {live.length ? (
        <p className="cart-note">
          <Icon n="info" />
          <span>
            You already have <b>{live[0].title}</b> with {fn}. This sends a separate invitation.
          </span>
        </p>
      ) : null}

      {field(
        "title",
        "field cart-title",
        <>
          <label htmlFor={`${rid}-t`}>Brief title</label>
          <input
            className="input"
            id={`${rid}-t`}
            data-k="title"
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. Barrier Repair Serum, winter launch"
            value={d.title}
            onChange={e => {
              d.title = e.target.value;
              clear("title");
              up();
            }}
          />
          <p className="err" aria-live="polite">
            {errs.title || ""}
          </p>
        </>,
      )}

      <section
        className={`cart-sec${errs.items ? " is-err" : ""}`}
        aria-labelledby={`${rid}-dl`}
        data-err="items"
      >
        <div className="cart-sec-h">
          <h3 className="t-label" id={`${rid}-dl`}>
            <span className="cart-step num">1</span>Deliverables
          </h3>
          <p className="help">What {fn} posts for you</p>
        </div>
        <ol className="cart-items">
          {d.items.map((it, i) => (
            <ItemRow
              key={i}
              c={c}
              it={it}
              i={i}
              rid={rid}
              only={d.items.length === 1}
              onChange={(k, v) => {
                it[k] = v;
                if (k === "p") {
                  const f = formatsFor(c, it.p);
                  if (!f.includes(it.f)) it.f = f[0];
                }
                up();
              }}
              onDel={() => {
                d.items.splice(i, 1);
                up();
                setFocusSel(".cart-add");
              }}
            />
          ))}
        </ol>
        <p className="err" aria-live="polite">
          {errs.items || ""}
        </p>
        {d.items.length < MAX_ITEMS ? (
          <Lq
            className="lq-s lq-sm cart-add"
            data-additem=""
            onClick={() => {
              const last = d.items[d.items.length - 1] || { p: c.platforms[0].p };
              const order = [last.p, ...c.platforms.map(x => x.p).filter(pp => pp !== last.p)];
              const pairs = order.flatMap(pp => formatsFor(c, pp).map(f => ({ p: pp, f })));
              const next = pairs.find(x => !d.items.some(it => it.p === x.p && it.f === x.f)) || pairs[0];
              d.items.push({ p: next.p, f: next.f, n: 1, notes: "" });
              clear("items");
              up();
              setFocusSel(`.cart-item[data-i="${d.items.length - 1}"] [data-k="f"]`);
            }}
          >
            <Icon n="plus" className="ic" />
            Add deliverable
          </Lq>
        ) : null}
      </section>

      <div className="cart-two">
        <section className={`cart-sec field${errs.due ? " is-err" : ""}`} data-err="due">
          <div className="cart-sec-h">
            <h3 className="t-label">
              <span className="cart-step num">2</span>
              <label htmlFor={`${rid}-d`}>Due date</label>
            </h3>
          </div>
          <input
            className="input num cart-date"
            id={`${rid}-d`}
            type="date"
            data-k="due"
            min={addDays(MIN_DAYS)}
            max={addDays(MAX_DAYS)}
            value={d.due}
            onChange={e => {
              d.due = e.target.value;
              clear("due");
              up();
            }}
            onInput={e => {
              d.due = e.target.value;
              clear("due");
              up();
            }}
          />
          <p className="help" data-duehelp="">
            {dueHelp(d)}
          </p>
          {ad > 0 ? <p className="help">{K_.availLabel(c)}. Leave room after that.</p> : null}
          <p className="err" aria-live="polite">
            {errs.due || ""}
          </p>
        </section>
        <section className="cart-sec">
          <div className="cart-sec-h">
            <h3 className="t-label" id={`${rid}-rl`}>
              <span className="cart-step num">3</span>Revisions included
            </h3>
          </div>
          <div className="seg cart-seg" role="group" aria-labelledby={`${rid}-rl`}>
            {[0, 1, 2, 3].map(n => (
              <button
                key={n}
                type="button"
                data-rev={n}
                aria-pressed={String(n === d.rev)}
                onClick={() => {
                  d.rev = n;
                  up();
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="help" data-revhelp="">
            {d.rev
              ? `${d.rev} more ${d.rev === 1 ? "round" : "rounds"} of changes after the first delivery.`
              : "You approve or decline the first delivery as it is."}
          </p>
        </section>
      </div>

      <section className={`cart-sec field cart-price${errs.price ? " is-err" : ""}`} data-err="price">
        <div className="cart-sec-h">
          <h3 className="t-label">
            <span className="cart-step num">4</span>
            <label htmlFor={`${rid}-pr`}>Agreed price</label>
          </h3>
        </div>
        <div className="money-in">
          <span aria-hidden="true">₹</span>
          <input
            id={`${rid}-pr`}
            className="num"
            data-k="price"
            inputMode="numeric"
            autoComplete="off"
            value={
              document.activeElement && document.activeElement.id === `${rid}-pr`
                ? (d.priceRaw ?? group(d.price))
                : group(d.price)
            }
            aria-describedby={`${rid}-lr`}
            onChange={e => {
              d.priceRaw = e.target.value;
              d.price = digits(e.target.value).slice(0, 8);
              d.touched = true;
              clear("price");
              up();
            }}
            onBlur={() => {
              d.priceRaw = undefined;
              up();
            }}
          />
        </div>
        <p className="help" id={`${rid}-lr`} data-listed="">
          {!parts.length ? (
            `${fn} has no listed rate for this format. Agree a price you think is fair.`
          ) : (
            <>
              {`Listed rate: ${parts.join(" + ")}${parts.length > 1 ? " = " + L.inr(total) : ""}.`}
              {d.touched && p !== total ? (
                <>
                  {" "}
                  <button
                    className="btn-q"
                    type="button"
                    data-relist=""
                    onClick={e => {
                      d.touched = false;
                      d.priceRaw = undefined;
                      clear("price");
                      up();
                      const inp = e.currentTarget.closest(".cart-price").querySelector('[data-k="price"]');
                      requestAnimationFrame(() => inp.focus({ preventScroll: true }));
                    }}
                  >
                    Use {L.inr(total)}
                  </button>
                </>
              ) : null}
              {d.touched && p && p < total ? (
                <span className="cart-below">
                  Below {fn}’s listed rate. {fn} can still accept, or decline.
                </span>
              ) : null}
            </>
          )}
        </p>
        <p className="err" aria-live="polite">
          {errs.price || ""}
        </p>
      </section>

      <footer className="cart-row-f">
        <p className="cart-sum" data-sum="">
          {p ? (
            <>
              {fn} receives <b className="num">{L.inr(p)}</b>, the agreed price. You pay it into escrow only
              after {fn} accepts. No fee, tax as per confirmed rules.
            </>
          ) : (
            "Set the agreed price to send this invitation."
          )}
        </p>
        <div className="cart-send-w">
          <Lq
            className="lq-p cart-send"
            data-send=""
            aria-disabled={busy ? "true" : undefined}
            aria-busy={busy ? "true" : undefined}
            onClick={e => send(e.currentTarget)}
          >
            <Icon n="send" className="ic" />
            Send invitation
          </Lq>
          <p className="ll-trust">
            <Icon n="lock" />
            Held safely until you approve.
          </p>
        </div>
      </footer>
    </article>
  );
}

function Slip({ camp, c }) {
  return (
    <div className="cart-slip" data-id={`slip-${camp.id}`} role="status">
      <span className="cart-slip-ic">
        <Icon n="check" />
      </span>
      <div className="cart-slip-t">
        <p>
          <b>Invitation sent to {c.name}</b>
        </p>
        <p className="muted">
          {camp.title} ·{" "}
          {camp.items.length === 1
            ? camp.items[0].count + " " + plural(camp.items[0].count, camp.items[0].format)
            : camp.items.length + " deliverables"}{" "}
          · due {L.fmtDate(camp.due)}. You pay <span className="num">{L.inr(camp.price)}</span> into escrow if{" "}
          {first(c.name)} accepts.
        </p>
      </div>
      <Lq as="a" className="lq-s lq-sm" href={`#campaign-${camp.id}`}>
        View in Deals
        <Icon n="arrow" className="ic" />
      </Lq>
    </div>
  );
}

function CartScreen() {
  const u = ui();
  const [, redraw] = useState(0);
  const sent = useRef([]); // slips for invitations sent on this visit
  const removed = useRef(null);
  const [undo, setUndo] = useState(null); // { text, btn }
  const list = useRef(null),
    undoEl = useRef(null);
  const rows = useRef({});
  if (K()) K().ensure();
  const people = () => S().cart.map(L.creator).filter(Boolean);
  const kids = () => [...list.current.children];

  useEffect(() => {
    if (!K()) return;
    mo("stagger", L.$$(".cart-row", list.current));
    if (u.focus) {
      const id = u.focus;
      u.focus = null;
      requestAnimationFrame(() =>
        setTimeout(() => {
          const r = rows.current[id];
          if (!r) return;
          r.scrollIntoView({ block: "start", behavior: "auto" });
          window.scrollBy(0, -88);
          const t = r.querySelector('[data-k="title"]');
          t && t.focus({ preventScroll: true });
          mo("fresh", r);
        }, 40),
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!K())
    return (
      <div className="empty">
        <p className="t-h2">The cart could not load.</p>
        <p className="muted">Reload the page to try again.</p>
      </div>
    );

  const remove = (c, r) => {
    const id = c.id,
      idx = S().cart.indexOf(id);
    removed.current = { id, idx };
    flip(
      () =>
        flushSync(() => {
          K().removeFromCart(id);
          setUndo({ name: c.name });
          redraw(n => n + 1);
        }),
      kids,
    );
    void r;
    const nx = list.current.querySelector('.cart-row [data-k="title"]');
    (nx || (undoEl.current && undoEl.current.querySelector("button")))?.focus({ preventScroll: true });
  };
  const doUndo = () => {
    if (!removed.current) return;
    const { id, idx } = removed.current;
    removed.current = null;
    flip(
      () =>
        flushSync(() => {
          L.store.set(s => {
            if (!s.cart.includes(id)) s.cart.splice(Math.min(idx, s.cart.length), 0, id);
          }, "cart-add");
          setUndo({ back: true });
          redraw(n => n + 1);
        }),
      kids,
    );
    const r = rows.current[id];
    if (r) {
      mo("fresh", r);
      r.querySelector('[data-k="title"]').focus({ preventScroll: true });
    }
  };
  const onSend = async (c, d, r) => {
    const now = L.today().toISOString();
    const camp = {
      id: "c" + Date.now().toString(36),
      creator: c.id,
      source: "direct",
      job: null,
      title: d.title.trim(),
      platform: d.items[0].p,
      format: d.items[0].f,
      price: priceP(d),
      stage: "invited",
      revisionsIncluded: d.rev,
      revisionsUsed: 0,
      due: d.due,
      thread: null,
      invited: now,
      deliverables: d.items.map(itemTxt),
      items: d.items.map(it => ({ platform: it.p, format: it.f, count: it.n, notes: it.notes.trim() })),
      log: [[now, "invited"]],
    };
    /* the thread runs from the row to Campaigns while the row is still on screen, then the row becomes its receipt */
    try {
      await (mo("thread", r, mo("navItem", "campaigns")) || Promise.resolve());
    } catch (e) {}
    flip(
      () =>
        flushSync(() => {
          L.store.set(s => {
            s.campaigns.push(camp);
            s.cart = s.cart.filter(x => x !== c.id);
            if (s.ui && s.ui.cart && s.ui.cart.drafts) delete s.ui.cart.drafts[c.id];
            s.notifications.unshift({
              id: "n" + Date.now(),
              kind: "invited",
              text: `Invitation sent to ${c.name} for ${camp.title}. You pay into escrow after ${first(c.name)} accepts.`,
              at: now,
              go: "#campaign-" + camp.id,
              read: false,
            });
          }, "invite");
          sent.current.unshift({ camp, c });
          redraw(n => n + 1);
        }),
      kids,
    );
    const slip = list.current.querySelector(`.cart-slip[data-id="slip-${camp.id}"]`);
    const a = slip && slip.querySelector("a");
    a && a.focus({ preventScroll: true });
    slip &&
      slip.scrollIntoView &&
      slip.getBoundingClientRect().top < 72 &&
      slip.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
  };

  const ps = people();
  const total = ps.reduce((n, c) => n + priceP(draft(c)), 0);
  const none = !ps.length;
  return (
    <div className="view-in cart">
      <header className="cart-head">
        <div className="cart-head-t">
          <h1 className="t-h1">Hiring cart</h1>
          <p className="cart-lede">
            Set what you need from each creator, then send the invitation. <b>Nothing is charged now.</b> You
            pay the agreed price into escrow only after a creator accepts.{" "}
            <span className="sample">Sample data</span>
          </p>
        </div>
        <Lq as="a" className="lq-s lq-sm" href="#creators">
          <Icon n="plus" className="ic" />
          Add more creators
        </Lq>
      </header>
      <div className="cart-layout">
        <div className="cart-main">
          <div className="cart-list" id="cartList" ref={list}>
            {sent.current.map(x => (
              <Slip key={"s" + x.camp.id} camp={x.camp} c={x.c} />
            ))}
            {ps.map(c => (
              <CartRow
                key={c.id}
                c={c}
                onRemove={remove}
                onSend={onSend}
                rowRef={(id, n) => (rows.current[id] = n)}
                onDirty={() => redraw(n => n + 1)}
              />
            ))}
          </div>
          <p className="cart-undo" aria-live="polite" ref={undoEl}>
            {undo && undo.back ? (
              "Back in your cart."
            ) : undo ? (
              <>
                Removed {undo.name} from the cart.{" "}
                <button className="btn-q" type="button" data-undo="" onClick={doUndo}>
                  Undo
                </button>
              </>
            ) : null}
          </p>
          <div className="empty cart-empty" hidden={!none}>
            {!none ? null : sent.current.length ? (
              <>
                <img src="assets/step-02-plane.svg" width="72" height="72" alt="" />
                <p className="t-h2">Everyone is invited.</p>
                <p className="muted">
                  You will get a notification when they reply. Pay into escrow from Deals once they accept.
                </p>
                <div className="row wrap cart-empty-a">
                  <Lq className="lq-p" data-go="#campaigns">
                    Go to Deals
                  </Lq>
                  <Lq className="lq-s" data-go="#creators">
                    Find more creators
                  </Lq>
                </div>
              </>
            ) : (
              <>
                <img src="assets/step-01-envelope.svg" width="160" height="117" alt="" />
                <p className="t-h2">Your cart is empty.</p>
                <p className="muted">
                  Add creators from Find creators or their profile, then set deliverables and a due date here.
                </p>
                <div className="row wrap cart-empty-a">
                  <Lq className="lq-p" data-go="#creators">
                    Find creators
                  </Lq>
                  {S().favorites.length ? (
                    <Lq className="lq-s" data-go="#saved">
                      Open saved creators
                    </Lq>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
        <aside className="cart-aside" aria-label="Payment" hidden={!ps.length && !sent.current.length}>
          <div className="cart-total">
            <p className="t-eyebrow">If everyone accepts</p>
            <p className="t-money t-money-l num" data-total="">
              {L.inr(total)}
            </p>
            <p className="cart-total-s" data-totals="">
              {ps.length
                ? `${ps.length} ${ps.length === 1 ? "creator" : "creators"} · agreed prices only, no platform fee. Tax as per confirmed rules.`
                : "Your cart is empty."}
            </p>
          </div>
          <div className="cart-how">
            <h2 className="t-h3">When you pay</h2>
            <ol className="cart-steps">
              <li>
                <span className="cart-dot" aria-hidden="true"></span>
                <p>
                  <b>You send the invitation.</b> Nothing is charged.
                </p>
              </li>
              <li>
                <span className="cart-dot" aria-hidden="true"></span>
                <p>
                  <b>The creator accepts or declines.</b> We notify you either way.
                </p>
              </li>
              <li className="is-escrow">
                <span className="cart-dot" aria-hidden="true">
                  <Icon n="lock" />
                </span>
                <p>
                  <b>You pay the agreed price into escrow.</b> Linkloom holds it and chat opens.
                </p>
              </li>
              <li>
                <span className="cart-dot" aria-hidden="true"></span>
                <p>
                  <b>You approve the work.</b> The money is released to the creator.
                </p>
              </li>
            </ol>
            <p className="help">
              No platform fee on any deal. If the creator does not deliver, the escrow comes back to you in
              full.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

L.register("cart", {
  title: "Hiring cart",
  nav: "creators",
  crumb: '<a href="#creators">Find creators</a> / Hiring cart',
  Component: CartScreen,
});
void Fragment;
