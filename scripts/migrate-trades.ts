// scripts/migrate-trades.ts
//
// One-off (KALM-167): moves every contractor's tradeTypes from the old
// trade names (the 8-category list, the demo seed's six labels, and a few
// early free-text values) to specialities in the new list in
// src/lib/trade-types.ts. Values already on the new list are kept. Old
// values with no sensible new home are listed and left out.
//
// Changing trades this way does NOT flag "update in review" on a Verified
// listing: it's a rename, not the contractor changing what they do.
//
// Dry run by default (prints what would change, writes nothing):
//   npx tsx scripts/migrate-trades.ts
// Then, to save:
//   npx tsx scripts/migrate-trades.ts --apply

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { ALL_SPECIALITIES, isValidTradeType } from '../src/lib/trade-types';

const MAP: Record<string, string[]> = {
  // Old 8-category list
  'Land survey contractor': ['Surveying & setting-out'],
  'Soil investigation/geotechnical contractor': ['Ground improvement & grouting'],
  'Demolition contractor': ['Demolition'],
  'Site clearing contractor': ['Site clearance'],
  'Excavation contractor': ['Excavation & earthwork'],
  'Earthwork/filling contractor': ['Excavation & earthwork'],
  'Dewatering contractor': ['Dewatering'],
  'Shoring contractor': ['Shoring & earth retention'],
  'Piling contractor': ['Piling'],
  'Anti-termite treatment contractor': ['Anti-termite treatment'],
  'Foundation contractor': ['Foundations'],
  'RCC contractor': ['RCC work'],
  'Reinforcement/rebar contractor': ['Rebar / steel fixing'],
  'Shuttering/formwork contractor': ['Shuttering / formwork'],
  'Concrete/RMC supplier': ['RCC work'],
  'Structural steel contractor': ['Structural steel fabrication', 'Steel erection'],
  'Masonry contractor': ['Brickwork & masonry'],
  'Blockwork/AAC block contractor': ['AAC / blockwork'],
  'Plastering contractor': ['Internal plaster', 'External plaster'],
  'Screeding contractor': ['Screeding'],
  'Waterproofing contractor': ['Terrace waterproofing', 'Toilet & wet-area waterproofing'],
  'Expansion-joint contractor': ['Expansion joints'],
  'Electrical contractor': ['Internal wiring', 'LT panels & distribution'],
  'Plumbing contractor': ['Internal plumbing'],
  'Sanitary contractor': ['Sanitary fixtures'],
  'Fire-fighting contractor': ['Fire hydrant', 'Sprinklers'],
  'Fire-alarm contractor': ['Fire alarm & detection'],
  'HVAC/AC contractor': ['Split & VRF / VRV AC'],
  'Lift/elevator contractor': ['Passenger lifts'],
  'DG/power-backup contractor': ['DG sets'],
  'Solar contractor': ['Solar PV'],
  'ELV contractor': ['Structured cabling & networking'],
  'CCTV contractor': ['CCTV'],
  'Access-control contractor': ['Access control'],
  'Networking/structured-cabling contractor': ['Structured cabling & networking'],
  'BMS contractor': ['BMS / IBMS'],
  'Aluminium-window contractor': ['Aluminium windows'],
  'uPVC-window contractor': ['UPVC windows & doors'],
  'Glazing contractor': ['Structural glazing'],
  'Façade contractor': ['Curtain wall'],
  'Structural-glazing contractor': ['Structural glazing'],
  'ACP/cladding contractor': ['ACP / aluminium cladding'],
  'Metal-fabrication contractor': ['MS fabrication'],
  'MS-grill/railing contractor': ['MS / SS railings', 'Grills'],
  'Fire-door contractor': ['Fire-rated doors'],
  'Wooden-door contractor': ['Wooden doors'],
  'Rolling-shutter contractor': ['Rolling shutters'],
  'Flooring contractor': ['Vitrified / ceramic tiles'],
  'Marble/granite contractor': ['Marble flooring', 'Granite flooring'],
  'Tile contractor': ['Vitrified / ceramic tiles'],
  'Painting contractor': ['Internal painting', 'External painting'],
  'Gypsum/POP contractor': ['Gypsum / POP false ceiling'],
  'False-ceiling contractor': ['Gypsum / POP false ceiling'],
  'Carpentry contractor': ['Carpentry & joinery'],
  'Joinery contractor': ['Carpentry & joinery'],
  'Modular-kitchen contractor': ['Modular kitchens'],
  'Wardrobe contractor': ['Wardrobes & cabinetry'],
  'Glass/mirror contractor': ['Glass partitions'],
  'Wallpaper/decorative-finish contractor': ['Texture painting'],
  'Sanitary-fitting contractor': ['Sanitary fixtures'],
  'Road/paver contractor': ['Internal roads', 'Paver blocks'],
  'Landscaping contractor': ['Softscape / planting', 'Hardscape'],
  'Compound-wall contractor': ['Compound wall & gates'],
  'External drainage contractor': ['External drainage & utilities'],
  'External plumbing contractor': ['Water supply lines'],
  'External electrical contractor': ['Street lighting'],
  'Rainwater-harvesting contractor': ['Rainwater harvesting'],
  'STP contractor': ['STP (sewage treatment)'],
  'Water-treatment contractor': ['WTP (water treatment)'],
  'Underground-tank contractor': ['Water tanks (UGT / OHT)'],
  'Swimming-pool contractor': ['Swimming pools & filtration'],
  'Gym/sports contractor': ['Gym equipment', 'Sports flooring & courts'],
  'Waterproofing specialist': ['Basement waterproofing', 'Terrace waterproofing'],
  'Acoustic contractor': ['Acoustic ceilings & panels'],
  'Home-automation contractor': ['Home automation'],
  'EV-charging contractor': ['EV charging'],
  'Kitchen/exhaust contractor': ['Kitchen exhaust'],
  'Solar-water-heater contractor': ['Hot water & solar water heating'],
  'Waste-management contractor': ['Organic waste converter'],
  'Testing & commissioning contractor': ['Electrical testing & commissioning'],

  // Demo seed labels (the placeholder profiles)
  'RCC & Structural': ['RCC work', 'Foundations'],
  Electrical: ['Internal wiring', 'LT panels & distribution'],
  Waterproofing: ['Terrace waterproofing', 'Toilet & wet-area waterproofing'],
  'Interior Fit-out': ['Full interior fit-out', 'Gypsum / POP false ceiling'],
  Plumbing: ['Internal plumbing', 'Sanitary fixtures'],
  'Facade & Cladding': ['ACP / aluminium cladding', 'Structural glazing'],

  // Early free-text values on test accounts
  Fire: ['Fire hydrant', 'Extinguishers & hose reels'],
  rcc: ['RCC work'],
};

// Every target must exist in the new list; fail loudly on a typo here
// rather than writing a value the site won't recognise.
for (const [from, to] of Object.entries(MAP)) {
  for (const t of to) {
    if (!isValidTradeType(t)) throw new Error(`Mapping for "${from}" points at unknown speciality "${t}"`);
  }
}

// Old values are matched regardless of capitals and spacing ("RCC",
// "rcc ", "Rcc" all find the same new home).
const key = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();
const MAP_BY_KEY = new Map<string, string[]>(Object.entries(MAP).map(([from, to]) => [key(from), to]));
for (const sp of ALL_SPECIALITIES) if (!MAP_BY_KEY.has(key(sp))) MAP_BY_KEY.set(key(sp), [sp]);

async function main() {
  const apply = process.argv.includes('--apply');
  const contractors = await prisma.contractor.findMany({
    select: { id: true, name: true, tradeTypes: true },
    orderBy: { name: 'asc' },
  });

  let changed = 0;
  const unmapped = new Map<string, number>();

  for (const c of contractors) {
    const next: string[] = [];
    for (const value of c.tradeTypes) {
      if (isValidTradeType(value)) next.push(value);
      else if (MAP_BY_KEY.has(key(value))) next.push(...MAP_BY_KEY.get(key(value))!);
      else unmapped.set(value, (unmapped.get(value) ?? 0) + 1);
    }
    const deduped = Array.from(new Set(next));
    const same = deduped.length === c.tradeTypes.length && deduped.every((v, i) => v === c.tradeTypes[i]);
    if (same) continue;

    changed++;
    console.log(`${c.name}\n   was: ${c.tradeTypes.join(', ') || '(none)'}\n   now: ${deduped.join(', ') || '(none)'}`);
    if (apply) {
      await prisma.contractor.update({ where: { id: c.id }, data: { tradeTypes: deduped } });
    }
  }

  console.log(`\n${changed} of ${contractors.length} contractors ${apply ? 'updated' : 'would change'}.`);
  if (unmapped.size > 0) {
    console.log('Old values with no new home (left out):');
    for (const [v, n] of unmapped) console.log(`   "${v}" on ${n} profile(s)`);
  }
  if (!apply) console.log('Dry run only. Nothing was saved. Add --apply to save.');
}

main().finally(() => prisma.$disconnect());
