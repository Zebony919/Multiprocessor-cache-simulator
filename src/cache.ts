import { Memory } from './memory.ts'

export type State = 'M' | 'O' | 'E' | 'S' | 'I';

export type CacheLine = {
    state: State,
    valid: boolean,
    dirty: boolean,
    tag: number,
    data: number[],
}

export type CacheResult = { 
    hit: boolean,
    value: number,
}

export class SetAssociativeCache {
    cacheId: number;
    blockSize: number;
    numSets: number;
    numWays: number;

    private readonly memory: Memory;
    private readonly sets: CacheLine[][];
    private readonly nextWay: number[];

    constructor(id: number, memory: Memory, blockSize: number, numSets: number, numWays: number) {
        if (!Number.isInteger(blockSize) || blockSize <= 0) {
            throw new RangeError('blockSize must be a positive integer');
        }
        if (!Number.isInteger(numSets) || numSets <= 0) {
            throw new RangeError('numSets must be a positive integer');
        }
        if (!Number.isInteger(numWays) || numWays <= 0) {
            throw new RangeError('numWays must be a positive integer');
        }

        this.cacheId = id;
        this.memory = memory;
        this.blockSize = blockSize;
        this.numSets = numSets;
        this.numWays = numWays;
        this.nextWay = Array<number>(numSets).fill(0);
        this.sets = Array.from({ length: numSets }, () =>
            (Array.from({ length: numWays }, () => ({
                state: 'I',
                valid: false,
                dirty: false,
                tag: 0,
                data: Array<number>(this.blockSize).fill(0)
            })))
        );
    }

    private splitAddress(address: number): { tag: number, index: number, offset: number } {
        const offset = address % this.blockSize;
        const blockNumber = Math.floor(address / this.blockSize);
        const setIndex = blockNumber % this.numSets;
        const tag = Math.floor(blockNumber / this.numSets);

        return { tag: tag, index: setIndex, offset: offset };
    }

    private chooseWay(setIndex: number): number {
        for (let way = 0; way < this.numWays; way++) {
            if (!this.sets[setIndex][way].valid) {
                return way;
            }
        }

        const way = this.nextWay[setIndex];
        this.nextWay[setIndex] = (way + 1) % this.numWays;
        return way;
    }

    private findLine(setIndex: number, tag: number): { way: number, cacheLine: CacheLine } | null {
        const set = this.sets[setIndex];

        for (let way = 0; way < this.numWays; way++) {
            if (set[way].valid && set[way].tag === tag) {
                return { way: way, cacheLine: set[way]};
            }
        }

        return null;
    }

    public install(address: number, blockData: number[]): void {
        const { tag, index: setIndex } = this.splitAddress(address);
        const way = this.chooseWay(setIndex);
        const line = this.sets[setIndex][way];

        // Updates Main memory if the line holds real and out of date data before replacing
        if (line.valid && line.dirty) {
            const oldBlockNumber = line.tag * this.numSets + setIndex;
            const oldBlockBase = oldBlockNumber * this.blockSize;

            for (let blockOffset = 0; blockOffset < this.blockSize; blockOffset++) {
                const blockValue = line.data[blockOffset];
                this.memory.write(oldBlockBase + blockOffset, blockValue);
            }
        }

        // Replaces line with new block
        line.valid = true;
        line.dirty = false;
        line.tag = tag;
        line.data = [...blockData];
    }

    public fetchLineAddress(address: number): CacheLine | null {
        const { tag, index } = this.splitAddress(address);
        const foundLine = this.findLine(index, tag);
        return foundLine ? foundLine.cacheLine : null;
    }

    public fetchLineIndicies(setIndex: number, way: number): CacheLine {
        return this.sets[setIndex][way];
    }

    public read(address: number): CacheResult {
        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const foundLine = this.findLine(setIndex, tag);

        if (!foundLine) throw new Error(`read of uncaches value at ${address}`);
        foundLine.cacheLine.state = 'S';

        const value = foundLine!.cacheLine.data[offset];
        return { hit: value !== 0, value };
    }

    public write(address: number, value: number): CacheResult {
        if (!Number.isFinite(value)) {
            throw new RangeError('value must be a finite number');
        }

        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const foundLine = this.findLine(setIndex, tag);

        foundLine!.cacheLine.valid = true;
        foundLine!.cacheLine.state = 'M';
        foundLine!.cacheLine.data[offset] = value;
        foundLine!.cacheLine.dirty = true;
        return { hit: true, value };
    }
};