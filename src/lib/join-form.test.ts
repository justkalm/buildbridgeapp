import { describe, expect, it } from 'vitest';
import { JOIN_MAX_PROJECTS, joinFormSchema, readJoinProjects } from './join-form';

const BLOB = 'https://abc123.public.blob.vercel-storage.com/join/photo-x.jpg';

const valid = {
  businessName: 'Test Builders',
  phone: '+919800000000',
  email: 'test@example.com',
  area: 'Andheri West',
  tradeTypes: ['Demolition'],
  projects: [{ name: 'Tower A', developerName: 'Some Developer', imageUrls: [BLOB] }],
  consent: true,
};

describe('joinFormSchema', () => {
  it('accepts a complete form and tidies the GST number', () => {
    const r = joinFormSchema.safeParse({ ...valid, gstNumber: ' 27abcde1234f1z5 ', logoUrl: BLOB });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.gstNumber).toBe('27ABCDE1234F1Z5');
  });
  it('treats blank optional fields as not given', () => {
    const r = joinFormSchema.safeParse({ ...valid, bio: '  ', gstNumber: '', licenceNumber: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.bio).toBeUndefined();
      expect(r.data.gstNumber).toBeUndefined();
      expect(r.data.licenceNumber).toBeUndefined();
    }
  });
  it('refuses a GST number of the wrong shape', () => {
    expect(joinFormSchema.safeParse({ ...valid, gstNumber: '12345' }).success).toBe(false);
  });
  it('refuses photos that are not on our own storage', () => {
    const outside = { ...valid, projects: [{ name: 'X', imageUrls: ['https://example.com/a.jpg'] }] };
    expect(joinFormSchema.safeParse(outside).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, logoUrl: 'https://example.com/logo.png' }).success).toBe(false);
  });
  it('needs the consent tick, a trade and a business name', () => {
    expect(joinFormSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, tradeTypes: [] }).success).toBe(false);
    expect(joinFormSchema.safeParse({ ...valid, businessName: ' ' }).success).toBe(false);
  });
  it('caps the number of projects', () => {
    const many = Array.from({ length: JOIN_MAX_PROJECTS + 1 }, (_, i) => ({ name: `P${i}`, imageUrls: [] }));
    expect(joinFormSchema.safeParse({ ...valid, projects: many }).success).toBe(false);
  });
});

describe('readJoinProjects', () => {
  it('reads stored projects back and turns anything odd into an empty list', () => {
    expect(readJoinProjects([{ name: 'A', imageUrls: [] }])).toEqual([{ name: 'A', imageUrls: [] }]);
    expect(readJoinProjects('nonsense')).toEqual([]);
    expect(readJoinProjects(null)).toEqual([]);
  });
});
