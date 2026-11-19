/* The brand profile kit (Builder A): validators and choices for the profile forms (setup, the edit sheet), the counts
   Home shares (LLD.brandStats), and the complete-profile check before posting a brief (LLD.brandMissing, LLD.needProfile). */
import { CITIES_BY_STATE, OTHER_CITY } from "@/shared/india-cities";

const L = window.LLD,
  { store } = L;
export { CITIES_BY_STATE, OTHER_CITY };
export const ABOUT_MAX = 160;
export const INDUSTRIES = [
  "Skincare",
  "Beauty and cosmetics",
  "Personal care",
  "Fashion",
  "Food and beverage",
  "Health and fitness",
  "Home and decor",
  "Consumer tech",
  "Travel and hospitality",
  "Finance",
  "Education",
  "Gaming",
  "Other",
];
export const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];
const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];
export const href = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
export const initial = n => (String(n || "").trim()[0] || "B").toUpperCase();
export const todayISO = () => new Date(L.today().getTime() + 198e5).toISOString().slice(0, 10);
export const fmtMobile = d => (d ? "+91 " + String(d).slice(0, 5) + " " + String(d).slice(5) : "");
/* place: the state comes first, then that state's cities (or "Other city", typed in) */
export const cityOther = (state, city) => !!city && !!state && !(CITIES_BY_STATE[state] || []).includes(city);

/* ---------- validators ---------- */
export const V = {
  brand: v => {
    v = v.trim();
    if (!v) return "Enter your brand name, as creators should see it.";
    if (v.length < 2) return "Use at least 2 characters.";
    return v.length > 60 ? "Keep it under 60 characters." : "";
  },
  person: v => {
    v = v.trim();
    if (!v) return "Enter the name of the person creators will talk to.";
    if (v.length < 2) return "Use at least 2 letters.";
    return /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(v) ? "" : "Use letters, spaces, dots or hyphens only.";
  },
  website: v => {
    v = v.trim();
    if (!v) return "Add your website, like mirevo.in.";
    try {
      const u = new URL(href(v));
      return /\.[a-z]{2,}$/i.test(u.hostname) ? "" : "That website looks incomplete, like mirevo.in.";
    } catch (e) {
      return "That doesn't look like a website. Try mirevo.in.";
    }
  },
  industry: v => (v ? "" : "Choose the industry closest to yours."),
  legal: v => {
    v = v.trim();
    if (!v) return "Enter the legal name printed on invoices.";
    return v.length < 3 ? "Use the full registered name." : "";
  },
  gstin: v => {
    v = v.trim().toUpperCase();
    if (!v) return "";
    if (v.length !== 15) return `A GSTIN has 15 characters. This one has ${v.length}.`;
    return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)
      ? ""
      : "Check the GSTIN. It looks like 27AABCM1234F1Z5.";
  },
  address: v => {
    v = v.trim();
    if (!v) return "Enter the billing address.";
    if (v.length < 12) return "Add the full address, with street and city.";
    return /\b\d{6}\b/.test(v) ? "" : "Add the 6-digit PIN code.";
  },
  email: v => {
    v = v.trim();
    if (!v) return "Enter the email that should receive invoices.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
      ? ""
      : "That email looks incomplete, like accounts@brand.in.";
  },
  city: v => {
    v = v.trim();
    if (!v) return "Add your city.";
    return /^[\p{L}][\p{L} .'-]{1,40}$/u.test(v) ? "" : "Use the city name only, like Mumbai.";
  },
};
window.LLB = { V, INDUSTRIES, STATES };

/* ---------- counts shared with #home ---------- */
L.brandStats = () => {
  const s = store.s,
    cs = s.campaigns || [];
  const hiredIds = [
    ...new Set(cs.filter(c => LIVE.includes(c.stage) || c.stage === "released").map(c => c.creator)),
  ];
  return {
    hiredIds,
    hired: hiredIds.length,
    active: cs.filter(c => LIVE.includes(c.stage)),
    funded: cs.filter(c => LIVE.includes(c.stage) || ["released", "refunded"].includes(c.stage)).length,
    jobs: (s.jobs || []).filter(j => j.status !== "draft").length,
    drafts: (s.jobs || []).filter(j => j.status === "draft").length,
  };
};

/* ---------- a complete brand profile before posting a brief ---------- */
/** What's still missing from the brand profile, as words for the screen. Only fields the server keeps count. */
L.brandMissing = () => {
  const me = store.s.me || {},
    b = me.billing || {};
  const brand = String(me.brand || "").trim();
  return [
    (!brand || brand === "Your brand") && "brand name",
    !String(me.website || "").trim() && "website",
    !String(me.industry || "").trim() && "industry",
    !String(b.legal || "").trim() && "legal name",
    !String(b.address || "").trim() && "billing address",
  ].filter(Boolean);
};
const listWords = a => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
L.listWords = listWords;
/** True (and off to the profile editor) when the brand profile isn't complete. Comes back to `returnTo` once it is. */
L.needProfile = (returnTo = location.hash) => {
  const miss = L.brandMissing();
  if (!miss.length) return false;
  try {
    sessionStorage.setItem("ll-brand-profile-return", returnTo);
  } catch (e) {
    /* no storage: the brand finds the way back */
  }
  L.toast(`Complete your brand profile first: add your ${listWords(miss)}.`, "alert");
  L.go("#profile-edit");
  return true;
};
