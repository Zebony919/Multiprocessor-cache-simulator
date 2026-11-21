import { Memory } from './memory.ts'

export type CacheLine = {
    modified: boolean;
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
    offSetBits: number;
    indexBits: number;

    read(address: number): number;
    write(address: number, value: number): void;
}

export class DirectCache implements Cache {
    cacheId: number;
    memory: Memory;
    lines: CacheLine[];
    numLines: number;
    blockSize: number;
    offSetBits: number;
    indexBits: number;

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
        this.offSetBits = Math.log2(blockSize);
        this.indexBits = Math.log2(numLines);

        this.lines = Array.from({ length: numLines }, () => ({
            modified: false,
            valid: false,
            tag: 0,
            data: Array<number>(blockSize).fill(NaN)
        }));
    }

    private splitAddress(address: number): [number, number, number] {
        let offSetBits = Number(address & (this.blockSize - 1));
        let indexBits = Number((address >>> this.offSetBits) & (this.numLines - 1));
        let tagBits = Number(address >>> (this.offSetBits + this.indexBits));

        return [offSetBits, indexBits, tagBits];
    }

    public read(address: number): number {
        let [offSet, index, tag] = this.splitAddress(address);
        let data = this.lines[index].data[offSet];
        let curData = this.memory.read(address);

        if (Number.isNaN(data) || (data != curData)) {
            if (!Number.isNaN(curData)) {
                this.write(address, curData);
            } else {
                throw new ReferenceError(`Data does not exist at address ${address}`);
            }
        } 

        return data;
    };

    public write(address: number, value: number): void {
        let [offSet, index, tag] = this.splitAddress(address);
        this.lines[index].data[offSet] = value;
    }
};

// Logic for eviction and modified data checks
/*
if (!Number.isNaN(data)) {
    if (this.lines[index].modified) {
        // Update Main Memory with Cacheline
    } 

    for (let i = 0; i < this.blockSize; i++) {
        let newData = this.memory.read(address + i);
        this.lines[index].data[i] = newData;
    }
}
*/