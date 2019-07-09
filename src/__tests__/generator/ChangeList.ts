import { Random, Shrinkable } from "fast-check";
import { deltaArbitrary } from "./Delta";
import * as _ from 'underscore'
import { contentLengthIncreased, JSONStringify } from "../../core/util";
import { ArbitraryWithShrink } from "./util";
import { genSmallBiasedDistribution } from "./primitives";
import { ExDelta } from "../../core/ExDelta";


export interface ChangeList {
    lengths:number[]
    deltas:ExDelta[]
}

export class ChangeListArbitrary extends ArbitraryWithShrink<ChangeList> {

    constructor(readonly initialLength:number = -1, readonly numChanges:number = -1, readonly withAttr = false) {
        super()
    }

    public generate(mrng:Random):Shrinkable<ChangeList> {
        const value = this.gen(mrng)
        return this.wrapper(value)
    }

    private gen(mrng:Random):ChangeList {
        const initialLength = this.initialLength != -1 ? this.initialLength : genSmallBiasedDistribution(mrng, 20)
        const numChanges = this.numChanges != -1 ? this.numChanges : genSmallBiasedDistribution(mrng, 30)
        const deltas:ExDelta[] = []
        let lengths = [initialLength]
        let length = initialLength

        for(let i = 0; i < numChanges; i++) {
            const delta = deltaArbitrary(length, false).generate(mrng).value
            deltas.push(delta)
            length = contentLengthIncreased(length, delta)

            if(length < 0)
                throw new Error("unexpected negative length:" + JSONStringify(lengths) +  "/" + JSONStringify(deltas))
            lengths.push(length)
        }

        return { lengths, deltas }
    }

    public *shrinkGen(value:ChangeList):IterableIterator<Shrinkable<ChangeList>> {
        if(value.deltas.length == 0)
            return

        if(value.deltas.length > 1) {
            yield this.wrapper({lengths: value.lengths.slice(0,-1), deltas:value.deltas.slice(0, -1)})
            yield this.wrapper({lengths: value.lengths.slice(1), deltas:value.deltas.slice(1)})
        }

        // shrink last delta
        var iterator = deltaArbitrary(value.lengths[value.lengths.length-1], this.withAttr).shrinkGen(value.deltas[value.deltas.length-1])
        let shrinkedDelta = iterator.next()
        while(!shrinkedDelta.done) {
            // console.log('shrinkGen', shrinkedOps)
            const newDeltas = _.clone(value.deltas)
            newDeltas[newDeltas.length-1] = shrinkedDelta.value.value
            const shrinkedChangeList = {lengths:value.lengths, deltas:newDeltas}
            yield this.wrapper(shrinkedChangeList)
            shrinkedDelta = iterator.next()
        }
    }
}

export const changeListArbitrary = (initialLength:number = -1, numChanges:number = -1) => new ChangeListArbitrary(initialLength, numChanges)

