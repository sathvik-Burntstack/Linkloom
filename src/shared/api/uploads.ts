/* File uploads: ask for a one-time URL, PUT the file there, then mark it complete.
   kind: avatar | gallery | brand_logo | deliverable | chat_attachment | kyc_document | support_attachment */
import { api, ApiError } from "./client";

export type UploadKind =
  | "avatar"
  | "gallery"
  | "brand_logo"
  | "deliverable"
  | "chat_attachment"
  | "kyc_document"
  | "support_attachment";

export interface UploadedFile {
  id: string;
  kind: UploadKind;
  status: string;
  contentType: string;
  size: number;
  /** Public link for avatar, logo and gallery images; null for private files. */
  url: string | null;
}

interface Ticket {
  upload: { id: string };
  uploadUrl: string;
  method?: string;
  headers?: Record<string, string>;
}

const LIMITS: Record<UploadKind, { types: RegExp; max: number }> = {
  avatar: { types: /^image\/(jpeg|png|webp)$/, max: 10 << 20 },
  gallery: { types: /^image\/(jpeg|png|webp)$/, max: 10 << 20 },
  brand_logo: { types: /^image\/(jpeg|png|webp)$/, max: 10 << 20 },
  deliverable: { types: /^(image\/(jpeg|png|webp)|application\/pdf|video\/(mp4|quicktime))$/, max: 50 << 20 },
  chat_attachment: { types: /^(image\/(jpeg|png|webp)|application\/pdf)$/, max: 10 << 20 },
  kyc_document: { types: /^(image\/(jpeg|png|webp)|application\/pdf)$/, max: 10 << 20 },
  support_attachment: { types: /^(image\/(jpeg|png|webp)|application\/pdf)$/, max: 10 << 20 },
};

/** A wording problem with the file, or null when it can be sent. */
export function checkFile(kind: UploadKind, file: Blob): string | null {
  const l = LIMITS[kind];
  if (!l.types.test(file.type)) return "That file type isn't supported here.";
  if (file.size > l.max) return `That file is over ${l.max >> 20} MB.`;
  return null;
}

export async function uploadFile(kind: UploadKind, file: Blob): Promise<UploadedFile> {
  const bad = checkFile(kind, file);
  if (bad) throw new ApiError(400, bad, "FILE_INVALID");
  const t = await api<Ticket>("/v1/uploads/", {
    method: "POST",
    /* the original name (a File has one; a cropped Blob doesn't): the backend keeps it and returns it as fileName */
    body: { kind, contentType: file.type, size: file.size, ...((file as File).name ? { fileName: (file as File).name } : {}) },
  });
  let put: Response;
  try {
    put = await fetch(t.uploadUrl, {
      method: t.method || "PUT",
      headers: t.headers || { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new ApiError(0, "The upload didn't go through. Check your connection and try again.", "NETWORK");
  }
  if (!put.ok) throw new ApiError(put.status, "The upload didn't go through. Please try again.", "UPLOAD_FAILED");
  return api<UploadedFile>(`/v1/uploads/${t.upload.id}/complete/`, { method: "POST" });
}

/** A 5-minute link for a private file. */
export async function downloadUrl(uploadId: string): Promise<{ url: string; expiresIn: number }> {
  const r = await api<Record<string, unknown>>(`/v1/uploads/${uploadId}/download-url/`);
  const url = [r.url, r.downloadUrl, r.download_url, r.signedUrl, r.signed_url].find(x => typeof x === "string" && x) as
    | string
    | undefined;
  if (!url) throw new ApiError(0, "The file link couldn't be made. Please try again.", "FILE_LINK_MISSING");
  return { url, expiresIn: Number(r.expiresIn ?? r.expires_in) || 300 };
}

/** Opens a private file in a new tab. The tab is opened first so pop-up blockers allow it. */
export async function openPrivateFile(uploadId: string): Promise<void> {
  const w = window.open("about:blank", "_blank");
  try {
    const { url } = await downloadUrl(uploadId);
    if (w) w.location.href = url;
    else location.href = url;
  } catch (e) {
    w?.close();
    throw e;
  }
}

/** "data:image/jpeg;base64,..." → Blob, for the photo croppers that hand back data URLs. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] || "application/octet-stream";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
