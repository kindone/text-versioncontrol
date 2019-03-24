import fc, { Random, Arbitrary, asciiString, Shrinkable, string } from "fast-check";
import { genNat, genAsciiString } from "./primitives";
import { ArbitraryWithShrink } from "./util"
import * as _ from 'underscore'

type XorXYorXYZ = {[key in "x" | "xy" | "xyz"]?: string}


export class EmbedObjArbitrary extends ArbitraryWithShrink<XorXYorXYZ> {

    constructor(readonly stringArb:Arbitrary<string> = string(1,10), readonly numKinds = 2) {
        super()

        if(numKinds > 3)
            throw Error("unsupported number of kinds > 3: " + numKinds)
    }

    public generate(mrng:Random):Shrinkable<XorXYorXYZ> {
        const field = this.gen(mrng)
        return this.wrapper(field)
    }

    private gen(mrng:Random):XorXYorXYZ {
        const kind = genNat(mrng, this.numKinds)

        return this.stringArb.generate(mrng).map(str => {
            if(kind === 0) return { x: str}
            else if(kind === 1) return { xy: str}
            else return { xyz: str}
        }).value
    }

    public *shrinkGen(value:XorXYorXYZ):IterableIterator<Shrinkable<XorXYorXYZ>> {

        const sliceKeyBack = (value:XorXYorXYZ, key:string):XorXYorXYZ => {
            if((key in value) && value[key].length > 1)
                return _.extend(_.clone(value), {[key]: value[key].slice(0, -1)})
            else {
                return _.omit(_.clone(value), key)
            }
        }

        const sliceKeyFront = (value:XorXYorXYZ, key:string):XorXYorXYZ => {
            if((key in value) && value[key].length > 1)
                return _.extend(_.clone(value), {[key]: value[key].slice(1)})
            else {
                return _.omit(_.clone(value), key)
            }
        }

        for(const key of ["x", "xy", "xyz"])
        {
            // console.log('shrinkGen', key)
            if(key in value) {
                yield this.wrapper(sliceKeyFront(value, key))
                yield this.wrapper(sliceKeyBack(value, key))
            }
        }

    }
}

export const embedObjArbitrary =  (stringArb:Arbitrary<string> = string(1,10), numKinds = 2) => new EmbedObjArbitrary(stringArb, numKinds)
// export const OpEmbedGen = fc.jsonObject(2)