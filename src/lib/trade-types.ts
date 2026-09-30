// src/lib/trade-types.ts
//
// The fixed list of contractor trades and their specialities (KALM-167).
// Two levels, as the owner specified on 1 Oct 2026:
//
//   Trade (e.g. "Fire & Life Safety")
//     └─ Specialities (e.g. "Fire hydrant", "Extinguishers & hose reels")
//
//   - A contractor picks one or more trades, then ticks their specialities
//     inside each (TradeTypePicker). If something's missing they can type
//     their own ("Other, tell us"), which is how the list grows: see
//     scripts/list-other-specialities.ts.
//   - A developer filters Browse by TRADE only; a contractor matches when
//     any of their specialities belongs to that trade.
//   - Cards and profiles show the specialities.
//
// Storage: Contractor.tradeTypes holds speciality labels, so no database
// change was needed; the trade is looked up from the speciality. That's
// why every speciality label must be unique across the whole list and
// read sensibly on its own on a card ("Basement waterproofing", not
// "Basement"). A typed-in speciality is stored as
// "Other|<trade>|<text>" so it still belongs to a trade for filtering.
//
// Replaces the older 8-category / ~90-item list; scripts/migrate-trades.ts
// moves existing profiles across. The list came from the owner's research,
// cleaned up (duplicates merged, Indian site terms such as Mivan, Trimix,
// POP, UGT/OHT). `common` marks the trades almost every Mumbai residential
// project hires; those are the homepage shortcuts.

export type TradeDef = { trade: string; common: boolean; specialities: readonly string[] };

export const TRADES: readonly TradeDef[] = [
  {
    trade: 'Site & Groundworks',
    common: true,
    specialities: [
      'Demolition',
      'Site clearance',
      'Excavation & earthwork',
      'Rock breaking / controlled blasting',
      'Piling',
      'Micro-piling',
      'Diaphragm wall',
      'Shoring & earth retention',
      'Rock / soil anchoring',
      'Dewatering',
      'Ground improvement & grouting',
      'Underpinning',
      'Anti-termite treatment',
      'Surveying & setting-out',
    ],
  },
  {
    trade: 'Civil & RCC',
    common: true,
    specialities: [
      'RCC work',
      'PCC work',
      'Foundations',
      'Rebar / steel fixing',
      'Shuttering / formwork',
      'Mivan (aluminium) formwork',
      'Jump-form / climbing form',
      'Post-tensioning',
      'Brickwork & masonry',
      'AAC / blockwork',
      'Internal plaster',
      'External plaster',
      'Structural repair & strengthening',
      'Expansion joints',
    ],
  },
  {
    trade: 'Structural Steel & Fabrication',
    common: false,
    specialities: [
      'Structural steel fabrication',
      'Steel erection',
      'PEB (pre-engineered buildings)',
      'MS fabrication',
      'Steel staircases',
      'Canopies & pergolas',
    ],
  },
  {
    trade: 'Waterproofing & Roofing',
    common: true,
    specialities: [
      'Basement waterproofing',
      'Terrace waterproofing',
      'Toilet & wet-area waterproofing',
      'Podium waterproofing',
      'External wall waterproofing',
      'Injection grouting',
      'Joint sealing',
      'PU / epoxy coatings',
      'Thermal insulation',
      'Metal / PUF roofing',
      'Standing-seam roofing',
    ],
  },
  {
    trade: 'Facade & Glazing',
    common: false,
    specialities: [
      'Curtain wall',
      'Unitised facade',
      'Structural glazing',
      'Spider glazing',
      'ACP / aluminium cladding',
      'Stone cladding',
      'DGU glass',
      'Louvres & fins',
      'Skylights',
      'Facade access (gondola / BMU)',
      'GRC / GRP / FRP elements',
    ],
  },
  {
    trade: 'Doors & Windows',
    common: true,
    specialities: [
      'Aluminium windows',
      'UPVC windows & doors',
      'Wooden doors',
      'Fire-rated doors',
      'Door & window hardware',
      'Rolling shutters',
    ],
  },
  {
    trade: 'Flooring & Tiling',
    common: true,
    specialities: [
      'Vitrified / ceramic tiles',
      'Marble flooring',
      'Granite flooring',
      'Natural stone flooring',
      'Wooden flooring',
      'Epoxy flooring',
      'Trimix / industrial flooring',
      'Screeding',
    ],
  },
  {
    trade: 'Painting & Coatings',
    common: true,
    specialities: [
      'Internal painting',
      'External painting',
      'Texture painting',
      'Putty work',
      'Fire-retardant coatings',
      'Industrial / anti-corrosion coatings',
    ],
  },
  {
    trade: 'Ceilings, Partitions & Interiors',
    common: true,
    specialities: [
      'Gypsum / POP false ceiling',
      'Grid / metal ceiling',
      'Acoustic ceilings & panels',
      'Drywall partitions',
      'Glass partitions',
      'Carpentry & joinery',
      'Modular kitchens',
      'Wardrobes & cabinetry',
      'Full interior fit-out',
    ],
  },
  {
    trade: 'Electrical',
    common: true,
    specialities: [
      'HT works & substation',
      'Transformers',
      'LT panels & distribution',
      'Internal wiring',
      'Busduct',
      'Cable tray & cabling',
      'DG sets',
      'Lighting',
      'Facade & landscape lighting',
      'Earthing & lightning protection',
      'Solar PV',
      'EV charging',
      'Electrical testing & commissioning',
    ],
  },
  {
    trade: 'Plumbing & Sanitation',
    common: true,
    specialities: [
      'Internal plumbing',
      'Sanitary fixtures',
      'Water supply lines',
      'Drainage & sewerage',
      'Storm-water drainage',
      'Rainwater harvesting',
      'Water tanks (UGT / OHT)',
      'Hydro-pneumatic systems & pumps',
      'Hot water & solar water heating',
    ],
  },
  {
    trade: 'Fire & Life Safety',
    common: true,
    specialities: [
      'Fire hydrant',
      'Sprinklers',
      'Fire pumps',
      'Fire water tanks',
      'Fire alarm & detection',
      'Extinguishers & hose reels',
      'Gas suppression',
      'Fire stopping & sealing',
      'Smoke management / stair pressurisation',
      'Fire system testing & commissioning',
    ],
  },
  {
    trade: 'HVAC & Ventilation',
    common: false,
    specialities: [
      'Split & VRF / VRV AC',
      'Central AC & chillers',
      'Cooling towers',
      'AHU / FCU',
      'Ducting',
      'Basement ventilation',
      'Smoke extraction',
      'Kitchen exhaust',
      'Fresh air systems',
      'HVAC insulation',
      'HVAC testing & balancing',
    ],
  },
  {
    trade: 'Lifts & Parking Systems',
    common: true,
    specialities: [
      'Passenger lifts',
      'High-speed lifts',
      'Service / goods lifts',
      'Fire lifts',
      'Stretcher lifts',
      'Escalators',
      'Car lifts',
      'Stack / puzzle parking',
      'Automated parking',
      'Lift modernisation',
    ],
  },
  {
    trade: 'ELV, Security & Automation',
    common: false,
    specialities: [
      'CCTV',
      'Access control',
      'Video door phone & intercom',
      'Structured cabling & networking',
      'Wi-Fi infrastructure',
      'MATV / IPTV',
      'Public address system',
      'Audio-visual',
      'BMS / IBMS',
      'Home automation',
      'Boom barriers, bollards & turnstiles',
      'ANPR / parking management',
      'Perimeter security',
      'Digital signage',
    ],
  },
  {
    trade: 'Utilities & Treatment',
    common: false,
    specialities: [
      'STP (sewage treatment)',
      'WTP (water treatment)',
      'RO / filtration',
      'ETP (effluent treatment)',
      'Water recycling',
      'Organic waste converter',
      'Garbage chute & compactor',
      'LPG bank / PNG gas piping',
      'Diesel (HSD) storage',
    ],
  },
  {
    trade: 'External Development',
    common: false,
    specialities: [
      'Internal roads',
      'Paver blocks',
      'Kerbs & footpaths',
      'Compound wall & gates',
      'External drainage & utilities',
      'Street lighting',
      'Line marking & parking accessories',
    ],
  },
  {
    trade: 'Landscape & Irrigation',
    common: false,
    specialities: [
      'Softscape / planting',
      'Hardscape',
      'Horticulture',
      'Irrigation systems',
      'Green walls',
      'Terrace & podium gardens',
      'Tree transplantation',
    ],
  },
  {
    trade: 'Amenities',
    common: false,
    specialities: [
      'Swimming pools & filtration',
      'Fountains & water features',
      'Jacuzzi, sauna & steam',
      'Gym equipment',
      'Sports flooring & courts',
      "Kids' play area",
      'Clubhouse fit-out',
      'Amphitheatre',
    ],
  },
  {
    trade: 'Metalwork, Railings & Signage',
    common: true,
    specialities: [
      'MS / SS railings',
      'Glass railings & balustrades',
      'Decorative metalwork',
      'Grills',
      'Building signage',
      'Wayfinding & statutory signage',
      'Illuminated signage',
    ],
  },
];

export const ALL_TRADES: string[] = TRADES.map((t) => t.trade);

export const ALL_SPECIALITIES: string[] = TRADES.flatMap((t) => [...t.specialities]);

// Homepage shortcuts: the trades nearly every project hires.
export const HOMEPAGE_TRADES: string[] = TRADES.filter((t) => t.common).map((t) => t.trade);

const TRADE_BY_SPECIALITY = new Map<string, string>(
  TRADES.flatMap((t) => t.specialities.map((s) => [s, t.trade] as const))
);
const TRADE_SET = new Set(ALL_TRADES);

// ---------------------------------------------------------------------------
// "Other, tell us": a speciality the contractor typed themselves.
// ---------------------------------------------------------------------------

const OTHER_PREFIX = 'Other|';
export const MAX_OTHER_LENGTH = 60;
export const MAX_OTHER_PER_CONTRACTOR = 5;

const SPECIALITY_BY_LOWER = new Map<string, string>(ALL_SPECIALITIES.map((sp) => [sp.toLowerCase(), sp]));

function tidyText(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// What a contractor typed into "Something else?". If it's actually a listed
// speciality in any capitals ("sprinklers", "SPRINKLERS"), the listed one is
// used so they still show up under it; otherwise it's saved tidied (single
// spaces, first letter capitalised).
export function makeOtherSpeciality(trade: string, text: string): string {
  const listed = SPECIALITY_BY_LOWER.get(text.trim().replace(/\s+/g, ' ').toLowerCase());
  if (listed) return listed;
  return `${OTHER_PREFIX}${trade}|${tidyText(text)}`;
}

export function parseOtherSpeciality(value: string): { trade: string; text: string } | null {
  if (!value.startsWith(OTHER_PREFIX)) return null;
  const rest = value.slice(OTHER_PREFIX.length);
  const bar = rest.indexOf('|');
  if (bar === -1) return null;
  return { trade: rest.slice(0, bar), text: rest.slice(bar + 1) };
}

export function isOtherSpeciality(value: string): boolean {
  return parseOtherSpeciality(value) !== null;
}

// Tidies a whole list before it's saved (used by the API): typed-in
// specialities go through makeOtherSpeciality again, and duplicates that
// differ only in capitals ("Foam systems" / "foam Systems") are dropped.
export function normalizeTradeTypes(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const other = parseOtherSpeciality(value);
    const tidy = other ? makeOtherSpeciality(other.trade, other.text) : value;
    const key = tidy.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tidy);
  }
  return out;
}

// Server-side check for one stored value: a listed speciality, or a
// well-formed typed-in one under a real trade.
export function isValidTradeType(value: string): boolean {
  if (TRADE_BY_SPECIALITY.has(value)) return true;
  const other = parseOtherSpeciality(value);
  if (!other) return false;
  return (
    TRADE_SET.has(other.trade) &&
    other.text.length >= 2 &&
    other.text.length <= MAX_OTHER_LENGTH &&
    !other.text.includes('|')
  );
}

// ---------------------------------------------------------------------------
// Display helpers. Values that aren't in the list (e.g. old data not yet
// migrated) are shown as-is rather than hidden.
// ---------------------------------------------------------------------------

export function specialityLabel(value: string): string {
  return parseOtherSpeciality(value)?.text ?? value;
}

export function tradeOf(value: string): string | null {
  return TRADE_BY_SPECIALITY.get(value) ?? parseOtherSpeciality(value)?.trade ?? null;
}

// The contractor's trades, in list order.
export function tradesOf(values: readonly string[]): string[] {
  const mine = new Set(values.map(tradeOf).filter((t): t is string => t !== null));
  return ALL_TRADES.filter((t) => mine.has(t));
}

export function hasTrade(values: readonly string[], trade: string): boolean {
  return values.some((v) => tradeOf(v) === trade);
}

// Specialities grouped under their trade, in list order, for profiles.
export function groupByTrade(values: readonly string[]): { trade: string; specialities: string[] }[] {
  const groups = tradesOf(values).map((trade) => ({
    trade,
    specialities: values.filter((v) => tradeOf(v) === trade).map(specialityLabel),
  }));
  const unknown = values.filter((v) => tradeOf(v) === null);
  if (unknown.length > 0) groups.push({ trade: 'Other', specialities: unknown });
  return groups;
}
