/* Earnings (#earnings). Owned by Builder C.
   Every total here is derived from LLD_DATA.ledger and LLD_DATA.withdrawals in integer paise, never typed in:
   ready = Σ net(paid rows) − Σ withdrawals paid or processing; earned = Σ net(paid + pending rows).
   Pending (still clearing) and failed rows are never ready. Subscription model: no per-deal fee, so net = the agreed price
   (LLD.payout(p).net === p). Tax is never computed; it is always "as per confirmed rules".
   React screen (see src/shared/react/view.jsx). Numbers that count up are elements React leaves to the motion layer. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon, Lq, openReactSheet } from "@/shared/react/view";
import { NetBanner, PayoutSlip } from "../active/deal-ui";

const L = window.LLD,
  esc = L.esc,
  ic = L.icon;
const C = (window.LLD_C = window.LLD_C || {});
const net = p => L.payout(p).net;
const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
const OUT = w => w.status === "paid" || w.status === "processing";

C.money = () => {
  const s = L.store.s,
    by = st => s.ledger.filter(l => l.status === st);
  const cleared = sum(by("paid"), l => net(l.amount)),
    clearing = sum(by("pending"), l => net(l.amount)),
    failed = sum(by("failed"), l => net(l.amount));
  const out = sum(s.withdrawals.filter(OUT), w => w.amount);
  return { cleared, clearing, failed, out, ready: cleared - out, earned: cleared + clearing };
};
/* keep the shared field (read by the sidebar slip) equal to the ledger result; call inside store.set */
C.syncReady = s => {
  s.readyToWithdraw = C.money().ready;
};

/* the ink payout slip is deal-ui.jsx's PayoutSlip (also used on the work board) */

const STATUS = {
  paid: { pill: "pill-ok", icon: "check", label: "Paid" },
  pending: { pill: "pill-warn", icon: "clock", label: "Pending" },
  failed: { pill: "pill-err", icon: "alert", label: "Failed" },
  processing: { pill: "pill-info", icon: "clock", label: "Processing" },
};
const Pill = ({ st, extra }) => {
  const x = STATUS[st] || STATUS.pending;
  return (
    <span className={`pill ${x.pill}`}>
      <Icon n={x.icon} />
      {x.label + (extra ? " · " + extra : "")}
    </span>
  );
};
const LedgerSlip = ({ l }) => (
  <PayoutSlip
    price={l.amount}
    brand={l.brand}
    job={l.job}
    failed={l.status === "failed"}
    status={
      l.status === "paid" ? (
        <Pill st="paid" extra={"released " + L.fmtDate(l.date)} />
      ) : l.status === "pending" ? (
        <Pill st="pending" extra={l.clears ? "clears " + L.fmtDate(l.clears) : "clearing"} />
      ) : (
        <Pill st="failed" />
      )
    }
    foot={
      l.status === "paid"
        ? `In your balance since ${L.fmtDate(l.date, { year: true })}. Ref LL-PS-${l.id.toUpperCase()}`
        : l.status === "pending"
          ? `Approved ${L.fmtDate(l.date)}. Not in your balance until it clears.`
          : l.reason || "The release did not go through. It is not counted in your balance."
    }
  />
);

const RANGES = [
  ["30", "30 days"],
  ["90", "90 days"],
  ["fy", "This FY"],
  ["all", "All time"],
];
const rangeFrom = k => {
  const t = C.today ? C.today() : "2026-11-04";
  if (k === "30") return C.addDays(t, -30);
  if (k === "90") return C.addDays(t, -90);
  if (k === "fy") {
    const [y, m] = t.split("-").map(Number);
    return (m >= 4 ? y : y - 1) + "-04-01";
  } // Indian financial year starts 1 April
  return null;
};
const earnedIn = k => {
  const from = rangeFrom(k),
    rows = L.store.s.ledger.filter(
      l => (l.status === "paid" || l.status === "pending") && (!from || l.date >= from),
    );
  const first = from || rows.reduce((a, l) => (a && a < l.date ? a : l.date), null) || C.today();
  return {
    total: sum(rows, l => net(l.amount)),
    n: rows.length,
    label: `${L.fmtDate(first, { year: L.D(first).getFullYear() !== L.D(C.today()).getFullYear() })} – ${L.fmtDate(C.today(), { year: true })}`,
  };
};
const FILTERS = [
  ["all", "All"],
  ["paid", "Paid"],
  ["pending", "Pending"],
  ["failed", "Failed"],
];
/* a receipt feeds out of its slot (motion.js print); falls back to the plain reveal */
const feed = (n, delay) => {
  if (!n) return;
  if (n.matches(".earnings-slip-w,.earnings-mini-w") && n.firstElementChild) n = n.firstElementChild; // clip the paper, not its shadow wrapper
  L.motion.print ? L.motion.print(n, { delay }) : L.motion.reveal(n);
};
const narrow = () => matchMedia("(max-width:900px)").matches;
const dayNum = d => L.D(d).toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" });
const monTxt = d => L.D(d).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });

/* rupee text -> integer paise without floating point ("12,600.5" -> 1260050) */
const toPaise = str => {
  const v = String(str).replace(/[,\s₹]/g, "");
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(v)) return NaN;
  const [r, d = ""] = v.split(".");
  return parseInt(r, 10) * 100 + parseInt((d + "00").slice(0, 2), 10);
};
const rupeesText = p => L.inr(p, { dec: p % 100 !== 0 }).slice(1);
const MIN = 10000; // ₹100 sample minimum

function EmptyEarnings({ s }) {
  const e = s.earningsSummary;
  return (
    <div className="view-in earnings">
      <h1 className="t-h1">Earnings</h1>
      <div className="empty earnings-empty">
        <img src="assets/step-06-coins.svg" width="220" height="160" alt="" />
        <p className="t-h2">No earnings yet</p>
        <p className="muted">
          {e && e.inEscrow
            ? `${L.inr(e.inEscrow)} is held in escrow for ${e.ordersInEscrow} deal${e.ordersInEscrow === 1 ? "" : "s"} in progress. `
            : ""}
          When a brand approves your work, the payout is released from escrow and shows up here with a full
          slip.
        </p>
        <Lq as="a" className="lq-p" href="#jobs">
          Find collabs
        </Lq>
      </div>
    </div>
  );
}

/* ---------- the withdraw sheet: four steps, each swapped in with the motion layer ---------- */
function Withdraw({ close, repaint, keep }) {
  const s = L.store.s,
    methods = s.payoutMethods || [];
  const startReady = useRef(C.money().ready);
  const [st, setSt] = useState({
    step: 1,
    msg: "",
    amount: C.money().ready,
    method: methods[0] ? methods[0].id : "upi",
  });
  const [amtTxt, setAmtTxt] = useState(rupeesText(C.money().ready));
  const box = useRef(null);
  const stepN = useRef(0);
  const M = () => methods.find(x => x.id === st.method) || methods[0];
  /** Moves to the next state, sliding the box like the old sheet did (dir by step number). */
  const go = (next, n) => {
    const dir = n == null || n >= stepN.current ? 1 : -1;
    const put = () => flushSync(() => setSt(x => ({ ...x, ...next })));
    if (n != null && stepN.current && L.motion.swap) L.motion.swap(box.current, put, { dir });
    else put();
    if (n != null) stepN.current = n;
  };
  useEffect(() => {
    stepN.current = 1;
  }, []);
  useLayoutEffect(() => {
    if (!box.current) return;
    L.liquid(box.current);
    C.press(box.current);
    const f = L.$("input,button", box.current);
    f && f.focus({ preventScroll: true });
    if (st.step === 2) feed(L.$(".earnings-mini-w", box.current), 120);
    if (st.step === 4 && st.ok) {
      feed(L.$(".earnings-rcpt", box.current), 80);
      L.motion.count(L.$("[data-left]", box.current), st.left, L.inr, { from: startReady.current });
      L.motion.celebrate(L.$(".earnings-rcpt", box.current));
    }
  }, [st.step, st.ok, st.msg]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = C.money();
  let body;
  if (st.step === 1) {
    const submit = e => {
      e.preventDefault();
      const p = toPaise(amtTxt);
      const method = (L.$("input[name=wdM]:checked", box.current) || {}).value || st.method;
      const err = isNaN(p)
        ? "Enter an amount in rupees, like 5,000."
        : p < MIN
          ? "The minimum withdrawal is ₹100."
          : p > m.ready
            ? `You can withdraw up to ${L.inr(m.ready)}. Money still clearing is not ready yet.`
            : "";
      if (err) {
        go({ msg: err, method, amount: isNaN(p) ? st.amount : p });
        requestAnimationFrame(() => L.$("#wdAmt", box.current) && L.$("#wdAmt", box.current).focus());
        return;
      }
      go({ step: 2, msg: "", amount: p, method }, 2);
    };
    const msg = st.msg;
    body = (
      <form className="earnings-wf" noValidate onSubmit={submit}>
        <p className="earnings-wf-avail">
          <span>Ready to withdraw</span>
          <b className="t-money">{L.inr(m.ready)}</b>
        </p>
        <div className={`field${msg ? " is-err" : ""}`}>
          <label htmlFor="wdAmt">Amount</label>
          <div className="money-in">
            <span aria-hidden="true">₹</span>
            <input
              id="wdAmt"
              inputMode="decimal"
              autoComplete="off"
              value={amtTxt}
              onChange={e => setAmtTxt(e.target.value)}
              onBlur={() => {
                const p = toPaise(amtTxt);
                if (!isNaN(p)) setAmtTxt(rupeesText(p));
              }}
              aria-describedby="wdAmtHelp wdAmtErr"
              aria-invalid={msg ? "true" : undefined}
            />
          </div>
          <p className="help" id="wdAmtHelp">
            Up to {L.inr(m.ready)}. Minimum ₹100. Only cleared money can leave.
          </p>
          <p className="err" id="wdAmtErr" hidden={!msg}>
            {msg || ""}
          </p>
          <div className="chips">
            <button
              className="chip"
              type="button"
              data-amt="all"
              onClick={() => {
                setAmtTxt(rupeesText(m.ready));
                L.$("#wdAmt", box.current).focus();
              }}
            >
              All {L.inr(m.ready)}
            </button>
            <button
              className="chip"
              type="button"
              data-amt="half"
              onClick={() => {
                setAmtTxt(rupeesText(Math.floor(m.ready / 2)));
                L.$("#wdAmt", box.current).focus();
              }}
            >
              Half
            </button>
          </div>
        </div>
        <fieldset className="earnings-wf-m">
          <legend>Send to</legend>
          {methods.map(x => (
            <label key={x.id} className="earnings-mth">
              <input type="radio" name="wdM" value={x.id} defaultChecked={x.id === st.method} />
              <span className="earnings-mth-t">
                <b>{x.kind}</b>
                <span className="num">{x.label}</span>
                <span className="help">{x.note || ""}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="help earnings-wf-mask">
          <Icon n="lock" />
          <span>Payout details stay masked and are never shown to brands.</span>
        </p>
        <Lq className="lq-p lq-xl" type="submit">
          Review withdrawal
        </Lq>
      </form>
    );
  } else if (st.step === 2) {
    const x = M();
    body = (
      <div className="earnings-wf">
        <div className="earnings-mini-w">
          <div className="earnings-mini">
            <p className="earnings-mini-h">You are withdrawing</p>
            <p className="t-money earnings-mini-a">{L.inr(st.amount, { dec: st.amount % 100 !== 0 })}</p>
            <dl>
              <div>
                <dt>To</dt>
                <dd>{x.kind + " " + x.label}</dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>Linkloom balance</dd>
              </div>
              <div>
                <dt>Left after this</dt>
                <dd>{L.inr(m.ready - st.amount)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <p className="help">{x.note || ""}. You will get a UTR reference you can quote to your bank.</p>
        <label className="check earnings-wf-fail">
          <input type="checkbox" data-fail="" />
          <span>
            <span className="sample">Sample</span> Make this payout fail, to see what happens
          </span>
        </label>
        <div className="row wrap earnings-wf-acts">
          <Lq
            className="lq-p lq-xl"
            data-confirm=""
            onClick={() => {
              const fail = L.$("[data-fail]", box.current).checked;
              go({ step: 3, fail }, 3);
              keep(
                setTimeout(
                  () => {
                    if (!navigator.onLine) return bad("offline");
                    if (fail) return bad("bank");
                    const ref = "UTR " + String(431000000000 + Math.floor(Math.random() * 899999999));
                    const id = "w" + Date.now().toString(36);
                    L.store.set(stt => {
                      stt.withdrawals.unshift({
                        id,
                        amount: st.amount,
                        method: x.method,
                        date: C.today(),
                        status: "processing",
                        ref,
                      });
                      C.syncReady(stt);
                    }, "withdraw");
                    go({ step: 4, ok: true, ref, left: C.money().ready }, 4);
                    repaint(startReady.current);
                    // the bank confirms a moment later: processing -> paid (totals do not change, the money already left)
                    keep(
                      setTimeout(() => {
                        L.store.set(stt => {
                          const w = stt.withdrawals.find(v => v.id === id);
                          if (w) w.status = "paid";
                        }, "withdraw-paid");
                        if (L.current().name === "earnings") repaint();
                      }, 6000),
                    );
                  },
                  L.RM ? 300 : 1400,
                ),
              );
            }}
          >
            <Icon n="lock" className="ic" />
            Confirm and withdraw
          </Lq>
          <Lq className="lq-s lq-xl" data-back="" onClick={() => go({ step: 1, msg: "" }, 1)}>
            Change
          </Lq>
        </div>
        <p className="ll-trust">
          <Icon n="lock" />
          Sent only to your verified {x.kind}. Linkloom never shares payout details with brands.
        </p>
      </div>
    );
  } else if (st.step === 3) {
    const x = M();
    body = (
      <div className="earnings-wf earnings-wf-p" role="status" aria-live="polite">
        <span className="earnings-coin earnings-spin" aria-hidden="true">
          ₹
        </span>
        <p className="t-h2">Sending {L.inr(st.amount)}</p>
        <p className="muted">To {x.kind + " " + x.label}. Keep this open for a moment.</p>
      </div>
    );
  } else if (st.ok) {
    const x = M();
    body = (
      <div className="earnings-wf earnings-wf-ok" role="status" aria-live="polite">
        <p className="t-h2">{L.inr(st.amount)} is on its way</p>
        <p className="muted">
          To {x.kind + " " + x.label}. {x.note || ""}.
        </p>
        <div className="earnings-mini-w earnings-rcpt">
          <div className="earnings-mini">
            <p className="earnings-mini-h">Withdrawal receipt</p>
            <p className="t-money earnings-mini-a">{L.inr(st.amount, { dec: st.amount % 100 !== 0 })}</p>
            <dl>
              <div>
                <dt>Reference</dt>
                <dd>{st.ref}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Processing</dd>
              </div>
              <div>
                <dt>Left to withdraw</dt>
                <dd data-left=""></dd>
              </div>
            </dl>
          </div>
        </div>
        <Lq className="lq-p lq-xl" data-done="" onClick={() => close()}>
          Done
        </Lq>
      </div>
    );
  } else {
    const x = M(),
      other = methods.find(v => v.id !== st.method);
    body = (
      <div className="earnings-wf earnings-wf-bad" role="alert">
        <span className="earnings-bad-ic" aria-hidden="true">
          <Icon n="alert" />
        </span>
        <p className="t-h2">{st.kind === "offline" ? "No connection" : "Payout failed"}</p>
        <p className="muted">
          {st.kind === "offline"
            ? `You went offline before it was sent. Nothing left your balance; ${L.inr(C.money().ready)} is still ready.`
            : `${x.kind === "UPI" ? "Your UPI app" : "Your bank"} declined the transfer to ${x.label}. Nothing left your balance; ${L.inr(C.money().ready)} is still ready to withdraw.`}
        </p>
        <div className="row wrap">
          <Lq className="lq-p" data-retry="" onClick={() => go({ step: 2 }, 2)}>
            Try again
          </Lq>
          {st.kind === "bank" && other ? (
            <Lq className="lq-s" data-other="" onClick={() => go({ step: 2, method: other.id }, 2)}>
              Send to {other.kind} instead
            </Lq>
          ) : null}
          <button className="btn-q" type="button" data-x="" onClick={() => close()}>
            Close
          </button>
        </div>
      </div>
    );
  }

  function bad(kind) {
    const x = M();
    if (kind === "bank")
      L.store.set(stt => {
        stt.withdrawals.unshift({
          id: "w" + Date.now().toString(36),
          amount: st.amount,
          method: x.method,
          date: C.today(),
          status: "failed",
          ref: "Not sent",
          reason: `Declined by ${x.kind === "UPI" ? "the UPI app" : "the bank"}. Nothing left your balance.`,
        });
        C.syncReady(stt);
      }, "withdraw-failed");
    go({ step: 4, ok: false, kind }, 4);
    repaint();
  }

  return (
    <div className="earnings-wf-host" ref={box}>
      {body}
    </div>
  );
}

/* ---------- the screen ---------- */
function EarningsScreen() {
  const s = L.store.s,
    ui = s.workUI || (s.workUI = {});
  C.syncReady(s); // the ledger is the source of truth for the sidebar slip too
  const [, redraw] = useState(0);
  const from = useRef(null); // the ready amount to count up from after a withdrawal
  const root = useRef(null);
  const timers = useRef([]);
  const readyEl = useRef(null),
    totalEl = useRef(null),
    rowsRef = useRef(null);
  const [range, setRange] = useState(RANGES.some(r => r[0] === ui.earnRange) ? ui.earnRange : "fy");
  const [f, setF] = useState(FILTERS.some(x => x[0] === ui.earnFilter) ? ui.earnFilter : "all");
  const led = [...s.ledger].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const [pick, setPick] = useState(led.find(l => l.id === ui.earnPick) ? ui.earnPick : led[0] && led[0].id);
  const empty = !s.ledger.length && !s.withdrawals.length;
  const m = C.money();
  const E = earnedIn(range);

  useEffect(() => {
    if (empty || !root.current) return;
    L.motion.stagger(L.$$(".earnings-row", root.current).filter(r => !r.hidden));
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (empty || !root.current) return;
    C.press(root.current);
    const f0 = from.current;
    from.current = null;
    L.motion.count(readyEl.current, m.ready, p => L.inr(p).slice(1), f0 == null ? {} : { from: f0 });
  });
  useLayoutEffect(() => {
    if (!empty && totalEl.current) L.motion.count(totalEl.current, E.total, L.inr);
  }, [range]); // eslint-disable-line react-hooks/exhaustive-deps

  if (empty) return <EmptyEarnings s={s} />;

  const meth = s.payoutMethods || [];
  const wds = [...s.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
  if (s.readyToWithdraw !== m.ready) s.readyToWithdraw = m.ready; // the ledger is the source of truth
  const cnt = k => (k === "all" ? led.length : led.filter(l => l.status === k).length);
  /* Payouts are off on the server for launch: no withdraw button, no withdrawals list, keyed off payoutsEnabled. */
  const noPayouts = !!L.live && !s.payoutsEnabled;
  const sum0 = s.earningsSummary || {
    inEscrow: 0,
    earned: m.earned,
    tds: 0,
    ordersInEscrow: 0,
    ordersEarned: led.length,
  };
  const shown = l => f === "all" || l.status === f;
  const nShown = led.filter(shown).length;

  const repaint = prev => {
    from.current = prev == null ? null : prev;
    redraw(n => n + 1);
  };
  const pickRow = l => {
    ui.earnPick = l.id;
    setPick(l.id);
    if (narrow()) {
      openReactSheet({
        title: "Payout slip",
        render: () => (
          <div className="earnings-sheet-slip">
            <LedgerSlip l={l} />
          </div>
        ),
      });
      requestAnimationFrame(() => feed(L.$(".sheet .earnings-slip-w"), 160));
      return;
    }
    requestAnimationFrame(() => feed(L.$("[data-slip]", root.current).firstElementChild));
  };
  const filterTo = k => {
    ui.earnFilter = k;
    L.motion.flip(() => flushSync(() => setF(k)), L.$$(".earnings-row", root.current));
  };

  return (
    <div className="view-in earnings" ref={root}>
      <NetBanner
        cls="earnings-net"
        text="You are offline. Amounts are from your last sync; withdrawing waits until you are back."
      />
      <div className="earnings-top">
        <h1 className="t-h1">Earnings</h1>
        <span className="sample">Sample data · amounts in ₹</span>
        {s.plan && s.plan.renews ? (
          <span className="earnings-plan">
            {s.plan.name || "Creator plan"} · renews {L.fmtDate(s.plan.renews)}
          </span>
        ) : null}
      </div>

      <section className="earnings-hero butter" aria-labelledby="earnReadyH">
        <div className="earnings-hero-a">
          <h2 className="earnings-hero-l" id="earnReadyH">
            {noPayouts ? "Earned" : "Ready to withdraw"}
          </h2>
          <p className="earnings-ready">
            <span className="earnings-rs">₹</span>
            <span data-ready="" ref={readyEl}></span>
          </p>
          <p className="earnings-ready-sub">
            {noPayouts
              ? `From ${sum0.ordersEarned} approved deal${sum0.ordersEarned === 1 ? "" : "s"}. Withdrawals to your bank open soon; everything you earn is kept here.`
              : `Cleared money only.${m.clearing ? ` ${L.inr(m.clearing)} still clearing is not included.` : ""}`}
          </p>
          <div className="earnings-cta" hidden={noPayouts}>
            <Lq
              className="lq-p lq-xl"
              data-withdraw=""
              disabled={m.ready <= 0}
              onClick={() =>
                openReactSheet({
                  title: "Withdraw",
                  render: close => (
                    <Withdraw close={close} repaint={repaint} keep={t => timers.current.push(t)} />
                  ),
                })
              }
            >
              <Icon n="lock" className="ic" />
              Withdraw
            </Lq>
            <span className="earnings-to">
              {m.ready > 0
                ? `to ${meth[0] ? meth[0].kind + " " + meth[0].label : "your payout method"}`
                : "Nothing cleared to withdraw right now."}
            </span>
            <p className="ll-trust earnings-trust">
              <Icon n="lock" />
              Paid only to your own verified bank account or UPI. Never shown to brands.
            </p>
          </div>
        </div>
        <div className="earnings-recon">
          <p className="earnings-recon-h">How it adds up</p>
          {noPayouts ? (
            <dl>
              <div>
                <dt>
                  In escrow, {sum0.ordersInEscrow} deal{sum0.ordersInEscrow === 1 ? "" : "s"}
                </dt>
                <dd>{L.inr(sum0.inEscrow)}</dd>
              </div>
              <div>
                <dt>Earned, approved work</dt>
                <dd>{L.inr(sum0.earned)}</dd>
              </div>
              <div>
                <dt>TDS deducted</dt>
                <dd>{L.inr(-sum0.tds)}</dd>
              </div>
            </dl>
          ) : null}
          <dl hidden={noPayouts}>
            <div>
              <dt>Earned, all time</dt>
              <dd>{L.inr(m.earned)}</dd>
            </div>
            <div>
              <dt>Withdrawn</dt>
              <dd>{L.inr(-m.out)}</dd>
            </div>
            <div>
              <dt>Still clearing</dt>
              <dd>{L.inr(-m.clearing)}</dd>
            </div>
            <div className="is-total">
              <dt>Ready to withdraw</dt>
              <dd>{L.inr(m.ready)}</dd>
            </div>
          </dl>
          <p className="earnings-recon-ok">
            <Icon n="check" />
            <span>Matches your ledger{m.failed ? `. ${L.inr(m.failed)} failed is not counted.` : "."}</span>
          </p>
          <p className="t-note earnings-recon-note" aria-hidden="true">
            to the paisa
          </p>
        </div>
      </section>

      <div className="earnings-grid">
        <div className="earnings-main">
          <section className="ll-panel" aria-labelledby="earnTotH">
            <div className="earnings-total">
              <div className="earnings-total-t">
                <h2 className="earnings-sec-h" id="earnTotH">
                  Total earned
                </h2>
                <p className="t-money earnings-total-n" data-total="" ref={totalEl}></p>
                <p className="earnings-total-r">
                  <span data-range="">{E.label}</span> ·{" "}
                  <span data-jobs="">
                    {E.n} approved deal{E.n === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="help">Agreed prices, before tax. Includes money still clearing.</p>
              </div>
              <div className="seg earnings-range" role="group" aria-label="Date range">
                {RANGES.map(([k, n]) => (
                  <button
                    key={k}
                    type="button"
                    data-r={k}
                    aria-pressed={String(k === range)}
                    onClick={() => {
                      ui.earnRange = k;
                      setRange(k);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="ll-panel earnings-sec" aria-labelledby="earnActH">
            <div className="ll-panel-head earnings-sec-top">
              <h2 className="ll-panel-h" id="earnActH">
                Activity
              </h2>
              <div className="chips earnings-filter" role="group" aria-label="Filter activity">
                {FILTERS.map(([k, n]) => (
                  <button
                    key={k}
                    className="chip"
                    type="button"
                    data-f={k}
                    aria-pressed={String(k === f)}
                    onClick={() => filterTo(k)}
                  >
                    {n} <span className="earnings-chip-n">{cnt(k)}</span>
                  </button>
                ))}
              </div>
            </div>
            <ol className="earnings-list" ref={rowsRef}>
              {led.map(l => (
                <li key={l.id} className="earnings-row" data-status={l.status} hidden={!shown(l)}>
                  <button
                    type="button"
                    className="earnings-row-b"
                    data-pick={l.id}
                    aria-pressed={String(l.id === pick)}
                    aria-label={`${l.brand}, ${l.job}, ${L.inr(net(l.amount))}, ${STATUS[l.status] ? STATUS[l.status].label : l.status}. Open payout slip`}
                    onClick={() => pickRow(l)}
                  >
                    <span className="earnings-date">
                      <b>{dayNum(l.date)}</b>
                      <span>{monTxt(l.date)}</span>
                    </span>
                    <span className="earnings-what">
                      <b>{l.brand}</b>
                      <span>{l.job}</span>
                    </span>
                    <span className="earnings-amt">
                      <b className="t-money">{L.inr(net(l.amount))}</b>
                    </span>
                    <Pill st={l.status} />
                  </button>
                </li>
              ))}
            </ol>
            <p className="earnings-none muted" hidden={nShown > 0}>
              Nothing with this status.
            </p>
          </section>

          <section className="ll-panel earnings-sec" aria-labelledby="earnWdH" hidden={noPayouts}>
            <div className="ll-panel-head earnings-sec-top">
              <div>
                <h2 className="ll-panel-h" id="earnWdH">
                  Withdrawals
                </h2>
                <p className="ll-panel-sub">Methods are masked. UTR is the bank’s reference.</p>
              </div>
            </div>
            {wds.length ? (
              <ol className="earnings-wds">
                {wds.map(w => (
                  <li key={w.id} className="earnings-wd" data-status={w.status}>
                    <span className="earnings-date">
                      <b>{dayNum(w.date)}</b>
                      <span>{monTxt(w.date)}</span>
                    </span>
                    <span className="earnings-wd-m">
                      <b>{w.method}</b>
                      <span>{w.ref || ""}</span>
                    </span>
                    <b className="t-money earnings-wd-a">{L.inr(w.amount)}</b>
                    <Pill st={w.status} />
                    {w.reason ? <p className="earnings-wd-why">{w.reason}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">No withdrawals yet.</p>
            )}
          </section>
        </div>

        <aside className="earnings-side" aria-label="Payout slip" aria-live="polite" data-slip="">
          {pick ? <LedgerSlip l={led.find(l => l.id === pick)} /> : null}
        </aside>
      </div>
    </div>
  );
}

L.register("earnings", { title: "Earnings", nav: "earnings", Component: EarningsScreen });
