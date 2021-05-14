import { Insert, InsertGen } from './Insert';
import { ArraySplitsGen } from './ArraySplit';
import { Generator, interval, just, TupleGen } from 'jsproptest';
import { IDelta } from '../../core/IDelta';

export function ContentGen(baseLength = -1, withEmbed = true, withAttr = true):Generator<IDelta> {
    const baseLengthGen = baseLength >= 0 ? just(baseLength) : interval(1, 20)
    return baseLengthGen.flatMap(baseLength => {
        if(baseLength > 0) {
            const splitsGen = ArraySplitsGen(baseLength)
            return splitsGen.flatMap(splits => {
                return TupleGen<Generator<Insert>[]>(...splits.map(split => InsertGen(split.length, split.length, withEmbed, withAttr)))
            }).map(inserts => {return {ops: inserts }})
        }
        else {
            return just({ops:[]})
        }
    })
}