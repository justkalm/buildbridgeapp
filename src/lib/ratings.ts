// src/lib/ratings.ts
//
// One switch for every star rating and review on the public site: Browse
// cards, the contractor profile header, each project card and the project
// photo viewer. OFF since 2 Oct 2026 (owner): (kalm) isn't collecting real
// client reviews yet, so the site shouldn't show ratings it can't vouch
// for. The data stays in the database (admin can still edit it); set this
// to true to show ratings again once reviews are real.
export const SHOW_RATINGS = false;
