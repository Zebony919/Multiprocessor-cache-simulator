import { expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { System, type Op } from "../system.ts"

test('System rejects invalid addresses in small program', () => {
    const memory = new Memory();
    const system = new System(1, memory);

    let program: Op[] = [
        { cacheId: 0, type: 'R', address: -1 },
        { cacheId: 0, type: 'W', address: 0x0000, value: 12 },
        { cacheId: 0, type: 'R', address: 0x0000 },
    ];

    expect(() => system.load(program)).toThrow(RangeError);
})

test('System can execute small program (no states)', () => {
    const memory = new Memory();
    memory.write(0x0000, 12);
    const system = new System(1, memory);

    let program: Op[] = [
        { cacheId: 0, type: 'R', address: 0x0000 },
        { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
        { cacheId: 0, type: 'R', address: 0x0000 },
    ];

    const next = () => {
        const stepResult = system.step();
        return stepResult!;
    };

    system.load(program);

    expect(next()).toMatchObject({ hit: false, value: 12 });
    expect(next()).toMatchObject({ hit: true, value: 99 });
    expect(next()).toMatchObject({ hit: true, value: 99 });

    expect(next()).toEqual(null);
})

test('System with two caches are incoherent without states', () => {
    const memory = new Memory();
    const system = new System(2, memory);

    memory.write(0x0000, 10);

    let program: Op[] = [
        { cacheId: 0, type: 'R', address: 0x0000 },
        { cacheId: 0, type: 'W', address: 0x0000, value: 12 },
        { cacheId: 0, type: 'R', address: 0x0000 },
        { cacheId: 1, type: 'R', address: 0x0000 },
        { cacheId: 1, type: 'W', address: 0x0000, value: 20 },
        { cacheId: 1, type: 'R', address: 0x0000 },
    ];

    const next = () => {
        const stepResult = system.step();
        return stepResult!;
    };

    system.load(program);

    // first cache
    expect(next()).toMatchObject({ hit: false, value: 10 });
    expect(next()).toMatchObject({ hit: true, value: 12 });
    expect(next()).toMatchObject({ hit: true, value: 12 });

    // second cache
    expect(next()).toMatchObject({ hit: false, value: 10 });
    expect(next()).toMatchObject({ hit: true, value: 20 });
    expect(next()).toMatchObject({ hit: true, value: 20 });

    expect(next()).toEqual(null);
})