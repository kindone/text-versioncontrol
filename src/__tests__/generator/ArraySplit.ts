import { JSONStringify } from '../../core/util'
import * as _ from 'underscore'
import { Generator, interval, just, SetGen } from 'jsproptest'

export type ArraySplit = { from: number; length: number }

function getSortedArrayFromSet<T>(set: Set<T>): Array<T> {
    const arr = new Array<T>()
    set.forEach(function(item) {
        arr.push(item)
    })
    return arr.sort((a, b) => (a > b ? 1 : a == b ? 0 : -1))
}

export function ArraySplitsGen(length: number, minSplits = -1, maxSplits = -1): Generator<ArraySplit[]> {
    if ((minSplits >= 0 && length < minSplits) || (maxSplits >= 0 && length < maxSplits))
        throw new Error(`length too small: ${length}, minSplits: ${minSplits}, maxSplits: ${maxSplits}`)
    else if (length <= 0)
        throw new Error(`length too small: ${length}, minSplits: ${minSplits}, maxSplits: ${maxSplits}`)

    if (minSplits < 0) minSplits = 0
    if (maxSplits < 0) maxSplits = length

    return interval(minSplits, maxSplits).flatMap(numSplits => {
        if (numSplits <= 1) return just<ArraySplit[]>([{ from: 0, length }])

        const seqGen = SetGen(interval(1, length - 1), numSplits - 1, numSplits - 1).map(set =>
            getSortedArrayFromSet(set),
        )

        return seqGen.map(seq => {
            // console.log(`random unique seq range: [${1},${length-1}], seqSize: ${numSplits-1}, seq: ${JSONStringify(seq)}`)
            const arr: ArraySplit[] = []

            expect(seq.length).toBe(numSplits - 1)

            arr.push({ from: 0, length: seq[0] })
            if (seq[0] <= 0) throw new Error(`invalid length: ${JSONStringify(seq)} at ${-1}`)

            for (let i = 0; i < seq.length - 1; i++) {
                arr.push({ from: seq[i], length: seq[i + 1] - seq[i] })
                if (seq[i + 1] - seq[i] <= 0) throw new Error(`invalid length: ${JSONStringify(seq)} at ${i}`)
            }
            arr.push({ from: seq[seq.length - 1], length: length - seq[seq.length - 1] })
            if (length - seq[seq.length - 1] <= 0)
                throw new Error(`invalid length: ${JSONStringify(seq)} at ${seq.length - 1}`)

            const reduced = _.reduce(
                arr,
                (sum, split) => {
                    return sum + split.length
                },
                0,
            )

            if (reduced != length) throw new Error(`reduced(${reduced}) != length(${length}), ${JSONStringify(arr)}`)
            return arr
        })
    })
}
