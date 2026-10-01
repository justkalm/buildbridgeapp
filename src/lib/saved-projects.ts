// src/lib/saved-projects.ts
//
// Saved projects: a developer's reusable quote details (name, work needed,
// location, optional budget, details), so they never retype the same
// project for every contractor. Created from the dashboard ("Your
// projects") or by ticking "Save these details as a project" on a quote
// form. See the SavedProject model in prisma/schema.prisma.
//
// budgetRupees is a BigInt in the database (crore-scale amounts overflow a
// 32-bit Int) but JSON can't carry BigInt, so toClient() turns it into a
// plain number. Every amount we allow (max Rs. 1 lakh crore) fits in a
// JavaScript number exactly.

import { z } from 'zod';
import { MAX_BUDGET_RUPEES } from '@/lib/budget';
import { prisma } from '@/lib/prisma';

// Plenty for any real developer; stops a runaway script filling the table.
export const MAX_SAVED_PROJECTS = 50;

export const savedProjectInputSchema = z.object({
  name: z.string().trim().min(1, 'Give the project a name').max(80),
  workNeeded: z.string().trim().max(100).nullish(),
  location: z.string().trim().min(1, 'Add a location').max(200),
  budgetAmount: z.number().int().min(1).max(MAX_BUDGET_RUPEES).nullish(),
  details: z.string().trim().min(1, 'Add some project details').max(2000),
});

export type SavedProjectInput = z.infer<typeof savedProjectInputSchema>;

export type SavedProjectClient = {
  id: string;
  name: string;
  workNeeded: string | null;
  location: string;
  budgetAmount: number | null;
  details: string;
  updatedAt: string;
};

export const savedProjectSelect = {
  id: true,
  name: true,
  workNeeded: true,
  location: true,
  budgetRupees: true,
  details: true,
  updatedAt: true,
} as const;

export function toClient(row: {
  id: string;
  name: string;
  workNeeded: string | null;
  location: string;
  budgetRupees: bigint | null;
  details: string;
  updatedAt: Date;
}): SavedProjectClient {
  return {
    id: row.id,
    name: row.name,
    workNeeded: row.workNeeded,
    location: row.location,
    budgetAmount: row.budgetRupees === null ? null : Number(row.budgetRupees),
    details: row.details,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toData(input: SavedProjectInput) {
  return {
    name: input.name,
    workNeeded: input.workNeeded || null,
    location: input.location,
    budgetRupees: input.budgetAmount ? BigInt(input.budgetAmount) : null,
    details: input.details,
  };
}

/**
 * Saves a new project for this developer, unless they're at the cap.
 * Returns the saved project, or null if the cap was reached.
 */
export async function createSavedProject(developerId: string, input: SavedProjectInput) {
  const count = await prisma.savedProject.count({ where: { developerId } });
  if (count >= MAX_SAVED_PROJECTS) return null;
  const row = await prisma.savedProject.create({
    data: { developerId, ...toData(input) },
    select: savedProjectSelect,
  });
  return toClient(row);
}
