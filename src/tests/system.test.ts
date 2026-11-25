import { beforeEach, describe, expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { type State } from '../cache.ts'
import { System, type Op, type StepResult } from "../system.ts"

describe('System with NO states', () => {
    let memory: Memory;
    let system: System;

    let next: () => StepResult; 

    beforeEach(() => {
        memory = new Memory();
        system = new System(1, memory);

        next = () => {
            const stepResult = system.step();
            return stepResult!;
        };
    })

    test('System rejects invalid addresses in small program', () => {
        let program: Op[] = [
            { cacheId: 0, type: 'R', address: -1 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 12 },
            { cacheId: 0, type: 'R', address: 0x0000 },
        ];

        expect(() => system.load(program)).toThrow(RangeError);
    })

    test('System can execute small program (no states)', () => {
        memory.write(0x0000, 12);

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

    test('System with two caches are incoherent (no states)', () => {
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

        // second cache checks first cache now 
        expect(next()).toMatchObject({ hit: false, value: 12 });
        expect(next()).toMatchObject({ hit: true, value: 20 });
        expect(next()).toMatchObject({ hit: true, value: 20 });

        expect(next()).toEqual(null);
    })
});

describe('System with states', () => {
    let memory: Memory;
    let system: System;
    let program: Op[];

    let curState: (cacheId: number, address: number) => State;

    beforeEach(() => {
        memory = new Memory();
        system = new System(1, memory);

        memory.write(0x0000, 12);
        memory.write(0x0002, 20);

        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
            { cacheId: 0, type: 'R', address: 0x0000 },
        ];

        system.load(program);

        curState = (cacheId: number, address: number) => {
            return system.fetchCache(cacheId).getState(address);
        };
    })

    test('Line starts at State I', () => {
        expect(curState(0, 0x0000)).toEqual('I');
    })

    test('Line moves from State I to S after local read', () => {
        expect(curState(0, 0x0000)).toEqual('I');
        system.step();
        expect(curState(0, 0x0000)).toEqual('S');
    })

    test('Line moves from State I to M after local write', () => {
        program = [
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
        ];

        system.load(program);

        expect(curState(0, 0x0000)).toEqual('I');
        expect(system.step()).toMatchObject({ hit: false, value: 99 });
        expect(curState(0, 0x0000)).toEqual('M');
    })

    test('Line moves from State S to M after local write', () => {
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
        ];

        system.load(program);
        expect(curState(0, 0x0000)).toEqual('I');
        expect(system.step()).toMatchObject({ hit: false, value: 12 });
        expect(curState(0, 0x0000)).toEqual('S');
        expect(system.step()).toMatchObject({ hit: true, value: 99 });
        expect(curState(0, 0x0000)).toEqual('M');
    })

    test('Line moves from State M to S after snoop read AND State S to I on snoop write', () => {
        const system = new System(2, memory);
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },

            { cacheId: 1, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'W', address: 0x0000, value: 50 },
        ];

        system.load(program);
        system.step();
        system.step();

        expect(curState(0, 0x0000)).toEqual('M');
        expect(curState(1, 0x0000)).toEqual('I');
        expect(system.step()).toMatchObject({ hit: false, value: 99 }); // Cache 1 reads data from cache 0
        expect(curState(0, 0x0000)).toEqual('S');
        expect(curState(1, 0x0000)).toEqual('S');

        expect(system.step()).toMatchObject({ hit: true, value: 50 }); // Cache 0 snoops Cache 1's write to 0x0000 and changes to State I
        expect(memory.read(0x0000)).toEqual(99); // Cache 0's version of 0x0000
        expect(curState(0, 0x0000)).toEqual('I');
        expect(curState(1, 0x0000)).toEqual('M');
    })

    test('Line moves from State M to I after snoop write', () => {
        const system = new System(2, memory);
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },

            { cacheId: 1, type: 'W', address: 0x0000, value: 50 },
        ];

        system.load(program);
        system.step();
        system.step();

        expect(curState(0, 0x0000)).toEqual('M');
        expect(curState(1, 0x0000)).toEqual('I');
        expect(system.step()).toMatchObject({ hit: false, value: 50 }); // Cache 0 snoops Cache 1's write to 0x0000 and moves to State I
        expect(memory.read(0x0000)).toEqual(99);
        expect(curState(0, 0x0000)).toEqual('I');
        expect(curState(1, 0x0000)).toEqual('M');
    })

    test('Write to line in I with another in S and no flush', () => {
        const system = new System(2, memory);
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'W', address: 0x0000, value: 50 },
        ];

        system.load(program);
        expect(system.step()).toMatchObject({ hit: false, value: 12 });
        expect(curState(0, 0x0000)).toEqual('S');
        expect(system.step()).toMatchObject({ hit: false, value: 50 });

        expect(curState(0, 0x0000)).toEqual('I');
        expect(curState(1, 0x0000)).toEqual('M');
        expect(memory.read(0x0000)).toEqual(12);
    })

    test('Evict line in M so its value is flushed to memory', () => {
        const system = new System(2, memory);
        program = [
            { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 1, type: 'W', address: 0x0000, value: 50 },
        ];

        system.load(program);
        expect(system.step()).toMatchObject({ hit: false, value: 20 });
        expect(curState(0, 0x0000)).toEqual('M');
        expect(system.step()).toMatchObject({ hit: false, value: 50 });

        expect(curState(0, 0x0000)).toEqual('I');
        expect(curState(1, 0x0000)).toEqual('M');
        expect(memory.read(0x0000)).toEqual(20);
    })

    test('Multiple addresses are independant and do not conflict states', () => {
        const system = new System(3, memory);
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'R', address: 0x0002 },

            { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 2, type: 'W', address: 0x0002, value: 40 },
        ];

        system.load(program);
        
        expect(system.step()).toMatchObject({ hit: false, value: 12 });
        expect(curState(0, 0x0000)).toEqual('S');
        expect(system.step()).toMatchObject({ hit: false, value: 20 });
        expect(curState(1, 0x0002)).toEqual('S');

        expect(system.step()).toMatchObject({ hit: true, value: 20 });
        expect(curState(0, 0x0000)).toEqual('M');
        expect(curState(1, 0x0002)).toEqual('S'); // Cache 1 was not affected as it's a different address

        expect(system.step()).toMatchObject({ hit: false, value: 40 });
        expect(curState(1, 0x0002)).toEqual('I');
        expect(curState(2, 0x0002)).toEqual('M');
    })

    test('More than one way and more than two caches', () => {
        const system = new System(3, memory);
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'R', address: 0x0002 },

            { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 2, type: 'W', address: 0x0002, value: 40 },
        ];
    })
})