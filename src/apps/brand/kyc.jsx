/* Brand verification (#kyc). The backend asks every account, brand or creator, for the same three things before it
   can post a brief, send an offer or check out: PAN, an ID document and a bank account. Each saves on its own,
   then the brand submits for a manual review. This screen uses the setup screen's layout and classes.
   React screen (see src/shared/react/view.jsx). */
import { useEffect, useRef, useState } from "react";
import { Icon, Lq } from "@/shared/react/view";

const w = window;
const ID_TYPES = [
  ["aadhaar", "Aadhaar"],
  ["passport", "Passport"],
  ["voter_id", "Voter ID"],
  ["driving_licence", "Driving licence"],
];
/** How long the manual review takes, said the same way everywhere on the brand side. */
export const REVIEW_TIME = "Usually 1 to 2 hours. It can take up to 24 hours, as our team checks it by hand.";

const STATUS = {
  not_started: ["pill-paper", "Not started"],
  in_progress: ["pill-info", "In progress"],
  pending: ["pill-info", "Under review"],
  verified: ["pill-ok", "Verified"],
  rejected: ["pill-err", "Needs a fix"],
};
/* the left panel's list: what each step is and why it's asked */
const ART_STEPS = [
  ["PAN", "Your company PAN, or your own if you're a sole proprietor."],
  ["ID document", "Aadhaar, passport, voter ID or driving licence of the person signing up."],
  ["Bank account", "Where refunds from escrow are sent back."],
];
/* PAN and IFSC are capitals only: change them as they're typed, keeping the cursor where it was */
const caps = e => {
  const i = e.currentTarget,
    at = i.selectionStart;
  const up = i.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (up !== i.value) {
    i.value = up;
    if (at != null) i.setSelectionRange(Math.min(at, up.length), Math.min(at, up.length));
  }
};
const Row = ({ label, value }) => (
  <div className="kv">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);
const Trust = () => (
  <p className="ll-trust">
    <Icon n="lock" />
    Encrypted. Never shown to creators.
  </p>
);

function SaveBtn({ n, id, label, cur, busyK, onSave }) {
  return (
    <Lq
      className={`${n === cur ? "lq-p" : "lq-s"} lq-sm`}
      data-save={id}
      disabled={busyK === id}
      aria-busy={busyK === id ? "true" : undefined}
      onClick={() => onSave(id)}
    >
      <Icon n="lock" className="ic" />
      {label}
    </Lq>
  );
}
function Sec({ id, n, title, isDone, summary, form, cur, locked, editing, onEdit }) {
  return (
    <section
      className={`card stack bk-sec${n === cur && !locked ? " is-now" : ""}`}
      aria-labelledby={`bk-${id}-h`}
      data-sec={id}
    >
      <div className="bk-sec-head">
        <div>
          <p className="t-eyebrow muted">Step {n + 1} of 3</p>
          <h2 className="t-h3" id={`bk-${id}-h`}>
            {title}
          </h2>
        </div>
        {isDone ? (
          <span className="pill pill-ok">
            <Icon n="check" />
            Saved
          </span>
        ) : null}
      </div>
      {isDone && !editing ? (
        <>
          <dl>{summary}</dl>
          {locked ? null : (
            <div className="row">
              <Lq className="lq-s lq-sm" data-edit={id} onClick={() => onEdit(id)}>
                Change
              </Lq>
            </div>
          )}
        </>
      ) : locked ? (
        <p className="muted">Locked while under review.</p>
      ) : (
        form
      )}
    </section>
  );
}

function KycScreen() {
  const L = w.LLD;
  /* each save redraws the forms from scratch (a paint), as the plain-DOM version did */
  const [paintN, setPaintN] = useState(0);
  const paint = () => {
    setPaintN(n => n + 1);
    setErrs({});
    setFerr(null);
    setFileName("No file chosen");
  };
  const [errs, setErrs] = useState({});
  const [ferr, setFerr] = useState(null);
  const [busyK, setBusyK] = useState("");
  const [fileName, setFileName] = useState("No file chosen");
  const openEdit = useRef(new Set()).current;
  const alive = useRef(true);
  const root = useRef(null);
  const returnTo = useRef(null);
  if (returnTo.current === null) {
    try {
      returnTo.current = sessionStorage.getItem("ll-brand-kyc-return") || "";
    } catch {
      returnTo.current = ""; // no storage: back to home
    }
  }
  useEffect(() => {
    alive.current = true;
    w.LLD.live.kyc().then(
      () => alive.current && paint(),
      () => undefined,
    );
    const off = w.LLD.store.on(why => why === "kyc-live" && alive.current && paint());
    return () => {
      alive.current = false;
      off();
    };
  }, []);

  const val = id => ((root.current && root.current.querySelector("#" + id)) || {}).value?.trim() || "";
  const setErr = (k, m) => setErrs(e => ({ ...e, [k]: m }));
  const busy = async (k, job) => {
    if (k === "submit") setFerr("");
    else setErr(k, "");
    setBusyK(k);
    try {
      await job();
      openEdit.delete(k);
      if (alive.current) {
        setBusyK("");
        paint();
      }
    } catch (e) {
      setBusyK("");
      const m = w.LLD.live.errorText(e);
      if (k === "submit") setFerr(m);
      else setErr(k, m);
    }
  };
  const save = k => {
    if (k === "pan") {
      const pan = val("bkPan").toUpperCase(),
        name = val("bkPanName");
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))
        return setErr(k, "A PAN is 5 letters, 4 digits, then 1 letter.");
      if (name.length < 3) return setErr(k, "Enter the name exactly as it's printed on the PAN.");
      void busy(k, () => w.LLD.live.kycPan(pan, name));
    } else if (k === "id") {
      const f = root.current.querySelector("#bkIdFile")?.files?.[0];
      if (!f) return setErr(k, "Choose a photo or PDF of the document.");
      void busy(k, () => w.LLD.live.kycId(val("bkIdType"), f));
    } else if (k === "bank") {
      const acc = val("bkAcc").replace(/\s/g, ""),
        ifsc = val("bkIfsc").toUpperCase(),
        holder = val("bkHolder");
      if (!/^\d{9,18}$/.test(acc)) return setErr(k, "Indian account numbers have 9 to 18 digits.");
      if (acc !== val("bkAcc2").replace(/\s/g, "")) return setErr(k, "The two account numbers don't match.");
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))
        return setErr(k, "An IFSC is 4 letters, a zero, then 6 letters or digits.");
      if (holder.length < 3) return setErr(k, "Enter the name on the bank account.");
      void busy(k, () => w.LLD.live.kycBank(holder, acc, ifsc));
    }
  };

  const k = w.LLD_DATA.kyc || {};
  const st = k.status || "not_started";
  const steps = k.steps || {};
  const locked = st === "pending" || st === "verified";
  const [pc, pt] = STATUS[st] || STATUS.not_started;
  const done = x => !!x?.done;
  const doneList = [steps.pan, steps.id, steps.bank].map(done);
  const doneN = doneList.filter(Boolean).length;
  /* the step to do next: its Save is the screen's one filled button (Submit takes over once all three are saved) */
  const cur = doneList.indexOf(false);
  const secP = { cur, locked, onEdit: id => (openEdit.add(id), paint()) };
  const btnP = { cur, busyK, onSave: save };
  const err = id => (
    <p className="err" data-err={id} aria-live="assertive">
      {errs[id] || ""}
    </p>
  );

  return (
    <div className="focus auth setup" ref={root}>
      <section className="focus-art dark auth-art bk-art" aria-label="About verification">
        <p className="auth-brand">
          <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
          <span>linkloom</span>
          <span className="auth-for">for brands</span>
        </p>
        <h2 className="t-display auth-line">Verify once. Hire with escrow.</h2>
        <ol className="bk-art-steps">
          {ART_STEPS.map(([t, d], i) => (
            <li key={i} className={doneList[i] ? "is-done" : i === cur && !locked ? "is-now" : ""}>
              <span className="bk-art-n" aria-hidden="true">
                {doneList[i] ? <Icon n="check" /> : i + 1}
              </span>
              <span>
                <b>{t}</b>
                <span>{d}</span>
              </span>
              {doneList[i] ? <span className="sr-only">, saved</span> : null}
            </li>
          ))}
        </ol>
        <div className="bk-art-time">
          <Icon n="clock" />
          <p>
            <b>Review time</b>
            <span>{REVIEW_TIME}</span>
          </p>
        </div>
        <ul className="bk-art-trust">
          <li>
            <Icon n="lock" />
            <span>Encrypted. Creators never see your PAN, ID or bank details.</span>
          </li>
          <li>
            <Icon n="shield" />
            <span>Once verified, you can post collabs, send offers and pay into escrow.</span>
          </li>
          <li>
            <Icon n="bell" />
            <span>You get a notification, and Home shows the status, the moment it's done.</span>
          </li>
        </ul>
      </section>
      <section className="focus-form light auth-form">
        <div className="auth-in">
          <div className="auth-head">
            <p className="row wrap">
              <span className={`pill ${pc}`}>{pt}</span>
            </p>
            <h1 className="t-h1" tabIndex={-1}>
              {st === "verified"
                ? "Your business is verified"
                : st === "pending"
                  ? "We're checking your details"
                  : "Verify your business"}
            </h1>
            <p className="muted">
              {st === "verified"
                ? "You can post collabs, send offers and hire with escrow."
                : st === "pending"
                  ? `${REVIEW_TIME} You'll get a notification when it's done.`
                  : "Posting a collab, sending an offer and checking out need a verified account. Numbers are encrypted and never shown to creators."}
            </p>
            {st === "rejected" && k.rejectionReason ? (
              <div className="profile-formerr" role="alert">
                <Icon n="alert" /> {k.rejectionReason}
              </div>
            ) : null}
            {/* progress: never lead with "0 of 3": a new brand sees how long it takes instead */}
            {locked ? null : (
              <div className="ll-steps bk-progress">
                <span className="ll-steps-t">
                  {doneN ? `${doneN} of 3 done` : "3 steps"}
                  {doneN < 3 ? " · about 4 minutes" : " · ready to submit"}
                </span>
                <div className="ll-steps-bar" aria-hidden="true">
                  {doneList.map((d, i) => (
                    <i key={i} className={d ? "is-done" : i === cur ? "is-now" : ""}></i>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="auth-stack" key={paintN}>
            <Sec
              {...secP}
              editing={openEdit.has("pan")}
              id="pan"
              n={0}
              title="PAN"
              isDone={done(steps.pan)}
              summary={
                <>
                  <Row label="PAN" value={"••••••" + (steps.pan?.panLast4 || "")} />
                  <Row label="Name on PAN" value={steps.pan?.nameOnPan || ""} />
                </>
              }
              form={
                <>
                  <div className="field">
                    <label htmlFor="bkPan">PAN number</label>
                    <input
                      className="input bk-caps"
                      id="bkPan"
                      maxLength={10}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck="false"
                      placeholder="e.g. ABCDE1234F"
                      data-caps=""
                      onInput={caps}
                    />
                    <p className="help">Your company PAN, or your own if you're a sole proprietor.</p>
                  </div>
                  <div className="field">
                    <label htmlFor="bkPanName">Name as printed on the PAN</label>
                    <input
                      className="input"
                      id="bkPanName"
                      autoComplete="organization"
                      defaultValue={steps.pan?.nameOnPan || ""}
                    />
                  </div>
                  {err("pan")}
                  <SaveBtn {...btnP} n={0} id="pan" label="Save PAN" />
                  <Trust />
                </>
              }
            />
            <Sec
              {...secP}
              editing={openEdit.has("id")}
              id="id"
              n={1}
              title="ID document"
              isDone={done(steps.id)}
              summary={
                <Row
                  label="Document"
                  value={(ID_TYPES.find(t => t[0] === steps.id?.idType) || ["", "Uploaded"])[1]}
                />
              }
              form={
                <>
                  <div className="field">
                    <label htmlFor="bkIdType">Document type</label>
                    <select className="select" id="bkIdType" defaultValue={ID_TYPES[0][0]}>
                      {ID_TYPES.map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <span className="t-label" id="bkIdFileL">
                      Photo or PDF of the front side
                    </span>
                    <div className="bk-file">
                      <input
                        className="sr-only"
                        id="bkIdFile"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        aria-labelledby="bkIdFileL"
                        aria-describedby="bkIdFileN bkIdFileH"
                        onChange={e => {
                          const f = e.currentTarget.files?.[0];
                          setFileName(f ? f.name : "No file chosen");
                        }}
                      />
                      <Lq as="label" className="lq-s lq-sm" htmlFor="bkIdFile">
                        <Icon n="upload" className="ic" />
                        Choose file
                      </Lq>
                      <span className="bk-file-n muted" id="bkIdFileN" data-file-name="">
                        {fileName}
                      </span>
                    </div>
                    <p className="help" id="bkIdFileH">
                      JPG, PNG, WebP or PDF, up to 10 MB. All four corners in frame.
                    </p>
                  </div>
                  {err("id")}
                  <SaveBtn {...btnP} n={1} id="id" label="Upload and save" />
                  <Trust />
                </>
              }
            />
            <Sec
              {...secP}
              editing={openEdit.has("bank")}
              id="bank"
              n={2}
              title="Bank account"
              isDone={done(steps.bank)}
              summary={
                <>
                  <Row label="Account" value={"••••" + (steps.bank?.accountLast4 || "")} />
                  <Row label="IFSC" value={steps.bank?.ifsc || ""} />
                  <Row label="Holder" value={steps.bank?.accountHolderName || ""} />
                </>
              }
              form={
                <>
                  <div className="field">
                    <label htmlFor="bkAcc">Account number</label>
                    <input className="input" id="bkAcc" inputMode="numeric" autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="bkAcc2">Re-enter account number</label>
                    <input className="input" id="bkAcc2" inputMode="numeric" autoComplete="off" />
                  </div>
                  <div className="field">
                    <label htmlFor="bkIfsc">IFSC</label>
                    <input
                      className="input bk-caps"
                      id="bkIfsc"
                      maxLength={11}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck="false"
                      placeholder="e.g. HDFC0001234"
                      data-caps=""
                      onInput={caps}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="bkHolder">Account holder name</label>
                    <input
                      className="input"
                      id="bkHolder"
                      autoComplete="organization"
                      defaultValue={steps.bank?.accountHolderName || ""}
                    />
                    <p className="help">Refunds from escrow go back to this account.</p>
                  </div>
                  {err("bank")}
                  <SaveBtn {...btnP} n={2} id="bank" label="Save bank account" />
                  <Trust />
                </>
              }
            />
          </div>
          <p className="profile-formerr" role="alert" data-ferr="" hidden={ferr === null}>
            {ferr || ""}
          </p>
          <div className={`profile-setup-nav bk-nav${doneN === 3 || locked ? " is-ready" : ""}`}>
            {st === "verified" ? (
              <Lq
                className="lq-p"
                data-done=""
                onClick={() => {
                  try {
                    sessionStorage.removeItem("ll-brand-kyc-return");
                  } catch {
                    /* ignore */
                  }
                  w.LLD.go(returnTo.current || "#home");
                }}
              >
                {returnTo.current ? "Back to where you were" : "Go to your dashboard"}
              </Lq>
            ) : locked ? (
              <Lq as="a" className="lq-s" href="#home">
                Back to your dashboard
              </Lq>
            ) : (
              <>
                <Lq as="a" className="lq-s" href="#home">
                  Save and exit
                </Lq>
                <Lq
                  className="lq-p"
                  data-submit=""
                  disabled={doneN !== 3 || busyK === "submit"}
                  aria-busy={busyK === "submit" ? "true" : undefined}
                  onClick={() => void busy("submit", () => w.LLD.live.kycSubmit())}
                >
                  <Icon n="lock" className="ic" />
                  Submit for review
                </Lq>
                <p className="ll-trust profile-setup-trust">
                  <Icon n="lock" />
                  Encrypted. Only Linkloom's review team sees this.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Sends the brand to #kyc and remembers where to come back to. */
export function brandKycGate(returnTo = location.hash) {
  try {
    sessionStorage.setItem("ll-brand-kyc-return", returnTo);
  } catch {
    /* ignore */
  }
  w.LLD.toast("Verify your business to continue. It takes a few minutes.", "shield");
  w.LLD.go("#kyc");
}

/** True (and off to #kyc) when the brand isn't verified yet. Call it before posting, offering or hiring. */
export function needKyc(returnTo = location.hash) {
  if (String(w.LLD_DATA.kyc?.status || "") === "verified") return false;
  brandKycGate(returnTo);
  return true;
}

export function registerBrandKyc() {
  w.LLD.register("kyc", { title: "Verify your business", shell: "focus", Component: KycScreen });
  w.LLD.kycReviewTime = REVIEW_TIME;
  w.LLD.kycGate = brandKycGate;
  w.LLD.needKyc = needKyc;
}
