/* Trial switches for the creator dashboard. Each is read once at build time from a Vite env variable, so a trial is
   turned on or off by setting the variable and rebuilding (or restarting `vite`). Every trial is OFF unless its
   variable is exactly "1".

   VITE_TRIAL_BID_BEFORE_KYC=1  (brief C10) Bid before the ID check.
     ON:  Bid opens the bid form straight away and the bid is sent without the ID-check detour. The ID check is asked
          for once a brand accepts a bid ("Your bid was accepted. Verify your ID (about 4 minutes) to start.") and
          before the first payout.
     OFF: today's behaviour. The first Bid sends the creator to #kyc and a bid can only be sent once verified.
   TODO(backend): accept bids from unverified creators; block payout until the ID check is approved. Until then the
   server answers KYC_REQUIRED and the bid form falls back to asking for the ID check. */
export const BID_BEFORE_KYC: boolean = import.meta.env.VITE_TRIAL_BID_BEFORE_KYC === "1";
