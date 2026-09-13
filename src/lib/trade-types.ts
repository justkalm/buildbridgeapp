// src/lib/trade-types.ts
//
// The fixed, closed list of allowed contractor trade types. This is a
// hard constraint, not suggestions: Contractor.tradeTypes only ever
// contains values from this list — see the zod .refine() calls in every
// route that writes tradeTypes for where that's enforced server-side.
//
// Before this existed, tradeTypes was pure free text (comma-separated
// input, no validation at all) — which meant the same trade could be
// entered as "Electrician", "electrical work", and "Electrical
// Contractor" as three different strings, silently breaking the browse
// filter dropdown (which just lists whatever distinct strings happen to
// exist in the database) and making search/matching unreliable. A closed
// list fixes that at the source.
//
// Grouped into 8 categories matching how contractors actually think about
// their trade, used to render the picker UI in grouped sections — the
// grouping is presentational only, `ALL_TRADE_TYPES` (flattened) is what
// validation actually checks against.

export const TRADE_TYPE_CATEGORIES = [
  {
    category: 'Pre-Construction',
    trades: [
      'Land survey contractor',
      'Soil investigation/geotechnical contractor',
      'Demolition contractor',
      'Site clearing contractor',
      'Excavation contractor',
      'Earthwork/filling contractor',
      'Dewatering contractor',
      'Shoring contractor',
      'Piling contractor',
      'Anti-termite treatment contractor',
    ],
  },
  {
    category: 'Civil & Structural',
    trades: [
      'Foundation contractor',
      'RCC contractor',
      'Reinforcement/rebar contractor',
      'Shuttering/formwork contractor',
      'Concrete/RMC supplier',
      'Structural steel contractor',
      'Masonry contractor',
      'Blockwork/AAC block contractor',
      'Plastering contractor',
      'Screeding contractor',
      'Waterproofing contractor',
      'Expansion-joint contractor',
    ],
  },
  {
    category: 'MEP',
    trades: [
      'Electrical contractor',
      'Plumbing contractor',
      'Sanitary contractor',
      'Fire-fighting contractor',
      'Fire-alarm contractor',
      'HVAC/AC contractor',
      'Lift/elevator contractor',
      'DG/power-backup contractor',
      'Solar contractor',
      'ELV contractor',
      'CCTV contractor',
      'Access-control contractor',
      'Networking/structured-cabling contractor',
      'BMS contractor',
    ],
  },
  {
    category: 'Doors, Windows & Façade',
    trades: [
      'Aluminium-window contractor',
      'uPVC-window contractor',
      'Glazing contractor',
      'Façade contractor',
      'Structural-glazing contractor',
      'ACP/cladding contractor',
      'Metal-fabrication contractor',
      'MS-grill/railing contractor',
      'Fire-door contractor',
      'Wooden-door contractor',
      'Rolling-shutter contractor',
    ],
  },
  {
    category: 'Interior & Finishing',
    trades: [
      'Flooring contractor',
      'Marble/granite contractor',
      'Tile contractor',
      'Painting contractor',
      'Gypsum/POP contractor',
      'False-ceiling contractor',
      'Carpentry contractor',
      'Joinery contractor',
      'Modular-kitchen contractor',
      'Wardrobe contractor',
      'Glass/mirror contractor',
      'Wallpaper/decorative-finish contractor',
      'Sanitary-fitting contractor',
    ],
  },
  {
    category: 'External Development',
    trades: [
      'Road/paver contractor',
      'Landscaping contractor',
      'Compound-wall contractor',
      'External drainage contractor',
      'External plumbing contractor',
      'External electrical contractor',
      'Rainwater-harvesting contractor',
      'STP contractor',
      'Water-treatment contractor',
      'Underground-tank contractor',
    ],
  },
  {
    category: 'Specialist Works',
    trades: [
      'Swimming-pool contractor',
      'Gym/sports contractor',
      'Waterproofing specialist',
      'Acoustic contractor',
      'Home-automation contractor',
      'EV-charging contractor',
      'Kitchen/exhaust contractor',
      'Solar-water-heater contractor',
      'Waste-management contractor',
      'Pest-control contractor',
    ],
  },
  {
    category: 'Project Support',
    trades: [
      'Scaffolding contractor',
      'Crane/equipment contractor',
      'Construction-equipment rental contractor',
      'Labour contractor',
      'Material-handling contractor',
      'Security contractor',
      'Site-cleaning contractor',
      'Final-cleaning contractor',
      'Testing & commissioning contractor',
      'Snagging/defect-rectification contractor',
    ],
  },
] as const;

export const ALL_TRADE_TYPES: string[] = TRADE_TYPE_CATEGORIES.flatMap((c) => c.trades);

const ALL_TRADE_TYPES_SET = new Set(ALL_TRADE_TYPES);

export function isValidTradeType(value: string): boolean {
  return ALL_TRADE_TYPES_SET.has(value);
}
