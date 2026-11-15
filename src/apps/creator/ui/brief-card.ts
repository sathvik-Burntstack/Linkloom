/* The one brief card (C2), used by Home ("Briefs for you") and Find briefs (#jobs).
   Bid sits bottom-left, Save and Hide bottom-right, on every card. Save/Hide/Bid clicks are wired by L.jobkit.wire()
   in screens/jobs/jobs.ts: .jobs-save toggles saved, .jobs-hide hides, [data-bid] goes through L.kycGate(id).
   Card classes stay .jobs-* so the swipe, flip and keyboard code keep working. Styles in brief-card.css. */
import { LLD as L, esc, type Job } from "@/apps/creator/core";
import type { JobCardOptions } from "@/apps/creator/core";
import "./brief-card.css";

/** "Best fit" is shown only at this match % or higher (C5). Below it, the plain "60% match" chip. */
export const BEST_FIT_MIN = 75;

export const isBestFit = (match: number): boolean => (Number(match) || 0) >= BEST_FIT_MIN;

export interface BriefCardOptions extends JobCardOptions {
  /** Paints Bid as the screen's one primary button. Every other card gets the outlined Bid. */
  primary?: boolean;
}

/** Match chip: "Best fit" + "82% match" at or above BEST_FIT_MIN, otherwise just "60% match". Nothing without a score. */
export function fitChip(match: number): string {
  const K = L.jobkit;
  const m = Number(match) || 0;
  if (!K || !m) return "";
  return `${isBestFit(m) ? '<span class="jobs-best">Best fit</span>' : ""}${K.pct(m)}`;
}

export function briefCard(j: Job, o: BriefCardOptions = {}): string {
  const K = L.jobkit;
  if (!K) return "";
  const feat = o.variant === "feature";
  const saved = K.isSaved(j.id),
    mine = K.openBid(j.id),
    dl = K.daysTo(j.deadline);
  const reasons = (j.reasons || []).slice(0, feat ? 3 : 2);
  const tid = `jc-${o.ctx || "x"}-${j.id}`;
  const cat = [
    j.category ? esc(j.category) : "",
    mine ? K.pill(mine.status, "You bid · " + K.STATUS[mine.status].label) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const fit = fitChip(j.match);
  const why = reasons.length
    ? `<ul class="jobs-why" aria-label="Why it matches">${reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>`
    : "";
  /* the Bid slot never moves: an open bid swaps the button for a link to it */
  const bid = mine
    ? `<a class="btn-q jobs-bid" href="#bids">See your bid${L.icon("arrow")}</a>`
    : `<button class="lq ${o.primary ? "lq-p" : "lq-s"} lq-sm jobs-bid" type="button" data-bid="${esc(j.id)}">Bid on this</button>`;
  return `<article class="jobs-card${feat ? " jobs-card--feature" : ""}${saved ? " is-saved" : ""}" data-id="${esc(j.id)}" aria-labelledby="${tid}">
      <div class="jobs-card-top">
        ${K.brandChip(j)}
        <span class="jobs-plat">${K.glyph(j.platform)}<span>${esc(K.platName(j.platform))} ${esc(j.format)}</span></span>
      </div>
      <h3 class="jobs-card-t" id="${tid}"><a class="jobs-card-link" href="#job-${esc(j.id)}">${esc(j.title)}</a></h3>
      ${cat ? `<p class="jobs-cat">${cat}</p>` : ""}
      <div class="jobs-money">
        ${feat ? '<p class="jobs-mlab">Budget</p>' : ""}
        <p class="jobs-price t-money">${L.inr(j.budget)}</p>
        <p class="jobs-loc">${L.icon("pin")}<span>${esc(K.where(j))}</span></p>
        ${feat ? `<p class="jobs-net">Bid the budget and you receive <b>${L.inr(L.payout(j.budget).net)}</b>, the agreed price. <span>Tax as per confirmed rules.</span></p>` : ""}
      </div>
      <dl class="jobs-meta">
        <div><dt>Deadline</dt><dd>${esc(L.fmtDate(j.deadline))} <span class="muted">· ${esc(K.daysShort(dl))}</span></dd></div>
        <div><dt>Bids</dt><dd>${j.bids ? j.bids : '<span class="muted">None yet</span>'}</dd></div>
      </dl>
      ${fit || why ? `<div class="jobs-match">${fit}${why}</div>` : ""}
      <div class="jobs-acts">
        ${bid}
        <span class="jobs-acts-grow"></span>
        <button class="chip jobs-save" type="button" aria-pressed="${saved}" aria-label="${saved ? "Saved" : "Save"}: ${esc(j.title)}" title="Save (or swipe right)">${L.icon("bookmark")}<span class="jobs-act-l">${saved ? "Saved" : "Save"}</span></button>
        <button class="chip jobs-hide" type="button" aria-label="Hide: ${esc(j.title)}" title="Hide (or swipe left)">${L.icon("close")}<span class="jobs-act-l">Hide</span></button>
      </div>
    </article>`;
}
