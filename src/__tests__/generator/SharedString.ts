import { Random } from "fast-check";
import { SharedString } from "../../primitive/SharedString";
import { genAsciiString, genNat } from "./primitives";

 export function genSharedString(mrng:Random) {
    return SharedString.fromString(genAsciiString(mrng, genNat(mrng, 10) + 1))
}

