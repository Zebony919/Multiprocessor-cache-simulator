import { expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { System, type Op, type StepResult } from "../system.ts"

test('System can execute small program (no states)', () => {
    const memory = new Memory();
    memory.write(0x0000, 12);
    const system = new System(1, memory);

    let program: Op[] = [
        { cpuId: 0, type: 'R', address: 0x0000 },
        { cpuId: 0, type: 'W', address: 0x0000, value: 12 },
        { cpuId: 0, type: 'R', address: 0x0000 },
    ];

    system.load(program);

    let stepResult: StepResult | null = system.step();

    if (stepResult != null) {
        expect(stepResult.hit).toBe(false);
    }

    stepResult = system.step();

    if (stepResult != null) {
        expect(stepResult.value).toBe(12);
    }

    stepResult = system.step();

    if (stepResult != null) {
        expect(stepResult.hit).toBe(true);
        expect(stepResult.value).toBe(12);
    }
})

test('System rejects invalid addresses in small program', () => {
    const memory = new Memory();
    const system = new System(1, memory);

    let program: Op[] = [
        { cpuId: 0, type: 'R', address: -1 },
        { cpuId: 0, type: 'W', address: 0x0000, value: 12 },
        { cpuId: 0, type: 'R', address: 0x0000 },
    ];

    expect(() => system.load(program)).toThrow(RangeError);
})