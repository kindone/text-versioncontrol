import fc, { Random, Arbitrary, asciiString, Shrinkable } from "fast-check";
import { genNat } from "./primitives";
import AttributeMap from "quill-delta/dist/AttributeMap";



export class AttributeMapArbitrary extends Arbitrary<AttributeMap> {
    constructor(readonly arb:Arbitrary<any> = asciiString()) {
        super()
    }

    public generate(mrng:Random):Shrinkable<AttributeMap> {
        const kind = genNat(mrng, 8)
        switch (kind) {
            case 0:
                return this.arb.generate(mrng).map(obj => { return { b: obj} })
            case 1:
                return fc.constant({ b: null }).generate(mrng)
            case 2:
                return this.arb.generate(mrng).map(obj => { return { i: obj} })
            case 3:
                return fc.constant({ i: null }).generate(mrng)
            case 4:
                return this.arb.generate(mrng).map(obj => { return { b: obj, i: obj} })
            case 5:
                return fc.constant({ b:null, i: null }).generate(mrng)
            case 6:
                return this.arb.generate(mrng).map(obj => { return { b: obj, i: null} })
            case 7:
            default:
                return this.arb.generate(mrng).map(obj => { return { b: null, i: obj} })
        }
    }
}

const OpAttributeGen = fc.jsonObject(2)

export const attributeMapArbitrary = () => new AttributeMapArbitrary()

