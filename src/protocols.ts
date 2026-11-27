import { type State } from './cache.ts';

export type BusMsg = 'BusRd' | 'BusRdX' | 'BusUpgr' | 'None';
export type ProtocolType = 'MSI' | 'MOSI' | 'MESI' | 'MOESI';

export function onProcess(state: State, type: 'R' | 'W', protocolType: ProtocolType, sharedByOthers: boolean ): { busMsg: BusMsg, next: State} {
    if (type == 'R') {
        if (state == 'I') {
            if (sharedByOthers || protocolType == 'MSI') {
                return { busMsg: 'BusRd', next: 'S' };
            } else {
                return { busMsg: 'BusRd', next: 'E' };
            }
        } else if (state == 'S') {
            return { busMsg: 'None', next: 'S' };
        } else if (state == 'M') {
            return { busMsg: 'None', next: 'M' };
        } else if (state == 'E') {
            return { busMsg: 'None', next: 'E' };
        } else if (state == 'O') {
            return { busMsg: 'None', next: 'O' };
        }
    } else if (type == 'W') {
        if (state == 'I') {
            return { busMsg: 'BusRdX', next: 'M' };
        } else if (state == 'S') {
            return { busMsg: 'BusUpgr', next: 'M' };
        } else if (state == 'M' || state == 'E') {
            return { busMsg: 'None', next: 'M' };
        } else if (state == 'O') {
            return { busMsg: 'BusUpgr', next: 'M' };
        }
    }

    return { busMsg: 'None', next: state };
}

export function onSnoop(state: State, msg: BusMsg, protocol: ProtocolType): { next: State, supplyData: boolean, writeBack: boolean, shared: boolean } {
    if (state == 'I') {
        return { next: 'I', supplyData: false, writeBack: false, shared: false };
    } else if (state == 'S') {
        if (msg == 'BusRd') {
            return { next: 'S', supplyData: false, writeBack: false, shared: true };
        } else if ((msg == 'BusRdX' ) || (msg == 'BusUpgr')) {
            return { next: 'I', supplyData: false, writeBack: false, shared: false };
        }
    } else if (state == 'M' || 'O') {
        if (msg == 'BusRd') {
            if (protocol == 'MSI') {
                return { next: 'S', supplyData: true, writeBack: true, shared: true };
            } else {
                return { next: 'O', supplyData: true, writeBack: true, shared: true };
            }
        } else if (msg == 'BusRdX' || msg == 'BusUpgr') {
            return { next: 'I', supplyData: true, writeBack: true, shared: false };
        } 
    } else if (state == 'E') {
        // Exclusive line COULD alternatively supply data since it is the same version as main memory
        if (msg == 'BusRd') {
            return { next: 'S', supplyData: false, writeBack: false, shared: true };
        } else if (msg == 'BusRdX') {
            return { next: 'I', supplyData: false, writeBack: false, shared: false };
        }
    } else if (state == 'O' && msg == 'BusUpgr') {
        return { next: 'I', supplyData: false, writeBack: false, shared: false };
    }

    return { next: state, supplyData: false, writeBack: false, shared: false };
}