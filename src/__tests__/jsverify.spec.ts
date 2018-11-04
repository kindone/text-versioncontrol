import jsc = require("jsverify")
import Delta = require("quill-delta")
import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { IDelta } from "../primitive/IDelta";
import { JSONStringify } from "../util";
import { OpGen } from "./jsverify.gen"
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
})