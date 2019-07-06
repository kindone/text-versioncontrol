import { Random, Shrinkable } from "fast-check";
import { genSmallBiasedDistribution, genUniqueSequenceSorted } from "./primitives";
import { JSONStringify } from "../../primitive/util";
import { ArbitraryWithShrink } from "./util";
import * as _ from 'underscore'

type ArraySplit = { from: number; length:number}


export function genArraySplit(mrng:Random, length:number, minSplits = -1, maxSplits = -1):ArraySplit[] {
    if((minSplits >= 0 && length < minSplits) || (maxSplits >= 0 && length < maxSplits))
        throw new Error(`length too small: ${length}, minSplits: ${minSplits}, maxSplits: ${maxSplits}`)
    else if(length <= 0)
        throw new Error(`length too small: ${length}, minSplits: ${minSplits}, maxSplits: ${maxSplits}`)

    if(minSplits < 0)
        minSplits = 0
    if(maxSplits < 0)
        maxSplits = length - 1

    const numSplits = genSmallBiasedDistribution(mrng, (maxSplits - minSplits)+1, 0.8) + minSplits // minSplits~maxSplits

    if(numSplits <= 1)
        return [{from: 0, length}]

    const seq = genUniqueSequenceSorted(mrng, 1, length-1, numSplits-1)

    // console.log(`random unique seq range: [${1},${length-1}], seqSize: ${numSplits-1}, seq: ${JSONStringify(seq)}`)

    const arr:ArraySplit[] = []

    arr.push({from: 0, length: seq[0]})
    for(let i = 0; i < seq.length - 1; i++) {
        arr.push({from: seq[i], length: seq[i+1]-seq[i]})
    }
    arr.push({from: seq[seq.length-1], length: length - seq[seq.length-1]})

    const reduced = _.reduce(arr, (sum, split) => {
        return sum + split.length
    }, 0)

    if(reduced != length)
        throw new Error(`reduced(${reduced}) != length(${length}), ${JSONStringify(arr)}`)

    return arr
}


export class SplitArbitrary extends ArbitraryWithShrink<Array<ArraySplit>>
{
    constructor(readonly baseLength: number, readonly moreThanOne = true) {
        super()
    }

    public generate(mrng:Random):Shrinkable<Array<ArraySplit>> {

        // const splits: Array<ArraySplit> = [{from: 0, length: 1}, {from: 1, length: 1}, {from: 2, length: 1}, {from: 3, length: 1}, {from: 4, length: 1}, {from: 5, length: 2}]//[]
        const splits = genArraySplit(mrng, this.baseLength, this.moreThanOne ? 1 : 0)
        return this.wrapper(splits)
    }

    *shrinkGen(splits:Array<ArraySplit>):IterableIterator<Shrinkable<Array<ArraySplit>>> {

        // make 1 smaller by joining in the front
        const shrinkFront = (splits:Array<ArraySplit>) => {
            const front = { from:0, length: splits[0].length + splits[1].length}
            const combined = [front].concat(splits.slice(2))
            return combined
        }

        // make 1 smaller by joining in the back
        const shrinkRear = (splits:Array<ArraySplit>) => {
            const rear = { from: splits[splits.length - 2].from, length: splits[splits.length - 2].length + splits[splits.length - 1].length}
            const combined = splits.slice(0, splits.length - 2).concat(rear)
            return combined
        }

        while(true) {
            if(splits.length > 2) {
                yield this.wrapper(shrinkRear(splits))
                yield this.wrapper(shrinkFront(splits))
            }
            else if(splits.length === 2) {
                yield this.wrapper(shrinkFront(splits))
            }
            else
                return

            splits = shrinkRear(splits)
        }
    }
}

export const splitArbitrary = (baseLength:number, moreThanOne:boolean) => new SplitArbitrary(baseLength, moreThanOne)