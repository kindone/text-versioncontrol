
import { DeltaGen } from "./Delta";
import { JSONStringify } from "../../core/util";
import { Delta } from "../../core/Delta";
import { contentLengthIncreased } from "../../core/primitive";
import { Generator, inRange, interval, just, oneOf, TupleGen } from "jsproptest";


export interface ChangeList {
    deltas:Delta[]
    lengths:number[]
}

interface DeltaAndLength {
    delta:Delta
    length:number
}

export function ChangeListGen(initialLength = -1, numChanges = -1, withAttr = true):Generator<ChangeList> {
    const initialLengthGen = initialLength != -1 ? just(initialLength) : oneOf(inRange(0, 3), interval(3, 20))
    const numChangesGen = numChanges != -1 ? just(numChanges) : interval(1, 20)

    return TupleGen(initialLengthGen, numChangesGen).flatMap(tuple => {
        const initialLength = tuple[0]
        const numChanges = tuple[1]

        const deltaAndLengthGen = (length:number) => DeltaGen(length, withAttr).map<[Delta,number]>(delta => {
            const newLength = contentLengthIncreased(length, delta)
            if(newLength < 0)
                throw new Error("unexpected negative length:" + JSONStringify([length, newLength]) +  "/" + JSONStringify(delta))
            return [delta, newLength]
        })

        let deltasAndLengthsGen:Generator<[Delta[], number[]]> = deltaAndLengthGen(initialLength).map(deltaAndLength => [[deltaAndLength[0]], [initialLength, deltaAndLength[1]]])
        return deltaAndLengthGen(initialLength).accumulate(deltaAndLength => {
            const delta = deltaAndLength[0]
            const length = deltaAndLength[1]
            if(length < 0)
                throw new Error("unexpected negative length:" + length +  "/" + JSONStringify(delta))
            return deltaAndLengthGen(length)
        }, numChanges, numChanges).map(deltasAndLengths => {
            const changeList:ChangeList = {deltas:[], lengths:[]}
            deltasAndLengths.forEach(deltaAndLength => {
                changeList.deltas.push(deltaAndLength[0])
                changeList.lengths.push(deltaAndLength[1])
            })
            return changeList
        })
    })
}
