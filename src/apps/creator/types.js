/* Linkloom Creator Dashboard: the data model. One in-memory `State` object (see src/apps/creator/data/seed.ts) holds everything.

   Conventions used throughout:
   - Money is ALWAYS integer paise (₹1 = 100): see `Paise`. Only form inputs ever hold rupees.
   - `IsoDay` is "YYYY-MM-DD". `IsoInstant` is a full ISO timestamp, usually with a +05:30 offset.
   - A field marked optional is genuinely absent on some rows, or appears only after a screen writes it at runtime.
     The comment says which. */

/** Integer paise. ₹12,500 is 1250000. */

/** Calendar day, "YYYY-MM-DD". */

/** Full ISO 8601 timestamp, e.g. "2026-11-03T18:10:00+05:30". */

/** Either form; `D()` in core accepts both. */

/** Brand chip colour: coral, blue/violet, yellow. */

/* ---------- session ---------- */

/** "email": email + password or an emailed code, the only way to sign up since 2026-11-13. "mobile": older accounts
    made with an SMS code. "google": the prototype's Google sign-in. */

/* ---------- the creator ---------- */

/** [city, percent of audience] */

/** The creator's lowest price, kept on the server as a package. Brands see it as "From ₹X per <format>". */

/* ---------- KYC ---------- */

/* ---------- jobs ---------- */

/** Absent on an open job. Discovery filters out "hired". */

/** Find Jobs filter state. Kept when opening a job and coming back; mirrored to sessionStorage minus the last two. */

/* ---------- bids ---------- */

/** Unsent bid form. Every field is the raw input text; this is the one place rupees and text are not yet paise. */

/* ---------- active work ---------- */

/** Work stage. Payment status is separate on purpose: "approved" is not the same as "paid". */

/** All optional: screens start from `s.workUI || (s.workUI = {})` and validate each value before use. */

/* ---------- chat ---------- */

/** Chat exists only with brands that accepted a bid. */

/* ---------- money ---------- */

/** paid = released from escrow into the Linkloom balance (cleared); pending = approved, still clearing;
    failed = the release did not go through (never counted). */

/** Subscription. No price is ever shown in the app. */

/* ---------- notifications ---------- */

/* ---------- the whole state ---------- */
