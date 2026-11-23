import { Memory } from './memory.ts'

export type CacheBlock = {
    value: number | null,
    tag: number | null,
    modified: boolean,
}

export type CacheLine = {
    valid: boolean,
    data: CacheBlock[],
}

export type CacheResult = {
    hit: boolean,
    value: number | null,
}

export interface Cache {
    cacheId: number;
    blockSize: number;
    numSets: number;
    numWays: number;

    read(address: number): CacheResult;
    write(address: number, value: number): CacheResult;
}

export class SetAssociativeCache implements Cache {
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
            Array.from({ length: numWays }, () => ({
                valid: false,
                data: Array.from({ length: blockSize }, () => ({
                    value: null,
                    tag: null,
                    modified: false,
                }))
            }))
        );
    }

    private validateAddress(address: number): void {
        if (!Number.isInteger(address) || address < 0) {
            throw new RangeError('address must be a non-negative integer');
        }
    }

    private splitAddress(address: number): [number, number, number] {
        const offset = address % this.blockSize;
        const blockNumber = Math.floor(address / this.blockSize);
        const setIndex = blockNumber % this.numSets;
        const tag = Math.floor(blockNumber / this.numSets);

        return [offset, setIndex, tag];
    }

    private findBlock(setIndex: number, tag: number): [number, CacheLine] | null {
        for (let way = 0; way < this.numWays; way++) {
            const line = this.sets[setIndex][way];
            if (line.valid && line.data[0].tag === tag) {
                return [way, line];
            }
        }

        return null;
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
        const [offset, setIndex, tag] = this.splitAddress(address);
        const way = this.chooseWay(setIndex);
        const line = this.sets[setIndex][way];
        const blockNumber = Math.floor(address / this.blockSize);
        const blockBase = blockNumber * this.blockSize;

        line.valid = true;
        line.data = Array.from({ length: this.blockSize }, (_, blockOffset) => {
            if (blockOffset === offset && value !== undefined) {
                return { value, tag, modified: true };
            }

            return {
                value: this.memory.read(blockBase + blockOffset),
                tag,
                modified: false,
            };
        });

        return {
            hit: false,
            value: value ?? line.data[offset].value,
        };
    }

    public read(address: number): CacheResult {
        this.validateAddress(address);
        const [offset, setIndex, tag] = this.splitAddress(address);
        const found = this.findBlock(setIndex, tag);

        if (found !== null) {
            const value = found[1].data[offset].value;
            return { hit: value !== null, value };
        }

        return this.fill(address);
    }

    public write(address: number, value: number): CacheResult {
        this.validateAddress(address);
        if (!Number.isFinite(value)) {
            throw new RangeError('value must be a finite number');
        }

        this.memory.write(address, value);

        const [offset, setIndex, tag] = this.splitAddress(address);
        const found = this.findBlock(setIndex, tag);

        if (found !== null) {
            found[1].valid = true;
            found[1].data[offset] = {
                value,
                tag,
                modified: true,
            };
            return { hit: true, value };
        }

        return this.fill(address, value);
    }
};