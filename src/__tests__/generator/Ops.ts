import fc, { Random, Shrinkable } from "fast-check";
import Op from "quill-delta/dist/Op";
import {  genNat, genUniqueSequenceSorted, genSmallBiasedDistribution } from "./primitives";
import { attributeMapArbitrary } from "./Attribute";
import { insertArbitrary } from "./Insert";
import { genArraySplit } from "./ArraySplit";
import { ArbitraryWithShrink } from "./util";
import * as _ from 'underscore'

interface Indexable {
  [key: string]: any;
}

export class OpsArbitrary extends ArbitraryWithShrink<Op[]> {
    constructor(readonly baseLength:number = -1, readonly withAttr = false) {
        super()
    }

    generate(mrng:Random):Shrinkable<Op[]> {
        const ops = this.gen(mrng)
        return this.wrapper(ops)
    }

    private gen(mrng:Random):Op[] {
        const baseLength = this.baseLength == -1 ? genSmallBiasedDistribution(mrng, 100)+1 : this.baseLength
        const baseOps:Op[] = []

        if(baseLength > 0) {
            const splits = genArraySplit(mrng, baseLength)

            for(const split of splits) {
                const action = genNat(mrng, 3)
                // 1/3 prob
                if (action === 0) {
                    baseOps.push({ delete: split.length })
                } else {
                    if(this.withAttr && genNat(mrng, 5) == 0) {
                        baseOps.push({ retain: split.length, attributes: attributeMapArbitrary().generate(mrng).value })
                    }
                    else
                        baseOps.push({ retain: split.length })
                }
            }

            if (genNat(mrng, 3) !== 0) return baseOps
        }
        else {
            return [insertArbitrary(1,100, true, this.withAttr).generate(mrng).value]
        }


        const numInserts = mrng.nextInt(1, baseOps.length)
        const insertPositions = genUniqueSequenceSorted(mrng, 0, baseOps.length + 1, numInserts)
        let resultOps: Op[] = []
        let pre = 0
        for(const insertPos of insertPositions) {
            resultOps = resultOps.concat(baseOps.slice(pre, insertPos))
            resultOps.push(insertArbitrary(1,100, true, this.withAttr).generate(mrng).value)
            pre = insertPos
        }

        // rest
        resultOps = resultOps.concat(baseOps.slice(insertPositions[insertPositions.length - 1]))
        return resultOps
    }

    public *shrinkGen(ops:Op[]):IterableIterator<Shrinkable<Op[]>> {

        const hasKey = (ops:Op[], key:string) => _.some(ops, op => (key in op))
        const hasInsert = (ops:Op[]) => hasKey(ops, "insert")
        const hasAttributes = (ops:Op[]) => hasKey(ops, "attributes")

        const sliceFront = (ops:Op[]) => ops.slice(1)
        const sliceBack = (ops:Op[]) => ops.slice(0, -1)
        const filterInserts = (ops:Op[]) => _.filter(ops, (op) => !op.insert)
        const filterAttributes = (ops:Op[]) => _.filter(ops, (op) => !op.attributes)
        const decKey = (ops:Op[], key:string) => _.map(ops, op => {
            if((key in op) && (op as Indexable)[key]! > 0) {
                const cloned = _.clone(op) as Op
                (cloned as Indexable)[key]! -= 1
                if((cloned as Indexable)[key]! <= 0)
                    delete (cloned as Indexable)[key]
                return cloned
            }
            else
                return op
        })
        // TODO decrease retain/delete (on which op?)
        const decRetain = (ops:Op[]) => decKey(ops, "retain")
        const decDelete = (ops:Op[]) => decKey(ops, "delete")

        const removeAttribute = (op:Op) => {
            const cloned = _.clone(op)
            delete cloned.attributes
            return cloned
        }
        const removeAttributes = (ops:Op[]) => _.map(ops, (op) => removeAttribute(op))

        if(ops.length > 0) {
            // TODO: remove duplicates
            yield this.wrapper(sliceFront(ops))
            if(ops.length > 1) {
                yield this.wrapper(sliceBack(ops))

                if(hasInsert(ops))
                    yield this.wrapper(filterInserts(ops))

                if(hasAttributes(ops)) {
                    yield this.wrapper(filterAttributes(ops))
                }
            }
            if(hasAttributes(ops)) {
                yield this.wrapper(removeAttributes(ops))
            }
        }
    }
}

export const opsArbitrary = (baseLength:number = -1, withAttr = false) => new OpsArbitrary(baseLength, withAttr)
