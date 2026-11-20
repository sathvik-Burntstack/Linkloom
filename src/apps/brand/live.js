/* The brand dashboard's connection to the backend. Same pattern as live/creator.ts: load into the store the screens
   already read (window.LLD_DATA), and give the screens actions that talk to the server first.

   Backend → screen vocabulary:
   - campaigns the brand posted        → s.jobs   ("jobs" on screen: briefs creators bid on)
   - bids on those campaigns           → s.bids
   - orders + open/declined offers     → s.campaigns ("campaigns" on screen: each hire, with its stage)
   - public creators                   → s.creators
   - the "Favourites" list             → s.favorites
   - conversations                     → s.threads
   - escrow and release, from orders   → s.payments */
import { api, apiAll, ApiError } from "@/shared/api/client";
import { CITIES_BY_STATE } from "@/shared/india-cities";
import { CREATOR_LANGUAGES } from "@/shared/creator-languages";
import { fetchMe } from "@/shared/api/auth";
import { onLive, startLive } from "@/shared/api/realtime";
import { downloadUrl, openPrivateFile, uploadFile } from "@/shared/api/uploads";
import { payForOrder, PAYMENTS_OFF } from "@/shared/payments/razorpay";
import {
  amount,
  day,
  extras,
  formatOf,
  idOf,
  isoOr,
  listOf,
  nameOf,
  nowIso,
  platformOf,
  settle,
  splitLocation,
  toneOf,
  usageRightsFor,
  usageText,
  isSuspended,
} from "@/shared/live";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the brand screens are still untyped (@ts-nocheck)

const W = window;
const S = () => W.LLD_DATA;
const set = (fn, why) => W.LLD.store.set(fn, why);

let userId = "";
let brandId = "";
let favListId = "";
const ex = () => extras("brand", userId || "anon");

/* ---------- mappers ---------- */

const FORMAT_KEY = {
  Reel: "reel",
  Story: "story",
  Carousel: "carousel",
  Video: "video",
  Short: "short",
};

/** A stored handle can be a full profile link ("https://www.instagram.com/name/"): show "@name" and keep the link. */
function handleAndUrl(rawHandle, rawUrl) {
  let h = String(rawHandle || "").trim();
  let url = String(rawUrl || "").trim();
  if (/^(https?:\/\/)?(www\.)?(instagram\.com|youtube\.com|youtu\.be)\//i.test(h)) {
    url = url || h;
    h =
      h
        .replace(/[?#].*$/, "")
        .replace(/\/+$/, "")
        .split("/")
        .pop() || "";
  }
  h = h.replace(/^@/, "");
  return { handle: h ? "@" + h : "", url };
}

/** Platform rows with handle and profile link. The live API sends `platforms: { instagram?, youtube? }` with handle,
    followersCount, avgViews and engagementRate; the older names (followers, er) and a list of { platform, ... } are
    read too. Without it there is one row for the primary platform and no handle. */
function platformRows(c, primary) {
  const raw = c.platforms;
  const list = Array.isArray(raw)
    ? raw.filter(x => x && typeof x === "object").map(x => [platformOf(x.platform || x.p), x])
    : raw && typeof raw === "object"
      ? Object.entries(raw).filter(([, x]) => x && typeof x === "object")
      : [];
  const rows = list
    .filter(([k]) => k === "instagram" || k === "youtube")
    .map(([k, x]) => {
      const { handle, url } = handleAndUrl(x.handle, x.url);
      return {
        p: k,
        handle,
        url,
        followers: Number(x.followersCount ?? x.followers ?? x.followerCount) || 0,
        er: Number(x.engagementRate ?? x.er) || 0,
        avgViews: Number(x.avgViews) || 0,
      };
    })
    .sort((a, b) => (a.p === primary ? -1 : b.p === primary ? 1 : 0));
  const total = Number(c.followerCount) || 0;
  if (!rows.length) return [{ p: primary, handle: "", url: "", followers: total, er: 0, avgViews: 0 }];
  if (total && !rows.some(r => r.followers)) rows[0].followers = total;
  return rows;
}

const stateNames = new Map(Object.keys(CITIES_BY_STATE).map(name => [name.toLowerCase(), name]));
const languageNames = new Map(CREATOR_LANGUAGES.map(name => [name.toLowerCase(), name]));

export function mapCreator(c) {
  const name = String(c.displayName || c.name || "Creator");
  const location = String(c.location || "").replace(/(?:^|,\s*)India\s*$/i, "").trim();
  const [place, region] = splitLocation(location);
  const stateOnly = !region && stateNames.get(place.toLowerCase());
  const city = String(c.city || (stateOnly ? "" : place)).trim();
  const rawState = String(c.state || region || stateOnly || "").trim();
  let state = stateNames.get(rawState.toLowerCase()) || rawState;
  if (!state || state.toLowerCase() === "india") {
    const matches = Object.entries(CITIES_BY_STATE).filter(([, cities]) =>
      cities.some(name => name.toLowerCase() === city.toLowerCase()),
    );
    state = matches.length === 1 ? matches[0][0] : "";
  }
  const p = platformOf(c.primaryPlatform);
  const rates = {};
  const packages = Array.isArray(c.packages) ? c.packages : [];
  for (const pk of packages) {
    const k = FORMAT_KEY[formatOf(pk.deliverables || pk.title, String(pk.platform || p))];
    const pr = amount(pk.price);
    if (k && pr && (!rates[k] || pr < rates[k])) rates[k] = pr;
  }
  const start = amount(c.startingPrice);
  if (!Object.keys(rates).length && start) rates[p === "youtube" ? "video" : "reel"] = start;
  const gallery = Array.isArray(c.gallery) ? c.gallery : [];
  return {
    id: String(c.id),
    slug: String(c.slug || ""),
    name,
    handle: c.slug ? "@" + String(c.slug).replace(/-[a-z0-9]{6}$/, "") : "",
    tone: toneOf(name),
    city: city || "India",
    state,
    country: "India",
    gender: String(c.gender || ""),
    age: Number(c.age) || "",
    languages: (Array.isArray(c.languages) ? c.languages : [])
      .filter(language => typeof language === "string" && language.trim())
      .map(language => language.trim())
      .map(language => languageNames.get(language.toLowerCase()) || language),
    categories: Array.isArray(c.categories) ? c.categories : [],
    content: Object.keys(rates).map(k => k[0].toUpperCase() + k.slice(1)),
    platforms: platformRows(c, p),
    verified: !!c.verified,
    rating: Number(c.rating) || 0,
    reviews: Number(c.reviewCount) || 0,
    availability: "open",
    rates,
    bio: String(c.bio || ""),
    work: gallery.map(g => ({ brand: "", title: String(g.caption || "Gallery"), views: 0, image: g.url })),
    avatarUrl: String(c.avatarUrl || ""),
    repliesWithin: String(c.repliesWithin || ""),
    packages: packages.map(pk => ({
      id: String(pk.id),
      title: String(pk.title || ""),
      platform: platformOf(pk.platform),
      deliverables: String(pk.deliverables || ""),
      price: amount(pk.price),
      deliveryDays: Number(pk.deliveryDays) || 0,
    })),
  };
}

const JOB_STATUS = {
  open: "open",
  active: "open",
  live: "open",
  closed: "closed",
  awarded: "hired",
  hired: "hired",
  filled: "hired",
  draft: "draft",
};

/** The backend checks every brief before creators see it (moderationStatus "live" once approved).
    Returns "" when approved or unknown, "pending" while waiting, "rejected" when it was turned down. */
export function reviewOf(c) {
  const m = c.moderation || {};
  const st = String(c.moderationStatus || m.status || "").toLowerCase();
  const reason = String(m.reason || c.moderationReason || "");
  if (!st || /^(live|approved|published|ok|passed)$/.test(st)) return { review: "", reviewReason: "" };
  return {
    review: /reject|declin|block|remov|fail|denied/.test(st) ? "rejected" : "pending",
    reviewReason: reason,
  };
}

function mapJob(c, bidCount) {
  const [city] = splitLocation(c.location);
  return {
    ...reviewOf(c),
    id: String(c.id),
    title: String(c.title || ""),
    status: JOB_STATUS[String(c.status || "open").toLowerCase()] || "open",
    platform: platformOf(c.platform),
    format: formatOf(c.deliverables, String(c.platform || "")),
    category: String(c.category || ""),
    budget: amount(c.budgetMax) || amount(c.budgetMin),
    budgetMin: amount(c.budgetMin),
    deadline: day(c.closesAt),
    posted: isoOr(c.createdAt, nowIso()),
    city: city || "Any city",
    remote: !city,
    languages: Array.isArray(c.languages) ? c.languages : [],
    minFollowers: Number(c.minFollowers) || 0,
    deliverables: listOf(c.deliverables),
    usage: usageText(c.usageRights),
    brief: String(c.brief || ""),
    bids: Number(c.bidCount ?? c.bidsCount ?? bidCount) || bidCount,
  };
}

const BID_STATUS = {
  pending: "new",
  submitted: "new",
  open: "new",
  viewed: "viewed",
  shortlisted: "shortlisted",
  selected: "hired",
  accepted: "hired",
  hired: "hired",
  rejected: "declined",
  declined: "declined",
  not_selected: "declined",
  closed: "declined",
};

function mapBid(b, jobId) {
  const st = String(b.status || "pending").toLowerCase();
  if (st === "withdrawn") return null;
  const sent = isoOr(b.createdAt, nowIso());
  const days = Number(b.deliveryDays) || 0;
  const msg = String(b.message || "");
  const [pitch, links = ""] = msg.split(/\n+Similar work:\n/);
  const d = new Date(sent);
  d.setDate(d.getDate() + days);
  return {
    id: String(b.id),
    job: jobId,
    creator: idOf(b.creator) || String(b.creatorId || ""),
    price: amount(b.price),
    status: BID_STATUS[st] || "new",
    sent,
    postDate: days ? d.toISOString().slice(0, 10) : "",
    views: b.expectedViews == null ? 0 : Number(b.expectedViews),
    pitch,
    links: links
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean),
  };
}

function stageOf(status) {
  const s = status.toLowerCase();
  if (/refund|cancel/.test(s)) return "refunded";
  if (/approved|completed|released|paid_out/.test(s)) return "released";
  /* waiting for the brand's payment: checked before "paid" so "unpaid" / "awaiting_payment" never read as funded */
  if (/unpaid|await|pending_pay|payment_pending|to_pay|created/.test(s)) return "accepted";
  if (/revision/.test(s)) return "revision";
  if (/submitted|delivered|in_review/.test(s)) return "submitted";
  if (/progress|started|disput/.test(s)) return "in_progress";
  if (/funded|paid|active|escrow/.test(s)) return "funded";
  return "accepted";
}

function mapOrder(o, deliveries) {
  const camp = o.campaign && typeof o.campaign === "object" ? o.campaign : null;
  const pkg = o.package && typeof o.package === "object" ? o.package : null;
  const status = String(o.status || "");
  const stage = stageOf(status);
  const created = isoOr(o.createdAt, nowIso());
  const funded = o.fundedAt || o.paidAt;
  const deliverablesTxt = o.deliverables ?? camp?.deliverables ?? pkg?.deliverables ?? "";
  const platform = platformOf(o.platform ?? camp?.platform ?? pkg?.platform);
  const dv = deliveries
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((d, i) => ({
      v: i + 1,
      ...deliveryFile(d, i),
      at: isoOr(d.createdAt, created),
      note: String(d.note || ""),
    }));
  const revs = Array.isArray(o.revisions) ? o.revisions : [];
  const log = [[created, "accepted"]];
  if (funded) log.push([funded, "funded"]);
  dv.forEach(d => log.push([d.at, "submitted"]));
  if (stage === "released")
    log.push([isoOr(o.approvedAt || o.completedAt || o.updatedAt, created), "released"]);
  const review = o.review;
  return {
    id: String(o.id),
    creator: idOf(o.creator),
    source: camp || o.campaignId ? "job" : "direct",
    job: idOf(o.campaign) || o.campaignId || null,
    title: String(o.title || camp?.title || pkg?.title || "Order"),
    platform,
    format: formatOf(deliverablesTxt, String(platform)),
    price: amount(o.price ?? o.amount ?? o.total),
    invoiceNo: String(o.invoiceNumber || o.invoiceNo || ""),
    stage,
    status,
    allowed: Array.isArray(o.allowedActions) ? o.allowedActions : [],
    revisionsIncluded: Number(o.revisionsIncluded ?? o.revisionsAllowed ?? 1) || 1,
    revisionsUsed: Number(o.revisionsUsed ?? revs.length) || 0,
    due: day(o.dueAt || o.deadline || o.dueDate || camp?.closesAt),
    funded: funded || (["accepted"].includes(stage) ? undefined : created),
    released: stage === "released" ? isoOr(o.approvedAt || o.completedAt || o.updatedAt, created) : undefined,
    refunded: stage === "refunded" ? isoOr(o.updatedAt, created) : undefined,
    refundReason: String(o.cancelReason || o.reason || ""),
    thread: null,
    deliverables: listOf(deliverablesTxt),
    deliveries: dv,
    revisionNote: String(revs[revs.length - 1]?.feedback || o.revisionFeedback || ""),
    review: review
      ? { rating: Number(review.stars) || 0, text: String(review.text || ""), at: day(review.createdAt) }
      : null,
    log,
  };
}

const OFFER_STAGE = {
  pending: "invited",
  sent: "invited",
  open: "invited",
  rejected: "declined",
  declined: "declined",
  withdrawn: "cancelled",
  expired: "cancelled",
};

function mapOffer(o) {
  const st = String(o.status || "pending").toLowerCase();
  const stage = OFFER_STAGE[st];
  if (!stage) return null; // accepted offers show up as their order
  const at = isoOr(o.createdAt, nowIso());
  const deliverable = String(o.deliverable || "");
  return {
    id: "offer-" + String(o.id),
    offerId: String(o.id),
    creator: idOf(o.creator) || String(o.creatorId || ""),
    source: "direct",
    job: null,
    title: deliverable.split(/[,\n]/)[0] || "Direct offer",
    platform: platformOf(deliverable),
    format: formatOf(deliverable),
    price: amount(o.budget),
    stage,
    revisionsIncluded: 1,
    revisionsUsed: 0,
    due: day(o.deadline),
    thread: null,
    invited: at,
    declined: stage === "declined" ? isoOr(o.updatedAt, at) : undefined,
    cancelled: stage === "cancelled" ? isoOr(o.updatedAt, at) : undefined,
    deliverables: listOf(deliverable),
    log: [[at, "invited"]],
  };
}

function mapThread(c) {
  const party = c.withParty || {};
  const last = c.lastMessage;
  return {
    id: String(c.id),
    campaign: null,
    creator: idOf(party),
    creatorName: nameOf(party, "Creator"),
    creatorImage: String(party.image || party.avatarUrl || ""),
    unread: Number(c.unread) || 0,
    loaded: false,
    messages:
      last && (last.text || last.hasAttachment)
        ? [
            {
              from: last.fromMe ? "brand" : "creator",
              text: String(last.text || "📎 Attachment"),
              at: isoOr(last.sentAt, nowIso()),
            },
          ]
        : [],
  };
}

export function mapMessage(m) {
  const att = m.attachment;
  return {
    id: String(m.id || ""),
    from: m.fromMe ? "brand" : "creator",
    text: String(m.text || ""),
    at: isoOr(m.sentAt, nowIso()),
    ...(att
      ? {
          file: {
            name: att.contentType.startsWith("image/") ? "Image" : "File",
            size: att.size ? Math.round(att.size / 1024) + " KB" : "",
            uploadId: att.uploadId,
          },
        }
      : {}),
  };
}

/** billingAddress is an object on the backend ({} when unset; otherwise line1, line2, city, state, pincode or similar).
    Older rows and the sample data are text. The profile shows one line either way. */
function addressText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v !== "object") return "";
  const r = v;
  const order = [
    "line1",
    "line2",
    "street",
    "area",
    "city",
    "district",
    "state",
    "pincode",
    "postalCode",
    "zip",
    "country",
  ];
  const seen = new Set();
  const parts = [];
  for (const k of [...order, ...Object.keys(r)]) {
    if (seen.has(k)) continue;
    seen.add(k);
    const x = r[k];
    if (typeof x === "string" || typeof x === "number") {
      const t = String(x).trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(", ");
}

/** A creator's pitch to this brand (one per creator; edited at most once). */
export function mapPitch(p) {
  const camp = p.campaign && typeof p.campaign === "object" ? p.campaign : null;
  const status = String(p.status || "sent").toLowerCase();
  return {
    id: String(p.id),
    creator: idOf(p.creator),
    job: camp ? String(camp.id) : String(p.campaignId || "") || null,
    jobTitle: camp ? String(camp.title || "") : "",
    message: String(p.message || ""),
    links: (Array.isArray(p.links) ? p.links : []).map(String).filter(Boolean),
    status: /declin/.test(status)
      ? "declined"
      : /edit/.test(status) || Number(p.editCount) > 0
        ? "edited"
        : "sent",
    edited: Number(p.editCount) > 0 || /edit/.test(status),
    at: isoOr(p.createdAt, nowIso()),
    editedAt: p.editedAt ? isoOr(p.editedAt, nowIso()) : "",
    read: !!p.readAt,
  };
}

const NOTIF_KIND = {
  pitch_received: "bid",
  pitch_edited: "bid",
  bid_received: "bid",
  new_bid: "bid",
  new_message: "message",
  deliverable_submitted: "delivery",
  offer_accepted: "accepted",
  offer_rejected: "declined",
  order_approved: "payment",
  kyc_verified: "accepted",
  kyc_rejected: "declined",
};

function mapNotification(n) {
  const d = n.data || {};
  const type = String(n.type || "");
  const go = type.startsWith("kyc")
    ? "#kyc"
    : type.startsWith("pitch")
      ? "#pitches"
      : type.startsWith("support")
        ? d.ticketId
          ? "#support-" + d.ticketId
          : "#support"
        : d.conversationId
          ? "#chat-" + d.conversationId
          : d.orderId
            ? "#campaign-" + d.orderId
            : d.campaignId
              ? "#job-" + d.campaignId
              : "#home";
  return {
    id: String(n.id),
    kind: NOTIF_KIND[type] || "accepted",
    text: String(n.title || n.text || "Update"),
    at: isoOr(n.createdAt, nowIso()),
    go,
    read: !!n.read,
  };
}

/** GST state codes → state names (the backend stores the code). */
const GST_STATE = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  10: "Bihar",
  11: "Sikkim",
  12: "Arunachal Pradesh",
  13: "Nagaland",
  14: "Manipur",
  15: "Mizoram",
  16: "Tripura",
  17: "Meghalaya",
  18: "Assam",
  19: "West Bengal",
  20: "Jharkhand",
  21: "Odisha",
  22: "Chhattisgarh",
  23: "Madhya Pradesh",
  24: "Gujarat",
  26: "Dadra and Nagar Haveli and Daman and Diu",
  27: "Maharashtra",
  29: "Karnataka",
  30: "Goa",
  31: "Lakshadweep",
  32: "Kerala",
  33: "Tamil Nadu",
  34: "Puducherry",
  35: "Andaman and Nicobar Islands",
  36: "Telangana",
  37: "Andhra Pradesh",
  38: "Ladakh",
};

function mapMe(b, u) {
  const prev = S().me;
  const [city, state] = splitLocation(b.location || b.city);
  return {
    ...prev,
    brand: String(b.name || b.brandName || prev.brand || "Your brand"),
    name: String(u.fullName || prev.name || ""),
    email: String(u.email || prev.email || ""),
    mobile: String(u.phone || "").replace(/^\+91/, ""),
    logo: b.logoUrl || null,
    website: String(b.website || ""),
    industry: String(b.industry || ""),
    city: city || prev.city || "",
    state: state || GST_STATE[String(b.stateCode || "")] || prev.state || "",
    about: String(b.about || b.description || prev.about || ""),
    billing: {
      legal: String(b.legalName || ""),
      gstin: String(b.gstin || ""),
      address: addressText(b.billingAddress),
      email: String(b.billingEmail || u.email || ""),
    },
  };
}

/** A stable document number for a payment row until the backend issues real ones: kind, year, and the deal id.
    LL-INV (paid into escrow), LL-REL (released), LL-CN (credit note for a refund). */
const docNo = (prefix, orderId, date) =>
  `${prefix}-${String(date || "").slice(0, 4) || new Date().getFullYear()}-${String(orderId)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase()}`;

/** Escrow rows come from the orders: paid in when funded, released on approval, refunded on cancellation. */
function payments(camps) {
  const out = [];
  for (const c of camps) {
    if (!c.funded || String(c.id).startsWith("offer-")) continue;
    out.push({
      id: "p-" + c.id,
      date: day(c.funded),
      kind: "escrow",
      campaign: c.id,
      creator: c.creator,
      amount: c.price,
      status: c.stage === "released" ? "released" : c.stage === "refunded" ? "refunded" : "held",
      method: "Escrow",
      invoice: c.invoiceNo || docNo("LL-INV", c.id, day(c.funded)),
    });
    if (c.stage === "released")
      out.push({
        id: "r-" + c.id,
        date: day(c.released),
        kind: "release",
        campaign: c.id,
        creator: c.creator,
        amount: c.price,
        status: "released",
        method: "From escrow",
        invoice: docNo("LL-REL", c.id, day(c.released)),
      });
    if (c.stage === "refunded")
      out.push({
        id: "f-" + c.id,
        date: day(c.refunded),
        kind: "refund",
        campaign: c.id,
        creator: c.creator,
        amount: c.price,
        status: "refunded",
        method: "To your account",
        invoice: docNo("LL-CN", c.id, day(c.refunded)),
      });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ---------- loading ---------- */

/* Which API fields each mapped creator field comes from. Bids and orders carry only a short creator reference
   ({id, displayName, slug}); merging that must not reset what the full row said (city to "India", followers to 0),
   or brands see a different profile from the one the creator sees (C6). */
const CREATOR_SOURCE = {
  city: ["location"],
  state: ["location"],
  gender: ["gender"],
  age: ["age"],
  languages: ["languages"],
  categories: ["categories"],
  content: ["packages", "startingPrice"],
  rates: ["packages", "startingPrice"],
  packages: ["packages"],
  platforms: ["platforms", "followerCount"],
  verified: ["verified"],
  rating: ["rating"],
  reviews: ["reviewCount"],
  bio: ["bio"],
  work: ["gallery"],
  avatarUrl: ["avatarUrl"],
  repliesWithin: ["repliesWithin"],
};

function addCreators(s, rows) {
  for (const r of rows) {
    if (!r || !r.id) continue;
    const c = mapCreator(r);
    const i = s.creators.findIndex(x => x.id === c.id);
    if (i < 0) {
      s.creators.push(c);
      continue;
    }
    const merged = { ...s.creators[i], ...c };
    for (const [k, from] of Object.entries(CREATOR_SOURCE))
      if (!from.some(f => f in r && r[f] != null)) merged[k] = s.creators[i][k];
    s.creators[i] = merged;
  }
}

export async function loadBrandGuest() {
  const creators = await apiAll("/v1/creators/", { auth: false }).catch(() => []);
  set(s => {
    s.creators = [];
    addCreators(
      s,
      creators.filter(c => !isSuspended(c)),
    );
  }, "live-loaded");
}

export async function loadBrand() {
  /* Everything is asked for at once: the account check no longer holds the other requests back. */
  const me = fetchMe();
  const errors = [];
  const wave = Promise.all([
    settle(api("/v1/brands/me/"), {}, "profile", errors),
    settle(api("/v1/kyc/"), null, "kyc", errors),
    settle(apiAll("/v1/creators/"), [], "creators", errors),
    settle(apiAll("/v1/campaigns/"), [], "jobs", errors),
    settle(apiAll("/v1/offers/"), [], "offers", errors),
    settle(apiAll("/v1/orders/"), [], "orders", errors),
    settle(apiAll("/v1/conversations/"), [], "messages", errors),
    settle(apiAll("/v1/notifications/", {}, 100), [], "notifications", errors),
    settle(apiAll("/v1/lists/"), [], "lists", errors),
    /* pitches: null until the backend has the endpoint (then the Pitches screen says it opens soon) */
    apiAll("/v1/brands/me/pitches/").catch(() => null),
  ]);
  const user = await me;
  userId = user.id;
  if (user.role !== "brand") return user;
  const [bme, kyc, creators, camps, offers, orders, convs, notifs, lists, pitchRows] = await wave;
  brandId = String(bme.id || "");
  /* only this brand's own briefs: the list endpoint may also return other brands' open briefs */
  const mine = camps.filter(c => !c.brand || !brandId || idOf(c.brand) === brandId);
  const [bidsBy, deliveriesBy, favList] = await Promise.all([
    Promise.all(mine.map(c => apiAll(`/v1/campaigns/${c.id}/bids/`).catch(() => []))),
    Promise.all(orders.map(o => apiAll(`/v1/orders/${o.id}/deliverables/`).catch(() => []))),
    favouritesList(lists),
  ]);
  const x = ex().get();
  set(s => {
    s.session.signedIn = true;
    s.session.guest = false;
    s.session.status = "verified";
    s.session.email = user.email || "";
    s.session.firstRun = !!user.needsOnboarding;
    s.me = mapMe(bme, user);
    s.kyc = kyc ? { ...kyc } : { status: user.kycStatus || "not_started", steps: {} };
    s.creators = [];
    addCreators(
      s,
      creators.filter(c => !isSuspended(c)),
    );
    const bidRows = [];
    mine.forEach((c, i) => {
      for (const b of bidsBy[i]) {
        if (b.creator && typeof b.creator === "object") addCreators(s, [b.creator]);
        const m = mapBid(b, String(c.id));
        if (m) bidRows.push(m);
      }
    });
    /* drafts never reach the server: keep the ones in memory and the ones saved on this device */
    const drafts = [...(s.jobs || []), ...(x.drafts || [])].filter(j => j && j.status === "draft");
    const seen = new Set();
    s.jobs = mine
      .map((c, i) => mapJob(c, bidsBy[i].filter(b => String(b.status) !== "withdrawn").length))
      .concat(drafts.filter(j => !seen.has(j.id) && seen.add(j.id)));
    s.bids = bidRows;
    const campaignRows = orders.map((o, i) => {
      if (o.creator && typeof o.creator === "object") addCreators(s, [o.creator]);
      return mapOrder(o, deliveriesBy[i]);
    });
    for (const o of offers) {
      if (o.creator && typeof o.creator === "object") addCreators(s, [o.creator]);
      const m = mapOffer(o);
      if (m) campaignRows.push(m);
    }
    s.campaigns = campaignRows;
    s.threads = convs.map(mapThread);
    linkThreads(s);
    s.pitchesOn = !!pitchRows;
    s.pitches = (pitchRows || [])
      .filter(p => !isSuspended(p.creator))
      .map(p => {
        if (p.creator && typeof p.creator === "object") addCreators(s, [p.creator]);
        return mapPitch(p);
      });
    s.payments = payments(s.campaigns);
    s.notifications = notifs.map(mapNotification);
    s.favorites = favList.ids;
    s.cart = (x.cart || []).filter(id => s.creators.some(c => c.id === id));
    if (x.budget) s.budget = x.budget;
    s.payMethods = [];
    s.plan = null;
  }, "live-loaded");
  favListId = favList.id;
  if (errors.length) console.warn("Some sections could not load:", errors.join(", "));
  startLive();
  wireLive();
  return user;
}

/** A delivery's file, read leniently: the upload may come as an id, a nested object or a ready link. */
function deliveryFile(d, i) {
  const f = [d.file, d.fileUpload, d.upload, d.attachment].find(x => x && typeof x === "object");
  const str = (...v) => String(v.find(x => typeof x === "string" && x) || "");
  const uploadId =
    str(
      d.fileUploadId,
      d.file_upload_id,
      d.uploadId,
      d.upload_id,
      typeof d.file === "string" ? d.file : "",
      typeof d.fileUpload === "string" ? d.fileUpload : "",
    ) || (f ? str(f.uploadId, f.upload_id, f.fileUploadId, f.id) : "");
  let url = str(d.contentUrl, d.content_url, d.url, d.fileUrl, d.downloadUrl, f && f.url, f && f.downloadUrl);
  let deepId = "";
  if (!uploadId && !url) {
    /* unknown shape: look through the record (one level of nesting) for a file id or a link under a file-like key */
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const FILEY = /file|upload|media|attach|asset|video|image|content|document|storage|path|link|url/i;
    const scan = (o, depth) => {
      for (const [k, v] of Object.entries(o)) {
        if (/^(id|order|orderId|creator|brand|createdAt|updatedAt)$/i.test(k)) continue;
        if (typeof v === "string" && FILEY.test(k)) {
          if (!url && /^https?:\/\//.test(v)) url = v;
          else if (!deepId && UUID.test(v)) deepId = v;
        } else if (v && typeof v === "object" && !Array.isArray(v) && depth < 1 && FILEY.test(k)) {
          const n = v;
          if (!deepId && typeof n.id === "string" && UUID.test(n.id)) deepId = n.id;
          scan(n, depth + 1);
        }
      }
    };
    scan(d, 0);
    if (!url && !deepId)
      console.warn("Linkloom: delivery has no file field. Fields sent:", Object.keys(d).join(", "), d);
  }
  const contentType = str(d.contentType, d.content_type, d.mimeType, f && f.contentType, f && f.content_type);
  const name = str(d.fileName, d.file_name, f && f.fileName, f && f.name, f && f.originalName);
  const upId = uploadId || deepId;
  return {
    file: name || (url && !upId ? url.replace(/^https?:\/\//, "").split("?")[0] : `delivery-v${i + 1}`),
    uploadId: upId,
    url,
    contentType,
  };
}

/** There is one conversation per brand and creator: every campaign with that creator uses it, and the thread
    shows the newest one. */
function linkThreads(s) {
  for (const t of s.threads) {
    const mine = s.campaigns
      .filter(x => x.creator === t.creator && !String(x.id).startsWith("offer-"))
      .sort((a, b) => String(b.log?.[0]?.[0] || "").localeCompare(String(a.log?.[0]?.[0] || "")));
    const c = mine[0];
    t.campaign = c ? c.id : null;
    mine.forEach(x => (x.thread = t.id));
    const known = s.creators.find(x => x.id === t.creator);
    if (!known)
      s.creators.push(mapCreator({ id: t.creator, displayName: t.creatorName, avatarUrl: t.creatorImage }));
    else if (!known.avatarUrl && t.creatorImage) known.avatarUrl = t.creatorImage;
  }
}

async function favouritesList(lists) {
  let fav = lists.find(l => /^favou?rites$/i.test(String(l.name)));
  if (!fav) return { id: "", ids: [] };
  if (!Array.isArray(fav.creators)) fav = await api(`/v1/lists/${fav.id}/`).catch(() => fav);
  const ids = (Array.isArray(fav.creators) ? fav.creators : []).map(c =>
    typeof c === "string" ? c : idOf(c.creator || c),
  );
  return { id: String(fav.id), ids };
}

let wired = false;
function wireLive() {
  if (wired) return;
  wired = true;
  onLive(e => {
    if (e.event === "connected") return void refresh();
    if (e.event === "new_message") {
      const m = mapMessage(e.message);
      set(s => {
        const t = s.threads.find(x => x.id === e.conversationId);
        if (!t) return void refreshThreads();
        if (m.id && t.messages.some(x => x.id === m.id)) return;
        if (m.from === "brand") {
          const mine = t.messages.find(x => x.from === "brand" && !x.id && x.text === m.text);
          if (mine) return void (mine.id = m.id);
        }
        t.messages.push(m);
        if (m.from !== "brand") t.unread = (t.unread || 0) + 1;
      }, "chat-live");
      return;
    }
    if (e.event === "notification") {
      const n = mapNotification(e.notification);
      set(s => {
        if (!s.notifications.some(x => x.id === n.id)) s.notifications.unshift(n);
      }, "notif-live");
      void refresh();
    }
  });
}

async function refreshThreads() {
  const convs = await apiAll("/v1/conversations/");
  set(s => {
    const old = new Map(s.threads.map(t => [t.id, t]));
    s.threads = convs.map(c => {
      const t = mapThread(c);
      const o = old.get(t.id);
      if (o?.loaded) {
        t.messages = o.messages;
        t.loaded = true;
      }
      return t;
    });
    linkThreads(s);
  }, "chat-live");
}

/** Reloads everything the other side can change. Cheap enough at this size. */
export async function refresh() {
  try {
    await loadBrand();
    set(() => undefined, "live-refresh");
  } catch {
    /* the next live event or reload tries again */
  }
}

/* ---------- actions ---------- */

/* what the API's field names mean on screen, for "Invalid input." with details */
const FIELD_LABEL = {
  title: "Title",
  brief: "The brief",
  platform: "Platform",
  deliverables: "Deliverables",
  budgetMin: "Budget",
  budgetMax: "Budget",
  budget: "Budget",
  closesAt: "Live-by date",
  deadline: "Date",
  usageRights: "Usage rights",
  message: "Message",
  creatorId: "Creator",
  deliverable: "Deliverable",
};

export function errorText(e) {
  if (e instanceof ApiError) {
    if (e.code === "KYC_REQUIRED") return "Verify your business first. It takes a few minutes.";
    /* name the field the server refused instead of a bare "Invalid input." */
    const d = e.details;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      for (const [k, v] of Object.entries(d)) {
        const first = Array.isArray(v)
          ? v.find(x => typeof x === "string")
          : typeof v === "string"
            ? v
            : null;
        const nested =
          !first && v && typeof v === "object"
            ? Object.values(v)
                .flat()
                .find(x => typeof x === "string")
            : null;
        const msg = first || nested;
        if (msg) return `${FIELD_LABEL[k] || k}: ${String(msg).replace(/\.$/, "")}.`;
      }
    }
    return e.message;
  }
  return e?.message || "Something went wrong. Please try again.";
}
export const isKycRequired = e => e instanceof ApiError && e.code === "KYC_REQUIRED";

/* the API takes usage rights as an object; the form keeps the chosen label */
const usageFor = usageRightsFor;

export const brandApi = {
  errorText,
  isKycRequired,
  refresh,
  PAYMENTS_OFF,

  /* escrow: Razorpay Checkout for an accepted deal (order). The secret key stays on the backend. */
  async payEscrow(orderId, description) {
    const me = W.LLD_DATA.me || {};
    const r = await payForOrder({
      orderId,
      description,
      prefill: { name: String(me.name || me.brand || ""), email: String(me.email || "") },
    });
    if (r.status === "paid") await refresh().catch(() => undefined);
    return r;
  },

  /* creators */
  async creatorDetail(id) {
    const [c, reviews] = await Promise.all([
      api(`/v1/creators/${id}/`),
      apiAll(`/v1/creators/${id}/reviews/`, {}, 50).catch(() => []),
    ]);
    set(s => {
      addCreators(s, [c]);
      const cc = s.creators.find(x => x.id === id);
      if (cc)
        cc.reviewList = reviews.map(r => ({
          brand: nameOf(r.brand || r.author, "Brand"),
          rating: Number(r.stars) || 0,
          text: String(r.text || ""),
          at: day(r.createdAt),
        }));
    }, "live-refresh");
  },

  async setFavorite(creatorId, on) {
    if (!favListId)
      favListId = String((await api("/v1/lists/", { method: "POST", body: { name: "Favourites" } })).id);
    if (on) await api(`/v1/lists/${favListId}/creators/`, { method: "POST", body: { creatorId } });
    else await api(`/v1/lists/${favListId}/creators/${creatorId}/`, { method: "DELETE" });
  },

  saveCart(ids) {
    ex().set({ cart: ids });
  },
  saveBudget(b) {
    ex().set({ budget: b });
  },
  saveDrafts(jobs) {
    ex().set({ drafts: jobs.filter(j => j.status === "draft") });
  },

  /* jobs (briefs) */
  async postJob(rec, existingId) {
    const body = {
      title: rec.title,
      brief: rec.brief,
      platform: rec.platform,
      deliverables: (rec.deliverables || []).join(" + "),
      budgetMin: Math.round(rec.budget * 0.8),
      budgetMax: rec.budget,
      closesAt: rec.deadline,
      usageRights: usageFor(rec.usage),
    };
    const r = existingId
      ? await api(`/v1/campaigns/${existingId}/`, { method: "PATCH", body })
      : await api("/v1/campaigns/", { method: "POST", body });
    return String(r.id);
  },
  async closeJob(id) {
    await api(`/v1/campaigns/${id}/close/`, { method: "POST" });
  },
  async selectBid(jobId, bidId) {
    await api(`/v1/campaigns/${jobId}/bids/${bidId}/select/`, { method: "POST" });
    await refresh();
  },

  /* direct offers (the hiring cart) */
  async sendOffer(o) {
    await api("/v1/offers/", { method: "POST", body: { ...o, usageRights: usageRightsFor(o.usageRights) } });
  },
  async withdrawOffer(offerId) {
    await api(`/v1/offers/${offerId}/withdraw/`, { method: "POST" });
  },

  /* orders (campaigns on screen) */
  async approve(orderId) {
    await api(`/v1/orders/${orderId}/approve/`, { method: "POST" });
  },
  async requestRevision(orderId, feedback) {
    await api(`/v1/orders/${orderId}/revisions/`, { method: "POST", body: { feedback } });
  },
  async review(orderId, stars, text) {
    await api(`/v1/orders/${orderId}/review/`, { method: "POST", body: { stars, text } });
  },
  async cancelOrder(orderId, reason) {
    await api(`/v1/orders/${orderId}/cancel/`, { method: "POST", body: { reason } });
  },
  async dispute(orderId, reason) {
    await api(`/v1/orders/${orderId}/disputes/`, { method: "POST", body: { reason } });
  },
  async openDelivery(d) {
    if (d.uploadId) return openPrivateFile(d.uploadId);
    if (d.url) window.open(d.url, "_blank", "noopener");
    else
      throw new ApiError(
        404,
        "This file isn't available yet. Ask the creator to send it again.",
        "FILE_MISSING",
      );
  },
  /** A link to show or save a delivery: a fresh 5-minute link for uploaded files, the creator's link otherwise. */
  async deliveryLink(d) {
    if (d.uploadId) return { url: (await downloadUrl(d.uploadId)).url, uploaded: true };
    if (d.url) return { url: d.url, uploaded: false };
    throw new ApiError(
      404,
      "This file isn't available yet. Ask the creator to send it again.",
      "FILE_MISSING",
    );
  },

  /* messages */
  async loadThread(id) {
    const msgs = await apiAll(`/v1/conversations/${id}/messages/`, {}, 300);
    set(s => {
      const t = s.threads.find(x => x.id === id);
      if (!t) return;
      t.messages = msgs.map(mapMessage).reverse();
      t.loaded = true;
    }, "chat-loaded");
  },
  async sendMessage(id, text, file) {
    const attachmentUploadId = file ? (await uploadFile("chat_attachment", file)).id : undefined;
    const r = await api(`/v1/conversations/${id}/messages/`, {
      method: "POST",
      body: { ...(text ? { text } : {}), ...(attachmentUploadId ? { attachmentUploadId } : {}) },
    });
    return mapMessage({ ...r, fromMe: true });
  },
  async markRead(id) {
    await api(`/v1/conversations/${id}/read/`, { method: "POST" });
  },
  async readPitch(id) {
    await api(`/v1/pitches/${id}/read/`, { method: "POST" });
  },
  async declinePitch(id) {
    await api(`/v1/pitches/${id}/decline/`, { method: "POST" });
    set(s => {
      const p = (s.pitches || []).find(x => x.id === id);
      if (p) p.status = "declined";
    }, "pitch-declined");
  },
  async openChatWith(creatorId) {
    const r = await api("/v1/conversations/", { method: "POST", body: { creatorId } });
    await refreshThreads();
    return String(r.id);
  },

  /* notifications */
  async readNotification(id) {
    await api(`/v1/notifications/${id}/read/`, { method: "PATCH" });
  },
  async readAllNotifications() {
    await api("/v1/notifications/read-all/", { method: "POST" });
  },

  /* brand profile */
  async saveBrand(me) {
    const body = {
      name: me.brand,
      website: me.website ? (/^https?:/.test(me.website) ? me.website : "https://" + me.website) : "",
      industry: me.industry || "",
      legalName: me.billing?.legal || "",
      gstin: me.billing?.gstin || "",
      billingAddress: me.billing?.address || "",
    };
    const sc = String(me.billing?.gstin || "").slice(0, 2);
    if (/^\d{2}$/.test(sc)) body.stateCode = sc;
    await api("/v1/brands/me/", { method: "PATCH", body });
  },
  async uploadLogo(file) {
    return (await uploadFile("brand_logo", file)).url;
  },

  /* KYC */
  async kyc() {
    const k = await api("/v1/kyc/");
    set(s => (s.kyc = k), "kyc-live");
    return k;
  },
  async kycPan(pan, nameOnPan) {
    const k = await api("/v1/kyc/pan/", { method: "PUT", body: { pan: pan.toUpperCase(), nameOnPan } });
    set(s => (s.kyc = k), "kyc-live");
  },
  async kycId(idType, file) {
    const up = await uploadFile("kyc_document", file);
    const k = await api("/v1/kyc/id/", { method: "PUT", body: { idType, uploadId: up.id } });
    set(s => (s.kyc = k), "kyc-live");
  },
  async kycBank(accountHolderName, accountNumber, ifsc) {
    const k = await api("/v1/kyc/bank/", {
      method: "PUT",
      body: { accountHolderName, accountNumber, ifsc: ifsc.toUpperCase() },
    });
    set(s => (s.kyc = k), "kyc-live");
  },
  async kycSubmit() {
    const k = await api("/v1/kyc/submit/", { method: "POST" });
    set(s => (s.kyc = k), "kyc-live");
  },
};
