import { Memory } from './memory.ts'

export type State = 'M' | 'O' | 'E' | 'S' | 'I';

export type CacheLine = {
    state: State,
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
    sets: CacheLine[][];

    private readonly memory: Memory;
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
            if (this.sets[setIndex][way].state == 'I') {
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
            if (set[way].state != 'I' && set[way].tag === tag) {
                return { way: way, cacheLine: set[way]};
            }
        }

        return null;
    }

    public install(address: number, blockData: number[]): void {
        const { tag, index: setIndex } = this.splitAddress(address);
        const way = this.chooseWay(setIndex);
        const line = this.sets[setIndex][way];

        // M and O contain the only potentially newer-than-memory copies.
        if (line.state === 'M' || line.state === 'O') {
            const oldBlockNumber = line.tag * this.numSets + setIndex;
            const oldBlockBase = oldBlockNumber * this.blockSize;

            for (let blockOffset = 0; blockOffset < this.blockSize; blockOffset++) {
                const blockValue = line.data[blockOffset];
                this.memory.write(oldBlockBase + blockOffset, blockValue);
            }
        }

        // A newly installed clean block is shared until the requesting operation changes its state.
        line.state = 'S';
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

    public getState(address: number): State {
        const { tag, index } = this.splitAddress(address);
        const foundLine = this.findLine(index, tag);
        return foundLine?.cacheLine.state ?? 'I';
    }

    public setState(address: number, state: State): void {
        const { tag, index } = this.splitAddress(address);
        const foundLine = this.findLine(index, tag);
        if (foundLine) foundLine.cacheLine.state = state;
    }

    public clearCache(): void {
        this.sets = Array.from({ length: this.numSets }, () =>
            (Array.from({ length: this.numWays }, () => ({
                state: 'I',
                tag: 0,
                data: Array<number>(this.blockSize).fill(0)
            })))
        );
    }

    public read(address: number): CacheResult {
        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const foundLine = this.findLine(setIndex, tag);

        if (!foundLine) throw new Error(`read of uncaches value at ${address}`);
        const value = foundLine.cacheLine.data[offset];
        return { hit: true, value };
    }

    public write(address: number, value: number): CacheResult {
        if (!Number.isFinite(value)) {
            throw new RangeError('value must be a finite number');
        }

        const { tag, index: setIndex, offset } = this.splitAddress(address);
        const foundLine = this.findLine(setIndex, tag);

        foundLine!.cacheLine.state = 'M';
        foundLine!.cacheLine.data[offset] = value;
        return { hit: true, value };
    }
};