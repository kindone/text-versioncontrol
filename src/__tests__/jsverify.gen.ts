import jsc = require("jsverify")
import Delta = require("quill-delta")
import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { IDelta } from "../primitive/IDelta";
import { JSONStringify, deltaLength } from "../primitive/util";
import { randomAttribute, randomUserDeltas } from "./random";



export const NumberOrStringOrNullGen = jsc.sum([jsc.nat, jsc.asciinestring, jsc.falsy])

export const AttributeKeyValuePairGen =jsc.pair(jsc.asciinestring, NumberOrStringOrNullGen)

export const AttributeMapGen = (() => {
    const generator = jsc.generator.bless((size:number):AttributeMap => {
        const map:AttributeMap = {}
        for(let i = 0; i < size; i++)
        {
            const keyValuePair = AttributeKeyValuePairGen.generator(size)
            // bug in types not really ts tuple
            map[keyValuePair[0]] = (keyValuePair[1] as any).value
        }

        return map
    })

    const shrink = jsc.shrink.bless((attrs:AttributeMap):AttributeMap[] => {
        const keys = Object.keys(attrs)
        const size = Object.keys(attrs).length

        const smaller:AttributeMap[] = [];
        for (let i = 0; i < 5; i++) {
            const newAttrs:AttributeMap = _.omit(attrs, keys[jsc.random(0, size - 1)])
            smaller.push(newAttrs)
        }
        return smaller
    })

    const show = (attrs:AttributeMap) => {
        return JSONStringify(attrs)
    }

    return {generator, shrink, show}
})()

export const OpGen = (() => {

    const generator = jsc.generator.bless((size:number):Op => {
        const attributes:AttributeMap = randomAttribute()// AttributeMapGen.generator(size)

        switch(jsc.random(0,2)) {
          case 0: return {retain: jsc.nat.generator(size)+1, attributes}
          case 1: return {delete: jsc.nat.generator(size)+1, attributes}
          case 2: return {insert: jsc.asciinestring.generator(size), attributes}
        }
      })

    const shrink = jsc.shrink.bless((op:Op):Op[] => {
        const size = op.insert ? op.insert.toString().length :
            (op.retain ? op.retain : op.delete)

        const smallerSize = size > 2 ? jsc.random(1, size -1) : 1

        const smaller:Op[] = [];
        for (let i = 0; i < 5; i++) {
            smaller.push(generator(smallerSize));
        }

        return smaller
    })

    const show = (op:Op) => {
        return JSONStringify(op)
    }

    return {
        generator,
        shrink,
        show
    }
})()

export const DeltaGen = jsc.array(jsc.bless(OpGen)).smap((ops:Op[]) => new Delta(ops), (delta:Delta) => delta.ops)
export const DeltasGen = jsc.array(DeltaGen)

export const ChangesGen = (() => {
    const generator = jsc.generator.bless((size:number):Delta[] => {
        return randomUserDeltas(10, size, true)
    })

    const shrink = jsc.shrink.bless((deltas:Delta[]):Delta[][] => {
        const size = deltas.length

        const smallerSize = size > 2 ? jsc.random(1, size -1) : 1

        const smaller:Delta[][] = []
        for (let i = 0; i < 5; i++) {
            smaller.push(generator(smallerSize));
        }

        return smaller
    })

    const show = (op:Op) => {
        return JSONStringify(op)
    }

    return {generator, shrink, show}
})()

// export const ChangesGen = (() => {

//     const generator = jsc.generator.bless((size:number):Delta[] => {
//         const attributes:AttributeMap = randomAttribute()

//         switch(jsc.random(0,2)) {
//           case 0: return {retain: jsc.nat.generator(size)+1, attributes}
//           case 1: return {delete: jsc.nat.generator(size)+1, attributes}
//           case 2: return {insert: jsc.asciinestring.generator(size), attributes}
//         }
//       })

//     const shrink = jsc.shrink.bless((op:Op):Op[] => {
//         const size = op.insert ? op.insert.toString().length :
//             (op.retain ? op.retain : op.delete)

//         const smallerSize = size > 2 ? jsc.random(1, size -1) : 1

//         const smaller:Op[] = [];
//         for (let i = 0; i < 5; i++) {
//             smaller.push(generator(smallerSize));
//         }

//         return smaller
//     })

//     const show = (op:Op) => {
//         return JSONStringify(op)
//     }

//     return {
//         generator,
//         shrink,
//         show
//     }
// })()