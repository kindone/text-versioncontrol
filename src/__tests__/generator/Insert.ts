import Op from "quill-delta/dist/Op";
import fc, { Arbitrary, ascii, asciiString, Random, Shrinkable, string } from "fast-check";
import AttributeMap from "quill-delta/dist/AttributeMap";
import { AttributeMapArbitrary } from "./Attribute";
import { genNat } from "./primitives";
import { ArbitraryWithShrink } from "./util";
import { embedObjArbitrary, XorXYorXYZ} from "./Embed";


export interface SimpleInsert extends Op {
    insert: string
}

export interface SimpleEmbed extends Op {
    insert: {[key in "x" | "xy" | "xyz"]?: string}
}

export interface Embed extends Op {
    insert: {[key in "x" | "xy" | "xyz"]?: string}
    attributes?:AttributeMap
}

export interface Insert {
    insert: string | {[key in "x" | "xy" | "xyz"]?: string}
    attributes?:AttributeMap
}


export const SimpleInsertArbitrary: (stringArb:Arbitrary<string>) => Arbitrary<SimpleInsert> = (stringArb:Arbitrary<string> = asciiString(1, 20)) => {
    return stringArb.map( str => { return {insert: str} });
}

export const SimpleEmbedArbitrary = () => embedObjArbitrary().map(obj => {
    return { insert: obj}
})

export const EmbedArbitrary = (withAttr:Boolean = false) =>  {
    if(withAttr) {
        return fc.boolean().chain(hasAttr => {
            return fc.record({insert: embedObjArbitrary(),
                attributes: new AttributeMapArbitrary()})
        })
    }
    else {
        return SimpleEmbedArbitrary()
    }
}

export const InsertArbitrary = (minLength = 1, maxLength = Number.MAX_VALUE,
    withEmbed = false, withAttr = false) => {
        const gen:(kind:number) => Arbitrary<Insert> = kind => {
            if(kind === 0)
                // insert
                return SimpleInsertArbitrary(string(minLength, maxLength))
            else if(kind == 1) {
                // embed
                if(withEmbed && minLength <= 1 && maxLength >= 1)
                    return SimpleEmbedArbitrary()
                else
                    return SimpleInsertArbitrary(string(minLength, maxLength))
            }
            else if(kind == 2) {
                // insert with attribute
                return fc.record({ insert: SimpleInsertArbitrary(string(minLength, maxLength)).map(i => i.insert),
                    attributes: new AttributeMapArbitrary() })
            }
            else {
                // embed with attribute
                if(withEmbed && minLength <= 1 && maxLength >= 1)
                    return fc.record({ insert: SimpleEmbedArbitrary().map(i => i.insert),
                        attributes: new AttributeMapArbitrary() })
                else
                    return fc.record({ insert: SimpleInsertArbitrary(string(minLength, maxLength)).map(i => i.insert),
                        attributes: new AttributeMapArbitrary() })
            }
        }
        return fc.integer(0, withAttr ? 4: 2).chain(gen)
    }

export const embedArbitrary = (withAttr = false) => EmbedArbitrary(withAttr)
export const insertArbitrary = (minLength = 1, maxLength = 20,
    withEmbed = false, withAttr = false) => InsertArbitrary(minLength, maxLength, withEmbed, withAttr)