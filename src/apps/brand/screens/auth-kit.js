/* The brand sign-in kit (Builder A), shared by the prototype auth screens (auth.jsx) and the profile's sample password
   sheet: rules shown in the UI (the server enforces them in production), the demo's accounts and reset links, the
   screens' remembered state, and LLD.auth (password rules, checks, sign out). In live mode session.js
   replaces LLD.auth.signOut. */
const L = window.LLD,
  { store } = L;
const mo = (k, ...a) => {
  const f = L.motion && L.motion[k];
  if (typeof f === "function") {
    try {
      return f(...a);
    } catch (e) {}
  }
};
const now = () => Date.now();
const COOL = 30,
  MAX_SENDS = 3,
  OTP = "246810",
  OTP_TRIES = 5,
  PW_TRIES = 5,
  PW_LOCK = 15 * 60,
  RESET_TTL = 30 * 60;
const SUPPORT = "support@linkloom.in",
  SAMPLE_EMAIL = "meera@mirevo.in",
  SAMPLE_PW = "Mirevo@2026";
const mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const fmtPhone = d => (d.length > 5 ? d.slice(0, 5) + " " + d.slice(5) : d);
const maskEmail = e => {
  const [u, d] = String(e).split("@");
  return d ? u.slice(0, Math.min(2, u.length)) + "••••@" + d : e;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const vEmail = v => {
  v = v.trim();
  if (!v) return "Enter your work email.";
  return EMAIL_RE.test(v) ? "" : "That email looks incomplete, like name@brand.in.";
};
const vMobile = d => {
  if (!d) return "Enter your mobile number.";
  if (d.length !== 10) return "Enter all 10 digits.";
  return /^[6-9]/.test(d) ? "" : "Indian mobile numbers start with 6, 7, 8 or 9.";
};

/* ---------- accounts known to this demo (the server owns these in production) ---------- */
const ACC = { [SAMPLE_EMAIL]: { pw: SAMPLE_PW, status: "verified", first: false } };
const taken = () => store.s.taken || { emails: [], mobiles: [] };
const emailTaken = e => taken().emails.includes(e.trim().toLowerCase());
const mobileTaken = d => taken().mobiles.includes(d);

/* ---------- password rules (shared with profile and reset; the fields themselves are auth-ui.jsx) ---------- */
const RULES = [
  ["len", "At least 8 characters", v => [...v].length >= 8],
  ["let", "A letter", v => /\p{L}/u.test(v)],
  ["num", "A number", v => /\d/.test(v)],
  ["sym", "A symbol, like @ # or !", v => /[^\p{L}\d\s]/u.test(v)],
];
const pwOk = v => RULES.every(r => r[2](v));
function signOut(opts = {}) {
  store.set(s => {
    s.session.signedIn = false;
    s.session.expired = !!opts.expired;
  }, "signed-out");
  L.closeSheet(true);
  L.go(opts.expired ? "#login-expired" : "#login-out");
}
function checkCurrent(pw) {
  const a = ACC[(store.s.session.email || SAMPLE_EMAIL).toLowerCase()] || ACC[SAMPLE_EMAIL];
  return a.pw === pw;
}
function setPassword(pw, email) {
  const a = ACC[(email || store.s.session.email || SAMPLE_EMAIL).toLowerCase()] || ACC[SAMPLE_EMAIL];
  a.pw = pw;
}

const LS = {
  email: "",
  acct: "returning",
  tries: 0,
  lockEnd: 0,
  remember: true,
  pendCool: 0,
  pendSends: 0,
};
const SAMPLES = {
  returning: ["Returning brand", "verified", false],
  first: ["First sign-in", "verified", true],
  pending: ["Email not verified", "pending", false],
  blocked: ["Blocked", "blocked", false],
};

const STEPS = [
  { t: "Email and mobile", sub: "One email and one mobile number per brand account." },
  { t: "Verify your email", sub: "We sent a link. Open it on any device to confirm the address is yours." },
  { t: "Verify your mobile", sub: "Enter the 6-digit code we texted you." },
  { t: "Create a password", sub: "You'll use it with your email to sign in." },
];
const freshSU = () => ({
  step: 0,
  reached: 0,
  email: "",
  mobile: "",
  emailOk: false,
  mobileOk: false,
  eCool: 0,
  eSends: 0,
  mCool: 0,
  mSends: 0,
  tries: 0,
  terms: false,
  done: false,
});

const FS = { email: "", sent: false, coolEnd: 0, sends: 0 };
const TOK = {}; // token -> { email, issued, used }
const newToken = (email, ageSec = 0) => {
  const t = Math.random().toString(36).slice(2, 10);
  TOK[t] = { email, issued: now() - ageSec * 1000, used: false };
  return t;
};

L.auth = {
  RULES,
  pwOk,
  signOut,
  checkCurrent,
  setPassword,
  maskEmail,
  fmtPhone,
  vEmail,
};
export {
  L,
  store,
  mo,
  now,
  COOL,
  MAX_SENDS,
  OTP,
  OTP_TRIES,
  PW_TRIES,
  PW_LOCK,
  RESET_TTL,
  SUPPORT,
  SAMPLE_EMAIL,
  SAMPLE_PW,
};
export {
  mmss,
  fmtPhone,
  maskEmail,
  vEmail,
  vMobile,
  ACC,
  emailTaken,
  mobileTaken,
  RULES,
  pwOk,
  LS,
  SAMPLES,
  STEPS,
  freshSU,
  FS,
  TOK,
  newToken,
};
export const SU = { cur: null };
