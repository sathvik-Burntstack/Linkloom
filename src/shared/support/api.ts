/* Support tickets and abuse reports, shared by the brand and creator apps.
   Built to the backend list "Support tickets: backend implementation list":
     GET/POST /v1/support/tickets/            the user's tickets / open one
     GET      /v1/support/tickets/{id}/       one ticket with its messages (never internal notes)
     POST     /v1/support/tickets/{id}/messages/ · resolve/ · reopen/
     POST     /v1/abuse-reports/              { targetType, targetId, reason, details } → super admin Moderation
   Until the support endpoints exist every call throws SUPPORT_OFF, and the screens say support opens soon. */
import { api, apiAll, ApiError } from "../api/client";
import { downloadUrl, uploadFile } from "../api/uploads";

type Obj = Record<string, unknown>;

export const SUPPORT_OFF = "SUPPORT_OFF";
export const SUPPORT_EMAIL = "support@linkloom.in";

export type TicketStatus = "open" | "waiting_on_user" | "resolved" | "closed";
export type Topic = "payments" | "deal" | "account" | "marketplace" | "bug" | "other";

export const TOPICS: [Topic, string][] = [
  ["payments", "Payments & escrow"],
  ["deal", "A deal or delivery"],
  ["account", "Account & KYC"],
  ["marketplace", "Briefs, bids & pitches"],
  ["bug", "Something's broken"],
  ["other", "Something else"],
];

export interface Attachment {
  uploadId: string;
  fileName: string;
  contentType: string;
  size: number;
}
export interface SupportMessage {
  id: string;
  author: "user" | "admin" | "system";
  authorName: string;
  text: string;
  attachments: Attachment[];
  at: string;
}
export interface Ticket {
  id: string;
  number: number;
  ref: string;
  topic: Topic;
  subject: string;
  status: TicketStatus;
  order: { id: string; title: string } | null;
  unread: number;
  lastText: string;
  lastAuthor: string;
  canReopen: boolean;
  at: string;
  updatedAt: string;
  resolvedAt: string;
  messages: SupportMessage[];
}

const str = (v: unknown) => (v == null ? "" : String(v));
const STATUS = (s: unknown): TicketStatus => {
  const v = str(s).toLowerCase();
  if (/waiting|pending_user|awaiting_user/.test(v)) return "waiting_on_user";
  if (/resolv|solved/.test(v)) return "resolved";
  if (/clos/.test(v)) return "closed";
  return "open";
};

function mapMessage(m: Obj): SupportMessage {
  const a = str(m.author || m.authorType || m.from).toLowerCase();
  return {
    id: str(m.id),
    author: /admin|support|staff|agent/.test(a) ? "admin" : /system/.test(a) ? "system" : "user",
    authorName: str(m.authorName || m.adminName) || (/admin|support/.test(a) ? "Linkloom Support" : ""),
    text: str(m.text || m.body || m.message),
    attachments: (Array.isArray(m.attachments) ? (m.attachments as Obj[]) : []).map(x => ({
      uploadId: str(x.uploadId || x.id),
      fileName: str(x.fileName || x.name) || "Attachment",
      contentType: str(x.contentType),
      size: Number(x.size) || 0,
    })),
    at: str(m.createdAt || m.at) || new Date().toISOString(),
  };
}

export function mapTicket(t: Obj): Ticket {
  const number = Number(t.number) || 0;
  const last = (t.lastMessage || {}) as Obj;
  const o = (t.order && typeof t.order === "object" ? t.order : null) as Obj | null;
  const status = STATUS(t.status);
  const resolvedAt = str(t.resolvedAt);
  return {
    id: str(t.id),
    number,
    ref: number ? `LL-${number}` : "LL-" + str(t.id).slice(0, 6).toUpperCase(),
    topic: (TOPICS.some(x => x[0] === t.topic) ? t.topic : "other") as Topic,
    subject: str(t.subject) || "Support request",
    status,
    order: o ? { id: str(o.id), title: str(o.title) || "Deal" } : t.orderId ? { id: str(t.orderId), title: "Deal" } : null,
    unread: Number(t.unreadForUser ?? t.unread) || 0,
    lastText: str(last.text),
    lastAuthor: str(last.author),
    canReopen:
      t.canReopen !== undefined
        ? !!t.canReopen
        : status === "resolved" && (!resolvedAt || Date.now() - Date.parse(resolvedAt) < 7 * 864e5),
    at: str(t.createdAt) || new Date().toISOString(),
    updatedAt: str(t.updatedAt || t.createdAt) || new Date().toISOString(),
    resolvedAt,
    messages: (Array.isArray(t.messages) ? (t.messages as Obj[]) : []).map(mapMessage),
  };
}

/** 404 / 405 / 501 on the support paths: the backend hasn't shipped tickets yet. */
async function call<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501) && !/^(NOT_FOUND_TICKET)$/.test(e.code || ""))
      throw new ApiError(e.status, "Support opens soon.", SUPPORT_OFF);
    throw e;
  }
}

const ERR: Record<string, string> = {
  ORDER_NOT_YOURS: "That deal isn't one of yours. Pick another or leave it empty.",
  ATTACHMENT_INVALID: "One of the files didn't upload properly. Remove it and try again.",
  TICKET_CLOSED: "This request is closed. Open a new one if you still need help.",
  REOPEN_EXPIRED: "It's been more than 7 days, so this one can't be reopened. Open a new request instead.",
  TOO_MANY_OPEN: "You have several requests open already. Add to one of those, or try again tomorrow.",
  ALREADY_REPORTED: "You've already reported this. Our team is looking at it.",
};
export function supportError(e: unknown, fallback: (e: unknown) => string): string {
  if (e instanceof ApiError && ERR[e.code || ""]) return ERR[e.code || ""];
  return fallback(e);
}

export const support = {
  async list(): Promise<Ticket[]> {
    return (await call(() => apiAll<Obj>("/v1/support/tickets/"))).map(mapTicket);
  },
  async get(id: string): Promise<Ticket> {
    /* not wrapped: a 404 here means this ticket isn't the user's (the list decides whether support is on) */
    return mapTicket(await api<Obj>(`/v1/support/tickets/${id}/`));
  },
  async create(t: { topic: Topic; orderId: string | null; subject: string; message: string; files: File[] }): Promise<Ticket> {
    const ids = await uploadAll(t.files);
    const r = await call(() =>
      api<Obj>("/v1/support/tickets/", {
        method: "POST",
        body: {
          topic: t.topic,
          ...(t.orderId ? { orderId: t.orderId } : {}),
          subject: t.subject,
          message: t.message,
          ...(ids.length ? { attachmentUploadIds: ids } : {}),
        },
      }),
    );
    return mapTicket(r);
  },
  async reply(id: string, text: string, files: File[]): Promise<SupportMessage> {
    const ids = await uploadAll(files);
    const r = await call(() =>
      api<Obj>(`/v1/support/tickets/${id}/messages/`, {
        method: "POST",
        /* the live API names the reply field "message" (as on create), not "text" */
        body: { message: text, ...(ids.length ? { attachmentUploadIds: ids } : {}) },
      }),
    );
    return mapMessage({ author: "user", text, ...r });
  },
  async resolve(id: string): Promise<Ticket> {
    return mapTicket(await call(() => api<Obj>(`/v1/support/tickets/${id}/resolve/`, { method: "POST" })));
  },
  async reopen(id: string): Promise<Ticket> {
    return mapTicket(await call(() => api<Obj>(`/v1/support/tickets/${id}/reopen/`, { method: "POST" })));
  },
  async openFile(uploadId: string): Promise<void> {
    const w = window.open("about:blank", "_blank");
    try {
      const { url } = await downloadUrl(uploadId);
      if (w) w.location.href = url;
      else location.href = url;
    } catch (e) {
      w?.close();
      throw e;
    }
  },
};

async function uploadAll(files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) out.push((await uploadFile("support_attachment", f)).id);
  return out;
}

/** A report from the website, for super admin's Moderation queue. */
export async function reportAbuse(r: {
  targetType: "profile" | "message" | "content" | "review" | "campaign";
  targetId: string;
  reason: string;
  details: string;
}): Promise<void> {
  await api("/v1/abuse-reports/", { method: "POST", body: r });
}
