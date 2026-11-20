import { expect, test } from 'vitest';
import { Memory } from '../memory.ts'
import { DirectCache } from '../cache.ts';

test('initializes the requested cache lines and block sizes', () => {
    const mainMemory = new Memory();
    const cache = new DirectCache(0, mainMemory, 2, 4);

    expect(cache.lines).toEqual([
        { valid: false, tag: 0, data: [0, 0, 0, 0] },
        { valid: false, tag: 0, data: [0, 0, 0, 0] }
    ]);
});

test('DirectCache: keeps each cache line data block independent', () => {
    const mainMemory = new Memory();
    const cache = new DirectCache(0, mainMemory, 2, 2);

    cache.lines[0].data[0] = 7;

    expect(cache.lines[1].data).toEqual([0, 0]);
});

test('DirectCache: rejects non-positive or non-integer dimensions', () => {
    const mainMemory = new Memory();

    expect(() => new DirectCache(0, mainMemory, 2, 4.5)).toThrow(RangeError);
    expect(() => new DirectCache(0, mainMemory, -2, 4)).toThrow(RangeError);
});
