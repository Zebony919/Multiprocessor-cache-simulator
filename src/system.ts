import { Memory } from './memory.ts'
import { DirectCache } from './cache.ts'

export class System {
    private mainMemory: Memory = new Memory(); 
    private caches: DirectCache[];

    constructor(numCaches: number) {
        this.caches = Array.from({ length: numCaches}, 
            (_, i) => new DirectCache(i, this.mainMemory, 4, 4)
        )
    }
}