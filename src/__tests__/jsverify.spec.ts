import jsc = require("jsverify")
import Delta = require("quill-delta")
import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { IDelta } from "../primitive/IDelta";
import { JSONStringify } from "../util";
import { OpGen, DeltaGen, DeltasGen, ChangesGen } from "./jsverify.gen"
import { randomAttribute } from "./random";





describe("sort", () => {
    jsc.property("idempotent", "array nat", (arr:number[]) => {
      return _.isEqual(arr.sort().sort(), arr.sort())
    })
  })

describe("basic jsverify usage", () => {
    jsc.property("(b && b) === b", jsc.bool, b => (b && b) === b)

    jsc.property("boolean fn thrice", jsc.fn(jsc.bool), jsc.bool, (f, b) =>
      f(f(f(b))) === f(b)
    )
  })

describe("multiple args", () => {
  jsc.property("idempotent", "nat", "nat", (num1:number, num2:number) => {
    return num1 + num2 >= num1
  })
})


describe("Op generator", () => {

  jsc.property("idempotent", OpGen, (op:Op) => {
    // console.log(op)
    let numActive  = 0
    if(op.insert)
      numActive ++
    if(op.delete)
      numActive ++
    if(op.retain)
      numActive ++

    return numActive === 1
  })

  jsc.property("size and length", OpGen, (op:Op) => {
    // console.log(op)
    let numActive  = 0
    if(op.insert)
      numActive ++
    if(op.delete)
      numActive ++
    if(op.retain)
      numActive ++

    return numActive === 1
  })
})

describe("Generators", () => {

  console.log('nat:', jsc.nat(5).generator(5))
  console.log('nat:', jsc.nat(5).generator(7))
  console.log('asciinestring:', jsc.asciinestring.generator(10))

  console.log('op:', OpGen.generator(7))
  console.log('delta:', DeltaGen.generator(3))
  console.log('deltas:', DeltasGen.generator(3))
  console.log('changes:', JSONStringify(ChangesGen.generator(3)))
})

describe("Changes generator", () => {

  jsc.property("test", ChangesGen, (changes:Delta[]) => {
    const length = 10
    const content = new Delta({ops: [{insert: '1234567890'}]})
    let applied = content
    for(const change of changes)
    {
      applied = applied.compose(change)
    }

    return true
  })

})