// src/lib/mumbai-areas.ts
//
// The one list of Mumbai areas. Signup, the contractor profile, the admin
// add form and the Browse filter all read from here, so a place is always
// spelled one way ("Andheri West", never "Andheri W"). Edit this list to add,
// remove or rename an area; nothing else needs touching.
//
// For now (owner, 5 Oct 2026) the platform is Mumbai only. Bombay counts as
// Mumbai (see src/lib/location.ts). A contractor whose area isn't listed
// picks "Other area" and types it, so nobody is ever blocked.
//
// Thane, Navi Mumbai (Vashi, Airoli...) and Mira Road are NOT Mumbai and are
// deliberately left out.

export const MUMBAI_CITY = 'Mumbai';

export const MUMBAI_AREAS: readonly string[] = [
  // South Mumbai (island city)
  'Colaba',
  'Cuffe Parade',
  'Nariman Point',
  'Fort',
  'Churchgate',
  'Marine Lines',
  'Girgaon',
  'Malabar Hill',
  'Walkeshwar',
  'Tardeo',
  'Grant Road',
  'Mumbai Central',
  'Agripada',
  'Byculla',
  'Mazagaon',
  'Sewri',
  'Wadala',
  'Parel',
  'Lower Parel',
  'Worli',
  'Prabhadevi',
  'Dadar',
  'Matunga',
  'Mahim',
  'Sion',
  // Western suburbs
  'Bandra',
  'Khar',
  'Santacruz',
  'Vile Parle',
  'Andheri East',
  'Andheri West',
  'Jogeshwari',
  'Goregaon',
  'Malad',
  'Kandivali',
  'Borivali',
  'Dahisar',
  // Central and eastern suburbs
  'Kurla',
  'Vidyavihar',
  'Ghatkopar',
  'Vikhroli',
  'Kanjurmarg',
  'Powai',
  'Bhandup',
  'Mulund',
  // Harbour line and east
  'Chembur',
  'Govandi',
  'Mankhurd',
  'Trombay',
];

// The listed spelling of an area, matched without regard to capitals, or
// null if it isn't on the list.
export function canonicalArea(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return null;
  return MUMBAI_AREAS.find((a) => a.toLowerCase() === v) ?? null;
}
