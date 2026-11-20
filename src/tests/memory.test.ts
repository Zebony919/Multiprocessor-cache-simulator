import { expect, test } from 'vitest';
import { Memory } from '../memory.ts';

test('read and write from memory', () => {
    let data = new Memory();

    data.write(0x0000, 12);
    let readValue = data.read(0x0000);

    expect(readValue).toBe(12);
})