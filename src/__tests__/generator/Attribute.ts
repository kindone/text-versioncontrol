
import { integers, interval, just, PrintableASCIIStringGen, TupleGen } from 'jsproptest'
import { Generator } from "jsproptest";

type Key = "i" | "b"
export type IOrB = {[key in Key]?: string|null}

export function AttributeMapGen(allowNullAttr = true, strGen:Generator<string> = PrintableASCIIStringGen(0, 3)):Generator<IOrB> {
    return interval(0, allowNullAttr ? 7 : 2).flatMap<IOrB>(kind => {
        switch (kind) {
            case 0:
                return strGen.map<IOrB>(str => { return { b: str} })
            case 1:
                return strGen.map<IOrB>(str => { return { i: str} })
            case 2:
                return TupleGen(strGen, strGen).map<IOrB>(tuple => { return { b: tuple[0], i: tuple[1]} })
            case 3:
                return just<IOrB>({ b: null })
            case 4:
                return just<IOrB>({ i: null })
            case 5:
                return just<IOrB>({ b: null, i: null })
            case 6:
                return strGen.map<IOrB>(str => { return { b: str, i: null} })
            case 7:
            default:
                return strGen.map<IOrB>(str => { return { b:null, i: str} })
        }
    })
}

export function NullableAttributeMapGen(strGen:Generator<string> = PrintableASCIIStringGen(0, 3)):Generator<IOrB> {
    return interval(0, 7).flatMap<IOrB>(kind => {
        switch (kind) {
            case 0:
                return strGen.map<IOrB>(str => { return { b: str} })
            case 1:
                return strGen.map<IOrB>(str => { return { i: str} })
            case 2:
                return TupleGen(strGen, strGen).map<IOrB>(tuple => { return { b: tuple[0], i: tuple[1]} })
            case 3:
                return just<IOrB>({ b: null })
            case 4:
                return just<IOrB>({ i: null })
            case 5:
                return just<IOrB>({ b: null, i: null })
            case 6:
                return strGen.map<IOrB>(str => { return { b: str, i: null} })
            case 7:
            default:
                return strGen.map<IOrB>(str => { return { b:null, i: str} })
        }
    })
}
