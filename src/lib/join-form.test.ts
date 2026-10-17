import { describe, expect, it } from 'vitest';
import { JOIN_MAX_PROJECTS, JOIN_MIN_PROJECTS, joinFormSchema, readJoinProjects } from './join-form';

const BLOB = 'https://abc123.public.blob.vercel-storage.com/join/photo-x.jpg';
const BLOB2 = 'https://abc123.public.blob.vercel-storage.com/join/photo-y.jpg';
const DETAILS = { area: 'Thane', builtUpAreaSqft: 45000, siteVisitPossible: true };

const valid = {
  businessName: 'Test Builders',
  phone: '+919800000000',
  email: 'test@example.com',
  area: 'Andheri West',
  tradeTypes: ['Demolition'],
  hasInsurance: true,
  gstNumber: '27ABCDE1234F1Z5',
  bio: 'We do piling and excavation for residential towers in Thane.',
  projects: [
    { ...DETAILS, name: 'Tower A', developerName: 'Some Developer', imageUrls: [BLOB, BLOB2] },
    { ...DETAILS, name: 'Tower B', imageUrls: [BLOB, BLOB2] },
    { ...DETAILS, name: 'Tower C', imageUrls: [BLOB, BLOB2] },
  ],
  consent: true,
};

describe('joinFormSchema', () => {
  it('accepts a complete form and tidies the GST number', () => {
    const r = joinFormSchema.safeParse({ ...valid, gstNumber: ' 27abcde1234f1z5 ', logoUrl: BLOB });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.gstNumber).toBe('27ABCDE1234F1Z5');
  });
  it('treats blank optional fields as not given', () => {
    const r = joinFormSchema.safeParse({ ...valid, licenceNumber: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.licenceNumber).toBeUndefined();
    }
  });
  it('refuses a missing or wrongly shaped GST number', () => {
    expect(joinFormSchema.safeParse({ ...valid, gstNumber: '12345' }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, gstNumber: '' }).success).toBe(false);
    const { gstNumber: _omit, ...noGst } = valid;
    void _omit;
    expect(joinFormSchema.safeParse(noGst).success).toBe(false);
  });
  it('refuses photos that are not on our own storage', () => {
    const outside = {
      ...valid,
      projects: [...valid.projects.slice(1), { ...DETAILS, name: 'X', imageUrls: [BLOB, 'https://example.com/a.jpg'] }],
    };
    expect(joinFormSchema.safeParse(outside).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, logoUrl: 'https://example.com/logo.png' }).success).toBe(false);
  });
  it('needs a real bio', () => {
    expect(joinFormSchema.safeParse({ ...valid, bio: '' }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, bio: 'Contractor' }).success).toBe(false);
  });
  it('needs the consent tick, a trade and a business name', () => {
    expect(joinFormSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, tradeTypes: [] }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, businessName: ' ' }).success).toBe(false);
  });
  it('checks the phone number looks like one', () => {
    expect(joinFormSchema.safeParse({ ...valid, phone: 'aaaaaaa' }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, phone: '98200 12345' }).success).toBe(true);
    expect(joinFormSchema.safeParse({ ...valid, phone: '+91-98200-12345' }).success).toBe(true);
  });
  it('only takes photos from the join upload folder', () => {
    const other = 'https://abc123.public.blob.vercel-storage.com/some-listing-photo.jpg';
    expect(joinFormSchema.safeParse({ ...valid, logoUrl: other }).success).toBe(false);
  });
  it('caps the number of projects', () => {
    const many = Array.from({ length: JOIN_MAX_PROJECTS + 1 }, (_, i) => ({ ...DETAILS, name: `P${i}`, imageUrls: [BLOB, BLOB2] }));
    expect(joinFormSchema.safeParse({ ...valid, projects: many }).success).toBe(false);
  });
  it('needs at least 3 projects, each with at least 2 photos', () => {
    expect(joinFormSchema.safeParse({ ...valid, projects: valid.projects.slice(0, JOIN_MIN_PROJECTS - 1) }).success).toBe(false);
    const onePhoto = [...valid.projects.slice(1), { ...DETAILS, name: 'Tower D', imageUrls: [BLOB] }];
    expect(joinFormSchema.safeParse({ ...valid, projects: onePhoto }).success).toBe(false);
  });
  it('needs each project location, built-up area and site visit answer', () => {
    for (const missing of ['area', 'builtUpAreaSqft', 'siteVisitPossible'] as const) {
      const broken = { ...valid.projects[0] } as Record<string, unknown>;
      delete broken[missing];
      expect(joinFormSchema.safeParse({ ...valid, projects: [broken, ...valid.projects.slice(1)] }).success).toBe(false);
    }
  });
  it('needs the insurance yes or no', () => {
    const { hasInsurance: _omit, ...noAnswer } = valid;
    void _omit;
    expect(joinFormSchema.safeParse(noAnswer).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, hasInsurance: false }).success).toBe(true);
  });
});

describe('readJoinProjects', () => {
  it('reads stored projects back and turns anything odd into an empty list', () => {
    expect(readJoinProjects([{ name: 'A', imageUrls: [] }])).toEqual([{ name: 'A', imageUrls: [] }]);
    expect(readJoinProjects('nonsense')).toEqual([]);
    expect(readJoinProjects(null)).toEqual([]);
  });
});
