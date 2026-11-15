/* KYC gate: first tap on Bid checks verification and keeps the job.
   With the C10 trial on (flags.ts, BID_BEFORE_KYC) Bid opens the form straight away and the ID check is asked for
   later, once a brand accepts the bid or before the first payout.
   TODO(backend): accept bids from unverified creators; block payout until the ID check is approved. */
import { BID_BEFORE_KYC, KYC_AFTER_ACCEPT, kycOwedFor } from "../flags";
import type { Kyc } from "../types";
import { today } from "./clock";
import { go } from "./router";
import { store } from "./store";

/** Opens the ID check and remembers where to send the creator once verified. */
export const openKyc = (returnTo: string | null = null): void => {
  store.set(s => {
    s.kyc.returnTo = returnTo;
  }, "kyc-return");
  go("#kyc");
};

export const kycGate = (jobId: string): boolean => {
  const k = store.s.kyc;
  if (k.status === "verified" || BID_BEFORE_KYC) {
    go("#bid-" + jobId);
    return true;
  }
  openKyc("#bid-" + jobId);
  return false;
};

/** True when the trial lets an unverified creator bid, so the ID check is still owed before a deal can start. */
export const kycOwed = (k: Kyc = store.s.kyc): boolean => kycOwedFor(k);

export { KYC_AFTER_ACCEPT };

/** When the ID review is expected to finish, if the API gave an estimate (see live/creator.ts mapKyc). */
export type KycWithEta = Kyc & { reviewEtaAt?: string };

/** "about 2 h left", "about 25 min left", or "within 2 hours" when there is no estimate.
    Shared by #kyc and the Home status card so both say the same thing.
    TODO(backend): automatic PAN check; expose an ETA on GET /v1/kyc/. */
export function kycWaitText(k: KycWithEta = store.s.kyc): string {
  const at = k.reviewEtaAt ? Date.parse(k.reviewEtaAt) : NaN;
  if (!Number.isFinite(at)) return "within 2 hours";
  const min = Math.ceil((at - today().getTime()) / 60000);
  if (min <= 2) return "almost done";
  if (min < 60) return `about ${Math.max(5, Math.ceil(min / 5) * 5)} min left`;
  return `about ${Math.max(1, Math.round(min / 60))} h left`;
}
