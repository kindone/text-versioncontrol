import { Generator, inRange, PrintableASCIIStringGen } from "jsproptest"

type Key = "x" | "xy" | "xyz"
export type XorXYorXYZ = {[key in Key]?: string}

export const EmbedObjGen = (strGen:Generator<string> = PrintableASCIIStringGen(1,10), numKinds = 3):Generator<XorXYorXYZ> => {
    return strGen.flatMap(str => inRange(0, numKinds).map(kind => {
        if(kind === 0) return { x: str}
        else if(kind === 1) return { xy: str}
        else return { xyz: str}
    }))
}