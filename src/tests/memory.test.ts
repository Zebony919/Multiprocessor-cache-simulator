import { expect, test } from 'vitest';
import { Memory } from '../memory.ts';
import { System, type Op } from "../system.ts"

test('read and write from memory', () => {
    let data = new Memory();

    data.write(0x0000, 12);
    let readValue = data.read(0x0000);

    expect(readValue).toBe(12);
})

test('Memory clears', () => {
    const memory = new Memory();
    const system = new System(3, memory, 'MOESI');

    const program: Op[] = [
        { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
    ];

    system.load(program);
    expect(system.step()).toMatchObject({ hit: false, value: 20 });

    memory.clearMemory();
    expect(memory.read(0x0000)).toEqual(0);
})