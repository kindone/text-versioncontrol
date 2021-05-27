import Op from 'quill-delta/dist/Op'
import AttributeMap from 'quill-delta/dist/AttributeMap'
import { AttributeMapGen } from './Attribute'
import { EmbedObjGen } from './Embed'
import { booleanGen, Generator, inRange, PrintableASCIIStringGen, TupleGen } from 'jsproptest'

export interface SimpleInsert extends Op {
    insert: string
}

export interface SimpleEmbed extends Op {
    insert: { [key in 'x' | 'xy' | 'xyz']?: string }
}

export interface Embed extends Op {
    insert: { [key in 'x' | 'xy' | 'xyz']?: string }
    attributes?: AttributeMap
}

export interface Insert {
    insert: string | { [key in 'x' | 'xy' | 'xyz']?: string }
    attributes?: AttributeMap
}

export function SimpleInsertGen(contentGen: Generator<string> = PrintableASCIIStringGen(1, 10)) {
    return contentGen.map(str => {
        return { insert: str }
    })
}

export function SimpleEmbedGen() {
    return EmbedObjGen().map(obj => {
        return { insert: obj }
    })
}

export const EmbedGen = (withAttr: Boolean = true) => {
    if (withAttr) {
        booleanGen().flatMap(hasAttr => {
            if (hasAttr)
                return TupleGen(EmbedObjGen(), AttributeMapGen()).map(tuple => {
                    return {
                        insert: tuple[0],
                        attributes: tuple[1],
                    }
                })
            else return SimpleEmbedGen()
        })
    } else {
        return SimpleEmbedGen()
    }
}

export function InsertGen(minLength = 1, maxLength = 20, withEmbed = true, withAttr = true) {
    const gen: (kind: number) => Generator<Insert> = kind => {
        if (kind === 0)
            // insert
            return SimpleInsertGen(PrintableASCIIStringGen(minLength, maxLength))
        else if (kind == 1) {
            // embed
            if (withEmbed && minLength <= 1 && maxLength >= 1) return SimpleEmbedGen()
            else return SimpleInsertGen(PrintableASCIIStringGen(minLength, maxLength))
        } else if (kind == 2) {
            // insert with attribute
            return TupleGen(
                SimpleInsertGen(PrintableASCIIStringGen(minLength, maxLength)).map(obj => obj.insert),
                AttributeMapGen(false),
            ).map(tuple => {
                return { insert: tuple[0], attributes: tuple[1] }
            })
        } else {
            // embed with attribute
            if (withEmbed && minLength <= 1 && maxLength >= 1) {
                return TupleGen(
                    SimpleEmbedGen().map(obj => obj.insert),
                    AttributeMapGen(false),
                ).map(tuple => {
                    return { insert: tuple[0], attributes: tuple[1] }
                })
            } else
                return TupleGen(
                    SimpleInsertGen(PrintableASCIIStringGen(minLength, maxLength)).map(obj => obj.insert),
                    AttributeMapGen(false),
                ).map(tuple => {
                    return { insert: tuple[0], attributes: tuple[1] }
                })
        }
    }
    return inRange(0, withAttr ? 4 : 2).flatMap(gen)
}
