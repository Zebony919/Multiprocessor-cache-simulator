import { Memory } from './memory.ts'
import { SetAssociativeCache, type State } from './cache.ts'
import { type BusMsg, onProcess, onSnoop } from './protocols.ts';

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
            (_, i) => new SetAssociativeCache(i, this.mainMemory, 4, 2, 2)
        )
    }

    private writeBlockToMemory(address: number, block: number[]): void {
        for (let i = 0; i < block.length; i++) {
            this.mainMemory.write(address + i, block[i]);
        }
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

    // Update every version of an address in each cache
    private broadcast(msg: BusMsg, address: number, cacheRequester: number): void {
        for (let i = 0; i < this.caches.length; i++) {
            if (i == cacheRequester) continue;

            const cache = this.caches[i];
            const { next, flush } = onSnoop(cache.getState(address), msg);
            if (flush) {
                const blockBase = Math.floor(address / cache.blockSize) * cache.blockSize;
                this.writeBlockToMemory(blockBase, cache.fetchLineAddress(address)!.data);
            }

            cache.setState(address, next);
        }
    }

    private execute(instruction: Op): StepResult {
        const cache = this.caches[instruction.cacheId];
        const hit = cache.fetchLineAddress(instruction.address) != null;
        const state = this.caches[instruction.cacheId].getState(instruction.address);
        const { busMsg, next } = onProcess(state, instruction.type);

        if (busMsg != 'None') {
            this.broadcast(busMsg, instruction.address, instruction.cacheId);
        }

        if (!hit) {
            cache.install(instruction.address, this.fetchBlock(instruction.address, instruction.cacheId));
        }

        const results: StepResult = {
            op: instruction,
            hit: false,
        }

        const value = instruction.type == 'R'
            ? cache.read(instruction.address).value
            : cache.write(instruction.address, instruction.value).value;

        results.value = value;
        results.hit = hit;

        cache.setState(instruction.address, next);
        return results;
    }

    public fetchCache(id: number): SetAssociativeCache {
        return this.caches[id];
    }

    public addCache(cache: SetAssociativeCache): void {
        this.caches[this.caches.length] = cache;
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