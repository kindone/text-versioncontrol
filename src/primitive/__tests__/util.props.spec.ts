import fc from "fast-check";
import { contentArbitrary } from "../../__tests__/generator/Content";
import { deltaArbitrary } from "../../__tests__/generator/Delta";
import { reverse, expectEqual, contentLength, minContentLengthForChange, normalizeOps, JSONStringify } from "../util";
import { SharedString } from "../SharedString";
import { Change } from "../Change";

describe('reverse function', () =>{
    it('basic', () => {
        const contentArb = contentArbitrary(true)
        const changeArb = deltaArbitrary(-1, true)
        fc.assert(
            fc.property(contentArb, changeArb, (content, change) => {
                change.ops = normalizeOps(change.ops)
                if(contentLength(content) < minContentLengthForChange(change))
                    return
                const undo = reverse(content, change)
                const ss1 = SharedString.fromDelta(content)
                ss1.applyChange(change, '_')
                let result = ss1.toDelta()
                result = {...result, ops: normalizeOps(result.ops)}

                if(contentLength(result) < minContentLengthForChange(undo))
                    throw new Error('unexpected undo')

                // inverse function is not possible due to attributes with no effect (cannot imaging an attribute)
                // expectEqual(reverse(result, undo), change, JSONStringify(result) + "  " + JSONStringify(undo) + "  " + JSONStringify(reverse(result, undo)))

                ss1.applyChange(undo, '_')
                expectEqual(normalizeOps(content.ops), normalizeOps(ss1.toDelta().ops), JSONStringify(undo))
                const ss2 = SharedString.fromDelta(result)
                ss2.applyChange(undo, '_')
                ss2.applyChange(change, '_')
                expectEqual(normalizeOps(result.ops), normalizeOps(ss2.toDelta().ops))
            }),
            { verbose: true, numRuns:1000 }
        )
    })
})