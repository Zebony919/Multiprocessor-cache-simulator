import { expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { System, type Op, type StepResult } from "../system.ts"

test('System can execute small program (no states)', () => {
    const memory = new Memory();
    memory.write(0x0000, 12);
    const system = new System(1, memory);

    let program: Op[] = [
        { cacheId: 0, type: 'R', address: 0x0000 },
        { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
        { cacheId: 0, type: 'R', address: 0x0000 },
    ];

    system.load(program);

    let stepResult: StepResult | null = system.step();

    expect(stepResult).not.toBeNull();
    expect(stepResult!.hit).toBe(false);

    stepResult = system.step();

    expect(stepResult).not.toBeNull();
    expect(stepResult!.value).toBe(99);

    stepResult = system.step();

    expect(stepResult).not.toBeNull();
    expect(stepResult!.value).toBe(99);

    expect(memory.read(0x0000)).toEqual(12);
})

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

test('System with two caches', () => {
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

    system.load(program);
    let stepResult: StepResult | null = system.step();

    // First Cache reads and writes from address 0x0000
    expect(stepResult).not.toBeNull();
    expect(stepResult!.hit).toBe(false);

    system.step();
    stepResult = system.step();

    expect(stepResult).not.toBeNull();
    expect(stepResult!.hit).toBe(true);

    // Second Cache reads and writes from address 0x0000 
    stepResult = system.step();

    expect(stepResult).not.toBeNull();

    // Second Cache reads NON-updated value (MSI will solve this issue)
    expect(stepResult!.value).toBe(10);
    expect(stepResult!.hit).toBe(false);

    system.step();
    stepResult = system.step();

    expect(stepResult).not.toBeNull();
    expect(stepResult!.hit).toBe(true);

    expect(memory.read(0x0000)).toEqual(10);
})