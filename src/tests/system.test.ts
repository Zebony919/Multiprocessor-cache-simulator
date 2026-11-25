import { beforeEach, describe, expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { System, type Op } from "../system.ts"

describe('System with NO states', () => {
    let memory: Memory;
    let system: System;

    beforeEach(() => {
        memory = new Memory();
        system = new System(1, memory);
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

    beforeEach(() => {
        memory = new Memory();
        system = new System(1, memory);

        memory.write(0x0000, 12);

        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
            { cacheId: 0, type: 'R', address: 0x0000 },
        ];

        system.load(program);

        const next = () => {
            const stepResult = system.step();
            return stepResult!;
        };
    })

    test('Line starts at State I', () => {
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('I');
    })

    test('Line moves from State I to S after local read', () => {
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('I');
        
        system.step();
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('S');
    })

    test('Line moves from State I to M after local write', () => {
        program = [
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
        ];

        system.load(program);

        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('I');
        expect(system.step()).toMatchObject({ hit: false, value: 99 });
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('M');
    })

    test('Line moves from State S to M after local write', () => {
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 99 },
        ];

        system.load(program);
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('I');
        expect(system.step()).toMatchObject({ hit: false, value: 12 });
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('S');
        expect(system.step()).toMatchObject({ hit: true, value: 99 });
        expect(system.fetchCache(0).fetchLineIndicies(0, 0)!.state).toEqual('M');
    })

    test('Line moves from State M to S after snoop read', () => {
        // Build Snoop system first
    })

    test('Line moves from State S to I after snoop write', () => {
        // Build Snoop system first
    })

    test('Line moves from State M to I after snoop write', () => {
        // Build Snoop system first
    })
})