/* kyc screen (Builder A): verification and payout setup, opened by LLD.kycGate(jobId) on the first Bid.
   State machine (kyc.status): not_started → in_progress → under_review → verified | action_needed | rejected.
   action_needed and rejected lead back into in_progress for the flagged step only, then to review again.
   Steps: PAN, identity proof, selfie (only for document uploads), payout (UPI or bank), GST (optional), review.
   The selected job (kyc.returnTo) is kept throughout; once verified the creator goes straight back to it.
   Privacy: raw numbers live only in this module's draft while typing. The store keeps masked values only.
   C9: one headline (the form's h1), the rail and the "what you need" list show the same steps (plus Review), and
   "About 4 minutes" sits beside Start verification. Every button that asks for PAN, ID or bank details has a lock and
   a trust line directly under it. While under review the screen is a waiting card with the time left (kycWaitText).
   React screen (see src/shared/react/view.jsx). Each paint redraws the main panel from the draft, as before. */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { kycWaitText } from "../../core/kyc-gate";
import { BID_BEFORE_KYC } from "../../flags";
import { Icon, Lq } from "@/shared/react/view";

/** The trust line that sits directly under a button asking for PAN, ID or bank details. */
const TRUST = "Encrypted. Never shown to brands.";
const LLD = window.LLD,
  { store } = LLD;
const LIVE = !import.meta.env.VITE_TEST_HOOKS;
const STEPS = [
  {
    id: "pan",
    t: "PAN",
    h: "Your PAN",
    why: "Payments to you are recorded against your PAN for tax. We check it once.",
    art: "trust-id-card",
  },
  {
    id: "id",
    t: "Identity proof",
    h: "Confirm it's you",
    why: "An ID shows the PAN really belongs to you. Brands never see it.",
    art: "trust-id-card",
  },
  { id: "selfie", t: "Selfie", h: "A quick selfie", why: "", art: "trust-id-card" },
  {
    id: "payout",
    t: "Payout",
    h: "Where should we pay you?",
    why: "Approved work is paid out here from escrow. You can change it later.",
    art: "trust-lock-coin",
  },
  {
    id: "gst",
    t: "GST",
    h: "GST, if you have it",
    why: "Only if you're registered for GST. Most individual creators aren't, and you can add it later.",
    art: "step-05-stamp",
  },
].filter(s => !LIVE || (s.id !== "selfie" && s.id !== "gst"));
const REVIEW = STEPS.length;
const IDS = {
  Aadhaar: {
    re: /^[2-9]\d{11}$/,
    clean: v => v.replace(/\D/g, ""),
    ph: "1234 5678 9012",
    fmt: v =>
      v
        .replace(/\D/g, "")
        .slice(0, 12)
        .replace(/(\d{4})(?=\d)/g, "$1 "),
    err: "Aadhaar numbers have 12 digits and don't start with 0 or 1.",
    mask: v => "•••• •••• " + v.slice(-4),
  },
  Passport: {
    re: /^[A-Z][0-9]{7}$/,
    clean: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ph: "K1234567",
    err: "A passport number is 1 letter and 7 digits, like K1234567.",
    mask: v => "••••" + v.slice(-4),
  },
  "Voter ID": {
    re: /^[A-Z]{3}[0-9]{7}$/,
    clean: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ph: "ABC1234567",
    err: "A Voter ID (EPIC) number is 3 letters and 7 digits.",
    mask: v => "••••" + v.slice(-4),
  },
  "Driving licence": {
    re: /^[A-Z]{2}[0-9]{2}[0-9A-Z]{9,12}$/,
    clean: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    ph: "MH0120190012345",
    err: "Use the number printed on your licence, like MH0120190012345.",
    mask: v => "••••" + v.slice(-4),
  },
};
const BANKS = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  YESB: "Yes Bank",
  IDIB: "Indian Bank",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IDFB: "IDFC First Bank",
  INDB: "IndusInd Bank",
  FDRL: "Federal Bank",
};
const STATUS = {
  not_started: ["pill-paper", "Not started"],
  in_progress: ["pill-info", "In progress"],
  under_review: ["pill-info", "Under review"],
  verified: ["pill-ok", "Verified"],
  action_needed: ["pill-warn", "Action needed"],
  rejected: ["pill-err", "Rejected"],
};
const FILE_MAX = (LIVE ? 10 : 5) * 1024 * 1024;

/* masks: what the store and screen keep after entry */
const M = {
  pan: p => p.slice(0, 5) + "••••" + p.slice(9),
  upi: u => {
    const [l, d] = u.split("@");
    return l.slice(0, Math.min(6, Math.max(1, l.length - 3))) + "••••@" + d;
  },
  acc: a => "••••" + a.slice(-4),
  ifsc: f => f.slice(0, 5) + "••••" + f.slice(-2),
  gst: g => g.slice(0, 2) + "••••••••••" + g.slice(-3),
};
const norm = s =>
  String(s || "")
    .toUpperCase()
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const press = el => {
  try {
    LLD.motion.press(el);
  } catch (e) {}
};
const K = () => store.s.kyc;
const set = (fn, why = "kyc") => store.set(s => fn(s.kyc), why);
const needsSelfie = k => !LIVE && k.idType !== "Aadhaar";
const fixes = k => k.fix || (/bank|upi|payout/i.test(k.note || "") ? ["payout", "pan"] : ["pan"]);
const jobOf = k => {
  const m = /^#bid-(.+)$/.exec(k.returnTo || "");
  return m ? store.s.jobs.find(j => j.id === m[1]) : null;
};

// draft: raw values while typing (never stored), edit toggles for saved values
let D = { edit: {}, panRaw: "" };
store.on(why => {
  if (why === "signed-in" || why === "signed-out") D = { edit: {}, panRaw: "" };
});

function normalise(k) {
  k.bank = k.bank || { acc: "", ifsc: "", holder: "" };
  if (["under_review", "verified", "action_needed"].includes(k.status)) {
    // records that exist from an earlier submission
    if (k.idDone == null) k.idDone = !!k.idType;
    if (k.gstDone == null) k.gstDone = true;
    if (k.selfie == null) k.selfie = needsSelfie(k);
  }
  if (typeof k.step !== "number" || k.step < 0 || k.step > REVIEW) k.step = 0;
}
function done(k, id) {
  if (id === "pan") return !!(k.pan && k.panName);
  if (id === "id") return !!k.idDone;
  if (id === "selfie") return !needsSelfie(k) || !!k.selfie;
  if (id === "payout")
    return k.payoutMethod === "bank" ? !!(k.bank.acc && k.bank.ifsc && k.bank.holder) : !!k.upi;
  if (id === "gst") return !!k.gstDone;
  return false;
}
function summary(k, id) {
  if (id === "pan") return k.pan;
  if (id === "id") return k.idMasked ? `${k.idType} ${k.idMasked}` : k.idType;
  if (id === "selfie") return "Added";
  if (id === "payout") return k.payoutMethod === "bank" ? `Bank ${k.bank.acc}` : `UPI ${k.upi}`;
  if (id === "gst") return k.gst || "Not registered";
  return "";
}
function railState(k, i) {
  const id = STEPS[i].id;
  if (id === "selfie" && !needsSelfie(k)) return ["skip", "Not needed with Aadhaar"];
  if (k.status === "action_needed" && fixes(k).includes(id)) return ["fix", "Needs a fix"];
  if (k.status === "rejected" && (id === "id" || (id === "selfie" && needsSelfie(k))))
    return ["fix", "Try again"];
  if (k.status === "in_progress" && k.step === i) return ["now", "Now"];
  if (done(k, id)) return ["done", summary(k, id)];
  return ["next", id === "gst" ? "Optional" : ""];
}
const pending = k => {
  const i = STEPS.findIndex(s => s.id !== "gst" && !done(k, s.id));
  return i < 0 ? REVIEW : i;
};
const nextStep = (k, i) => {
  let n = i + 1;
  if (STEPS[n] && STEPS[n].id === "selfie" && !needsSelfie(k)) n++;
  return n;
};
const prevStep = (k, i) => {
  let n = i - 1;
  if (STEPS[n] && STEPS[n].id === "selfie" && !needsSelfie(k)) n--;
  return Math.max(0, n);
};
function checkFile(f, types, label) {
  if (!f) return "Choose a file.";
  if (!types.includes(f.type))
    return `That file is ${f.type ? "a " + (f.type.split("/")[1] || "").toUpperCase() + " file" : "not a supported type"}. Use ${label}.`;
  if (f.size > FILE_MAX)
    return `That file is ${(f.size / 1048576).toFixed(1)} MB. Use one under ${FILE_MAX >> 20} MB.`;
  if (!f.size) return "That file is empty. Try another.";
  return "";
}

/* simulated upload with progress, offline failure and retry (the sample build only) */
function Upload({ file, onDone }) {
  const [v, setV] = useState(0);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);
  useEffect(() => {
    let x = 0;
    setV(0);
    setFailed(false);
    const t = setInterval(() => {
      if (!navigator.onLine) {
        clearInterval(t);
        setFailed(true);
        return;
      }
      x = Math.min(100, x + 12 + Math.random() * 14);
      setV(x);
      if (x >= 100) {
        clearInterval(t);
        onDone();
      }
    }, 90);
    return () => clearInterval(t);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  if (failed)
    return (
      <div className="kyc-up is-err" role="alert">
        <Icon n="alert" />
        <div>
          <p className="t-label">Upload failed</p>
          <p>You're offline. Check your connection, then try again.</p>
        </div>
        <Lq className="lq-s lq-sm" data-retry="" onClick={() => setRun(r => r + 1)}>
          Retry
        </Lq>
      </div>
    );
  return (
    <div className="kyc-up">
      <div className="row between">
        <span className="kyc-up-n">{file.name}</span>
        <span className="num muted" data-pct="">
          {Math.round(v)}%
        </span>
      </div>
      <progress max="100" value={v} aria-label={`Upload progress for ${file.name}`}></progress>
    </div>
  );
}

/* ---------- form parts ---------- */
function Field({ id, label, help, err, children }) {
  return (
    <div className={`field${err != null ? " is-err" : ""}`} data-f={id}>
      <label htmlFor={`kyc-${id}`}>{label}</label>
      {children}
      {help ? (
        <p className="help" id={`kyc-${id}-h`}>
          {help}
        </p>
      ) : null}
      <p className="err" id={`kyc-${id}-e`} aria-live="polite">
        {err || ""}
      </p>
    </div>
  );
}
const SavedRow = ({ label, value, k, onChange }) => (
  <div className="kyc-saved" data-st="">
    <span className="kyc-saved-l">{label}</span>
    <span className="kyc-saved-v num">{value}</span>
    <button type="button" className="btn-q" data-change={k} onClick={() => onChange(k)}>
      Change
    </button>
  </div>
);
/** the input box's text, transformed as it's typed (the caret goes to the end, as with the plain DOM) */
const typed = (fmt, put) => e => {
  const i = e.currentTarget;
  if (fmt) i.value = fmt(i.value);
  put(i.value);
};

/* PAN */
function FPan({ f }) {
  const k = K();
  const [hint, setHint] = useState("10 characters: 5 letters, 4 digits, 1 letter.");
  f.api.current = {
    check() {
      const errs = [];
      if (!k.pan || D.edit.pan) {
        const v = D.panRaw;
        if (!v) errs.push(["pan", "Enter your PAN."]);
        else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v))
          errs.push(["pan", "That doesn't look like a PAN. It's 5 letters, 4 digits, then 1 letter."]);
      }
      const n = norm(D.panName ?? k.panName);
      if (!n) errs.push(["pname", "Enter the name exactly as it's printed on your PAN."]);
      else if (n.length < 3) errs.push(["pname", "Use your full name as printed."]);
      return errs;
    },
    commit() {
      if (LIVE) {
        const name = norm(D.panName ?? k.panName);
        const raw = !k.pan || D.edit.pan ? D.panRaw : null;
        /* the server keeps the full PAN; a saved one only needs its name re-sent when it changes */
        if (!raw && name === norm(k.panName)) return;
        if (!raw) return Promise.reject(new Error("Re-enter your PAN number to change the name on it."));
        return LLD.live.kycPan(raw, name).then(() => {
          D.edit.pan = false;
          D.panRaw = "";
          delete D.panName;
        });
      }
      const masked = !k.pan || D.edit.pan ? M.pan(D.panRaw) : k.pan;
      set(kk => {
        kk.pan = masked;
        kk.panName = norm(D.panName ?? kk.panName);
      }, "kyc-pan");
      D.edit.pan = false;
      delete D.panName;
    },
  };
  const editing = !k.pan || D.edit.pan;
  return (
    <>
      {editing ? (
        <Field id="pan" label="PAN number" help={hint} err={f.errs.pan}>
          <input
            className="input kyc-mono"
            id="kyc-pan"
            maxLength={10}
            autoComplete="off"
            spellCheck="false"
            autoCapitalize="characters"
            defaultValue={D.panRaw}
            placeholder="ABCDE1234F"
            aria-describedby="kyc-pan-h kyc-pan-e"
            aria-invalid={f.inv("pan")}
            onInput={e => {
              const p = e.currentTarget;
              p.value = p.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "")
                .slice(0, 10);
              D.panRaw = p.value;
              f.clear("pan");
              setHint(
                p.value.length >= 4 && p.value[3] !== "P"
                  ? "Personal PANs usually have P as the 4th letter. Double-check yours."
                  : "10 characters: 5 letters, 4 digits, 1 letter.",
              );
            }}
          />
        </Field>
      ) : (
        <SavedRow label="PAN" value={k.pan} k="pan" onChange={f.change} />
      )}
      <Field id="pname" label="Name as printed on your PAN" err={f.errs.pname}>
        <input
          className="input"
          id="kyc-pname"
          autoComplete="name"
          defaultValue={D.panName ?? k.panName}
          placeholder="ANANYA IYER"
          aria-describedby="kyc-pname-e"
          aria-invalid={f.inv("pname")}
          onInput={e => {
            D.panName = e.currentTarget.value;
            f.clear("pname");
          }}
        />
      </Field>
    </>
  );
}

/* identity proof */
function FId({ f, setLive }) {
  const k = K();
  if (!D.idType) D.idType = k.idType || "Aadhaar";
  const [, redraw] = useState(0);
  const [upFile, setUpFile] = useState(null);
  const [consentErr, setConsentErr] = useState("");
  const file = useRef(null);
  const t = IDS[D.idType],
    saved = k.idDone && !D.edit.id && k.idType === D.idType;
  f.api.current = {
    check() {
      const errs = [];
      if (k.idDone && !D.edit.id && k.idType === D.idType) return errs;
      if (LIVE) {
        if (!D.docFile) errs.push(["doc", "Upload a photo or PDF of the front of your ID."]);
        return errs;
      }
      const v = t.clean(D.idNum || "");
      if (!v) errs.push(["idn", `Enter your ${D.idType} number.`]);
      else if (!t.re.test(v)) errs.push(["idn", t.err]);
      if (D.idType === "Aadhaar" && !D.consent) {
        errs.push(["consent", ""]);
        setConsentErr("Tick the box to agree, so we can run the check.");
      }
      if (D.idType !== "Aadhaar" && !D.docName) errs.push(["doc", "Upload a photo of the front of your ID."]);
      return errs;
    },
    commit() {
      if (k.idDone && !D.edit.id && k.idType === D.idType) return;
      if (LIVE)
        return LLD.live.kycId(D.idType, D.docFile).then(() => {
          D.edit.id = false;
          D.docFile = null;
          D.docName = "";
        });
      const masked = t.mask(t.clean(D.idNum));
      const changedType = k.idType !== D.idType;
      set(kk => {
        kk.idType = D.idType;
        kk.idMasked = masked;
        kk.idDone = true;
        if (changedType || D.idType !== "Aadhaar") kk.selfie = false;
      }, "kyc-id");
      D.edit.id = false;
      D.idNum = "";
      D.docName = "";
      D.consent = false;
    },
  };
  const pick = () => file.current.click();
  const docBox = upFile ? (
    <Upload
      file={upFile}
      onDone={() => {
        D.docName = upFile.name;
        setLive("Upload complete");
        setUpFile(null);
      }}
    />
  ) : D.docName ? (
    <div className="kyc-up is-ok">
      <Icon n="check" />
      <span className="kyc-up-n">{D.docName}</span>
      <button type="button" className="btn-q" data-redo="" onClick={pick}>
        Replace
      </button>
    </div>
  ) : (
    <Lq className="lq-s lq-sm" data-pick="" onClick={pick}>
      <Icon n="upload" className="ic" />
      Upload photo or PDF
    </Lq>
  );
  return (
    <>
      <fieldset className="kyc-fs" data-f="idtype">
        <legend>ID type</legend>
        <div className="kyc-opts">
          {Object.keys(IDS).map(n => (
            <label key={n} className="kyc-opt">
              <input
                type="radio"
                name="kyc-idt"
                value={n}
                checked={D.idType === n}
                onChange={() => {
                  D.idType = n;
                  D.idNum = "";
                  D.docName = "";
                  D.edit.id = true;
                  f.clearAll();
                  redraw(x => x + 1);
                }}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {saved ? (
        <SavedRow label={D.idType} value={k.idMasked || "Checked"} k="id" onChange={f.change} />
      ) : LIVE ? null : (
        <Field id="idn" label={`${D.idType} number`} err={f.errs.idn}>
          <input
            className="input kyc-mono"
            id="kyc-idn"
            autoComplete="off"
            spellCheck="false"
            inputMode={D.idType === "Aadhaar" ? "numeric" : "text"}
            defaultValue={D.idNum || ""}
            placeholder={t.ph}
            aria-describedby="kyc-idn-e"
            aria-invalid={f.inv("idn")}
            onInput={typed(
              v => (IDS[D.idType].fmt ? IDS[D.idType].fmt(v) : IDS[D.idType].clean(v).slice(0, 16)),
              v => {
                D.idNum = v;
                f.clear("idn");
              },
            )}
          />
        </Field>
      )}
      {!saved && !LIVE && D.idType === "Aadhaar" ? (
        <>
          <label className={`check${"consent" in f.errs ? " is-err" : ""}`} data-f="consent">
            <input
              type="checkbox"
              id="kyc-consent"
              defaultChecked={!!D.consent}
              aria-invalid={f.inv("consent")}
              onChange={e => {
                D.consent = e.currentTarget.checked;
                setConsentErr("");
              }}
            />
            <span>
              I agree to share my Aadhaar number for this check only. No photo of the card is needed.
            </span>
          </label>
          <p className="err" data-consent-e="" aria-live="polite">
            {consentErr}
          </p>
        </>
      ) : null}
      {!saved && (LIVE || D.idType !== "Aadhaar") ? (
        <>
          <div className={`field${f.errs.doc != null ? " is-err" : ""}`} data-f="doc">
            <span className="lab">Photo of the ID, front side</span>
            <div className="kyc-file" data-docbox="">
              {docBox}
            </div>
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              tabIndex={-1}
              aria-label="ID document file"
              data-file=""
              aria-invalid={f.inv("doc")}
              ref={file}
              onInput={() => f.clear("doc")}
              onChange={e => {
                const x = e.currentTarget.files[0];
                e.currentTarget.value = "";
                const er = checkFile(
                  x,
                  ["image/jpeg", "image/png", "application/pdf", ...(LIVE ? ["image/webp"] : [])],
                  "a JPG, PNG or PDF",
                );
                if (er) return f.setErr("doc", er);
                f.setErr("doc", "");
                setLive("Uploading " + x.name);
                if (LIVE) {
                  /* kept until Continue, which uploads it and saves the step in one go */
                  D.docFile = x;
                  D.docName = x.name;
                  setLive(x.name + " ready");
                  redraw(n => n + 1);
                  return;
                }
                setUpFile(x);
              }}
            />
            <p className="help">
              JPG, PNG{LIVE ? ", WebP" : ""} or PDF, up to {FILE_MAX >> 20} MB. All four corners in frame, no
              glare.
            </p>
            <p className="err" aria-live="polite">
              {f.errs.doc || ""}
            </p>
          </div>
          {LIVE ? null : (
            <p className="kyc-note">
              <Icon n="camera" />
              We'll also ask for a selfie, to match your face to this ID.
            </p>
          )}
        </>
      ) : null}
    </>
  );
}

/* selfie (only for document uploads, the sample build) */
function FSelfie({ f, setLive }) {
  const [upFile, setUpFile] = useState(null);
  const [, redraw] = useState(0);
  const file = useRef(null);
  f.api.current = {
    check: () => (K().selfie || D.selfieName ? [] : [["selfie", "Add a selfie to continue."]]),
    commit() {
      set(kk => {
        kk.selfie = true;
      }, "kyc-selfie");
      D.selfieName = "";
    },
  };
  const k = K();
  return (
    <>
      <ul className="kyc-tips" data-st="">
        <li>Face a window or light</li>
        <li>No cap or sunglasses</li>
        <li>Plain background</li>
      </ul>
      <div className={`field${f.errs.selfie != null ? " is-err" : ""}`} data-f="selfie">
        <span className="lab">Your selfie</span>
        <div className="kyc-file" data-sbox="">
          {upFile ? (
            <Upload
              file={upFile}
              onDone={() => {
                D.selfieName = "selfie";
                setLive("Selfie added");
                set(kk => {
                  kk.selfie = false;
                }, "kyc-selfie-draft");
                setUpFile(null);
                redraw(n => n + 1);
              }}
            />
          ) : k.selfie || D.selfieName ? (
            <div className="kyc-up is-ok">
              <Icon n="check" />
              <span className="kyc-up-n">Selfie added</span>
              <button type="button" className="btn-q" data-redo="" onClick={() => file.current.click()}>
                Retake
              </button>
            </div>
          ) : (
            <Lq className="lq-s" data-pick="" onClick={() => file.current.click()}>
              <Icon n="camera" className="ic" />
              Take or upload a selfie
            </Lq>
          )}
        </div>
        <input
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="user"
          tabIndex={-1}
          aria-label="Selfie photo"
          data-file=""
          aria-invalid={f.inv("selfie")}
          ref={file}
          onInput={() => f.clear("selfie")}
          onChange={e => {
            const x = e.currentTarget.files[0];
            e.currentTarget.value = "";
            const er = checkFile(
              x,
              ["image/jpeg", "image/png", "image/webp", "image/heic"],
              "a JPG, PNG or HEIC photo",
            );
            if (er) return f.setErr("selfie", er);
            f.setErr("selfie", "");
            setUpFile(x);
          }}
        />
        <p className="help">We don't show the photo here, and it's deleted after the check.</p>
        <p className="err" aria-live="polite">
          {f.errs.selfie || ""}
        </p>
      </div>
    </>
  );
}

/* payout: UPI or bank, masked once saved */
function FPayout({ f }) {
  const k = K();
  if (!D.method)
    D.method = LIVE
      ? "bank"
      : D.fixing && fixes(k).includes("payout") && k.bank.acc
        ? "bank"
        : k.payoutMethod || "upi";
  if (D.holder == null) D.holder = k.bank.holder || "";
  const [, redraw] = useState(0);
  f.api.current = {
    check() {
      const errs = [];
      if (D.method === "upi") {
        if (!k.upi || D.edit.upi) {
          const v = (D.upi || "").trim();
          if (!v) errs.push(["upi", "Enter your UPI ID."]);
          else if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(v))
            errs.push(["upi", "A UPI ID looks like name@okhdfcbank, with one @."]);
        }
      } else {
        if (!k.bank.acc || D.edit.bank) {
          const a = D.acc || "";
          if (!a) errs.push(["acc", "Enter your account number."]);
          else if (a.length < 9 || a.length > 18)
            errs.push(["acc", "Indian account numbers have 9 to 18 digits."]);
          if (a && D.acc2 !== a) errs.push(["acc2", "The two account numbers don't match."]);
          const x = D.ifsc || "";
          if (!x) errs.push(["ifsc", "Enter the IFSC."]);
          else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(x))
            errs.push(["ifsc", "An IFSC is 4 letters, a zero, then 6 letters or digits."]);
        }
        const h = norm(D.holder);
        if (!h) errs.push(["holder", "Enter the name on the bank account."]);
        else if (k.panName && h !== norm(k.panName))
          errs.push([
            "holder",
            `This doesn't match your PAN name (${k.panName}). Payouts fail when names differ. Use the PAN name, or correct your PAN.`,
          ]);
      }
      return errs;
    },
    commit() {
      if (LIVE) {
        const holder = D.holder.trim().replace(/\s+/g, " ");
        if (k.bank.acc && !D.edit.bank && holder === k.bank.holder) return;
        if (k.bank.acc && !D.edit.bank)
          return Promise.reject(new Error("Re-enter the account number and IFSC to change the holder name."));
        return LLD.live.kycBank(holder, D.acc, D.ifsc).then(() => {
          D.edit.bank = false;
          D.acc = D.acc2 = D.ifsc = "";
          D.method = null;
          D.holder = null;
        });
      }
      set(kk => {
        if (!D.fixing || !kk.payoutMethod) kk.payoutMethod = D.method;
        if (D.method === "upi" && (!kk.upi || D.edit.upi)) kk.upi = M.upi(D.upi.trim());
        if (D.method === "bank") {
          if (!kk.bank.acc || D.edit.bank) {
            kk.bank.acc = M.acc(D.acc);
            kk.bank.ifsc = M.ifsc(D.ifsc);
          }
          kk.bank.holder = D.holder.trim().replace(/\s+/g, " ");
        }
      }, "kyc-payout");
      D.edit.upi = D.edit.bank = false;
      D.upi = D.acc = D.acc2 = D.ifsc = "";
      D.method = null;
      D.holder = null;
    },
  };
  const upiSaved = k.upi && !D.edit.upi,
    accSaved = k.bank.acc && !D.edit.bank;
  const box = (id, key, fmt) => ({
    id: "kyc-" + id,
    defaultValue: D[key] || "",
    "aria-invalid": f.inv(id),
    onInput: typed(fmt, v => {
      D[key] = v;
      f.clear(id);
      if (id === "ifsc") redraw(n => n + 1);
    }),
  });
  const bankName = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(D.ifsc || "") && BANKS[(D.ifsc || "").slice(0, 4)];
  return (
    <>
      {LIVE ? null : (
        <div className="seg kyc-seg" role="group" aria-label="Payout method">
          {[
            ["upi", "UPI ID"],
            ["bank", "Bank account"],
          ].map(([m, t]) => (
            <button
              key={m}
              type="button"
              data-m={m}
              aria-pressed={String(D.method === m)}
              onClick={() => {
                D.method = m;
                f.clearAll();
                redraw(n => n + 1);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {D.method === "upi" ? (
        upiSaved ? (
          <SavedRow label="UPI ID" value={k.upi} k="upi" onChange={f.change} />
        ) : (
          <Field id="upi" label="UPI ID" help="Find it in your UPI app, under your profile." err={f.errs.upi}>
            <input
              className="input"
              autoComplete="off"
              spellCheck="false"
              autoCapitalize="none"
              placeholder="yourname@okbank"
              aria-describedby="kyc-upi-h kyc-upi-e"
              {...box("upi", "upi", v => v.replace(/\s/g, ""))}
            />
          </Field>
        )
      ) : (
        <>
          {accSaved ? (
            <SavedRow label="Account" value={`${k.bank.acc} · ${k.bank.ifsc}`} k="bank" onChange={f.change} />
          ) : (
            <>
              <Field id="acc" label="Account number" err={f.errs.acc}>
                <input
                  className="input kyc-mono"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-describedby="kyc-acc-e"
                  {...box("acc", "acc", v => v.replace(/\D/g, "").slice(0, 18))}
                />
              </Field>
              <Field id="acc2" label="Re-enter account number" err={f.errs.acc2}>
                <input
                  className="input kyc-mono"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-describedby="kyc-acc2-e"
                  {...box("acc2", "acc2", v => v.replace(/\D/g, "").slice(0, 18))}
                />
              </Field>
              <Field
                id="ifsc"
                label="IFSC"
                help={
                  bankName
                    ? bankName + " · branch code " + D.ifsc.slice(5)
                    : "On your cheque book or passbook. 11 characters."
                }
                err={f.errs.ifsc}
              >
                <input
                  className="input kyc-mono"
                  maxLength={11}
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="HDFC0001234"
                  aria-describedby="kyc-ifsc-h kyc-ifsc-e"
                  {...box("ifsc", "ifsc", v =>
                    v
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 11),
                  )}
                />
              </Field>
            </>
          )}
          <Field
            id="holder"
            label="Account holder name"
            help={
              <>
                Must match the name on your PAN: <b>{k.panName || "add your PAN first"}</b>
              </>
            }
            err={f.errs.holder}
          >
            <input
              className="input"
              autoComplete="name"
              aria-describedby="kyc-holder-h kyc-holder-e"
              {...box("holder", "holder")}
            />
          </Field>
        </>
      )}
    </>
  );
}

/* GST (optional, the sample build) */
function FGst({ f }) {
  const k = K();
  if (D.hasGst == null) D.hasGst = !!k.gst;
  const [, redraw] = useState(0);
  f.api.current = {
    check() {
      if (!D.hasGst || (k.gst && !D.edit.gst)) return [];
      const v = D.gst || "";
      if (!v) return [["gst", 'Enter your GSTIN, or choose "I don\'t have GST".']];
      if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) || +v.slice(0, 2) < 1 || +v.slice(0, 2) > 38)
        return [["gst", "That doesn't look like a GSTIN. It's 15 characters, like 27ABCDE1234F1Z5."]];
      const p = D.panRaw || "",
        pm = K().pan || "";
      const mismatch = p
        ? v.slice(2, 12) !== p
        : pm && (v.slice(2, 7) !== pm.slice(0, 5) || v[11] !== pm.slice(-1));
      if (mismatch)
        return [["gst", "This GSTIN belongs to a different PAN. Use the GSTIN registered to your own PAN."]];
      return [];
    },
    commit() {
      set(kk => {
        kk.gst = D.hasGst ? (kk.gst && !D.edit.gst ? kk.gst : M.gst(D.gst)) : "";
        kk.gstDone = true;
      }, "kyc-gst");
      D.edit.gst = false;
      D.gst = "";
    },
  };
  return (
    <>
      <div className="seg kyc-seg" role="group" aria-label="Do you have a GST number?">
        {[
          ["no", "I don't have GST", false],
          ["yes", "I have a GSTIN", true],
        ].map(([g, t, on]) => (
          <button
            key={g}
            type="button"
            data-g={g}
            aria-pressed={String(!!D.hasGst === on)}
            onClick={() => {
              D.hasGst = on;
              f.clearAll();
              redraw(n => n + 1);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {D.hasGst ? (
        k.gst && !D.edit.gst ? (
          <SavedRow label="GSTIN" value={k.gst} k="gst" onChange={f.change} />
        ) : (
          <Field
            id="gst"
            label="GSTIN"
            help="15 characters. It contains your PAN, so we check they match."
            err={f.errs.gst}
          >
            <input
              className="input kyc-mono"
              id="kyc-gst"
              maxLength={15}
              autoComplete="off"
              spellCheck="false"
              defaultValue={D.gst || ""}
              placeholder="27ABCDE1234F1Z5"
              aria-describedby="kyc-gst-h kyc-gst-e"
              aria-invalid={f.inv("gst")}
              onInput={typed(
                v =>
                  v
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 15),
                v => {
                  D.gst = v;
                  f.clear("gst");
                },
              )}
            />
          </Field>
        )
      ) : (
        <p className="kyc-note" data-st="">
          <Icon n="check" />
          That's fine. You can add a GSTIN from your profile later.
        </p>
      )}
    </>
  );
}

/* ---------- in progress: one step at a time ---------- */
function StepView({ k, i, ctx }) {
  const s = STEPS[i];
  const shown = STEPS.filter(x => x.id !== "selfie" || needsSelfie(k));
  const pos = shown.findIndex(x => x.id === s.id) + 1;
  const why =
    s.id === "selfie"
      ? `Only because you chose a ${k.idType.toLowerCase()}. We compare it with your ID photo, then delete it after the check.`
      : s.why;
  const [errs, setErrs] = useState({});
  const invSet = useRef(new Set());
  const [, redraw] = useState(0);
  const [formErr, setFormErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const box = useRef(null),
    nextBtn = useRef(null);
  const api = useRef(null);
  /* what each step form shares: its errors (a field's error clears as it's typed in), the Change link on a saved value */
  const f = {
    api,
    errs,
    inv: id => (invSet.current.has(id) ? "true" : undefined),
    clear: id => {
      if (!(id in errs)) return;
      invSet.current.delete(id);
      setErrs(e => {
        const x = { ...e };
        delete x[id];
        return x;
      });
    },
    setErr: (id, m) =>
      setErrs(e => {
        const x = { ...e };
        if (m) x[id] = m;
        else delete x[id];
        return x;
      }),
    /* a form that redraws itself starts clean, as a fresh plain-DOM paint did */
    clearAll: () => {
      invSet.current.clear();
      setErrs({});
    },
    change: key => {
      D.edit[key] = true;
      invSet.current.clear();
      flushSync(() => {
        setErrs({});
        redraw(n => n + 1);
      });
      const x = box.current.querySelector("input");
      x && x.focus();
    },
  };
  const Form = { pan: FPan, id: FId, selfie: FSelfie, payout: FPayout, gst: FGst }[s.id];
  const advance = () => {
    const n = D.fixing ? pending(K()) : nextStep(K(), i);
    set(kk => {
      kk.step = n;
    }, "kyc-step");
    ctx.setLive(n === REVIEW ? "Review your details" : `${STEPS[n].t} next`);
    ctx.paint(true, () => {
      try {
        const ns = document.querySelectorAll("[data-rail] .kyc-rail-n"),
          to = ns[Math.min(n, STEPS.length)];
        if (LLD.motion.pull && ns[i] && to && n > i) LLD.motion.pull(ns[i], to);
      } catch (e) {}
    });
  };
  const submit = e => {
    e.preventDefault();
    const list = api.current.check();
    if (list.length) {
      /* fields from an earlier check lose their red, but keep aria-invalid until they're typed in (as before) */
      list.forEach(([id]) => invSet.current.add(id));
      flushSync(() => setErrs(Object.fromEntries(list)));
      const first = box.current.querySelector(
        `[data-f="${list[0][0]}"] input:not([type=hidden]), [data-f="${list[0][0]}"] button`,
      );
      first && first.focus();
      ctx.setLive("Check the highlighted fields");
      return;
    }
    press(nextBtn.current);
    const r = api.current.commit();
    if (r && typeof r.then === "function") {
      setFormErr(null);
      setBusy(true);
      r.then(
        () => ctx.alive.current && advance(),
        er => {
          if (!ctx.alive.current) return;
          setBusy(false);
          const fieldErr = er && er.details && typeof er.details === "object" ? Object.keys(er.details) : [];
          setFormErr((er && er.message) || "We couldn't save that. Please try again.");
          if (fieldErr.length) ctx.setLive("Check the highlighted fields");
        },
      );
      return;
    }
    advance();
  };
  return (
    <form className="kyc-step" noValidate data-form="" onSubmit={submit}>
      <div className="kyc-head">
        <p className="t-eyebrow">{D.fixing ? "Fixing one detail" : `Step ${pos} of ${shown.length}`}</p>
        <h1 className="t-h1" tabIndex={-1}>
          {s.h}
        </h1>
        <p className="kyc-why">
          <Icon n="info" />
          <span>{why}</span>
        </p>
      </div>
      <div className="kyc-fields" data-fields="" ref={box}>
        <Form f={f} setLive={ctx.setLive} />
      </div>
      <p className="kyc-formerr" role="alert" data-formerr="" hidden={formErr === null}>
        {formErr || ""}
      </p>
      <div className="kyc-ask">
        <div className="kyc-actions">
          <Lq
            className="lq-p"
            type="submit"
            data-next=""
            ref={nextBtn}
            disabled={busy}
            aria-busy={busy ? "true" : undefined}
          >
            {D.fixing ? "Save and review" : "Continue"}
          </Lq>
          {i > 0 && !D.fixing ? (
            <Lq
              className="lq-s"
              data-back=""
              onClick={() => {
                set(kk => {
                  kk.step = prevStep(kk, i);
                }, "kyc-step");
                ctx.paint(true);
              }}
            >
              <Icon n="back" className="ic" />
              Back
            </Lq>
          ) : null}
          <Lq
            className="lq-s lq-sm kyc-exit"
            data-leave=""
            onClick={() => {
              LLD.toast("Saved. Pick up where you left off any time.", "check");
              ctx.leave();
            }}
          >
            Save and exit
          </Lq>
        </div>
        {s.id === "gst" ? null : (
          <p className="ll-trust">
            <Icon n="lock" />
            {TRUST}
          </p>
        )}
      </div>
    </form>
  );
}

/* review and submit */
function SummaryView({ k, ctx }) {
  const [agreeErr, setAgreeErr] = useState("");
  const [formErr, setFormErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const agree = useRef(null),
    btn = useRef(null);
  const mismatch = k.bank.acc && k.panName && norm(k.bank.holder) !== norm(k.panName);
  const rows = [
    ["pan", "PAN", `${k.pan} · ${k.panName}`],
    ["id", "Identity proof", summary(k, "id")],
    ...(needsSelfie(k) ? [["selfie", "Selfie", k.selfie ? "Added" : "Missing"]] : []),
    ["payout", "Payout", k.payoutMethod === "bank" ? `Bank ${k.bank.acc} · ${k.bank.ifsc}` : `UPI ${k.upi}`],
    ...(k.payoutMethod === "upi" && k.bank.acc
      ? [["payout", "Backup bank", `${k.bank.acc} · ${k.bank.holder}`]]
      : []),
    ...(LIVE ? [] : [["gst", "GST", k.gst || "Not registered"]]),
  ];
  const missing = STEPS.filter(s => !done(k, s.id) && s.id !== "gst");
  const finish = () => {
    D.fixing = false;
    D.panRaw = "";
  };
  const submit = e => {
    e.preventDefault();
    if (!agree.current.checked) {
      setAgreeErr("Tick the box to confirm.");
      agree.current.focus();
      return;
    }
    if (!navigator.onLine)
      return setFormErr(
        "You're offline, so nothing was sent. Your details are still here; submit again when you're connected.",
      );
    press(btn.current);
    setBusy(true);
    if (LIVE) {
      LLD.live.kycSubmit().then(
        () => {
          if (!ctx.alive.current) return;
          finish();
          set(kk => {
            kk.step = REVIEW;
            kk.fix = null;
          }, "kyc-submitted");
          ctx.setLive("Submitted for review");
          ctx.paint(true);
        },
        er => {
          if (!ctx.alive.current) return;
          setBusy(false);
          setFormErr((er && er.message) || "We couldn't submit. Please try again.");
        },
      );
      return;
    }
    setTimeout(() => {
      if (!ctx.alive.current) return;
      finish();
      set(kk => {
        kk.status = "under_review";
        kk.step = REVIEW;
        kk.note = "";
        kk.fix = null;
        kk.submittedAt = LLD.today().toISOString();
      }, "kyc-submitted");
      ctx.setLive("Submitted for review");
      ctx.paint(true);
    }, 800);
  };
  return (
    <form className="kyc-step" noValidate data-form="" onSubmit={submit}>
      <div className="kyc-head">
        <p className="t-eyebrow">Last step</p>
        <h1 className="t-h1" tabIndex={-1}>
          Check and submit
        </h1>
        <p className="muted">
          Numbers are masked from here on. Only the verification team sees them in full.
        </p>
      </div>
      <dl className="kyc-sum">
        {rows.map((r, i) => (
          <div key={i} className="kyc-sum-r" data-st="">
            <dt>{r[1]}</dt>
            <dd className="num">{r[2]}</dd>
            <dd>
              <button
                type="button"
                className="btn-q"
                data-edit={r[0]}
                onClick={() => {
                  const n = STEPS.findIndex(s => s.id === r[0]);
                  D.fixing = true;
                  set(kk => {
                    kk.step = n;
                  }, "kyc-step");
                  ctx.paint(true);
                }}
              >
                Edit<span className="sr-only"> {r[1]}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>
      {mismatch ? (
        <div className="kyc-alert" role="alert">
          <Icon n="alert" />
          <div>
            <p className="t-label">Bank name still doesn't match your PAN</p>
            <p>
              {k.bank.holder} vs {k.panName}. Fix one of them before you submit.
            </p>
          </div>
        </div>
      ) : null}
      {missing.length ? (
        <div className="kyc-alert" role="alert">
          <Icon n="alert" />
          <div>
            <p className="t-label">Missing: {missing.map(s => s.t).join(", ")}</p>
            <p>Add {missing.length === 1 ? "it" : "them"} to submit.</p>
          </div>
        </div>
      ) : null}
      <label className="check">
        <input type="checkbox" id="kyc-agree" ref={agree} />
        <span>
          These details are mine and correct. I understand they're used only to verify me and pay me.
        </span>
      </label>
      <p className="err" data-agree-e="" aria-live="polite">
        {agreeErr}
      </p>
      <p className="kyc-formerr" role="alert" data-formerr="" hidden={formErr === null}>
        {formErr || ""}
      </p>
      <div className="kyc-ask">
        <div className="kyc-actions">
          <Lq
            className="lq-p lq-xl"
            type="submit"
            data-submit=""
            ref={btn}
            disabled={!!(mismatch || missing.length) || busy}
          >
            {busy ? (
              "Submitting…"
            ) : (
              <>
                <Icon n="lock" className="ic" />
                Submit for review
              </>
            )}
          </Lq>
          <Lq
            className="lq-s lq-sm kyc-exit"
            data-leave=""
            onClick={() => {
              LLD.toast("Saved. Submit whenever you're ready.", "check");
              ctx.leave();
            }}
          >
            Save and exit
          </Lq>
        </div>
        <p className="ll-trust">
          <Icon n="lock" />
          {TRUST}
        </p>
      </div>
    </form>
  );
}

const StatusPill = ({ k }) => {
  const [c, t] = STATUS[k.status];
  return (
    <span className={`pill ${c}`}>
      {k.status === "rejected" || k.status === "action_needed" ? (
        <Icon n="alert" />
      ) : k.status === "verified" ? (
        <Icon n="check" />
      ) : null}
      {t}
    </span>
  );
};
const Trust = () => (
  <p className="ll-trust">
    <Icon n="lock" />
    {TRUST}
  </p>
);
// wrap the words that the other name doesn't have, so the mismatch is visible at a glance
const diff = (a, b) => {
  const other = new Set(norm(b).split(" "));
  return String(a)
    .split(/\s+/)
    .map((w, i) => (
      <Fragment key={i}>
        {i ? " " : ""}
        {other.has(norm(w)) ? w : <mark className="kyc-diff">{w}</mark>}
      </Fragment>
    ));
};

function MainView({ k, ctx }) {
  if (k.status === "in_progress")
    return k.step === REVIEW ? <SummaryView k={k} ctx={ctx} /> : <StepView k={k} i={k.step} ctx={ctx} />;
  if (k.status === "under_review") {
    const j = jobOf(k);
    /* the waiting card: how long is left (the API's estimate, else "within 2 hours"), and something to do meanwhile.
       Same words as the card on Home. TODO(backend): automatic PAN check; an ETA on GET /v1/kyc/ (reviewEtaAt). */
    return (
      <>
        <div className="kyc-head">
          <StatusPill k={k} />
          <h1 className="t-h1" tabIndex={-1}>
            We're checking your ID <span className="kyc-eta">· {kycWaitText(k)}</span>
          </h1>
          <p className="muted">
            We'll send a notification when it's done{j ? ", and bring you straight back to your bid" : ""}.
            Nothing else is needed from you.
          </p>
        </div>
        <ol className="kyc-track" aria-label="Review progress">
          <li className="is-done" data-st="">
            <span></span>
            <b>Submitted</b>
            <span className="t-cap muted num">
              {k.submittedAt
                ? new Date(k.submittedAt).toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Asia/Kolkata",
                  }) + " IST"
                : "Today"}
            </span>
          </li>
          <li className="is-now" data-st="">
            <span></span>
            <b>Checking</b>
            <span className="t-cap muted">PAN, ID and payout</span>
          </li>
          <li data-st="">
            <span></span>
            <b>Verified</b>
            <span className="t-cap muted">{BID_BEFORE_KYC ? "Deals and payouts unlock" : "Bids unlock"}</span>
          </li>
        </ol>
        <section className="kyc-wait" data-st="" aria-labelledby="kycWaitH">
          <span className="kyc-wait-ic" aria-hidden="true">
            <Icon n="clock" />
          </span>
          <div className="kyc-wait-t">
            <p className="kyc-wait-h" id="kycWaitH">
              Meanwhile, keep browsing briefs
            </p>
            <p className="muted">We'll tell you the moment it's done.</p>
          </div>
          <Lq className="lq-p" data-go="#jobs">
            Browse briefs
          </Lq>
        </section>
      </>
    );
  }
  if (k.status === "verified") {
    const j = jobOf(k);
    return (
      <>
        <div className="kyc-done" data-celebrate="">
          <div className="kyc-seal" aria-hidden="true">
            <Icon n="check" />
          </div>
          <div className="kyc-head">
            <StatusPill k={k} />
            <h1 className="t-h1" tabIndex={-1}>
              You're verified
            </h1>
            <p className="muted">
              You can bid on any brief now. Payouts go to{" "}
              {k.payoutMethod === "bank" ? (
                <>
                  bank account <b className="num">{k.bank.acc}</b>
                </>
              ) : (
                <>
                  UPI <b className="num">{k.upi}</b>
                </>
              )}
              .
            </p>
          </div>
        </div>
        <div className="kyc-actions">
          {j ? (
            <Lq
              className="lq-p lq-xl"
              data-return=""
              onClick={e => {
                press(e.currentTarget);
                const to = K().returnTo;
                set(kk => {
                  kk.returnTo = null;
                }, "kyc-return-done");
                LLD.go(to);
              }}
            >
              Back to your bid <Icon n="arrow" className="ic" />
            </Lq>
          ) : (
            <Lq className="lq-p lq-xl" data-go="#jobs">
              Find briefs <Icon n="arrow" className="ic" />
            </Lq>
          )}
          <Lq className="lq-s lq-sm" data-go="#profile">
            View your profile
          </Lq>
        </div>
      </>
    );
  }
  if (k.status === "action_needed") {
    const fx = fixes(k),
      both = fx.includes("payout") && fx.includes("pan") && k.bank.acc;
    return (
      <>
        <div className="kyc-head">
          <StatusPill k={k} />
          <h1 className="t-h1" tabIndex={-1}>
            {both ? "Two names don't match" : "One detail needs a fix"}
          </h1>
          <p className="muted">
            {k.note || "Something in your details needs a correction before you can bid."}
          </p>
        </div>
        {both ? (
          <>
            <dl className="kyc-compare" data-st="">
              <div>
                <dt>Name on PAN</dt>
                <dd>{diff(k.panName, k.bank.holder)}</dd>
              </div>
              <div>
                <dt>
                  Name on bank account <span className="num">{k.bank.acc}</span>
                </dt>
                <dd>{diff(k.bank.holder, k.panName)}</dd>
              </div>
            </dl>
            <p className="muted kyc-small">
              The payout account has to belong to the PAN holder. Correct whichever one is wrong.
            </p>
          </>
        ) : null}
        <div className="kyc-ask">
          <div className="kyc-actions">
            {fx.map((x, i) => (
              <Lq
                key={x}
                className={i ? "lq-s" : "lq-p"}
                data-fix={x}
                onClick={e => {
                  press(e.currentTarget);
                  D.fixing = true;
                  D.method = null;
                  D.holder = null;
                  const n = STEPS.findIndex(s => s.id === x);
                  set(kk => {
                    kk.status = "in_progress";
                    kk.step = n;
                  }, "kyc-fix");
                  ctx.paint(true);
                }}
              >
                {x === "payout" ? "Update bank name" : x === "pan" ? "Correct PAN name" : "Fix " + x}
              </Lq>
            ))}
          </div>
          <Trust />
        </div>
      </>
    );
  }
  if (k.status === "rejected")
    return (
      <>
        <div className="kyc-head">
          <StatusPill k={k} />
          <h1 className="t-h1" tabIndex={-1}>
            We couldn't verify your ID
          </h1>
          <p className="muted">
            {k.note || "The check didn't pass. Try again with a clearer photo or a different ID."}
          </p>
        </div>
        <div className="kyc-alert kyc-alert-soft" data-st="">
          <Icon n="info" />
          <div>
            <p className="t-label">Bids stay paused until this passes</p>
            <p>Your PAN and payout details are kept. Only the ID step needs redoing.</p>
          </div>
        </div>
        <div className="kyc-ask">
          <div className="kyc-actions">
            <Lq
              className="lq-p"
              data-retry=""
              onClick={e => {
                press(e.currentTarget);
                D.fixing = true;
                D.edit.id = true;
                D.idNum = "";
                D.docName = "";
                set(kk => {
                  kk.status = "in_progress";
                  kk.step = 1;
                }, "kyc-retry");
                ctx.paint(true);
              }}
            >
              Try again
            </Lq>
            <Lq className="lq-s lq-sm" data-leave="" onClick={ctx.leave}>
              Not now
            </Lq>
          </div>
          <Trust />
        </div>
      </>
    );
  /* ---------- not started ---------- */
  /* the same steps, in the same order and with the same names, as the rail on the left (C9) */
  const what = {
    pan: "Your PAN card, for payouts and tax records",
    id: LIVE
      ? "A photo or PDF of your Aadhaar, passport, voter ID or driving licence"
      : "Aadhaar or another ID, to show the PAN is yours",
    selfie: "Only for document uploads, to match you to your ID photo",
    payout: LIVE
      ? "Your bank account, where your money lands"
      : "UPI ID or bank account, where your money lands",
    gst: "Optional, only if you're registered",
  };
  const need = [
    ...STEPS.map(s => [s.t, what[s.id] || ""]),
    ["Review", "We check it, usually within 2 hours"],
  ];
  return (
    <>
      <div className="kyc-head">
        <StatusPill k={K()} />
        <h1 className="t-h1" tabIndex={-1}>
          Verify once, then bid
        </h1>
        <p className="muted">
          {BID_BEFORE_KYC
            ? "You can bid now. Brands need your ID check before a deal starts, and it's needed for your first payout."
            : "Brands only accept bids from verified creators."}{" "}
          You can stop and pick up where you left off.
        </p>
      </div>
      <ol className="kyc-need">
        {need.map((n, i) => (
          <li key={i} data-st="">
            <span className="kyc-need-n num">0{i + 1}</span>
            <span>
              <b>{n[0]}</b>
              <span>{n[1]}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="kyc-ask">
        <div className="kyc-actions">
          <Lq
            className="lq-p lq-xl"
            data-begin=""
            onClick={e => {
              press(e.currentTarget);
              set(kk => {
                kk.status = "in_progress";
                kk.step = 0;
              }, "kyc-start");
              ctx.paint(true);
            }}
          >
            <Icon n="lock" className="ic" />
            Start verification
          </Lq>
          <span className="kyc-time">
            <Icon n="clock" />
            About 4 minutes
          </span>
          <Lq className="lq-s lq-sm kyc-exit" data-leave="" onClick={ctx.leave}>
            Not now
          </Lq>
        </div>
        <Trust />
      </div>
    </>
  );
}

function KycScreen() {
  const k = K();
  normalise(k);
  const [paintN, setPaintN] = useState(0);
  const [live, setLive] = useState("");
  const alive = useRef(true);
  const celebrateNext = useRef(false);
  const after = useRef({ focus: false, then: null });
  const main = useRef(null),
    sampleBox = useRef(null);
  /* a paint redraws the panels from the store and the draft; `focus` puts focus on the new headline */
  const paint = (focus, then) => {
    if (!alive.current) return;
    after.current = { focus, then };
    flushSync(() => setPaintN(n => n + 1));
  };
  const leave = () => {
    const j = jobOf(K());
    LLD.go(j ? "#job-" + j.id : "#home");
  };
  useEffect(() => {
    alive.current = true;
    const offLive = store.on(why => {
      if (
        why === "kyc-live" &&
        alive.current &&
        ["under_review", "verified", "action_needed"].includes(K().status)
      ) {
        celebrateNext.current = K().status === "verified";
        paint(false);
      }
    });
    return () => {
      alive.current = false;
      offLive();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    try {
      LLD.motion.stagger([...main.current.querySelectorAll("[data-st]")]);
    } catch (e) {}
    try {
      LLD.motion.press([...sampleBox.current.querySelectorAll("[data-s]")]);
    } catch (e) {}
    const a = after.current;
    after.current = { focus: false, then: null };
    if (a.focus) {
      const h = main.current.querySelector("h1");
      h && h.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
    a.then && a.then();
    if (celebrateNext.current && K().status === "verified") {
      // fresh verification: the tick stitches itself on the seal, then on the pill (one quiet moment)
      celebrateNext.current = false;
      try {
        if (LLD.motion.check) {
          LLD.motion.check(main.current.querySelector(".kyc-seal"));
          LLD.motion.check(main.current.querySelector(".kyc-head .pill"), { delay: 160 });
        } else LLD.motion.celebrate(main.current.querySelector("[data-celebrate]"));
      } catch (e) {}
    }
  }, [paintN]);

  const sample = a => {
    if (a === "approve") {
      celebrateNext.current = true;
      set(x => {
        x.status = "verified";
        x.note = "";
        x.verifiedAt = new Date().toISOString();
      }, "kyc-verified");
      LLD.toast("Verified. You can bid now.", "check");
    }
    if (a === "fix")
      set(x => {
        x.status = "action_needed";
        x.fix = ["pan"];
        x.note =
          "The name on your PAN doesn't match the name on your ID. Check the spelling, letter by letter.";
      }, "kyc-action");
    if (a === "reject")
      set(x => {
        x.status = "rejected";
        x.fix = null;
        x.idDone = false;
        x.selfie = false;
        x.note =
          "The ID photo was blurred, so the number couldn't be read. Nothing is wrong with your account; try again with a sharper photo or a different ID.";
      }, "kyc-rejected");
    if (a === "reset") {
      D = { edit: {}, panRaw: "" };
      set(x => {
        Object.assign(x, {
          status: "not_started",
          step: 0,
          pan: "",
          panName: "",
          idType: "Aadhaar",
          idMasked: "",
          idDone: false,
          selfie: false,
          payoutMethod: "upi",
          upi: "",
          bank: { acc: "", ifsc: "", holder: "" },
          gst: "",
          gstDone: false,
          note: "",
          fix: null,
        });
      }, "kyc-reset");
    }
    paint(true);
  };

  /* the left panel: the rail and the illustration for where the creator is */
  const step = k.status === "in_progress" && STEPS[k.step];
  const ill = step
    ? step.art
    : k.status === "verified"
      ? "step-05-stamp"
      : k.status === "under_review"
        ? "trust-lock-coin"
        : "trust-id-card";
  const big = ill.startsWith("step");
  const j = jobOf(k);
  const sopts =
    k.status === "under_review"
      ? [
          ["approve", "Approve verification"],
          ["fix", "Ask for a fix"],
          ["reject", "Reject"],
        ]
      : k.status === "not_started"
        ? []
        : [["reset", "Start over as a new creator"]];
  const ctx = { paint, setLive, alive, leave };

  return (
    <div className="focus kyc">
      <section className="focus-art dark kyc-art" aria-label="Verification progress">
        <p className="kyc-brand">
          <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
          <span>linkloom</span>
        </p>
        <p className="kyc-art-k">Your ID check</p>
        <ol className="kyc-rail" data-rail="">
          {STEPS.map((s, i) => {
            const [st, sub] = railState(k, i);
            return (
              <li
                key={s.id}
                className={`kyc-rail-i is-${st}`}
                aria-current={st === "now" ? "step" : undefined}
              >
                <span className="kyc-rail-n">
                  {st === "done" ? (
                    <Icon n="check" />
                  ) : st === "fix" ? (
                    <Icon n="alert" />
                  ) : st === "skip" ? (
                    <Icon n="minus" />
                  ) : (
                    "0" + (i + 1)
                  )}
                </span>
                <span className="kyc-rail-t">
                  <b>{s.t}</b>
                  {sub && st !== "now" ? <span className="num">{sub}</span> : null}
                </span>
              </li>
            );
          })}
          <li
            className={`kyc-rail-i kyc-rail-end is-${k.status === "verified" ? "done" : k.status === "under_review" ? "now" : "next"}`}
          >
            <span className="kyc-rail-n">
              {k.status === "verified" ? <Icon n="check" /> : <Icon n="shield" />}
            </span>
            <span className="kyc-rail-t">
              <b>{k.status === "verified" ? "Verified" : "Review"}</b>
              <span>
                {k.status === "under_review"
                  ? "Checking · " + kycWaitText(k)
                  : k.status === "verified"
                    ? "You can bid"
                    : "Usually within 2 hours"}
              </span>
            </span>
          </li>
        </ol>
        <img
          className="kyc-ill"
          data-ill=""
          src={`assets/${ill}.svg`}
          width={big ? 300 : 260}
          height={big ? 220 : 180}
          alt=""
        />
      </section>
      <section className="focus-form light kyc-form">
        <div className="kyc-in">
          <div data-job="">
            {j ? (
              <div className="kyc-job">
                <span className="kyc-job-ic">
                  <Icon n="brief" />
                </span>
                <div className="kyc-job-t">
                  <p className="t-cap muted">
                    {k.status === "verified" ? "Ready to bid on" : "Your bid is saved for"}
                  </p>
                  <p className="t-label">{j.title}</p>
                  <p className="t-cap muted">
                    {j.brand} · Budget {LLD.inr(j.budget)}
                  </p>
                </div>
                <span className="pill pill-paper">
                  <Icon n="bookmark" />
                  Saved
                </span>
              </div>
            ) : null}
          </div>
          <div className="kyc-main" data-main="" ref={main}>
            <MainView key={paintN} k={k} ctx={ctx} />
          </div>
          <div className="kyc-sample" data-sample="" ref={sampleBox}>
            {sopts.length ? (
              <>
                <span className="sample">Sample</span>
                {sopts.map(([a, t]) => (
                  <button key={a} type="button" className="kyc-sbtn" data-s={a} onClick={() => sample(a)}>
                    {t}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
        <p className="sr-only" aria-live="polite" data-live="">
          {live}
        </p>
      </section>
    </div>
  );
}

LLD.register("kyc", { title: "Verification", shell: "focus", Component: KycScreen });
