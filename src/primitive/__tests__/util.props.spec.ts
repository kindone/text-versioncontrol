import fc from "fast-check";
import { contentArbitrary } from "../../__tests__/generator/Content";
import { deltaArbitrary } from "../../__tests__/generator/Delta";
import { reverseChange, expectEqual, contentLength, minContentLengthForChange, normalizeOps, JSONStringify, filterOutChangesByIndice, isEqual } from "../util";
import { SharedString } from "../SharedString";
import { Change } from "../Change";
import { History } from "../../history/History"
import { contentChangeListArbitrary } from "../../__tests__/generator/ContentChangeList";
import { ExDelta } from "../ExDelta";

describe('reverse function', () =>{
    it('basic', () => {
        const contentArb = contentArbitrary(true)
        const changeArb = deltaArbitrary(-1, true)
        fc.assert(
            fc.property(contentArb, changeArb, (content, change) => {
                change.ops = normalizeOps(change.ops)
                if(contentLength(content) < minContentLengthForChange(change))
                    return
                const undo = reverseChange(content, change)
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


describe('neutralizedChanges', () =>{
    it('known', () => {

        const content = {ops:[{insert:'1234567'}]}
        const changes:Change[] = [{ops:[{retain:1},{insert:'a'},{retain:1},{delete:1}]},
            {ops:[{delete:2},{insert:'a'}]}
        ]

        const neutralized = filterOutChangesByIndice(content, changes, [0])
        expectEqual(neutralized.length, 1)

        const undo = reverseChange(content, changes[0])
        let ss = SharedString.fromDelta(content)
        ss.applyChange(changes[0], "A")
        ss = SharedString.fromDelta(ss.toDelta())
        ss.applyChange(undo, "B")
        const neut = ss.applyChange(changes[1], "A")


        const ss2 = SharedString.fromDelta(content)
        ss2.applyChange(neutralized[0], "A")
        if(!isEqual(ss.toDelta(), ss2.toDelta()))
            throw new Error('')

        expectEqual(neutralized[0].ops, [{delete:1},{insert:'a'}])
        expectEqual(ss.toDelta().ops, [{insert:'a234567'}])
    })

    it('one', () => {
        const contentChangeArb = contentChangeListArbitrary(2)

        fc.assert(
            fc.property(contentChangeArb, (contentChangeList) => {
                const content = contentChangeList.content
                const changeList = contentChangeList.changeList
                const changes = changeList.deltas

                const neutralized = filterOutChangesByIndice(content, changes, [0])
                expectEqual(neutralized.length, 1)

                const undo = reverseChange(content, changes[0])
                let ss = SharedString.fromDelta(content)
                ss.applyChange(changes[0], "A")
                ss = SharedString.fromDelta(ss.toDelta())
                ss.applyChange(changes[1], "A")
                ss.applyChange(undo, "B")

                const ss2 = SharedString.fromDelta(content)
                ss2.applyChange(neutralized[0], "A")
                if(!isEqual(ss.toDelta(), ss2.toDelta()))
                    throw new Error(JSONStringify(ss) + " / " + JSONStringify(ss2))

            }),
            { verbose: true, numRuns:1000 }
        )
    })
    it('basic', () => {

        // const history0 = new History("0", "Hello world")
        // const changes = []
        // history0.append(changes.slice(0, i)) // 0~i-1 changes
        // const undoChange = reverse(history1.getContent(), targetChange)
        // history0.append(changes.slice(i))
        // history0.merge({branchName: "B", rev: i, deltas:[undoChange]})
        // const result1 = history0.getContent()


        const contentChangeArb = contentChangeListArbitrary(1)

        fc.assert(
            fc.property(contentChangeArb, (contentChangeList) => {
                const content = contentChangeList.content
                const changes = contentChangeList.changeList.deltas

                for(let i = 0; i < changes.length; i++) {
                    const history1 = new History("_", content)
                    const targetChange = changes[i]

                    // do and undo
                    history1.append(changes.slice(0, i)) // 0~i-1 changes
                    const undoChange = reverseChange(history1.getContent(), targetChange)
                    history1.append(changes.slice(i))
                    history1.merge({branchName: "B", rev: i+1, deltas:[undoChange]})
                    const result1 = history1.getContent()

                    // neutralized
                    const history2 = new History("C", content)
                    history2.append(filterOutChangesByIndice(content, changes, [i]))
                    const result2 = history2.getContent()

                    // must be equal
                    expectEqual(result1, result2)
                }

            }),
            { verbose: true, numRuns:1000 }
        )
    })
})