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

        expect(cache.read(0x0003)).toEqual({ hit: false, value: 0 });
    });

    test('main memory is not instantly updated (follows write-back policy)', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        memory.write(0x0001, 10);

        expect(cache.write(0x0001, 11)).toEqual({ hit: false, value: 11 });
        expect(cache.read(0x0001)).toEqual({ hit: true, value: 11 });
        expect(memory.read(0x0001)).toBe(10);
    });

    test('replaces a direct-mapped block', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        memory.write(0x0000, 10);
        memory.write(0x0004, 40);

        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        expect(cache.read(0x0004)).toEqual({ hit: false, value: 40 });
        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        expect(cache.read(0x0000)).toEqual({ hit: true,  value: 10});
    });

    test('splitAddress method maps addresses to the correct cacheLines', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        memory.write(0x0000, 10);
        memory.write(0x0001, 11);

        memory.write(0x0002, 12);
        memory.write(0x0003, 13);

        memory.write(0x0004, 14);

        // Tests Offset bits
        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        expect(cache.read(0x0001)).toEqual({ hit: true, value: 11 });

        // Tests SetIndex bits
        expect(cache.read(0x0002)).toEqual({ hit: false, value: 12 });
        expect(cache.read(0x0000)).toEqual({ hit: true, value: 10 });
        expect(cache.read(0x0002)).toEqual({ hit: true, value: 12 });

        // Tests Tag bits
        expect(cache.read(0x0000)).toEqual({ hit: true, value: 10 });
        expect(cache.read(0x0004)).toEqual({ hit: false, value: 14 });
        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
    })

    test('cache with two ways/lines per set and write-backs on eviction (FIFO/round-robin)', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 1, 2);

        memory.write(0x0000, 10);
        memory.write(0x0001, 11);

        memory.write(0x0002, 12);
        memory.write(0x0003, 13);

        memory.write(0x0004, 14);
        memory.write(0x0005, 15);

        // Fill set with two lines
        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        expect(cache.read(0x0002)).toEqual({ hit: false, value: 12 });

        // Main Memory is NOT instantly updated on cache writes (write-back policy)
        expect(cache.write(0x0000, 20)).toEqual({ hit: true, value: 20 });
        expect(memory.read(0x0000)).toEqual(10);

        // Evict first line when 0x0004 is inserted
        expect(cache.read(0x0004)).toEqual({ hit: false, value: 14 });

        // Write-backs update main memory after eviction
        expect(memory.read(0x0000)).toEqual(20);
    })

    test('memory is not updated if clean line evicted', () => {
        const memory = new Memory();
        const cache = new SetAssociativeCache(0, memory, 2, 2, 1);

        memory.write(0x0000, 10);
        memory.write(0x0004, 20);

        expect(cache.read(0x0000)).toEqual({ hit: false, value: 10 });
        memory.write(0x0000, 50);

        // evicts clean line, but memory still holds its version and not the cache version
        expect(cache.read(0x0004)).toEqual({ hit: false, value: 20 });
        expect(memory.read(0x0000)).toEqual(50);

        // proving the line was evicted
        expect(cache.read(0x0000)).toEqual({ hit: false, value: 50 })
    })
});