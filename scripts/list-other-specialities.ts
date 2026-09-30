// scripts/list-other-specialities.ts
//
// "Other, tell us" report (KALM-167): every speciality contractors typed in
// themselves because it wasn't on the list, grouped by trade and counted.
// Run it every month or so; anything that keeps coming up is a candidate to
// add to src/lib/trade-types.ts properly. Read-only.
//
//   npx tsx scripts/list-other-specialities.ts

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { parseOtherSpeciality } from '../src/lib/trade-types';

async function main() {
  const contractors = await prisma.contractor.findMany({ select: { name: true, tradeTypes: true } });
  const byTrade = new Map<string, Map<string, string[]>>();

  for (const c of contractors) {
    for (const value of c.tradeTypes) {
      const other = parseOtherSpeciality(value);
      if (!other) continue;
      const key = other.text.toLowerCase();
      const trade = byTrade.get(other.trade) ?? new Map<string, string[]>();
      trade.set(key, [...(trade.get(key) ?? []), c.name]);
      byTrade.set(other.trade, trade);
    }
  }

  if (byTrade.size === 0) {
    console.log('No typed-in specialities yet.');
    return;
  }
  for (const [trade, items] of byTrade) {
    console.log(`\n${trade}`);
    for (const [text, names] of [...items].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`   ${names.length}×  ${text}   (${names.join(', ')})`);
    }
  }
}

main().finally(() => prisma.$disconnect());
