import { Memory } from './memory.ts'

export type CacheLine = {
    valid: boolean,
    dirty: boolean,
    tag: number,
    data: (number | null)[],
}

export type CacheResult = {
    hit: boolean,
    value: number | null,
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

    private fill(address: number, value?: number): CacheResult {
        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const way = this.chooseWay(setIndex);
        const line = this.sets[setIndex][way];
        const blockNumber = Math.floor(address / this.blockSize);
        const blockBase = blockNumber * this.blockSize;

        // Updates Main memory if the line holds real and out of date data before replacing
        if (line.valid && line.dirty) {
            const oldBlockNumber = line.tag * this.numSets + setIndex;
            const oldBlockBase = oldBlockNumber * this.blockSize;

            for (let blockOffset = 0; blockOffset < this.blockSize; blockOffset++) {
                const blockValue = line.data[blockOffset];
                if (blockValue !== null) {
                    this.memory.write(oldBlockBase + blockOffset, blockValue);
                }
            }
        }

        // Replaces line with new block
        line.valid = true;
        line.dirty = value !== undefined;
        line.tag = tag;
        line.data = Array.from(
            { length: this.blockSize },
            (_, blockOffset) => {
                if (blockOffset === offset && value !== undefined) {
                    return value;
                }

                return this.memory.read(blockBase + blockOffset);
            },
        );

        return {
            hit: false,
            value: value ?? line.data[offset],
        };
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

    public read(address: number): CacheResult {
        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const foundLine = this.findLine(setIndex, tag);

        if (foundLine !== null) {
            const value = foundLine.cacheLine.data[offset];
            return { hit: value !== null, value };
        }

        return this.fill(address);
    }

    public write(address: number, value: number): CacheResult {
        if (!Number.isFinite(value)) {
            throw new RangeError('value must be a finite number');
        }

        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const foundLine = this.findLine(setIndex, tag);

        if (foundLine !== null) {
            foundLine.cacheLine.valid = true;
            foundLine.cacheLine.data[offset] = value;
            foundLine.cacheLine.dirty = true;
            return { hit: true, value };
        }

        return this.fill(address, value);
    }
};