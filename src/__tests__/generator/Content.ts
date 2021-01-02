import fc, { Random, Shrinkable } from 'fast-check';

import * as _ from 'underscore'
import { ArbitraryWithShrink } from './util';
import { InsertArbitrary } from './Insert';
import { IDelta } from '../../core/IDelta';
import { genArraySplit } from './ArraySplit';
import { genNat } from './primitives';



export class ContentArbitrary extends ArbitraryWithShrink<IDelta>
{
    constructor(readonly baseLength: number = -1, readonly withEmbed = false, readonly withAttr = false) {
        super()
    }

    public generate(mrng:Random):Shrinkable<IDelta> {
        const baseLength = this.baseLength >= 0 ? this.baseLength : genNat(mrng, 20)
        if(baseLength > 0) {
            const splits = genArraySplit(mrng, baseLength)
            const inserts = splits.map(split => InsertArbitrary(split.length, split.length, this.withEmbed, this.withAttr).generate(mrng).value)
            return this.wrapper({ops:inserts})
        }
        else {
            return this.wrapper({ops:[]})
        }
    }

    public *shrinkGen(value:IDelta):IterableIterator<Shrinkable<IDelta>> {
        // TODO
    }
}

// export const contentArbitrary = (withAttr = false):fc.Arbitrary<Change> => fc.array(new InsertArbitrary(1, 20, true, withAttr),10).map(ops => ({ops}))
export const contentArbitrary = (baseLength = -1, withEmbed = false, withAttr = false):fc.Arbitrary<IDelta> => new ContentArbitrary(baseLength, withEmbed, withAttr)
