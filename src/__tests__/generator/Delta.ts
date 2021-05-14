import { Delta } from '../../core/Delta';
import { OpsGen } from './Ops';
import { just } from 'jsproptest';

export function DeltaGen(baseLength = -1, withAttr = true) {
    return OpsGen(baseLength, withAttr).map(ops => new Delta(ops))
}

export function EmptyDeltaGen() {
    return just(new Delta([]))
}

