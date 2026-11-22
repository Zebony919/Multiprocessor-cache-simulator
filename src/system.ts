import { Memory } from './memory.ts'
import { DirectCache } from './cache.ts'

export type State = 'M' | 'O' | 'E' | 'S' | 'I';

export type Op = {
    cpuId: number,
    type: 'R' | 'W',
    address: number,
    value ?: number,
}

export type stepResult = {
    op: Op,
    value ?: number,
    hit: boolean,
    events?: Event[];
}

export type Event =
  | { type: 'bus'; from: number; message: 'BusRd' | 'BusRdX' | 'BusUpgr' }
  | { type: 'stateChange'; cpu: number; address: number; from: State; to: State }
  | { type: 'flush'; cpu: number; address: number }
  | { type: 'memoryWrite'; address: number; value: number }
  | { type: 'fill'; cpu: number; address: number; source: 'memory' | number };

export class System {
    private mainMemory: Memory = new Memory(); 
    private caches: DirectCache[];
    private program: Op[] = [];
    private pc = 0;

    constructor(numCaches: number) {
        this.caches = Array.from({ length: numCaches}, 
            (_, i) => new DirectCache(i, this.mainMemory, 4, 4)
        )
    }

    public writeToMemory(address: number, value: number): void {
        this.mainMemory.write(address, value);
    }

    public load(program: Op[]): void {
        this.program = program;
        this.pc = 0;
    }

    public step(): stepResult | null {
        if (this.pc >= this.program.length) return null;

        const op = this.program[this.pc++];
        return this.execute(op);
    }

    private execute(instruction: Op): stepResult {
        // Executes one instruction from given program
        const results: stepResult = {
            op: instruction,
            hit: false,
        }

        if (instruction.type == 'R') {
            const data = this.caches[instruction.cpuId].read(instruction.address);
            if (!Number.isNaN(data)) {
                results.hit = true;
                results.value = data;
            }
        } else {
            this.caches[instruction.cpuId].write(instruction.address);
            results.value = this.caches[instruction.cpuId].read(instruction.address);
        }

        return results;
    }
}