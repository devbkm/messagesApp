import { formatDate, formatDateTime, formatDateTimeForSpeech, formatFileSize } from '../utils/format';
import { validateMessage } from '../utils/validation';

describe('formatting', () => {
  it('formats dates as dd.mm.YYYY with a 24-hour time', () => {
    expect(formatDate('2026-01-03T18:05:00Z')).toBe('03.01.2026');
    expect(formatDateTime('2026-01-03T18:05:00Z')).toBe('03.01.2026, 18:05');
    expect(formatDateTimeForSpeech('2026-01-03T18:05:00Z')).toBe('3 January 2026 at 18:05');
  });

  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('validateMessage', () => {
  it('accepts a valid message', () => {
    expect(validateMessage({ subject: 'Hi', text: 'Body' })).toEqual({});
  });

  it('requires subject and text', () => {
    expect(validateMessage({ subject: ' ', text: '' })).toEqual({
      subject: 'Enter a subject.',
      text: 'Enter a message.',
    });
  });

  it('allows exactly 40 characters and counts after trimming', () => {
    expect(validateMessage({ subject: 'x'.repeat(40), text: 'b' })).toEqual({});
    expect(validateMessage({ subject: `  ${'x'.repeat(40)}  `, text: 'b' })).toEqual({});
    expect(validateMessage({ subject: 'x'.repeat(41), text: 'b' }).subject).toBe(
      'Subject is 1 character too long (max 40).',
    );
  });
});
