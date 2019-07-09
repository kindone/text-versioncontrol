import { Random, Shrinkable } from 'fast-check';
import {  emptyOpsArbitrary } from './op';

import * as _ from 'underscore'
import { opsArbitrary, OpsArbitrary } from './Ops';
import { ArbitraryWithShrink } from './util';
import { Delta } from '../../core/Delta';



export class DeltaArbitrary extends ArbitraryWithShrink<Delta>
{
    readonly opsGen:OpsArbitrary

    constructor(readonly baseLength = -1, readonly withAttr = false) {
        super()
        this.opsGen = opsArbitrary(baseLength, withAttr)
    }

    generate(mrng:Random):Shrinkable<Delta> {
        const value = this.opsGen.generate(mrng).value
        return this.wrapper(new Delta(value))
    }

    *shrinkGen(value:Delta):IterableIterator<Shrinkable<Delta>> {
        // console.log('shrinkGen', value.ops)
        var iterator = opsArbitrary(this.baseLength, this.withAttr).shrinkGen(value.ops)
        let shrinkedOps = iterator.next()
        while(!shrinkedOps.done) {
            // console.log('shrinkGen', shrinkedOps)
            yield shrinkedOps.value.map(ops => new Delta(ops))
            shrinkedOps = iterator.next()
        }
    }

}

export const deltaArbitrary = (baseLength = -1, withAttr = false) => new DeltaArbitrary(baseLength, withAttr)
export const emptyDeltaGen = emptyOpsArbitrary.map(op => new Array<Delta>())
