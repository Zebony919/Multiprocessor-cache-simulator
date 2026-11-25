import { type State } from './cache.ts';

export type BusMsg = 'BusRd' | 'BusRdX' | 'BusUpgr' | 'None';

export function onProcess(state: State, type: 'R' | 'W'): { busMsg: BusMsg, next: State} {
    if (type == 'R') {
        if (state == 'I') {
            return { busMsg: 'BusRd', next: 'S' };
        } else if (state == 'S') {
            return { busMsg: 'None', next: 'S' };
        } else if (state == 'M') {
            return { busMsg: 'None', next: 'M' };
        }
    } else if (type == 'W') {
        if (state == 'I') {
            return { busMsg: 'BusRdX', next: 'M' };
        } else if (state == 'S') {
            return { busMsg: 'BusUpgr', next: 'M' };
        } else if (state == 'M') {
            return { busMsg: 'None', next: 'M' };
        }
    }

    return { busMsg: 'None', next: state };
}

export function onSnoop(state: State, msg: BusMsg): { next: State, flush: boolean} {
    if (state == 'I') {
        return { next: 'I', flush: false };
    } else if (state == 'S') {
        if (msg == 'BusRd') {
            return { next: 'S', flush: false };
        } else if ((msg == 'BusRdX') || (msg == 'BusUpgr')) {
            return { next: 'I', flush: false };
        }
    } else if (state == 'M') {
        if (msg == 'BusRd') {
            return { next: 'S', flush: true };
        } else if ((msg == 'BusRdX') || (msg == 'BusUpgr')) {
            return { next: 'I', flush: true };
        }
    }

    return { next: state, flush: false };
}