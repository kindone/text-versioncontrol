import fc, { Arbitrary, Random, Shrinkable } from "fast-check";
import { AttributeMapArbitrary } from "./Attribute";
import Op from "quill-delta/dist/Op";
import AttributeMap from "quill-delta/dist/AttributeMap";


export interface SimpleRetain extends Op {
    retain: number
}

export interface Retain extends Op {
    retain: number
    attributes?:AttributeMap
}


export class SimpleRetainArbitrary extends Arbitrary<SimpleRetain> {
    constructor(readonly minLen = 1, readonly maxLen = 100) {
        super()
    }

    public generate(mrng:Random):Shrinkable<SimpleRetain> {
        return fc.integer().generate(mrng).map(num => { return { retain: num} })
    }
}

class RetainArbitrary extends Arbitrary<Retain> {
    constructor(readonly minLen = 1, readonly maxLen = 100, readonly withAttr = false) {
        super()
    }

    generate(mrng:Random):Shrinkable<Retain> {
        if(this.withAttr) {
            const hasAttr = mrng.nextBoolean()
            const arb = hasAttr ?
            fc.record({ retain: fc.integer(this.minLen, this.maxLen),
                attributes: new AttributeMapArbitrary() }) : simpleRetainArbitrary(this.minLen, this.maxLen)
            return arb.generate(mrng)
        }
        else
            return simpleRetainArbitrary(this.minLen, this.maxLen).generate(mrng)
    }


}


export const simpleRetainArbitrary = (minLen:number = 1, maxLen:number = 100) => new SimpleRetainArbitrary(minLen, maxLen)
export const retainWithAttrArbitrary = (minLen:number = 1, maxLen:number = 100):Arbitrary<Op> => fc.record({retain: fc.integer(minLen, maxLen), attr: new AttributeMapArbitrary()})
export const retainArbitrary = (minLen:number = 1, maxLen:number = 100, withAttr = false):Arbitrary<Op> => new RetainArbitrary(minLen, maxLen, withAttr)
export const deleteArbitrary = (minLen:number = 1, maxLen:number = 100) => fc.record({delete: fc.integer(minLen, maxLen)})