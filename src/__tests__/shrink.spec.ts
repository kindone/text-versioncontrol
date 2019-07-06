import * as fc from 'fast-check'
import * as _ from 'underscore'

import { basicOpArbitrary, complexOpArbitrary} from './generator/op';
import { isUniqueSequence, genUniqueSequenceSorted, genSmallBiasedDistribution } from './generator/primitives';
import { JSONStringify, expectEqual } from '../primitive/util';
import { retainArbitrary, deleteArbitrary } from './generator/RetainDelete';
import { opsArbitrary } from './generator/Ops';
import Delta = require('quill-delta');
import { Random, Arbitrary } from 'fast-check';
import prand from 'pure-rand';
import { insertArbitrary } from './generator/Insert';
import { splitArbitrary, genArraySplit } from './generator/ArraySplit';
import { embedObjArbitrary } from './generator/Embed';
import { deltaArbitrary } from './generator/Delta';
import { changeListArbitrary } from './generator/ChangeList';

const mrng = new Random(prand.xorshift128plus(new Date().getTime()))


function testShrink<T>(arb:Arbitrary<T>) {

    const numTrials = 10
    for(let trial = 0; trial < numTrials; trial ++)
    {
        try {

            let shrinkableT = arb.generate(mrng)

            for(let j = 0; j < 100; j++)
            {
                // console.log(`value(${j}):`, JSONStringify(shrinkableT.value))
                const streamShrinkableT = shrinkableT.shrink()
                let next = streamShrinkableT.next()

                if(!next || next.done || !next.value) {
                    if(j == 0)
                        throw new Error('no shrink seems to be defined')
                    break
                }

                const firstShrinked = next.value

                if(!firstShrinked) {
                    console.warn(`no more shrink after${j}`)
                    if(j == 0)
                        throw new Error('no shrink seems to be defined')
                    break
                }

                for(let i = 0; !next.done && i < 10; i++) {
                    // console.log(`shrink candidate(${j}:${i}): `, JSONStringify(next.value.value)) // JSONStringify(next.value)
                    next = streamShrinkableT.next()
                }

                shrinkableT = firstShrinked
            }

            break

        } catch(error) {
            if(trial == numTrials - 1) {
                throw error
            }
        }
    }

}

function testGenerate<T>(arb:Arbitrary<T>)
{
    for(let j = 0; j < 100; j++)
    {
        const generated = arb.generate(mrng).value
        // console.log('generate:', JSONStringify(generated))
    }
}

function testRandomDistribution(gen:() => number):{[key:number]:number} {
    const numTrials = 10000
    const counts:{[key:number]:number} = {}
    for(let i = 0; i < numTrials; i++) {
        const generated = gen()
        if(generated in counts)
            counts[generated] += 1/numTrials
        else
            counts[generated] = 1/numTrials
    }
    return counts
}

describe('shrink', () => {

    it('shrink() is immutable', () => {
        const arb = fc.integer()
        let shrinkableT = arb.generate(mrng)

        let str = JSONStringify(shrinkableT)
        for(let j = 0; j < 1000; j++)
        {
            shrinkableT.shrink()
            expectEqual(str, JSONStringify(shrinkableT))
        }
    })

    it('next() is mutable', () => {
        const arb = fc.integer()
        let shrinkableT = arb.generate(mrng)

        let streamShrinkableT = shrinkableT.shrink()
        let str = JSONStringify(streamShrinkableT.next())
        let same = true
        for(let j = 0; j < 1000; j++)
        {
            const next = streamShrinkableT.next()
            if(str !== JSONStringify(next))
                same = false
        }

        expectEqual(same, false)
    })

    it('genSmallBiasedDistribution', () => {
        for(let i = 1; i< 11; i++) {
            const generated = testRandomDistribution(() => genSmallBiasedDistribution(mrng, i))
            // console.log(`gen(${i}):`, generated)
        }
    })

    it('getRandomUniqueSequence', () => {

        for(let min = 0; min < 10; min ++)
        {
            for(let max = min; max < min + 10; max ++)
            {
                for(let seqSize = 1; seqSize < max - min + 2; seqSize++) {
                    for(let i = 0; i < 10; i++) {
                        const seq = genUniqueSequenceSorted(mrng, min, max, seqSize)
                        // console.log(`random unique seq range: [${min},${max}] seqSize: ${seqSize}`, seq)

                        if(seqSize >= 2 && seqSize < max - min) {
                            const splits = genArraySplit(mrng, max - min, seqSize)
                            // console.log(`random splits length: ${max}-${min}, seqSize: ${seqSize}`, splits)
                        }
                        expectEqual(isUniqueSequence(seq), true)
                    }
                }
            }

        }

    })


    it('boolean', () => {
        testShrink(fc.boolean())
    })

    it('integer', () => {
        testShrink(fc.integer())
    })

    it('array', () => {
        testShrink(fc.array(fc.integer()))
    })

    it('splits', () => {
        testShrink(splitArbitrary(100, true))
    })

    it('embedObjArbitrary', () => {
        testGenerate(embedObjArbitrary())
        testShrink(embedObjArbitrary())
    })

    it('retainArbitrary', () => {
        testShrink(retainArbitrary())
    })

    it('deleteArbitrary', () => {
        testShrink(deleteArbitrary())
    })

    it('insertOpArbitrary', () => {
        testGenerate(insertArbitrary())
        testShrink(insertArbitrary())
    })

    it('basicOpArbitrary', () => {
        testShrink(basicOpArbitrary())
    })

    it('complexOpArbitrary', () => {
        testShrink(complexOpArbitrary())
    })

    it('basicOpArbitrary array', () => {
        testShrink(fc.array(basicOpArbitrary()))
    })

    // it('generate splits', () => {
    //     console.log('uniqueSeq:', genUniqueSequence(mrng, 0,1, 1))
    //     console.log('uniqueSeq:', genUniqueSequence(mrng, 0,1, 2))

    //     console.log('split:', genArraySplit(mrng, 10, 1, 1))
    //     console.log('split:', genArraySplit(mrng, 10, 2, 2))
    //     console.log('split:', genArraySplit(mrng, 10, 3, 3))
    //     console.log('split:', genArraySplit(mrng, 10, 4, 4))
    // })


    it('opsArbitrary', () => {
        testGenerate(opsArbitrary())
        testShrink(opsArbitrary())
    })

    it('deltaArbitrary', () => {
        testGenerate(deltaArbitrary())
        testShrink(deltaArbitrary())
    })

    it('changeListArbitrary', () => {
        testGenerate(changeListArbitrary())
        testShrink(changeListArbitrary())
    })
})