import { Memory } from './memory.ts'
import { SetAssociativeCache } from './cache.ts'

export type State = 'M' | 'O' | 'E' | 'S' | 'I';

export type Op =
      { cpuId: number, type: 'R', address: number }
    | { cpuId: number, type: 'W', address: number, value: number };

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
            (_, i) => new SetAssociativeCache(i, this.mainMemory, 4, 4, 1)
        )
    }

    public writeToMemory(address: number, value: number): void {
        this.mainMemory.write(address, value);
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

    private validateAddress(address: number): void {
        if (!Number.isInteger(address) || address < 0) {
            throw new RangeError("Address must be a positive integer!")
        }
    }

    private execute(instruction: Op): StepResult {
        // Executes one instruction from given program
        const results: StepResult = {
            op: instruction,
            hit: false,
        }

        if (instruction.type == 'R') {
            const data = this.caches[instruction.cpuId].read(instruction.address);
            results.hit = data.hit;
            results.value = data.value;
        } else {
            const data = this.caches[instruction.cpuId].write(
                instruction.address,
                instruction.value,
            );
            results.hit = data.hit;
            results.value = data.value;
        }

        return results;
    }
}