// src/lib/join-form.ts
//
// Rules for the no-login contractor onboarding form at /join (16 Oct 2026).
// The team sends the /join link on WhatsApp or email; the contractor fills
// it in; admin reads it at /admin/applications and makes the listing by
// hand. Shared by the API route (the real check) and the page (limits shown
// to the person, so they hear about a problem before they press Send).
//
// Every image URL must point at a Vercel Blob store (see
// src/lib/validate-image-url.ts for why) AND sit in the join/ folder that
// /api/join/upload writes to, so a hand-made request can't slip an outside
// image, or some other file on Blob, into an application.

import { z } from 'zod';
import { tradeTypesField } from '@/lib/project-validation';
import { normalizeLocation } from '@/lib/location';
import { isOwnBlobImageUrl } from '@/lib/validate-image-url';
import { MAX_DB_INT } from '@/lib/project-fields';

// Owner's rule (16 Oct 2026): every contractor lists 3 to 5 projects, each
// with photos. 1 photo minimum (17 Oct: was 2; photos were the main reason
// people would give up on the form), 6 at most. More photos are nudged
// later by the dashboard checklist (src/components/OnboardingPanel.tsx).
export const JOIN_MIN_PROJECTS = 3;
export const JOIN_MAX_PROJECTS = 5;
export const JOIN_MIN_PHOTOS_PER_PROJECT = 1;
export const JOIN_MAX_PHOTOS_PER_PROJECT = 6;
export const JOIN_MAX_BIO = 1000;

// A GSTIN is 15 letters and digits (2-digit state code, PAN, entity number,
// "Z", check character). We only check the shape here, to catch typing
// slips; admin still checks it on the GST portal before verifying.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;

function isJoinUploadUrl(url: string): boolean {
  if (!isOwnBlobImageUrl(url)) return false;
  return new URL(url).pathname.startsWith('/join/');
}

const blobUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(isJoinUploadUrl, { message: 'Please upload the photo again.' });

// Digits, spaces, '+', '-' and brackets only, with 10 to 15 digits (an
// Indian mobile is 10, or 12 with the 91 in front).
const PHONE_CHARS = /^[0-9+\-\s()]+$/;
function digitCount(v: string): number {
  return v.replace(/[^0-9]/g, '').length;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const joinProjectSchema = z.object({
  name: z.string().trim().min(1, 'Each project needs a name').max(200),
  developerName: optionalText(200),
  // Where the project is (area, as on the rest of the site), its built-up
  // area, and whether the contractor can arrange a site visit there (the
  // building's owner has to agree, so it's "can you arrange", not "is it
  // possible"). Owner's rule, 16 Oct 2026. The live Project has no place
  // for location or the visit answer yet, so admin sees them here only.
  area: z.string().trim().min(1, 'Pick where each project is').max(100).transform(normalizeLocation),
  builtUpAreaSqft: z
    .number({ message: 'Enter the built-up area of each project in sq ft' })
    .int('Built-up area must be a whole number of sq ft')
    .positive('Enter the built-up area of each project in sq ft')
    .max(MAX_DB_INT, 'That built-up area looks too large. Check for extra zeros.'),
  siteVisitPossible: z.boolean({ message: 'Tell us for each project whether you can arrange a site visit' }),
  imageUrls: z
    .array(blobUrl)
    .min(JOIN_MIN_PHOTOS_PER_PROJECT, 'Add at least one photo to each project')
    .max(JOIN_MAX_PHOTOS_PER_PROJECT, `Up to ${JOIN_MAX_PHOTOS_PER_PROJECT} photos per project`),
});

export type JoinProject = z.infer<typeof joinProjectSchema>;

export const joinFormSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required').max(200),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => PHONE_CHARS.test(v) && digitCount(v) >= 10 && digitCount(v) <= 15, {
      message: 'Enter a valid phone number, for example +91 98200 12345',
    }),
  email: z.string().trim().email('Enter a valid email address').max(320),
  area: z.string().trim().min(1, 'Area is required').max(100).transform(normalizeLocation),
  // Required (owner, 17 Oct 2026). 30 characters is about one real sentence.
  bio: z
    .string()
    .trim()
    .min(30, 'Tell us a little more about your business (a sentence or two)')
    .max(JOIN_MAX_BIO),
  logoUrl: blobUrl.optional(),
  tradeTypes: tradeTypesField().refine((types) => types.length > 0, {
    message: 'Pick your trade and at least one speciality',
  }),
  // Required (owner, 16 Oct 2026): developers want GST invoices.
  gstNumber: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .refine((v) => v.length > 0, { message: 'GST number is required' })
    .refine((v) => v.length === 0 || GSTIN_PATTERN.test(v), {
      message: 'A GST number is 15 letters and digits, for example 27ABCDE1234F1Z5',
    }),
  licenceNumber: optionalText(100),
  hasInsurance: z.boolean({ message: 'Tell us whether you have insurance (Yes or No)' }),
  projects: z
    .array(joinProjectSchema)
    .min(JOIN_MIN_PROJECTS, `List at least ${JOIN_MIN_PROJECTS} projects`)
    .max(JOIN_MAX_PROJECTS, `Up to ${JOIN_MAX_PROJECTS} projects`),
  consent: z.literal(true, { message: 'Please tick the box to let us use these details' }),
});

export type JoinFormInput = z.infer<typeof joinFormSchema>;

// Looser than joinProjectSchema on purpose: rows were checked when they
// came in, and if the rules above get stricter later, older rows should
// still show their projects rather than quietly showing none.
const storedProjectSchema = z.object({
  name: z.string(),
  developerName: z.string().optional(),
  area: z.string().optional(),
  builtUpAreaSqft: z.number().optional(),
  siteVisitPossible: z.boolean().optional(),
  imageUrls: z.array(z.string()).catch([]),
});

/** Reads the stored projects JSON back safely (odd rows become []). */
export function readJoinProjects(value: unknown): z.infer<typeof storedProjectSchema>[] {
  const parsed = z.array(storedProjectSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
