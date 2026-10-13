import { describe, expect, it } from 'vitest';
import { workedWithNames, workedWithSummary } from './worked-with';

describe('workedWithNames', () => {
  it('keeps distinct names in first-seen order', () => {
    const rows = [{ developerName: 'Lodha' }, { developerName: 'Godrej' }, { developerName: 'Lodha' }];
    expect(workedWithNames(rows, false)).toEqual(['Lodha', 'Godrej']);
  });
  it('trims, ignores case and spacing differences, and drops blanks', () => {
    const rows = [
      { developerName: '  Rustomjee  Group ' },
      { developerName: 'rustomjee group' },
      { developerName: '   ' },
      { developerName: null },
    ];
    expect(workedWithNames(rows, false)).toEqual(['Rustomjee Group']);
  });
  it('shows nothing for a demo contractor', () => {
    expect(workedWithNames([{ developerName: 'Made Up Developers' }], true)).toEqual([]);
  });
});

describe('workedWithSummary', () => {
  it('shows the first names and counts the rest', () => {
    expect(workedWithSummary(['A', 'B', 'C', 'D', 'E'], 3)).toEqual({ shown: 'A, B, C', more: 2 });
  });
  it('has nothing left over when the list is short', () => {
    expect(workedWithSummary(['A'], 3)).toEqual({ shown: 'A', more: 0 });
  });
});
