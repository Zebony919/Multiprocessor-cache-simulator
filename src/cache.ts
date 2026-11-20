export type MainMemory = {
    numOfAddresses: number,
    full: boolean,
    data: number[],
}

export type CacheLine = {
    valid: boolean,
    tag: number,
    data: number[],
}

export interface Cache {
    lines: CacheLine[];
    numLines: number;
    blockSize: number;

    read(): number;
    write(): number;
}

export class DirectCache implements Cache {
    lines: CacheLine[];
    numLines: number;
    blockSize: number;

    constructor(numLines: number, blockSize: number) {
        if (!Number.isInteger(numLines) || numLines <= 0) {
            throw new RangeError('numLines must be a positive integer');
        }
        if (!Number.isInteger(blockSize) || blockSize <= 0) {
            throw new RangeError('blockSize must be a positive integer');
        }

        this.numLines = numLines;
        this.blockSize = blockSize;
        this.lines = Array.from({ length: numLines }, () => ({
            valid: false,
            tag: 0,
            data: Array<number>(blockSize).fill(0)
        }));
    }

    public read(): number {
        return 0;
    };

    public write(): number {
        return 0;
    }
};