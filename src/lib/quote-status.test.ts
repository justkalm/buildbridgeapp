import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  canTransition,
  developerStatusLabel,
  developerUndoNotice,
  type QuoteStatus,
} from './quote-status';

describe('quote status moves', () => {
  it('lets a new request move to any answer', () => {
    expect(ALLOWED_TRANSITIONS.PENDING).toEqual(['CONTACTED', 'QUOTED', 'DECLINED']);
  });

  it('lets every answered request be undone back to New', () => {
    for (const from of ['CONTACTED', 'QUOTED', 'DECLINED'] as QuoteStatus[]) {
      expect(canTransition(from, 'PENDING')).toBe(true);
    }
  });

  it('does not allow undo on a request that is already New', () => {
    expect(canTransition('PENDING', 'PENDING')).toBe(false);
  });

  it('does not allow jumping between final answers without an undo', () => {
    expect(canTransition('QUOTED', 'DECLINED')).toBe(false);
    expect(canTransition('DECLINED', 'QUOTED')).toBe(false);
    expect(canTransition('QUOTED', 'CONTACTED')).toBe(false);
  });

  it('still lets Talking to them move on to Quote sent or Not interested', () => {
    expect(canTransition('CONTACTED', 'QUOTED')).toBe(true);
    expect(canTransition('CONTACTED', 'DECLINED')).toBe(true);
  });
});

describe('developer wording', () => {
  it('no longer says Accepted', () => {
    expect(developerStatusLabel.CONTACTED).toBe('Contractor is in touch');
    for (const label of Object.values(developerStatusLabel)) {
      expect(label).not.toMatch(/accepted/i);
    }
  });

  it('tells the developer when an update is withdrawn', () => {
    expect(developerUndoNotice).toMatch(/withdrawn/i);
  });
});
