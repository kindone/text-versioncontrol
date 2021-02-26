import { ArrayGen, booleanGen, Generator, inRange, integers, interval, just, oneOf, SetGen, TupleGen, weightedGen } from "jsproptest";
import Op from "quill-delta/dist/Op";
import * as _ from 'underscore'
import { Delta } from "../../core/Delta";
import { contentLengthIncreased, minContentLengthForChange } from "../../core/primitive";
import { JSONStringify } from "../../core/util";
import { ArraySplitsGen } from "./ArraySplit";
import { AttributeMapArbitrary } from "./Attribute";
import { InsertGen } from "./Insert";

interface Indexable {
  [key: string]: any;
}

function getSortedArrayFromSet<T>(set:Set<T>):Array<T>  {
    const arr = new Array<T>()
    set.forEach(function(item) {
        arr.push(item)
    })
    return arr.sort((a,b) => a > b ? 1 : (a == b ? 0 : -1))
}

export function OpsGen(baseLength = -1, withAttr = false):Generator<Op[]> {
    const baseLengthGen:Generator<number> = baseLength == -1 ? oneOf(weightedGen(inRange(1, 3), 0.9), inRange(3, 20)) : just(baseLength)

    return baseLengthGen.flatMap(baseLength => {
        if(baseLength > 0) {
            const splitsGen = ArraySplitsGen(baseLength)
            const baseOpsGen = splitsGen.flatMap(splits =>
                TupleGen(...splits.map(split =>
                    booleanGen(0.5).flatMap<Op>(isRetain => {
                        if(isRetain) {
                            if(withAttr)
                                return booleanGen(0.2).flatMap(hasAttr => {
                                    if(hasAttr) {
                                        return AttributeMapArbitrary().map<Op>(attr => {
                                            return { retain: split.length, attributes: attr}
                                        })
                                    }
                                    else {
                                        return just<Op>({ retain: split.length })
                                    }

                                })
                            else
                                return just<Op>({ retain: split.length })
                        }
                        else {
                            return just<Op>({ delete: split.length })
                        }
                    })
                ))
            )
            return baseOpsGen.flatMap(baseOps => {
                    expect(contentLengthIncreased(baseLength, new Delta(baseOps))).toBeGreaterThanOrEqual(0)

                    return interval(0, baseOps.length+1).flatMap(numInserts => {
                        const insertPositionsGen = SetGen(interval(0, baseOps.length), numInserts, numInserts).map(set => getSortedArrayFromSet(set))
                        const insertsGen = ArrayGen(InsertGen(1,5, true, withAttr), numInserts, numInserts)
                        return TupleGen(insertPositionsGen, insertsGen).map(tuple => {
                            const insertPositions = tuple[0]
                            const inserts = tuple[1]
                            let resultOps: Op[] = []
                            let pre = 0
                            for(let i = 0; i < insertPositions.length; i++) {
                                resultOps = resultOps.concat(baseOps.slice(pre, insertPositions[i]))
                                pre = insertPositions[i]
                                resultOps.push(inserts[i])
                            }
                            // rest
                            resultOps = resultOps.concat(baseOps.slice(insertPositions[insertPositions.length - 1]))
                            expect(minContentLengthForChange(new Delta(baseOps))).toBe(minContentLengthForChange(new Delta(resultOps)))
                            return resultOps
                        })
                    })
                }
            )
        }
        else {
            return InsertGen(1, 100, true, withAttr).map(insert => [insert as Op])
        }
    })
}