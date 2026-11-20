import { Memory } from './memory.ts'

export type CacheLine = {
    valid: boolean,
    tag: number,
    data: number[],
}

export interface Cache {
    cacheId: number;
    memory: Memory;
    lines: CacheLine[];
    numLines: number;
    blockSize: number;

    read(address: number): number;
    write(): number;
}

export class DirectCache implements Cache {
    cacheId: number;
    memory: Memory;
    lines: CacheLine[];
    numLines: number;
    blockSize: number;

    constructor(id: number, memory: Memory, numLines: number, blockSize: number) {
        if (!Number.isInteger(numLines) || numLines <= 0) {
            throw new RangeError('numLines must be a positive integer');
        }
        if (!Number.isInteger(blockSize) || blockSize <= 0) {
            throw new RangeError('blockSize must be a positive integer');
        }

        this.cacheId = id;
        this.memory = memory;
        this.numLines = numLines;
        this.blockSize = blockSize;
        this.lines = Array.from({ length: numLines }, () => ({
            valid: false,
            tag: 0,
            data: Array<number>(blockSize).fill(0)
        }));
    }

    public read(address: number): number {
        let data = this.memory.read(address);

        if (!data)

        return 0;
    };

    public write(): number {
        return 0;
    }
};