/* Brand verification (#kyc). The backend asks every account, brand or creator, for the same three things before it
   can post a brief, send an offer or check out: PAN, an ID document and a bank account. Each saves on its own,
   then the brand submits for a manual review. This screen uses the setup screen's layout and classes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the brand runtime is still untyped
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

function render(el) {
  const L = w.LLD,
    esc = L.esc,
    icon = L.icon;
  let alive = true;
  let returnTo = "";
  try {
    returnTo = sessionStorage.getItem("ll-brand-kyc-return") || "";
  } catch {
    /* no storage: back to home */
  }

  const paint = () => {
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
    const saveCls = n => `lq ${n === cur ? "lq-p" : "lq-s"} lq-sm`;
    const row = (label, value) => `<div class="kv"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    const trust = `<p class="ll-trust">${icon("lock")}Encrypted. Never shown to creators.</p>`;
    const sec = (id, n, title, isDone, summary, form) => `
      <section class="card stack bk-sec${n === cur && !locked ? " is-now" : ""}" aria-labelledby="bk-${id}-h" data-sec="${id}">
        <div class="bk-sec-head">
          <div><p class="t-eyebrow muted">Step ${n + 1} of 3</p><h2 class="t-h3" id="bk-${id}-h">${esc(title)}</h2></div>
          ${isDone ? `<span class="pill pill-ok">${icon("check")}Saved</span>` : ""}
        </div>
        ${isDone && !openEdit.has(id) ? `<dl>${summary}</dl>${locked ? "" : `<div class="row"><button class="lq lq-s lq-sm" type="button" data-edit="${id}">Change</button></div>`}` : locked ? `<p class="muted">Locked while under review.</p>` : form}
      </section>`;
    /* progress: never lead with "0 of 3" — a new brand sees how long it takes instead */
    const progress = locked
      ? ""
      : `<div class="ll-steps bk-progress"><span class="ll-steps-t">${doneN ? `${doneN} of 3 done` : "3 steps"}${doneN < 3 ? " · about 4 minutes" : " · ready to submit"}</span><div class="ll-steps-bar" aria-hidden="true">${doneList.map((d, i) => `<i class="${d ? "is-done" : i === cur ? "is-now" : ""}"></i>`).join("")}</div></div>`;

    el.innerHTML = `<div class="focus auth setup">
      <section class="focus-art dark auth-art bk-art" aria-label="About verification">
        <p class="auth-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span><span class="auth-for">for brands</span></p>
        <h2 class="t-display auth-line">Verify once. Hire with escrow.</h2>
        <ol class="bk-art-steps">
          ${ART_STEPS.map(
            ([t, d], i) => `<li class="${doneList[i] ? "is-done" : i === cur && !locked ? "is-now" : ""}">
              <span class="bk-art-n" aria-hidden="true">${doneList[i] ? icon("check") : i + 1}</span>
              <span><b>${esc(t)}</b><span>${esc(d)}</span></span>
              ${doneList[i] ? '<span class="sr-only">, saved</span>' : ""}
            </li>`,
          ).join("")}
        </ol>
        <div class="bk-art-time">${icon("clock")}<p><b>Review time</b><span>${esc(REVIEW_TIME)}</span></p></div>
        <ul class="bk-art-trust">
          <li>${icon("lock")}<span>Encrypted. Creators never see your PAN, ID or bank details.</span></li>
          <li>${icon("shield")}<span>Once verified, you can post briefs, send offers and pay into escrow.</span></li>
          <li>${icon("bell")}<span>You get a notification, and Home shows the status, the moment it's done.</span></li>
        </ul>
      </section>
      <section class="focus-form light auth-form">
        <div class="auth-in">
          <div class="auth-head">
            <p class="row wrap"><span class="pill ${pc}">${esc(pt)}</span></p>
            <h1 class="t-h1" tabindex="-1">${st === "verified" ? "Your business is verified" : st === "pending" ? "We're checking your details" : "Verify your business"}</h1>
            <p class="muted">${
              st === "verified"
                ? "You can post briefs, send offers and hire with escrow."
                : st === "pending"
                  ? `${REVIEW_TIME} You'll get a notification when it's done.`
                  : "Posting a brief, sending an offer and checking out need a verified account. Numbers are encrypted and never shown to creators."
            }</p>
            ${st === "rejected" && k.rejectionReason ? `<div class="profile-formerr" role="alert">${icon("alert")} ${esc(k.rejectionReason)}</div>` : ""}
            ${progress}
          </div>
          <div class="auth-stack">
            ${sec(
              "pan",
              0,
              "PAN",
              done(steps.pan),
              row("PAN", "••••••" + (steps.pan?.panLast4 || "")) +
                row("Name on PAN", steps.pan?.nameOnPan || ""),
              `<div class="field"><label for="bkPan">PAN number</label><input class="input bk-caps" id="bkPan" maxlength="10" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. ABCDE1234F" data-caps><p class="help">Your company PAN, or your own if you're a sole proprietor.</p></div>
               <div class="field"><label for="bkPanName">Name as printed on the PAN</label><input class="input" id="bkPanName" autocomplete="organization" value="${esc(steps.pan?.nameOnPan || "")}"></div>
               <p class="err" data-err="pan" aria-live="assertive"></p>
               <button class="${saveCls(0)}" type="button" data-save="pan">${icon("lock", "ic")}Save PAN</button>${trust}`,
            )}
            ${sec(
              "id",
              1,
              "ID document",
              done(steps.id),
              row("Document", (ID_TYPES.find(t => t[0] === steps.id?.idType) || ["", "Uploaded"])[1]),
              `<div class="field"><label for="bkIdType">Document type</label><select class="select" id="bkIdType">${ID_TYPES.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></div>
               <div class="field"><span class="t-label" id="bkIdFileL">Photo or PDF of the front side</span>
                 <div class="bk-file"><input class="sr-only" id="bkIdFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" aria-labelledby="bkIdFileL" aria-describedby="bkIdFileN bkIdFileH"><label class="lq lq-s lq-sm" for="bkIdFile">${icon("upload", "ic")}Choose file</label><span class="bk-file-n muted" id="bkIdFileN" data-file-name>No file chosen</span></div>
                 <p class="help" id="bkIdFileH">JPG, PNG, WebP or PDF, up to 10 MB. All four corners in frame.</p></div>
               <p class="err" data-err="id" aria-live="assertive"></p>
               <button class="${saveCls(1)}" type="button" data-save="id">${icon("lock", "ic")}Upload and save</button>${trust}`,
            )}
            ${sec(
              "bank",
              2,
              "Bank account",
              done(steps.bank),
              row("Account", "••••" + (steps.bank?.accountLast4 || "")) +
                row("IFSC", steps.bank?.ifsc || "") +
                row("Holder", steps.bank?.accountHolderName || ""),
              `<div class="field"><label for="bkAcc">Account number</label><input class="input" id="bkAcc" inputmode="numeric" autocomplete="off"></div>
               <div class="field"><label for="bkAcc2">Re-enter account number</label><input class="input" id="bkAcc2" inputmode="numeric" autocomplete="off"></div>
               <div class="field"><label for="bkIfsc">IFSC</label><input class="input bk-caps" id="bkIfsc" maxlength="11" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. HDFC0001234" data-caps></div>
               <div class="field"><label for="bkHolder">Account holder name</label><input class="input" id="bkHolder" autocomplete="organization" value="${esc(steps.bank?.accountHolderName || "")}"><p class="help">Refunds from escrow go back to this account.</p></div>
               <p class="err" data-err="bank" aria-live="assertive"></p>
               <button class="${saveCls(2)}" type="button" data-save="bank">${icon("lock", "ic")}Save bank account</button>${trust}`,
            )}
          </div>
          <p class="profile-formerr" role="alert" data-ferr hidden></p>
          <div class="profile-setup-nav bk-nav${doneN === 3 || locked ? " is-ready" : ""}">
            ${
              st === "verified"
                ? `<button class="lq lq-p" type="button" data-done>${returnTo ? "Back to where you were" : "Go to your dashboard"}</button>`
                : locked
                  ? `<a class="lq lq-s" href="#home">Back to your dashboard</a>`
                  : `<a class="lq lq-s" href="#home">Save and exit</a><button class="lq lq-p" type="button" data-submit ${doneN === 3 ? "" : "disabled"}>${icon("lock", "ic")}Submit for review</button><p class="ll-trust profile-setup-trust">${icon("lock")}Encrypted. Only Linkloom's review team sees this.</p>`
            }
          </div>
        </div>
      </section></div>`;
    L.liquid(el);
    wire();
  };

  const openEdit = new Set();
  const val = id => (el.querySelector("#" + id)?.value || "").trim();
  const busy = async (btn, errKey, job) => {
    const err = el.querySelector(`[data-err="${errKey}"]`) || el.querySelector("[data-ferr]");
    if (err) {
      err.textContent = "";
      err.hidden = false;
    }
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
      await job();
      openEdit.delete(errKey);
      if (alive) paint();
    } catch (e) {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      if (err) err.textContent = w.LLD.live.errorText(e);
    }
  };

  function wire() {
    /* PAN and IFSC are capitals only: change them as they're typed, keeping the cursor where it was */
    el.querySelectorAll("[data-caps]").forEach(i =>
      i.addEventListener("input", () => {
        const at = i.selectionStart;
        const up = i.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (up !== i.value) {
          i.value = up;
          if (at != null) i.setSelectionRange(Math.min(at, up.length), Math.min(at, up.length));
        }
      }),
    );
    /* the styled file picker: show the chosen file's name beside the button */
    el.querySelector("#bkIdFile")?.addEventListener("change", e => {
      const f = e.currentTarget.files?.[0];
      const n = el.querySelector("[data-file-name]");
      if (n) n.textContent = f ? f.name : "No file chosen";
    });
    el.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => {
        openEdit.add(b.dataset.edit);
        paint();
      }),
    );
    el.querySelectorAll("[data-save]").forEach(b =>
      b.addEventListener("click", () => {
        const k = b.dataset.save;
        const err = el.querySelector(`[data-err="${k}"]`);
        if (k === "pan") {
          const pan = val("bkPan").toUpperCase(),
            name = val("bkPanName");
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))
            return void (err.textContent = "A PAN is 5 letters, 4 digits, then 1 letter.");
          if (name.length < 3)
            return void (err.textContent = "Enter the name exactly as it's printed on the PAN.");
          void busy(b, k, () => w.LLD.live.kycPan(pan, name));
        } else if (k === "id") {
          const f = el.querySelector("#bkIdFile")?.files?.[0];
          if (!f) return void (err.textContent = "Choose a photo or PDF of the document.");
          void busy(b, k, () => w.LLD.live.kycId(val("bkIdType"), f));
        } else if (k === "bank") {
          const acc = val("bkAcc").replace(/\s/g, ""),
            ifsc = val("bkIfsc").toUpperCase(),
            holder = val("bkHolder");
          if (!/^\d{9,18}$/.test(acc))
            return void (err.textContent = "Indian account numbers have 9 to 18 digits.");
          if (acc !== val("bkAcc2").replace(/\s/g, ""))
            return void (err.textContent = "The two account numbers don't match.");
          if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))
            return void (err.textContent = "An IFSC is 4 letters, a zero, then 6 letters or digits.");
          if (holder.length < 3) return void (err.textContent = "Enter the name on the bank account.");
          void busy(b, k, () => w.LLD.live.kycBank(holder, acc, ifsc));
        }
      }),
    );
    el.querySelector("[data-submit]")?.addEventListener(
      "click",
      e => void busy(e.currentTarget, "submit", () => w.LLD.live.kycSubmit()),
    );
    el.querySelector("[data-done]")?.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("ll-brand-kyc-return");
      } catch {
        /* ignore */
      }
      w.LLD.go(returnTo || "#home");
    });
  }

  paint();
  w.LLD.live.kyc().then(
    () => alive && paint(),
    () => undefined,
  );
  const off = w.LLD.store.on(why => why === "kyc-live" && alive && paint());
  return () => {
    alive = false;
    off();
  };
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
  w.LLD.register("kyc", { title: "Verify your business", shell: "focus", render });
  w.LLD.kycReviewTime = REVIEW_TIME;
  w.LLD.kycGate = brandKycGate;
  w.LLD.needKyc = needKyc;
}
