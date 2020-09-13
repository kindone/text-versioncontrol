import * as fc from 'fast-check'
import * as _ from 'underscore'

import { basicOpArbitrary} from './generator/Op';
import { JSONStringify } from '../core/util';
import { opsArbitrary } from './generator/Ops';
import { Random } from 'fast-check';
import prand from 'pure-rand';

const mrng = new Random(prand.xorshift128plus(0))

describe('basic fastcheck', () => {
    it('sort', () => {

        fc.assert(fc.property(fc.array(fc.integer()), (arr: number[]) => {
            return _.isEqual(arr.sort().sort(), arr.sort())
        }))
    })

    it('basic fc usage', () => {
        fc.assert(fc.property(fc.boolean(), b => (b && b) === b))
    })

    it('multiple args', () => {
        fc.assert(fc.property(fc.tuple(fc.nat(), fc.nat()), ([num1, num2]) => {
            return num1 + num2 >= num1
        }))
    })

    it('attributeMap', () => {
// interface AttributeMap {
//     [key:string]:string|AttributeMap
// }
        // fc.dictionary(fc.ascii(), fc.(fc.ascii(), fc.dictionary(fc.ascii(), fsc.ascii()))
        // const attributeValueMap = ():fc.Arbitrary<{[Key:string]:AttributeMap}> => fc.dictionary(fc.ascii(), attributeValueMap())
        // const attributeValueMapArb = attributeValueMap()

        fc.assert(fc.property(fc.jsonObject(2), (map) => {
            return true
        }))
    })

    // it('basic op', () => {
    //     fc.assert(fc.property(IntegerPositiveGen, (num) => {
    //         fc.assert(fc.property(OpBasicGen(num), (op) => {
    //             // console.log(JSONStringify(op))
    //             return (op.retain && op.retain <= num) || (op.delete && op.delete <= num) || (typeof op.insert !== 'undefined')
    //         }))
    //     }))

    // })

    // it('complex op', () => {
    //     fc.assert(fc.property(IntegerPositiveGen, (num) => {
    //         fc.assert(fc.property(OpComplexGen(num), (op) => {
    //             // console.log(JSONStringify(op))
    //             return (op.retain && op.retain <= num) || (op.delete && op.delete <= num) || (typeof op.insert !== 'undefined')
    //         }))
    //     }))

    // })

    // it('basic delta splits', () => {
    //     fc.assert(fc.property(DeltaGen(5), (splits) => {
    //         return true
    //     }))
    // })

    // it('basic delta', () => {
    //     fc.assert(fc.property(DeltaGen(5), (delta) => {
    //         // console.log(JSONStringify(delta))
    //         return true
    //     }))
    // })

    // // it('basic changes', () => {
    // //     fc.assert(fc.property(ChangeListGen(5, 5), (deltas) => {
    // //         console.log(JSONStringify(deltas))
    // //         return true
    // //     }))

    // // })

    it('basic changes', () => {
        // fc.assert(fc.property(new InsertArbitrary(true), (insert) => {
        //     console.log(JSONStringify(insert))
        //     return true
        // }))

        let i = 0

        const arb = basicOpArbitrary()

        fc.assert(fc.property(arb, (op) => {
            // console.log(JSONStringify(op))
            i++

            return i < 300
        }))

        const shrinkable = opsArbitrary().generate(mrng)

        console.log(JSONStringify(shrinkable))
        console.log(JSONStringify(shrinkable.shrink().take(10)))

        // fc.assert(fc.property(new ChangeListArbitrary(5, 5), (changeList) => {
        //     // console.log(JSONStringify(changeList.deltas))
        //     return true
        // }))

    })

    it('basic ops', () => {

        let i = 0

        fc.assert(fc.property(opsArbitrary(), (ops) => {
            // console.log(JSONStringify(ops))//, contentLengthIncreased(new Delta(ops)))
            i++
            // fc.assert(deltaLength(new Delta(ops)) ===
            return i < 300
        }))

        const shrinkable = opsArbitrary().generate(mrng)

        console.log(JSONStringify(shrinkable))
        console.log(JSONStringify(shrinkable.shrink().take(10)))


    })

})



// describe('Op generator', () => {
//     jsc.property('idempotent', OpGen, (op: Op) => {
//         // console.log(op)
//         let numActive = 0
//         if (op.insert) numActive++
//         if (op.delete) numActive++
//         if (op.retain) numActive++

//         return numActive === 1
//     })

//     jsc.property('size and length', OpGen, (op: Op) => {
//         // console.log(op)
//         let numActive = 0
//         if (op.insert) numActive++
//         if (op.delete) numActive++
//         if (op.retain) numActive++

//         return numActive === 1
//     })
// })

// describe('Generators', () => {
//     console.log('nat:', jsc.nat(5).generator(5))
//     console.log('nat:', jsc.nat(5).generator(7))
//     console.log('asciinestring:', jsc.asciinestring.generator(10))

//     console.log('op:', OpGen.generator(7))
//     console.log('delta:', DeltaGen.generator(3))
//     console.log('deltas:', DeltasGen.generator(3))
//     console.log('changes:', JSONStringify(ChangesGen.generator(3)))
// })

// describe('Changes generator', () => {
//     jsc.property('test', ChangesGen, (changes: Delta[]) => {
//         const length = 10
//         const content = new Delta({ ops: [{ insert: '1234567890' }] })
//         let applied = content
//         for (const change of changes) {
//             applied = applied.compose(change)
//         }

//         return true
//     })
// })
