import Op from "quill-delta/dist/Op";
import fc, { Arbitrary, asciiString, Random, Shrinkable, string } from "fast-check";
import { EmbedObjArbitrary } from "./Embed";
import AttributeMap from "quill-delta/dist/AttributeMap";
import { AttributeMapArbitrary } from "./Attribute";
import { genNat } from "./primitives";
import { ArbitraryWithShrink } from "./util";


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

export class SimpleInsertArbitrary extends ArbitraryWithShrink<SimpleInsert> {
    constructor(readonly stringArb:Arbitrary<string> = asciiString()) {
        super()
    }

    public generate(mrng:Random):Shrinkable<SimpleInsert> {
        return this.stringArb.generate(mrng).map(str => { return { insert: str} })
    }

    // FIXME: replace generate with this
    public generate2(mrng:Random):Shrinkable<SimpleInsert> {
        const insert = this.stringArb.generate(mrng).map(str => { return { insert: str} }).value
        return this.wrapper(insert)
    }

    public *shrinkGen(value:SimpleInsert):IterableIterator<Shrinkable<SimpleInsert>> {
        // TODO
    }
}


export class SimpleEmbedArbitrary extends Arbitrary<SimpleEmbed> {
    public generate(mrng:Random):Shrinkable<SimpleEmbed> {
        return new EmbedObjArbitrary().generate(mrng).map(obj => { return { insert: obj} })
    }
}

export class EmbedArbitrary  extends Arbitrary<Embed> {
    constructor(readonly withAttr = false) {
        super()
    }

    public generate(mrng:Random):Shrinkable<Embed> {
        const hasAttr = mrng.nextBoolean()
        if(hasAttr)
            return fc.record({ insert: new SimpleEmbedArbitrary().map(e => e.insert),
                attributes: new AttributeMapArbitrary() }).generate(mrng)
        else
            return fc.record({ insert: new SimpleEmbedArbitrary().map(e => e.insert)}).generate(mrng)
    }
}

export class InsertArbitrary extends Arbitrary<Insert> {

    constructor(readonly minLength = 1, readonly maxLength = Number.MAX_VALUE,
                readonly withEmbed = false, readonly withAttr = false) {
        super()
    }

    public generate(mrng:Random):Shrinkable<Insert> {
        const kind = genNat(mrng, this.withAttr ? 4 : 2)
        switch (kind) {
            case 0:
                // insert
                return this.simpleInsert(mrng)
            case 1:
                // embed
                if(this.withEmbed && this.minLength <= 1 && this.maxLength >= 1)
                    return this.simpleEmbed(mrng)
                else
                    return this.simpleInsert(mrng)
            case 2:
                // insert with attribute
                return this.insertWithAttr(mrng)
            case 3:
            default:
                // embed with attribute
                if(this.withEmbed && this.minLength <= 1 && this.maxLength >= 1)
                    return this.embedWithAttr(mrng)
                else
                    return this.insertWithAttr(mrng)
        }
    }

    public simpleInsert(mrng:Random) {
        return new SimpleInsertArbitrary(string(this.minLength, this.maxLength)).generate(mrng)
    }

    public simpleEmbed(mrng:Random) {
        return new SimpleEmbedArbitrary().generate(mrng)
    }

    public insertWithAttr(mrng:Random) {
        return fc.record({ insert: new SimpleInsertArbitrary(string(this.minLength, this.maxLength)).map(i => i.insert),
                         attributes: new AttributeMapArbitrary() }).generate(mrng)
    }

    public embedWithAttr(mrng:Random) {
        return fc.record({ insert: new SimpleEmbedArbitrary().map(i => i.insert),
                         attributes: new AttributeMapArbitrary() }).generate(mrng)
    }
}

export const embedArbitrary = (withAttr = false) => new EmbedArbitrary(withAttr)
export const insertArbitrary = (minLength = 1, maxLength = 20,
    withEmbed = false, withAttr = false) => new InsertArbitrary(minLength, maxLength, withEmbed, withAttr)
