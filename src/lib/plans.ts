// src/lib/plans.ts
//
// One switch for everything the public sees about paid plans: the Pricing
// page and its footer link, the "Promoted" badge on Browse cards, the plan
// name on the contractor dashboard, and the "upgrade" wording on locked
// leads. OFF for the pilot (owner, 15 Oct 2026): there is no payment system
// yet, and during the pilot every contractor is set to Plus by hand in admin
// so project alerts reach them (alerts need Plus or Pro). With the switch off
// Browse also stops ranking by plan, so nobody sits above anyone else.
// The plans themselves stay in the database and the alert rule still uses
// them; set this to true to show plans and paid ranking again.
export const SHOW_PLANS = false;
