import { expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { DirectCache } from '../cache.ts'

test('initializes the requested cache lines and block sizes', () => {
    const mainMemory = new Memory();
    const cache = new DirectCache(0, mainMemory, 2, 4);

    expect(cache.lines).toEqual([
        { modified: false, valid: false, tag: 0, data: [NaN, NaN, NaN, NaN] },
        { modified: false, valid: false, tag: 0, data: [NaN, NaN, NaN, NaN] }
    ]);
});

test('DirectCache: keeps each cache line data block independent', () => {
    const mainMemory = new Memory();
    const cache = new DirectCache(0, mainMemory, 2, 2);

    cache.lines[0].data[0] = 7;

    expect(cache.lines[1].data).toEqual([NaN, NaN]);
});

test('DirectCache: rejects non-positive or non-integer dimensions', () => {
    const mainMemory = new Memory();

    expect(() => new DirectCache(0, mainMemory, 2, 4.5)).toThrow(RangeError);
    expect(() => new DirectCache(0, mainMemory, -2, 4)).toThrow(RangeError);
});

test('DirectCache: read from cache with data in cache', () => {
    const mainMemory = new Memory();
    const cache = new DirectCache(0, mainMemory, 2, 2);

    mainMemory.write(0x0000, 10);
    mainMemory.write(0x0001, 11);
    mainMemory.write(0x0002, 12);

    cache.write(0x0000);
    cache.write(0x0001);
    cache.write(0x0002);

    let data = cache.read(0x0001);

    expect(data).toEqual(11);
})

test('DirectCache: read from cache with NaN data', () => {
    const mainMemory = new Memory();
    const cache = new DirectCache(0, mainMemory, 2, 2);

    mainMemory.write(0x0000, 10);
    mainMemory.write(0x0001, 11);
    mainMemory.write(0x0002, 12);

    cache.write(0x0000);
    cache.write(0x0001);
    cache.write(0x0002);

    let data = cache.read(0x0003);

    expect(data).toEqual(NaN);
})