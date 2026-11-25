import { type State } from './cache.ts';

export function onProcess(state: State, type: 'R' | 'W'): { bus: BusMsg | null, next: State};

export function onSnoop(state: State, msg: BusMsg): { next: State, flush: boolean};