import { describe, expect, test } from 'vitest';
import { Memory } from '../memory.ts';
import { SetAssociativeCache } from '../cache.ts';

describe('SetAssociativeCache', () => {
    test('initializes explicit set-associative dimensions', () => {
        const cache = new SetAssociativeCache(0, new Memory(), 2, 2, 2);

        expect(cache.blockSize).toBe(2);
        expect(cache.numSets).toBe(2);
        expect(cache.numWays).toBe(2);
        expect(cache.cacheId).toBe(0);
    });

    test.each([
        [0, 2, 2],
        [1.5, 2, 2],
        [2, 0, 2],
        [2, 2.5, 2],
        [2, 2, 0],
        [2, 2, -1],
    ])('rejects invalid dimensions', (blockSize, numSets, numWays) => {
        expect(() =>
            new SetAssociativeCache(0, new Memory(), blockSize, numSets, numWays)
        ).toThrow(RangeError);
    });

    test('fills a block and reports the first read as a miss', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        memory.write(0x0000, 10);
        memory.write(0x0001, 11);

        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        expect(cache.read(0x0001)).toEqual({ hit: true, value: 11 });
    });

    test('returns a miss for an address not present in memory', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        expect(cache.read(0x0003)).toEqual({ hit: false, value: null });
    });

    test('writes through to memory and a cached block', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        expect(cache.write(0x0001, 11)).toEqual({ hit: false, value: 11 });
        expect(cache.read(0x0001)).toEqual({ hit: true, value: 11 });
        expect(memory.read(0x0001)).toBe(11);
    });

    test('replaces a direct-mapped block', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        memory.write(0x0000, 10);
        memory.write(0x0004, 40);

        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        expect(cache.read(0x0004)).toEqual({ hit: false, value: 40 });
        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
    });
});