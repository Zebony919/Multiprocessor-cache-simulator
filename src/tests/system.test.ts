import { beforeEach, describe, expect, test } from 'vitest'
import { Memory } from '../memory.ts'
import { type State, SetAssociativeCache } from '../cache.ts'
import { System, type Op, type StepResult } from "../system.ts"

describe('System with NO states', () => {
    let memory: Memory;
    let system: System;

    let next: () => StepResult; 

    beforeEach(() => {
        memory = new Memory();
        system = new System(1, memory, 'MSI');

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

        system.load(program);

        expect(next()).toMatchObject({ hit: false, value: 12 });
        expect(next()).toMatchObject({ hit: true, value: 99 });
        expect(next()).toMatchObject({ hit: true, value: 99 });

        expect(next()).toEqual(null);
    })

    test('System with two caches are incoherent (no states)', () => {
        system = new System(2, memory, 'MSI');
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
        system = new System(1, memory, 'MSI');

        // Cache's are defaulted to blockSize 4, so each address must be four apart to test different lines
        memory.write(0x0000, 12);
        memory.write(0x0004, 14);
        memory.write(0x0008, 20);

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
        system = new System(2, memory, 'MSI');
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
        system = new System(2, memory, 'MSI');
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
        system = new System(2, memory, 'MSI');
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
        system = new System(2, memory, 'MSI');
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

    test('Different blocks are independant and do not conflict states', () => {
        system = new System(3, memory, 'MSI');
        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'R', address: 0x0004 },

            { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 2, type: 'W', address: 0x0004, value: 40 },
        ];

        memory.write(0x0004, 20);
        system.load(program);
        
        expect(system.step()).toMatchObject({ hit: false, value: 12 });
        expect(curState(0, 0x0000)).toEqual('S');
        expect(system.step()).toMatchObject({ hit: false, value: 20 });
        expect(curState(1, 0x0004)).toEqual('S');

        expect(system.step()).toMatchObject({ hit: true, value: 20 });
        expect(curState(0, 0x0000)).toEqual('M');
        expect(curState(1, 0x0004)).toEqual('S'); // Cache 1 was not affected as it's a different address

        expect(system.step()).toMatchObject({ hit: false, value: 40 });
        expect(curState(1, 0x0004)).toEqual('I');
        expect(curState(2, 0x0004)).toEqual('M');
    })

    test('Round Robin eviction AND more than two ways', () => {
        system = new System(2, memory, 'MSI');
        
        memory.write(0x0004, 21);
        memory.write(0x0008, 22);
        memory.write(0x000C, 23);
        memory.write(0x0010, 24);

        program = [
            { cacheId: 2, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 2, type: 'W', address: 0x0004, value: 30 },
            { cacheId: 2, type: 'W', address: 0x0008, value: 40 },
            { cacheId: 2, type: 'W', address: 0x000C, value: 50 },
            { cacheId: 2, type: 'W', address: 0x0010, value: 60 },
        ];

        system.load(program);

        const newCache = new SetAssociativeCache(2, memory, 2, 2, 4);
        system.addCache(newCache);

        expect(system.step()).toMatchObject({ hit: false, value: 20 });
        expect(newCache.fetchLineIndicies(0, 0)!.data[0]).toEqual(20);

        system.step();
        system.step();
        system.step();
        
        expect(system.step()).toMatchObject({ hit: false, value: 60 });
        expect(newCache.fetchLineIndicies(0, 0)!.data[0]).toEqual(60);
    })

    test('Exclusive State behaviour in MESI', () => {
        system = new System(3, memory, 'MESI');

        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 1, type: 'R', address: 0x0004 },
            { cacheId: 2, type: 'R', address: 0x0004 },
            { cacheId: 2, type: 'W', address: 0x0004, value: 40 },
        ];

        system.load(program);
        system.step();

        expect(curState(0, 0x0000)).toEqual('E'); // Line moves from State I to E on local read with no shared lines
        expect(system.step()).toMatchObject({ hit: true, value: 20 });
        expect(curState(0, 0x0000)).toEqual('M'); // Moves to M on local write
        expect(system.step()).toMatchObject({ hit: false, value: 14 });
        expect(curState(1, 0x0004)).toEqual('E'); // Only line with 0x0001 so in State E
        expect(system.step()).toMatchObject({ hit: false, value: 14 });
        expect(curState(1, 0x0004)).toEqual('S'); // Cache1 moves to S as Cache2 now shares 0x0001
        expect(curState(2, 0x0004)).toEqual('S'); // Cache2 in State S
        expect(system.step()).toMatchObject({ hit: true, value: 40 });
        expect(curState(1, 0x0004)).toEqual('I'); // Cache1 reads BusRdX and moves to invalid state
        expect(curState(2, 0x0004)).toEqual('M'); // Cache2 moves to M state after modifying and having dirty data
    })

    test('Owner State behaviour in MOSI', () => {
        system = new System(3, memory, 'MOSI');

        program = [
            { cacheId: 0, type: 'W', address: 0x0000, value: 20 },
            { cacheId: 1, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 40 },
            { cacheId: 1, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'W', address: 0x0000, value: 50 },
        ];

        system.load(program);
        expect(system.step()).toMatchObject({ hit: false, value: 20 });
        expect(curState(0, 0x0000)).toEqual('M');
        expect(system.step()).toMatchObject({ hit: false, value: 20 });
        expect(curState(0, 0x0000)).toEqual('O'); // Cache0 snoops read from Cache1 and supplies data instead
        expect(curState(1, 0x0000)).toEqual('S');
        expect(system.step()).toMatchObject({ hit: true, value: 40 });
        expect(curState(0, 0x0000)).toEqual('M');
        expect(curState(1, 0x0000)).toEqual('I'); // Cache1 snoops BusRdX from Cache0 and so moves to state I
        expect(system.step()).toMatchObject({ hit: false, value: 40 });
        expect(curState(0, 0x0000)).toEqual('O'); 
        expect(curState(1, 0x0000)).toEqual('S');
        expect(system.step()).toMatchObject({ hit: true, value: 50 });
        expect(curState(0, 0x0000)).toEqual('I'); // Cache0 snoops Cache1 writing to 0x0000 and so moves to state I
        expect(curState(1, 0x0000)).toEqual('M');
    })

    test('Exclusive and Owner behaviour in MOESI', () => {
        system = new System(3, memory, 'MOESI');

        program = [
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 0, type: 'W', address: 0x0000, value: 10 },
            { cacheId: 1, type: 'R', address: 0x0000 },
            { cacheId: 2, type: 'R', address: 0x0000 },
            { cacheId: 1, type: 'W', address: 0x0000, value: 25 },
            { cacheId: 2, type: 'R', address: 0x0004 },
            { cacheId: 0, type: 'R', address: 0x0004 },
            { cacheId: 2, type: 'W', address: 0x0004, value: 99 },
            { cacheId: 0, type: 'R', address: 0x0000 },
            { cacheId: 2, type: 'W', address: 0x0000, value: 77 },
        ];

        system.load(program);

        // Cold read -> Exclusive (E) in cache 0
        expect(system.step()).toMatchObject({ hit: false, value: 12 });
        expect(curState(0, 0x0000)).toEqual('E');

        // Write to Exclusive -> Modified (M) in cache 0 (silent upgrade)
        expect(system.step()).toMatchObject({ hit: true, value: 10 });
        expect(curState(0, 0x0000)).toEqual('M');

        // Read by cache 1 -> cache 0 transitions to Owned (O) and supplies data, cache 1 gets Shared (S)
        expect(system.step()).toMatchObject({ hit: false, value: 10 });
        expect(curState(0, 0x0000)).toEqual('O');
        expect(curState(1, 0x0000)).toEqual('S');

        // Another read by cache 2 -> stays O in cache 0, S in cache 1 and cache 2
        expect(system.step()).toMatchObject({ hit: false, value: 10 });
        expect(curState(0, 0x0000)).toEqual('O');
        expect(curState(1, 0x0000)).toEqual('S');
        expect(curState(2, 0x0000)).toEqual('S');

        // Write by cache 1 -> cache 1 becomes Modified (M), cache 0 and cache 2 become Invalid (I)
        expect(system.step()).toMatchObject({ hit: true, value: 25 });
        expect(curState(0, 0x0000)).toEqual('I');
        expect(curState(1, 0x0000)).toEqual('M');
        expect(curState(2, 0x0000)).toEqual('I');

        // Second address: cold read by cache 2 -> Exclusive (E) in cache 2
        expect(system.step()).toMatchObject({ hit: false, value: 14 });
        expect(curState(2, 0x0004)).toEqual('E');

        // Read of 0x0004 by cache 0 -> cache 2 downgrades E -> S, cache 0 becomes S
        expect(system.step()).toMatchObject({ hit: false, value: 14 });
        expect(curState(0, 0x0004)).toEqual('S');
        expect(curState(2, 0x0004)).toEqual('S');

        // Write to 0x0004 by cache 2 -> cache 2 upgrades S -> M, cache 0 invalidates S -> I
        expect(system.step()).toMatchObject({ hit: true, value: 99 });
        expect(curState(0, 0x0004)).toEqual('I');
        expect(curState(2, 0x0004)).toEqual('M');

        // Read of 0x0000 by cache 0 -> gets 25 from cache 1; cache 1 moves M -> O, cache 0 becomes S
        expect(system.step()).toMatchObject({ hit: false, value: 25 });
        expect(curState(0, 0x0000)).toEqual('S');
        expect(curState(1, 0x0000)).toEqual('O');

        // Write to 0x0000 by cache 2 -> cache 2 becomes Modified (M), cache 0 (S) and cache 1 (O) become Invalid (I)
        expect(system.step()).toMatchObject({ hit: false, value: 77 });
        expect(curState(0, 0x0000)).toEqual('I');
        expect(curState(1, 0x0000)).toEqual('I');
        expect(curState(2, 0x0000)).toEqual('M');
    })
})

// Some random number generator by Tommy Ettinger
function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Randomly allocates each address with a read or write instruction giving a random program to use
function randomTrace(rand: () => number, numCaches: number, length: number, addresses: number[]): Op[] {
    let counter = 0;
    return Array.from({ length }, () => {
        const cacheId = Math.floor(rand() * numCaches);
        const address = addresses[Math.floor(rand() * addresses.length)];
        return rand() < 0.5
            ? { cacheId, type: 'R', address } as Op
            : { cacheId, type: 'W', address, value: ++counter } as Op;
    });
}


function checkInvariants(system: System, memory: Memory, model: Map<number, number>, addresses: number[], numCaches: number) {
    for (const addr of addresses) {
        const expected = model.get(addr) ?? 0;
        const states = Array.from({ length: numCaches }, (_, i) => system.fetchCache(i).getState(addr));
        const owners = states.filter(s => s === 'M').length;

        // Single writer: an M copy means every other copy is I
        if (owners > 1) throw new Error(`addr ${addr}: multiple M copies ${states}`);
        if (owners === 1 && states.some(s => s === 'S'))
            throw new Error(`addr ${addr}: M coexists with S ${states}`);

        // Every valid copy holds the latest value
        states.forEach((s, i) => {
            const cache = system.fetchCache(i);
            const line = cache.fetchLineAddress(addr);
            if (s === 'I') return;
            if (!line)
                throw new Error(`addr ${addr}: cache ${i} reports ${s} without a valid line`);
            if (line.data[addr % cache.blockSize] !== expected)
                throw new Error(`addr ${addr}: cache ${i} (${s}) holds stale value`);
        });

        // With no M copy, memory must be current 
        if (owners === 0 && memory.read(addr) !== expected)
            throw new Error(`addr ${addr}: memory stale with no owner`);
    }
}

test('MSI keeps invariants on random traces', () => {
    const numCaches = 3;
    const addresses = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

    for (let seed = 0; seed < 500; seed++) {
        const rand = mulberry32(seed);
        const memory = new Memory();
        const system = new System(numCaches, memory, 'MSI');
        const trace = randomTrace(rand, numCaches, 50, addresses);
        const model = new Map<number, number>();

        system.load(trace);
        try {
            for (const op of trace) {
                const result = system.step()!;
                if (op.type === 'W') model.set(op.address, op.value);
                else expect(result.value).toBe(model.get(op.address) ?? 0);   // reads see the latest write
                checkInvariants(system, memory, model, addresses, numCaches);
            }
        } catch (e) {
            throw new Error(`seed ${seed} failed: ${(e as Error).message}\ntrace: ${JSON.stringify(trace)}`);
        }
    }
});