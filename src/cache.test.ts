import { expect, test } from 'vitest';
import { Cache } from './cache.ts';

test('initializes the requested cache lines and block sizes', () => {
    const cache = new Cache(2, 4);

    expect(cache.lines).toEqual([
        { valid: false, tag: 0, data: [0, 0, 0, 0] },
        { valid: false, tag: 0, data: [0, 0, 0, 0] }
    ]);
});

test('keeps each cache line data block independent', () => {
    const cache = new Cache(2, 2);

    cache.lines[0].data[0] = 7;

    expect(cache.lines[1].data).toEqual([0, 0]);
});

test('rejects non-positive or non-integer dimensions', () => {
    expect(() => new Cache(0, 4)).toThrow(RangeError);
    expect(() => new Cache(2, 1.5)).toThrow(RangeError);
});
