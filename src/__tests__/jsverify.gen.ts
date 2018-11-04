import jsc = require("jsverify")
import Delta = require("quill-delta")
import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { IDelta } from "../primitive/IDelta";
import { JSONStringify } from "../util";
import { randomAttribute } from "./random";

export const OpGen = (() => {

    const generator = (size:number):Op => {
        const attributes:AttributeMap = randomAttribute()

        switch(jsc.random(0,2)) {
          case 0: return {retain: jsc.nat.generator(size)+1, attributes}
          case 1: return {delete: jsc.nat.generator(size)+1, attributes}
          case 2: return {insert: jsc.asciinestring.generator(size), attributes}
        }
      }

    const shrink = (op:Op):Op[] => {
        const size = op.insert ? op.insert.toString().length :
            (op.retain ? op.retain : op.delete)

        const smallerSize = size > 2 ? jsc.random(1, size -1) : 1

        const smaller:Op[] = [];
        for (let i = 0; i < 5; i++) {
            smaller.push(generator(smallerSize));
        }

        return smaller
    }

    const show = (op:Op) => {
        return JSONStringify(op)
    }


    return {
        generator,
        shrink,
        show
    }
})()
