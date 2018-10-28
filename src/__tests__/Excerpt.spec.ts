import jsc = require("jsverify")
import * as _ from 'underscore'


describe("Excerpt", () => {
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