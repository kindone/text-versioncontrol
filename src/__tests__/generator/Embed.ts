import fc, { Arbitrary, string } from "fast-check";
import * as _ from 'underscore'

type Key = "x" | "xy" | "xyz"
export type XorXYorXYZ = {[key in Key]?: string}

export const embedObjArbitrary = (stringArb:Arbitrary<string> = string(1,10), numKinds = 2):Arbitrary<XorXYorXYZ> => {
    return stringArb.chain(str => {
        return fc.integer(0, numKinds - 1).map(kind => {
                if(kind === 0) return { x: str}
                else if(kind === 1) return { xy: str}
                else return { xyz: str}
            }
        )
    })
}
