import * as fc from 'fast-check'
import { Arbitrary, Random, Shrinkable } from 'fast-check'
import * as _ from "underscore"


export const IntegerOneToMaxGen = (max:number) => fc.integer(1, max)
export const IntegerPositiveGen = fc.nat().filter(n => n > 0)

export function genAsciiString(mrng:Random, size: number): string {
    return fc.asciiString(size, size).generate(mrng).value
}

export function genEvenDistribution(mrng:Random, dist:number) {
    const dist1000 = mrng.nextInt(0, dist*1000-1) // 0~(dist*1000-1)
    return Math.floor(dist1000 / 1000)
}

interface Bias
{
     [key:number]: number
}

export function genSmallBiasedDistribution(mrng:Random, dist:number, probForSmall=0.6) {
    if(dist == 0)
        throw new Error("0 dist is not allowed")
    if(dist <= 5) {
        return mrng.nextInt(0, dist-1) // 0~dist-1
    }

    // put 0, 1, 2 biased (put 0.6)
    const prob = mrng.nextDouble()

    if(prob < probForSmall) // 0~0.2~0.4~0.6
        return Math.floor(prob*3/probForSmall) // 0.19->0.6/0.6-> 0, 0.3999*3 = 1.19/0.6 -> 1, 0.5999*3 = 1.799/0.6->2
    else {
        const prob2 = (prob-probForSmall)/(1.0-probForSmall) // 0~1
        const bias = 3

        return Math.floor(Math.pow(prob2, bias)*(dist-3)) + 3
    }

        // dist:3 (0~2) rest of 0.6 ?
        // dist:4 (0~3) small prob not big
        // dist:5 (0~4) small prob same: 3 and 4 as extra
        // dist:6 (0~5) small prob big: 3,4,5 as extra
}

function genBiasedDistribution(mrng:Random, dist:number, bias:Bias = {}) {

}

export function genNat(mrng:Random, dist: number = -1):number {
     // return 0~dist-1
     // return Math.floor(Math.random() * dist)
     if(dist == 0)
        throw new Error("0 dist is not allowed")
     if(dist >= 1)
        return mrng.nextInt(0, dist-1)
    else
        return mrng.nextInt(0, Number.MAX_VALUE)
}

export function isUniqueSequence<T>(seq:T[]) {
    return _.size(_.uniq(seq)) == _.size(seq)
}

export function genUniqueSequence(mrng:Random, min:number, max:number, seqSize:number):number[]
{
    let size = max - min + 1

    if(size < seqSize)
        throw new Error(`size(${size}) < seqSize(${seqSize})`)

    let n = 0
    const dict:{[key:number]:number} = {}
    const arr:number[] = []
    // const tried:number[] = []

    while(n < seqSize) {
        const pos = genNat(mrng, size) + n
        // tried[n] = pos

        // ret
        if(pos in dict)
            arr.push(dict[pos])
        else
            arr.push(pos)

        // update
        if(n in dict)
            dict[pos] = dict[n]
        else
            dict[pos] = n

        n++
        size--
    }
    // console.log('tried:', tried, 'swapDict:', dict)
    return arr.map(v => v + min)
}


export const genUniqueSequenceSorted = (mrng:Random, min:number, max:number, seqSize:number):number[] => genUniqueSequence(mrng, min, max, seqSize).sort((a,b) => a - b)
