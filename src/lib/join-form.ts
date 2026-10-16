// src/lib/join-form.ts
//
// Rules for the no-login contractor onboarding form at /join (16 Oct 2026).
// The team sends the /join link on WhatsApp or email; the contractor fills
// it in; admin reads it at /admin/applications and makes the listing by
// hand. Shared by the API route (the real check) and the page (limits shown
// to the person, so they hear about a problem before they press Send).
//
// Every image URL must point at our own Vercel Blob store (see
// src/lib/validate-image-url.ts for why), so a hand-made request can't slip
// an outside image into an application.

import { z } from 'zod';
import { tradeTypesField } from '@/lib/project-validation';
import { normalizeLocation } from '@/lib/location';
import { isOwnBlobImageUrl } from '@/lib/validate-image-url';

export const JOIN_MAX_PROJECTS = 10;
export const JOIN_MAX_PHOTOS_PER_PROJECT = 10;
export const JOIN_MAX_BIO = 1000;

// A GSTIN is 15 letters and digits (2-digit state code, PAN, entity number,
// "Z", check character). We only check the shape here, to catch typing
// slips; admin still checks it on the GST portal before verifying.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;

const blobUrl = z
  .string()
  .trim()
  .max(1000)
  .refine(isOwnBlobImageUrl, { message: 'Please upload the photo again.' });

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
  imageUrls: z
    .array(blobUrl)
    .max(JOIN_MAX_PHOTOS_PER_PROJECT, `Up to ${JOIN_MAX_PHOTOS_PER_PROJECT} photos per project`),
});

export type JoinProject = z.infer<typeof joinProjectSchema>;

export const joinFormSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required').max(200),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
  email: z.string().trim().email('Enter a valid email address').max(320),
  area: z.string().trim().min(1, 'Area is required').max(100).transform(normalizeLocation),
  bio: optionalText(JOIN_MAX_BIO),
  logoUrl: blobUrl.optional(),
  tradeTypes: tradeTypesField().refine((types) => types.length > 0, {
    message: 'Pick your trade and at least one speciality',
  }),
  gstNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, '').toUpperCase() : undefined))
    .refine((v) => v === undefined || GSTIN_PATTERN.test(v), {
      message: 'A GST number is 15 letters and digits, for example 27ABCDE1234F1Z5',
    }),
  licenceNumber: optionalText(100),
  projects: z
    .array(joinProjectSchema)
    .max(JOIN_MAX_PROJECTS, `Up to ${JOIN_MAX_PROJECTS} projects`),
  consent: z.literal(true, { message: 'Please tick the box to let us use these details' }),
});

export type JoinFormInput = z.infer<typeof joinFormSchema>;

/** Reads the stored projects JSON back safely (old or odd rows become []). */
export function readJoinProjects(value: unknown): JoinProject[] {
  const parsed = z.array(joinProjectSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
