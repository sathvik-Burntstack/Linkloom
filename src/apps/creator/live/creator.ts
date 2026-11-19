/* The creator dashboard's connection to the backend.
   - emptyCreatorState(): what the app starts from (no sample rows).
   - loadCreator(): fills the store from the API, slice by slice, and keeps it current over the live socket.
   - creatorApi: the actions the screens call. Each one talks to the server first and only then changes the store,
     so the screen never shows something the server refused. */
import { api, apiAll, ApiError, storedUser, type ApiUser } from "@/shared/api/client";
import { fetchMe } from "@/shared/api/auth";
import { onLive, startLive, type LiveEvent } from "@/shared/api/realtime";
import { uploadFile, type UploadedFile } from "@/shared/api/uploads";
import type {
  ActiveJob,
  Bid,
  BidStatus,
  Job,
  Kyc,
  KycStatus,
  LedgerEntry,
  Me,
  Message,
  Notification,
  StartPrice,
  State,
  Thread,
  WorkStage,
} from "@/apps/creator/types";
import {
  addDaysIso,
  amount,
  day,
  daysUntil,
  extras,
  formatOf,
  idOf,
  initialsOf,
  isoOr,
  listOf,
  nameOf,
  nowIso,
  platformOf,
  settle,
  splitLocation,
  todayIst,
  toneOf,
  usageText,
} from "../../../shared/live";
import { KYC_AFTER_ACCEPT, kycOwedFor } from "../flags"; // not core/kyc-gate: that imports the store (cycle)

/* ---------- backend rows (only the fields the app reads) ---------- */

type Obj = Record<string, unknown>;

export interface ApiCampaign extends Obj {
  id: string;
  title: string;
  brief: string | null;
  platform: string;
  deliverables: string;
  budgetMin: { amount: number } | number;
  budgetMax: { amount: number } | number;
  closesAt: string;
  status: string;
  usageRights: unknown;
  brand: Obj | null;
  createdAt: string;
}

/** What the creator keeps on this device because the backend has no field for it yet: private details brands never
    see, and list helpers. Everything a brand sees about the creator (platforms, handles, followers, languages, city)
    is read from and saved to /v1/creators/me/ only, so the own profile, "See what brands see" and the brand's
    #creator-<id> show the same values (C6).
    TODO(backend): date of birth, gender and portfolio links on /v1/creators/me/. */
export interface CreatorExtras {
  dob: string;
  gender: string;
  portfolio: Me["portfolio"];
  hiddenJobs: string[];
  saved: string[];
}

/** Keys earlier builds kept on the device for profile fields brands see. Dropped on load, never read (C6). */
const DEVICE_ONLY_RETIRED = ["languages", "region", "platforms"] as const;

/** A bid with the brand's reply. `status` stays one of the six the screens key off; "shortlisted" is a flag on a
    viewed bid so Find briefs and Home keep working unchanged.
    TODO(backend): record brand view/shortlist/decline on bids and send a notification the same day. */
export type LiveBid = Bid & { shortlisted?: boolean };

/* ---------- the empty state ---------- */

export function emptyCreatorState(): State {
  return {
    session: { signedIn: false, method: "mobile", email: "", mobile: "", firstLogin: false },
    me: {
      name: "",
      handle: "",
      city: "",
      region: "",
      dob: "",
      gender: "",
      languages: [],
      categories: [],
      bio: "",
      photo: null,
      platforms: {},
      audienceGeo: [],
      completedJobs: 0,
      totalBids: 0,
      portfolio: [],
      reviews: [],
    },
    kyc: {
      status: "not_started",
      step: 0,
      returnTo: null,
      pan: "",
      panName: "",
      idType: "Aadhaar",
      payoutMethod: "bank",
      upi: "",
      bank: { acc: "", ifsc: "", holder: "" },
      gst: "",
      note: "",
    },
    jobs: [],
    saved: [],
    bids: [],
    active: [],
    threads: [],
    ledger: [],
    readyToWithdraw: 0,
    plan: null,
    withdrawals: [],
    notifications: [],
    jobsUI: {
      q: "",
      city: "",
      platform: "",
      category: "",
      minBudget: 0,
      sort: "newest",
      savedOnly: false,
      showHidden: false,
    },
    hiddenJobs: [],
    reports: [],
    bidDrafts: {},
    justSent: null,
    bidRules: { minPaise: 100000, overBudgetPct: 25, whyMin: 40, whyMax: 500, maxLinks: 5 },
    payoutMethods: [],
    workUI: { activeFilter: "all", earnRange: "fy", earnFilter: "all" },
  };
}

/* ---------- mappers ---------- */

const BID_STATUS: Record<string, BidStatus> = {
  pending: "submitted",
  submitted: "submitted",
  open: "submitted",
  active: "submitted",
  viewed: "viewed",
  shortlisted: "viewed",
  selected: "accepted",
  accepted: "accepted",
  hired: "accepted",
  rejected: "rejected",
  declined: "rejected",
  not_selected: "rejected",
  closed: "rejected",
  withdrawn: "withdrawn",
  completed: "completed",
};

const KYC_STATUS: Record<string, KycStatus> = {
  not_started: "not_started",
  in_progress: "in_progress",
  pending: "under_review",
  verified: "verified",
  rejected: "action_needed",
};

/** Order status → the work board's stage. Payment is tracked separately. */
function stageOf(status: string): WorkStage {
  const s = status.toLowerCase();
  if (/revision/.test(s)) return "revision";
  if (/submitted|delivered|in_review/.test(s)) return "submitted";
  if (/approved|completed|released|paid_out/.test(s)) return "approved";
  if (/progress|started|funded|active|paid|accepted/.test(s)) return "in_progress";
  return "kickoff";
}

export function mapJob(c: ApiCampaign, me?: Me): Job {
  const brand = nameOf(c.brand, "Brand on Linkloom");
  const platform = platformOf(c.platform);
  const category = String((c.category as string) || (c.categories as string[] | undefined)?.[0] || "");
  const [city] = splitLocation(c.location);
  const languages = Array.isArray(c.languages) ? (c.languages as string[]) : [];
  const j: Job = {
    id: c.id,
    brand,
    bi: initialsOf(brand),
    tone: toneOf(brand),
    title: c.title || "Untitled brief",
    platform,
    format: formatOf(c.deliverables, c.platform),
    category,
    budget: amount(c.budgetMax as never) || amount(c.budgetMin as never),
    deadline: day(c.closesAt),
    city: city || "Any city",
    remote: !city,
    languages,
    bids: Number(c.bidCount ?? c.bidsCount ?? c.bids ?? 0) || 0,
    posted: isoOr(c.createdAt, nowIso()),
    match: 0,
    reasons: [],
    deliverables: listOf(c.deliverables),
    brief: c.brief || "",
    min: c.minFollowers ? `Min ${Number(c.minFollowers).toLocaleString("en-IN")} followers` : "",
    usage: usageText(c.usageRights),
  };
  if (c.status && !/open|active|live/i.test(String(c.status))) j.status = "hired";
  if (me) scoreJob(j, me);
  return j;
}

/** A simple, explainable match score from what the creator told us. */
function scoreJob(j: Job, me: Me): void {
  const reasons: string[] = [];
  let score = 40;
  if (j.category && me.categories.some(c => c.toLowerCase() === j.category.toLowerCase())) {
    score += 30;
    reasons.push(`${j.category} is one of your categories`);
  }
  if (me.platforms[j.platform]) {
    score += 15;
    reasons.push(`You post on ${j.platform === "youtube" ? "YouTube" : "Instagram"}`);
  }
  const langs = j.languages.filter(l => me.languages.includes(l));
  if (langs.length) {
    score += 10;
    reasons.push(`You post in ${langs.join(" and ")}`);
  }
  if (j.remote) {
    score += 5;
    reasons.push("Open to any city");
  } else if (me.city && j.city.toLowerCase() === me.city.toLowerCase()) {
    score += 5;
    reasons.push(`${j.city}-based creators preferred`);
  }
  j.match = Math.min(99, score);
  j.reasons = reasons;
}

export function mapBid(b: Obj, jobs: Job[]): LiveBid {
  const camp = (b.campaign && typeof b.campaign === "object" ? b.campaign : null) as ApiCampaign | null;
  const jobId = idOf(b.campaign) || String(b.campaignId || "");
  const j = jobs.find(x => x.id === jobId);
  const raw = String(b.status || "pending").toLowerCase();
  let status = BID_STATUS[raw] || "submitted";
  /* the brand's reply: a status of its own, or a timestamp on a bid that is otherwise still pending */
  const shortlisted = raw === "shortlisted" || b.shortlisted === true || !!b.shortlistedAt;
  if (status === "submitted" && (shortlisted || b.viewedAt || b.viewed === true)) status = "viewed";
  const brand = j?.brand || nameOf(camp?.brand, "") || nameOf(b.brand, "") || "The brand";
  const sent = isoOr(b.createdAt || b.sentAt, nowIso());
  const deliveryDays = Number(b.deliveryDays) || 0;
  const message = String(b.message || "");
  const out: LiveBid = {
    id: String(b.id),
    job: jobId,
    price: amount(b.price as never),
    status,
    sent,
    note:
      status === "submitted"
        ? "Waiting for the brand to review."
        : status === "viewed"
          ? shortlisted
            ? "You're shortlisted. The brand is choosing now."
            : `${brand} viewed your bid.`
          : status === "accepted"
            ? "The brand picked your bid."
            : status === "rejected"
              ? "Not selected this time. The brand went with another creator."
              : status === "withdrawn"
                ? "You withdrew this bid."
                : "",
    postDate: deliveryDays ? addDaysIso(sent, deliveryDays) : j?.deadline || day(sent),
    views: b.expectedViews == null ? null : Number(b.expectedViews),
    why: message,
  };
  if (!j && camp) {
    const mj = mapJob(camp);
    out.brand = mj.brand;
    out.title = mj.title;
    out.platform = mj.platform;
    out.format = mj.format;
  } else if (!j) {
    out.brand = nameOf(b.brand, "Brand");
    out.title = String(b.campaignTitle || b.title || "Brief");
    out.platform = platformOf(b.platform);
    out.format = formatOf(b.deliverables, String(b.platform || ""));
  }
  if (status === "withdrawn") {
    out.by = "you";
    out.at = isoOr(b.updatedAt, sent);
  }
  if (status === "viewed" && shortlisted) out.shortlisted = true;
  return out;
}

export function mapOrder(o: Obj): ActiveJob {
  const camp = (o.campaign && typeof o.campaign === "object" ? o.campaign : {}) as Obj;
  const brand = nameOf(o.brand || camp.brand, "Brand");
  const status = String(o.status || "");
  const deliverablesTxt = o.deliverables ?? camp.deliverables ?? (o.package as Obj | undefined)?.deliverables;
  const platform = platformOf(o.platform ?? camp.platform ?? (o.package as Obj | undefined)?.platform);
  const created = isoOr(o.createdAt, nowIso());
  const funded = isoOr(o.fundedAt || o.paidAt, created);
  const due =
    day(o.dueAt || o.deadline || o.dueDate || camp.closesAt) ||
    addDaysIso(created, Number(o.deliveryDays) || 7);
  const stage = stageOf(status);
  const released = /approved|completed|released/.test(status.toLowerCase());
  const a: ActiveJob = {
    id: String(o.id),
    job: idOf(o.campaign) || "",
    brand,
    title: String(o.title || camp.title || (o.package as Obj | undefined)?.title || "Order"),
    platform,
    format: formatOf(deliverablesTxt, String(platform)),
    price: amount((o.price ?? o.amount ?? o.total) as never),
    stage,
    pay: released ? "released" : "escrow",
    due,
    uploads: [],
    deliverables: listOf(typeof deliverablesTxt === "string" ? deliverablesTxt : ""),
    thread: "",
    revisionsIncluded: Number(o.revisionsIncluded ?? o.revisionsAllowed ?? 1) || 1,
    brief: String(o.brief || camp.brief || ""),
    usage: usageText(o.usageRights ?? camp.usageRights),
    languages: [],
    accepted: created,
    funded,
    draftDue: due,
    log: [
      { at: created, kind: "accepted" },
      { at: funded, kind: "funded" },
    ],
  };
  if (stage === "revision") {
    a.revision = String(o.revisionFeedback || o.lastRevision || "");
    a.revisionAt = isoOr(o.updatedAt, created);
    a.log.push({ at: a.revisionAt, kind: "revision" });
  }
  if (stage === "approved") a.log.push({ at: isoOr(o.approvedAt || o.updatedAt, created), kind: "approved" });
  (a as ActiveJob & { allowed: string[]; brandId: string; status: string }).allowed = Array.isArray(
    o.allowedActions,
  )
    ? (o.allowedActions as string[])
    : [];
  (a as ActiveJob & { brandId: string }).brandId = idOf(o.brand || camp.brand);
  (a as ActiveJob & { status: string }).status = status;
  return a;
}

export function mapMessage(m: Obj): Message {
  const att = m.attachment as { uploadId: string; contentType: string } | null;
  const text =
    String(m.text || "") || (att ? (att.contentType.startsWith("image/") ? "📎 Image" : "📎 File") : "");
  const out: Message = { from: m.fromMe ? "me" : "brand", at: isoOr(m.sentAt, nowIso()), text };
  if (m.fromMe) out.status = "delivered";
  if (att) (out as Message & { attachment: unknown }).attachment = att;
  (out as Message & { id: string }).id = String(m.id || "");
  return out;
}

function mapThread(c: Obj, active: ActiveJob[]): Thread {
  const party = (c.withParty || {}) as Obj;
  const brand = nameOf(party, "Brand");
  const brandId = idOf(party);
  const a = active.find(x => (x as ActiveJob & { brandId?: string }).brandId === brandId);
  const t: Thread = {
    id: String(c.id),
    brand,
    bi: initialsOf(brand),
    tone: toneOf(brand),
    job: a?.id || "",
    unread: Number(c.unread) || 0,
    msgs: [],
  };
  const last = c.lastMessage as Obj | null;
  if (last && (last.text || last.hasAttachment))
    t.msgs.push({
      from: last.fromMe ? "me" : "brand",
      at: isoOr(last.sentAt, isoOr(c.updatedAt, nowIso())),
      text: String(last.text || "📎 Attachment"),
      ...(last.fromMe ? { status: "delivered" as const } : {}),
    });
  (t as Thread & { loaded: boolean; image: string }).loaded = false;
  (t as Thread & { image: string }).image = String(party.image || "");
  if (a) a.thread = t.id;
  return t;
}

const NOTIF_GO: Record<string, (d: Obj) => string> = {
  kyc_verified: () => "#kyc",
  kyc_rejected: () => "#kyc",
  new_message: d => (d.conversationId ? "#chat-" + d.conversationId : "#messages"),
  bid_selected: () => "#bids",
  bid_rejected: () => "#bids",
  offer_received: () => "#bids", // open direct offers are listed at the top of My bids
  order_created: d => (d.orderId ? "#work-" + d.orderId : "#active"),
  revision_requested: d => (d.orderId ? "#work-" + d.orderId : "#active"),
  order_approved: () => "#earnings",
};

/** Bid replies by notification type, so the bell says what happened in plain words.
    TODO(backend): record brand view/shortlist/decline on bids and send a notification the same day. */
const BID_REPLY: Record<string, "viewed" | "shortlisted" | "declined" | "accepted"> = {
  bid_viewed: "viewed",
  bid_seen: "viewed",
  bid_shortlisted: "shortlisted",
  bid_rejected: "declined",
  bid_declined: "declined",
  bid_not_selected: "declined",
  bid_selected: "accepted",
  bid_accepted: "accepted",
  bid_hired: "accepted",
};

/** The brand and brief a bid notification is about, from its data or from what is already loaded. */
function bidContext(d: Obj): { brand: string; title: string } {
  const s = store?.s;
  const jobId = String(d.campaignId || idOf(d.campaign) || "");
  const bid = s?.bids.find(b => b.id === String(d.bidId || "") || (!!jobId && b.job === jobId));
  const job = s?.jobs.find(j => j.id === (jobId || bid?.job));
  return {
    brand: nameOf(d.brandName || d.brand, "") || job?.brand || bid?.brand || "",
    title: String(d.campaignTitle || d.briefTitle || "") || job?.title || bid?.title || "",
  };
}

export function mapNotification(n: Obj): Notification {
  const data = (n.data || {}) as Obj;
  const type = String(n.type || "");
  let go =
    NOTIF_GO[type]?.(data) ||
    (data.orderId ? "#work-" + data.orderId : data.campaignId ? "#job-" + data.campaignId : "#home");
  let text = String(n.title || n.text || n.body || "Update");
  const reply = BID_REPLY[type];
  if (reply) {
    const { brand, title } = bidContext(data);
    go = "#bids";
    if (reply === "viewed") text = `${brand || "A brand"} viewed your bid${title ? ` for ${title}` : ""}`;
    else if (reply === "shortlisted") text = `You're shortlisted${title ? ` for ${title}` : ""}`;
    else if (reply === "declined") text = `Not selected this time${title ? ` · ${title}` : ""}`;
    else if (kycOwedFor(store?.s.kyc)) {
      text = KYC_AFTER_ACCEPT;
      go = "#kyc";
    } else text = `${brand || "The brand"} accepted your bid${title ? ` for ${title}` : ""}`;
  }
  return {
    id: String(n.id),
    at: isoOr(n.createdAt || n.at, nowIso()),
    text,
    go,
    read: !!n.read,
  };
}

export function mapKyc(k: Obj, prev: Kyc): Kyc {
  const steps = (k.steps || {}) as Record<string, Obj>;
  const pan = steps.pan || {},
    id = steps.id || {},
    bank = steps.bank || {};
  const ID_NAME: Record<string, Kyc["idType"]> = {
    aadhaar: "Aadhaar",
    passport: "Passport",
    voter_id: "Voter ID",
    driving_licence: "Driving licence",
  };
  const status = KYC_STATUS[String(k.status || "not_started")] || "not_started";
  /* How long the review should take, when the API says (#kyc and Home show "about 2 h left"; else "within 2 hours").
     TODO(backend): automatic PAN check; expose an ETA on GET /v1/kyc/. */
  const etaAt = [k.reviewEtaAt, k.etaAt, k.estimatedCompletionAt, k.eta].find(
    v => typeof v === "string" && Number.isFinite(Date.parse(v)),
  ) as string | undefined;
  const etaMin = Number(k.etaMinutes ?? k.reviewEtaMinutes);
  const reviewEtaAt =
    status !== "under_review"
      ? undefined
      : etaAt || (etaMin > 0 ? new Date(Date.now() + etaMin * 60000).toISOString() : undefined);
  return {
    ...prev,
    ...({ reviewEtaAt } as object),
    status,
    pan: pan.done ? `•••••${String(pan.panLast4 || "").padStart(4, "•")}` : "",
    panName: String(pan.nameOnPan || ""),
    idType: ID_NAME[String(id.idType || "")] || prev.idType || "Aadhaar",
    idDone: !!id.done,
    idMasked: id.done ? "Uploaded" : undefined,
    payoutMethod: "bank",
    bank: {
      acc: bank.done ? `••••${bank.accountLast4 || ""}` : "",
      ifsc: String(bank.ifsc || ""),
      holder: String(bank.accountHolderName || ""),
    },
    note: String(k.rejectionReason || ""),
    submittedAt: (k.submittedAt as string) || undefined,
    selfie: true,
    gstDone: true,
    fix: status === "action_needed" ? (["pan", "id", "payout"] as Kyc["fix"]) : null,
    ...({ steps: { pan: !!pan.done, id: !!id.done, bank: !!bank.done } } as object),
  };
}

/** The creator's platforms exactly as the server has them, which is also what brands get. Today GET /v1/creators/me/
    carries primaryPlatform and followerCount (the brand's #creator-<id> reads the same two); a `platforms` object
    ({ instagram, youtube } with handle, url, followers, avgViews, er) is read as soon as the backend sends one.
    TODO(backend): store each platform's handle, link, followers, average views and engagement on /v1/creators/me/
    (PATCH `instagram` / `youtube` as in docs/api/openapi.yaml PlatformUpdate) and return them to brands too. */
function serverPlatforms(c: Obj): Me["platforms"] {
  const out: Me["platforms"] = {};
  const updated = day(c.updatedAt) || todayIst();
  const given = (c.platforms && typeof c.platforms === "object" ? c.platforms : {}) as Record<
    string,
    Obj | null
  >;
  for (const key of ["instagram", "youtube"] as const) {
    const p = given[key];
    if (!p || typeof p !== "object") continue;
    const handle = String(p.handle || "");
    const followers = Number(p.followersCount ?? p.followers ?? p.followerCount) || 0;
    if (!handle && !followers) continue;
    out[key] = {
      handle: handle && !handle.startsWith("@") && key === "instagram" ? "@" + handle : handle,
      url: String(p.url || ""),
      followers,
      avgViews: Number(p.avgViews) || 0,
      er: Number(p.engagementRate ?? p.er) || 0,
      updated: day(p.updated || p.updatedAt) || updated,
      source: String(p.source || "Self-reported"),
    };
  }
  const primary = platformOf(c.primaryPlatform);
  const followers = Number(c.followerCount) || 0;
  if (out[primary]) {
    if (!out[primary].followers && followers) out[primary].followers = followers;
  } else if (followers)
    out[primary] = { handle: "", url: "", followers, avgViews: 0, er: 0, updated, source: "Self-reported" };
  return out;
}

/** Profile fields brands see come from the server only (C6). Private details the backend has no field for yet
    (date of birth, gender) and portfolio links still come from the device until it does. */
function mapMe(c: Obj, user: ApiUser | null, x: Partial<CreatorExtras>, prev: Me): Me {
  const [city, region] = splitLocation(c.location);
  const name = String(c.displayName || user?.fullName || prev.name || "Creator");
  const platforms = serverPlatforms(c);
  const handle =
    platforms.instagram?.handle ||
    platforms.youtube?.handle ||
    (c.slug ? "@" + String(c.slug).replace(/-[a-z0-9]{6}$/, "") : "");
  const portfolio = Array.isArray(c.portfolio)
    ? (c.portfolio as Obj[]).map(w => ({
        title: String(w.title || "Work"),
        url: String(w.url || ""),
        platform: /instagram\.com/i.test(String(w.url))
          ? ("instagram" as const)
          : /youtube\.com|youtu\.be/i.test(String(w.url))
            ? ("youtube" as const)
            : ("web" as const),
        format: String(w.format || ""),
        ...(w.views ? { views: Number(w.views) || 0 } : {}),
      }))
    : x.portfolio || prev.portfolio;
  return {
    ...prev,
    name,
    handle,
    city,
    region,
    dob: String(c.dob || c.dateOfBirth || x.dob || ""),
    gender: String(c.gender || x.gender || ""),
    languages: Array.isArray(c.languages) ? (c.languages as string[]) : [],
    categories: Array.isArray(c.categories) ? (c.categories as string[]) : prev.categories,
    bio: String(c.bio ?? prev.bio),
    photo: (c.avatarUrl as string) || null,
    platforms,
    portfolio,
  };
}

/** The lowest active package is the starting price brands see ("From ₹X per Reel"); `startingPrice` alone is read
    when there are no packages. null = none set. */
function mapStartPrice(pkgs: unknown, startingPrice: unknown, primary: unknown): StartPrice | null {
  const list = (Array.isArray(pkgs) ? (pkgs as Obj[]) : [])
    .filter(p => p && p.active !== false && amount(p.price as never) > 0)
    .sort((a, b) => amount(a.price as never) - amount(b.price as never));
  const p = list[0];
  if (p)
    return {
      id: String(p.id || ""),
      format: formatOf(p.deliverables || p.title, String(p.platform || "")),
      platform: platformOf(p.platform),
      price: amount(p.price as never),
      deliveryDays: Number(p.deliveryDays) || 0,
    };
  const sp = amount(startingPrice as never);
  if (!sp) return null;
  const plat = platformOf(primary);
  return { id: "", format: plat === "youtube" ? "Video" : "Reel", platform: plat, price: sp, deliveryDays: 0 };
}

/** Reads the creator's packages; leaves the price as it was when the list can't be read. */
async function loadStartPrice(): Promise<void> {
  const pkgs = await apiAll<Obj>("/v1/creators/me/packages/").catch(() => null);
  if (!pkgs) return;
  store.set(s => {
    s.me.startPrice = mapStartPrice(pkgs, null, null) || s.me.startPrice || null;
  }, "profile-live");
}

/* ---------- loading ---------- */

type Store ={ s: State; set(fn: (s: State) => void, why?: string): void };
let store: Store;
let creatorId = "";
let userId = "";
/** The fields the last GET /v1/creators/me/ returned: a profile field is only sent back when the server has it. */
let serverKeys = new Set<string>();
/** Fields the server refused on PATCH this visit (unknown or read-only), so they are not sent again. */
const refused = new Set<string>();
const ex = () => extras<CreatorExtras>("creator", userId || "anon");

/** Device copies of profile fields brands see, written by earlier builds (C6). They are never shown any more; a copy is
    removed only once the server holds that field, so nothing is lost while the backend has no field for it.
    TODO(backend): store languages and platform handles on /v1/creators/me/, then send these copies up once. */
function dropRetiredExtras(cme: Obj): void {
  const x = ex().get() as Record<string, unknown>;
  const filled = (v: unknown) =>
    (Array.isArray(v) ? v.length > 0 : v != null && v !== "" && typeof v !== "object") ||
    (!!v && typeof v === "object" && Object.keys(v).length > 0);
  const held: Record<(typeof DEVICE_ONLY_RETIRED)[number], boolean> = {
    languages: filled(cme.languages),
    region: filled(cme.location),
    platforms: filled(cme.platforms),
  };
  const drop = DEVICE_ONLY_RETIRED.filter(k => k in x && held[k]);
  if (!drop.length) return;
  const keep = { ...x };
  drop.forEach(k => delete keep[k]);
  try {
    localStorage.setItem(`ll-extra-creator-${userId || "anon"}`, JSON.stringify(keep));
  } catch {
    /* storage blocked: nothing to clean */
  }
}

/** Reads the profile back from the server, so the screen shows exactly what brands see. */
async function refreshProfile(): Promise<void> {
  const cme = await api<Obj>("/v1/creators/me/");
  serverKeys = new Set(Object.keys(cme || {}));
  store.set(s => {
    s.me = mapMe(cme || {}, storedUser(), ex().get(), s.me);
  }, "profile-live");
}

/** Loads only what a signed-out visitor may see. */
export async function loadGuest(st: Store): Promise<void> {
  store = st;
  const camps = await apiAll<ApiCampaign>("/v1/campaigns/", { auth: false }).catch(() => [] as ApiCampaign[]);
  st.set(s => {
    s.jobs = camps.map(c => mapJob(c));
  }, "live-loaded");
}

/** Everything for a signed-in creator. Returns the user so the session can route (onboarding, wrong role). */
export async function loadCreator(st: Store): Promise<ApiUser> {
  store = st;
  /* Everything is asked for at once: the account check no longer holds the other requests back. */
  const me = fetchMe();
  const errors: string[] = [];
  /* The reviews need the creator's profile id. It is remembered from the last visit so they can load alongside the rest. */
  const knownUser = storedUser()?.id || "";
  const knownCreator = knownUser
    ? extras<{ creatorId: string }>("creator", knownUser).get().creatorId || ""
    : "";
  const loadReviews = (id: string) =>
    settle(apiAll<Obj>(`/v1/creators/${id}/reviews/`, {}, 50), [] as Obj[], "reviews", errors); // needs a token since 2026-11-12
  const earlyReviews = knownCreator ? loadReviews(knownCreator) : null;
  const wave = Promise.all([
    settle(api<Obj>("/v1/creators/me/"), {} as Obj, "profile", errors),
    settle(api<Obj>("/v1/kyc/"), null as Obj | null, "kyc", errors),
    settle(apiAll<ApiCampaign>("/v1/campaigns/"), [] as ApiCampaign[], "jobs", errors),
    settle(apiAll<Obj>("/v1/creators/me/bids/"), [] as Obj[], "bids", errors),
    settle(apiAll<Obj>("/v1/creators/me/orders/"), [] as Obj[], "orders", errors),
    settle(apiAll<Obj>("/v1/conversations/"), [] as Obj[], "messages", errors),
    settle(apiAll<Obj>("/v1/notifications/", {}, 100), [] as Obj[], "notifications", errors),
    settle(api<Obj>("/v1/creators/me/earnings/"), null as Obj | null, "earnings", errors),
  ]);
  const user = await me;
  userId = user.id;
  if (user.role === "brand") return user; // the session sends a brand account to its own dashboard
  const [cme, kyc, camps, myBids, orders, convs, notifs, earnings] = await wave;
  creatorId = String(cme.id || "");
  serverKeys = new Set(Object.keys(cme));
  dropRetiredExtras(cme);
  const x = ex().get();
  if (creatorId && creatorId !== knownCreator)
    extras<{ creatorId: string }>("creator", userId).set({ creatorId });
  const reviews = !creatorId
    ? []
    : earlyReviews && creatorId === knownCreator
      ? await earlyReviews
      : await loadReviews(creatorId);

  st.set(s => {
    s.session.signedIn = true;
    s.session.email = String(user.email || "");
    s.session.mobile = user.phone ? maskPhone(String(user.phone)) : "";
    /* email-only app: only older SMS-code accounts have a phone and no email */
    s.session.method = user.phone && !user.email ? "mobile" : "email";
    s.session.firstLogin = !!user.needsOnboarding;
    s.me = mapMe(cme, user, x, s.me);
    s.me.startPrice = mapStartPrice(cme.packages, cme.startingPrice, cme.primaryPlatform);
    if (kyc) s.kyc = mapKyc(kyc, s.kyc);
    else if (user.kycStatus) s.kyc.status = KYC_STATUS[user.kycStatus] || "not_started";
    s.jobs = camps.map(c => mapJob(c, s.me));
    /* /creators/me/bids/ (since 2026-11-12; /creators/me/campaigns/ is the old name) lists the creator's bids, each with its
       campaign; some builds nest the bid instead */
    s.bids = myBids
      .map(r =>
        r.price !== undefined
          ? r
          : ((r.myBid || r.bid) as Obj | undefined)
            ? { ...((r.myBid || r.bid) as Obj), campaign: r }
            : null,
      )
      .filter((r): r is Obj => !!r)
      .map(b => mapBid(b, s.jobs));
    s.active = orders.map(mapOrder);
    s.threads = convs.map(c => mapThread(c, s.active));
    s.notifications = notifs.map(mapNotification);
    s.me.totalBids = s.bids.length;
    s.me.completedJobs = s.active.filter(a => a.stage === "approved").length;
    s.me.reviews = reviews.map(r => ({
      brand: nameOf(r.brand || r.author, "Brand"),
      rating: Number(r.stars ?? r.rating) || 0,
      text: String(r.text || ""),
    }));
    s.saved = x.saved || [];
    s.hiddenJobs = x.hiddenJobs || [];
    applyEarnings(s, earnings);
  }, "live-loaded");
  if (errors.length) console.warn("Some sections could not load:", errors.join(", "));
  void loadStartPrice();
  startLive();
  wireLive();
  return user;
}

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}•••••${d.slice(7)}` : p;
}

/** Earnings: the ledger is the approved orders; withdrawals stay hidden while payouts are off. */
function applyEarnings(s: State, e: Obj | null): void {
  const approved = s.active.filter(a => a.pay === "released");
  s.ledger = approved.map((a): LedgerEntry => ({
    id: "l-" + a.id,
    date: day(a.log.find(l => l.kind === "approved")?.at || a.funded),
    brand: a.brand,
    job: a.title,
    amount: a.price,
    status: "paid",
  }));
  const payouts = !!e?.payoutsEnabled;
  (s as State & { payoutsEnabled: boolean }).payoutsEnabled = payouts;
  (s as State & { earningsSummary: unknown }).earningsSummary = e
    ? {
        inEscrow: amount(e.inEscrow as never),
        earned: amount(e.earned as never),
        tds: amount(e.tdsDeducted as never),
        ordersInEscrow: Number(e.ordersInEscrow) || 0,
        ordersEarned: Number(e.ordersEarned) || 0,
      }
    : null;
  s.readyToWithdraw = payouts ? amount(e?.earned as never) : 0;
  s.withdrawals = [];
  s.payoutMethods = [];
}

let wired = false;
function wireLive(): void {
  if (wired) return;
  wired = true;
  onLive((e: LiveEvent) => {
    if (e.event === "connected") {
      void refreshSoft();
      return;
    }
    if (e.event === "new_message") {
      const m = mapMessage(e.message);
      store.set(s => {
        const t = s.threads.find(x => x.id === e.conversationId);
        if (!t) {
          void refreshThreads();
          return;
        }
        const id = (m as Message & { id?: string }).id;
        if (id && t.msgs.some(x => (x as Message & { id?: string }).id === id)) return;
        /* the echo of a message this tab just sent: match it to the one already on screen */
        if (m.from === "me") {
          const mine = t.msgs.find(
            x => x.from === "me" && !(x as Message & { id?: string }).id && x.text === m.text,
          );
          if (mine) {
            (mine as Message & { id?: string }).id = id;
            return;
          }
        }
        t.msgs.push(m);
        if (m.from !== "me") t.unread += 1;
      }, "chat-live");
      return;
    }
    if (e.event === "notification") {
      const n = mapNotification(e.notification as unknown as Obj);
      store.set(s => {
        if (!s.notifications.some(x => x.id === n.id)) s.notifications.unshift(n);
      }, "notif-live");
      const t = e.notification.type;
      if (t === "kyc_verified" || t === "kyc_rejected") void refreshKyc();
      else void refreshSoft();
    }
  });
}

/* ---------- refreshes ---------- */

export async function refreshKyc(): Promise<void> {
  const k = await api<Obj>("/v1/kyc/");
  store.set(s => {
    s.kyc = mapKyc(k, s.kyc);
  }, "kyc-live");
}

async function refreshThreads(): Promise<void> {
  const convs = await apiAll<Obj>("/v1/conversations/");
  store.set(s => {
    const old = new Map(s.threads.map(t => [t.id, t]));
    s.threads = convs.map(c => {
      const t = mapThread(c, s.active);
      const o = old.get(t.id) as (Thread & { loaded?: boolean }) | undefined;
      if (o?.loaded) {
        t.msgs = o.msgs;
        (t as Thread & { loaded: boolean }).loaded = true;
      }
      return t;
    });
  }, "chat-live");
}

/** Bids, orders and notifications: the slices other people change. */
export async function refreshSoft(): Promise<void> {
  const [myBids, orders, notifs] = await Promise.all([
    apiAll<Obj>("/v1/creators/me/bids/").catch(() => null),
    apiAll<Obj>("/v1/creators/me/orders/").catch(() => null),
    apiAll<Obj>("/v1/notifications/", {}, 100).catch(() => null),
  ]);
  store.set(s => {
    if (myBids)
      s.bids = myBids
        .map(r =>
          r.price !== undefined
            ? r
            : ((r.myBid || r.bid) as Obj | undefined)
              ? { ...((r.myBid || r.bid) as Obj), campaign: r }
              : null,
        )
        .filter((r): r is Obj => !!r)
        .map(b => mapBid(b, s.jobs));
    if (orders) {
      const threads = new Map(s.active.map(a => [a.id, a.thread]));
      s.active = orders.map(o => {
        const a = mapOrder(o);
        a.thread = threads.get(a.id) || s.threads.find(t => t.job === a.id)?.id || "";
        return a;
      });
    }
    if (notifs) s.notifications = notifs.map(mapNotification);
  }, "live-refresh");
  void refreshThreads().catch(() => undefined);
}

/* ---------- actions ---------- */

/** Wording for an error a screen shows inline. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "KYC_REQUIRED") return "Verify your ID first. Your draft is saved.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

export const isKycRequired = (e: unknown): boolean => e instanceof ApiError && e.code === "KYC_REQUIRED";

export const creatorApi = {
  errorText,
  async placeBid(
    jobId: string,
    p: { price: number; why: string; views: number | null; postDate: string; links: string[] },
  ): Promise<Bid> {
    const days = Math.max(1, daysUntil(p.postDate));
    const message = p.links.length ? `${p.why}\n\nSimilar work:\n${p.links.join("\n")}` : p.why;
    const body: Obj = { price: p.price, message, deliveryDays: days };
    if (p.views) body.expectedViews = p.views;
    const r = await api<Obj>(`/v1/campaigns/${jobId}/bids/`, { method: "POST", body });
    const b = mapBid({ ...r, campaign: r.campaign || jobId }, store.s.jobs);
    b.postDate = p.postDate;
    b.links = p.links;
    b.why = p.why;
    return b;
  },

  async withdrawBid(bid: Bid): Promise<void> {
    await api(`/v1/campaigns/${bid.job}/bids/${bid.id}/withdraw/`, { method: "POST" });
  },

  async reviewOrder(orderId: string, stars: number, text: string): Promise<void> {
    await api(`/v1/orders/${orderId}/review/`, { method: "POST", body: { stars, text } });
  },

  /** One brief by id, added to the list so job detail can show it. */
  async fetchJob(id: string): Promise<void> {
    const c = await api<ApiCampaign>(`/v1/campaigns/${id}/`);
    store.set(s => {
      const j = mapJob(c, s.me);
      s.jobs = s.jobs.filter(x => x.id !== j.id).concat(j);
    }, "live-refresh");
  },

  /* jobs: saved and hidden are kept per account on this device */
  saveJobs(saved: string[], hidden: string[]): void {
    ex().set({ saved, hiddenJobs: hidden });
  },

  /* messages */
  async loadThread(threadId: string): Promise<void> {
    const msgs = await apiAll<Obj>(`/v1/conversations/${threadId}/messages/`, {}, 300);
    store.set(s => {
      const t = s.threads.find(x => x.id === threadId);
      if (!t) return;
      t.msgs = msgs.map(mapMessage).reverse();
      (t as Thread & { loaded: boolean }).loaded = true;
    }, "chat-loaded");
  },

  async sendMessage(threadId: string, text: string, file?: File): Promise<Message> {
    let attachmentUploadId: string | undefined;
    if (file) attachmentUploadId = (await uploadFile("chat_attachment", file)).id;
    const r = await api<Obj>(`/v1/conversations/${threadId}/messages/`, {
      method: "POST",
      body: { ...(text ? { text } : {}), ...(attachmentUploadId ? { attachmentUploadId } : {}) },
    });
    return mapMessage({ ...r, fromMe: true });
  },

  async markRead(threadId: string): Promise<void> {
    await api(`/v1/conversations/${threadId}/read/`, { method: "POST" });
  },

  async openThreadWithBrand(brandId: string): Promise<string> {
    const r = await api<Obj>("/v1/conversations/", { method: "POST", body: { brandId } });
    await refreshThreads();
    return String(r.id);
  },

  /* notifications */
  async readNotification(id: string): Promise<void> {
    await api(`/v1/notifications/${id}/read/`, { method: "PATCH" });
  },
  async readAllNotifications(): Promise<void> {
    await api("/v1/notifications/read-all/", { method: "POST" });
  },

  /* work */
  async submitDeliverable(
    orderId: string,
    d: { file?: File; url?: string; note?: string },
  ): Promise<UploadedFile | null> {
    let up: UploadedFile | null = null;
    const body: Obj = {};
    if (d.file) {
      up = await uploadFile("deliverable", d.file);
      body.fileUploadId = up.id;
    } else if (d.url) body.contentUrl = d.url.startsWith("http") ? d.url : "https://" + d.url;
    if (d.note) body.note = d.note;
    await api(`/v1/orders/${orderId}/deliverables/`, { method: "POST", body });
    return up;
  },
  async refreshOrders(): Promise<void> {
    await refreshSoft();
  },
  async orderAction(orderId: string, action: "cancel" | "disputes", reason: string): Promise<void> {
    await api(`/v1/orders/${orderId}/${action}/`, { method: "POST", body: { reason } });
  },
  async offers(): Promise<Obj[]> {
    return apiAll<Obj>("/v1/creators/me/offers/");
  },
  async answerOffer(id: string, status: "accepted" | "rejected"): Promise<void> {
    await api(`/v1/creators/me/offers/${id}/`, { method: "PATCH", body: { status } });
    await refreshSoft();
  },

  /* profile */
  /** Saves to /v1/creators/me/ and reads the profile back, so the screen shows what brands will see (C6). Fields brands
      see are never kept on the device. Returns the ones the server has no place for yet, for the screen to say so.
      Platforms go as `instagram` / `youtube`: { handle, followersCount, avgViews, engagementRate (a percentage) }, or
      null to clear one. Any other key inside them is a 400. `followerCount` is derived by the server, so not sent. */
  async saveProfile(p: {
    name?: string;
    bio?: string;
    categories?: string[];
    city?: string;
    region?: string;
    primaryPlatform?: "instagram" | "youtube";
    languages?: string[];
    platforms?: Me["platforms"];
    extras?: Partial<CreatorExtras>;
  }): Promise<{ unsaved: string[] }> {
    if (p.extras) ex().set(p.extras);
    if (!serverKeys.size) await refreshProfile().catch(() => undefined);
    const core: Obj = {};
    if (p.name !== undefined) core.displayName = p.name.trim();
    if (p.bio !== undefined) core.bio = p.bio.trim();
    if (p.categories !== undefined) core.categories = p.categories;
    if (p.city !== undefined)
      core.location = [p.city.trim(), (p.region || "").trim()].filter(Boolean).join(", ");
    if (p.primaryPlatform) core.primaryPlatform = p.primaryPlatform;
    /* fields brands see that only some backend builds store: sent only when the server returned them */
    const wanted: Obj = {};
    if (p.languages !== undefined) wanted.languages = p.languages;
    if (p.platforms) {
      /* a blank or zero number is sent as null ("not shared"), never as 0 */
      const count = (n: unknown) => {
        const v = Math.round(Number(n) || 0);
        return v > 0 ? v : null;
      };
      const rate = (n: unknown) => {
        const v = Number(String(n ?? "").replace("%", "")) || 0;
        return v > 0 ? Math.min(100, Math.round(v * 100) / 100) : null;
      };
      (["instagram", "youtube"] as const).forEach(k => {
        const x = p.platforms?.[k];
        wanted[k] = x?.handle
          ? {
              handle: x.handle,
              followersCount: count(x.followers),
              avgViews: count(x.avgViews),
              engagementRate: rate(x.er),
            }
          : null;
      });
    }
    const has = (k: string) =>
      k === "instagram" || k === "youtube" ? serverKeys.has("platforms") : serverKeys.has(k);
    const ext: Obj = {};
    const unsaved = new Set<string>();
    for (const [k, v] of Object.entries(wanted)) {
      if (has(k) && !refused.has(k)) ext[k] = v;
      else unsaved.add(k);
    }
    const patch = (body: Obj) => api("/v1/creators/me/", { method: "PATCH", body });
    if (Object.keys(ext).length) {
      try {
        await patch({ ...core, ...ext });
      } catch (e) {
        /* the server refused a field it does not take (yet): save the rest, and say what was left out */
        if (!(e instanceof ApiError) || e.status !== 400) throw e;
        const named = Object.keys(ext).filter(k => e.field(k));
        const blame = named.length
          ? named
          : /unknown|read.?only|not allowed/i.test(e.message)
            ? Object.keys(ext)
            : [];
        if (!blame.length) throw e;
        blame.forEach(k => {
          refused.add(k);
          unsaved.add(k);
          delete ext[k];
        });
        if (Object.keys(core).length + Object.keys(ext).length) await patch({ ...core, ...ext });
      }
    } else if (Object.keys(core).length) await patch(core);
    await refreshProfile();
    const words = new Set<string>();
    unsaved.forEach(k =>
      words.add(
        k === "languages" ? "languages" : k === "followerCount" ? "follower numbers" : "platform handles",
      ),
    );
    return { unsaved: [...words] };
  },
  /** Saves the starting price as the creator's package: updates the one shown, or creates it. Price in rupees. */
  async saveStartPrice(p: {
    format: StartPrice["format"];
    rupees: number;
    deliveryDays: number;
  }): Promise<void> {
    const platform = p.format === "Video" || p.format === "Short" ? "youtube" : "instagram";
    const where = platform === "youtube" ? "YouTube" : "Instagram";
    const body = {
      title: `1 ${where} ${p.format}`,
      description: `Starting price for one ${where} ${p.format}.`,
      platform,
      deliverables: `1 ${p.format}`,
      price: Math.round(p.rupees * 100),
      deliveryDays: Math.round(p.deliveryDays),
      active: true,
    };
    const id = store.s.me.startPrice?.id;
    const saved = id
      ? await api<Obj>(`/v1/creators/me/packages/${id}/`, { method: "PATCH", body })
      : await api<Obj>("/v1/creators/me/packages/", { method: "POST", body });
    const now = mapStartPrice([{ ...body, ...(saved || {}) }], null, null);
    if (now) store.set(s => (s.me.startPrice = now), "profile-live");
    await loadStartPrice();
  },
  async uploadAvatar(file: Blob): Promise<string | null> {
    const r = await uploadFile("avatar", file);
    return r.url;
  },

  /* KYC */
  async kycPan(pan: string, nameOnPan: string): Promise<void> {
    const k = await api<Obj>("/v1/kyc/pan/", { method: "PUT", body: { pan: pan.toUpperCase(), nameOnPan } });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycId(idType: Kyc["idType"], file: File): Promise<void> {
    const ID: Record<string, string> = {
      Aadhaar: "aadhaar",
      Passport: "passport",
      "Voter ID": "voter_id",
      "Driving licence": "driving_licence",
    };
    const up = await uploadFile("kyc_document", file);
    const k = await api<Obj>("/v1/kyc/id/", {
      method: "PUT",
      body: { idType: ID[idType] || "aadhaar", uploadId: up.id },
    });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycBank(accountHolderName: string, accountNumber: string, ifsc: string): Promise<void> {
    const k = await api<Obj>("/v1/kyc/bank/", {
      method: "PUT",
      body: { accountHolderName, accountNumber: accountNumber.replace(/\s/g, ""), ifsc: ifsc.toUpperCase() },
    });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycSubmit(): Promise<void> {
    const k = await api<Obj>("/v1/kyc/submit/", { method: "POST" });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
};
