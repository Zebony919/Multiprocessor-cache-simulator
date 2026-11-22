import { expect, test } from 'vitest'
import { System, type Op, type stepResult } from "../system.ts"

test('System can execute small program (no states)', () => {
    const system = new System(1);
    system.writeToMemory(0x0000, 12);

    let program: Op[] = [
        { cpuId: 0, type: 'R', address: 0x0000 },
        { cpuId: 0, type: 'W', address: 0x0000, value: 12 },
        { cpuId: 0, type: 'R', address: 0x0000 },
    ];

    system.load(program);

    let stepResult: stepResult | null = system.step();

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