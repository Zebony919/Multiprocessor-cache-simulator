import { Memory } from './memory.ts'
import { SetAssociativeCache, type State } from './cache.ts'

export type Op =
      { cacheId: number, type: 'R', address: number }
    | { cacheId: number, type: 'W', address: number, value: number };

export type StepResult = {
    op: Op,
    value ?: number | null,
    hit: boolean,
    events?: Event[];
}

export type Event =
    { type: 'bus'; from: number; message: 'BusRd' | 'BusRdX' | 'BusUpgr' }
  | { type: 'stateChange'; cpu: number; address: number; from: State; to: State }
  | { type: 'flush'; cpu: number; address: number }
  | { type: 'memoryWrite'; address: number; value: number }
  | { type: 'fill'; cpu: number; address: number; source: 'memory' | number };

export class System {
    private mainMemory: Memory;
    private caches: SetAssociativeCache[];
    private program: Op[] = [];
    private pc = 0;

    constructor(numCaches: number, memory: Memory) {
        this.mainMemory = memory;

        this.caches = Array.from({ length: numCaches}, 
            (_, i) => new SetAssociativeCache(i, this.mainMemory, 2, 2, 2)
        )
    }

    private validateAddress(address: number): void {
        if (!Number.isInteger(address) || address < 0) {
            throw new RangeError("Address must be a positive integer!")
        }
    }

    // Finds the missed data in either another cache or memory as last resort
    private fetchBlock(address: number, cacheId: number): number[] {
        for (let i = 0; i < this.caches.length; i++) {
            if (i == cacheId) continue;

            const line = this.caches[i].fetchLineAddress(address);
            if (line) return line.data;
        }

        const { blockSize } = this.caches[cacheId];
        const base = Math.floor(address / blockSize) * blockSize;
        return Array.from({ length: blockSize }, (_, i) => this.mainMemory.read(base + i));
    }

    private execute(instruction: Op): StepResult {
        const cache = this.caches[instruction.cacheId];
        const hit = cache.fetchLineAddress(instruction.address) != null;
        if (!hit) cache.install(instruction.address, this.fetchBlock(instruction.address, instruction.cacheId));

        // Executes one instruction from given program
        const results: StepResult = {
            op: instruction,
            hit: false,
        }

        const value = instruction.type == 'R'
            ? cache.read(instruction.address).value
            : cache.write(instruction.address, instruction.value).value;

        results.value = value;
        results.hit = hit;

        return results;
    }

    public fetchCache(id: number) {
        return this.caches[id];
    }

    public load(program: Op[]): void {
        for (let i = 0; i < program.length; i++) {
            this.validateAddress(program[i].address);
        }

        this.program = program;
        this.pc = 0;
    }

    public step(): StepResult | null {
        if (this.pc >= this.program.length) return null;

        const op = this.program[this.pc++];
        return this.execute(op);
    }
}