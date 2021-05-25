import { SharedString } from "../SharedString";
import { contentLength, normalizeOps} from "../primitive";
import { expectEqual, JSONStringify } from "../util";
import { ContentGen } from "../../__tests__/generator/Content";
import { ContentChangeListGen } from "../../__tests__/generator/ContentChangeList";
import { forAll } from "jsproptest";
import { IDelta } from "../../core/IDelta"
import Op from "quill-delta/dist/Op";
import { ChangeList } from "../../__tests__/generator/ChangeList";
import { DeltaGen } from "../../__tests__/generator/Delta";
import { Delta } from "../Delta";

type ContentAndChangeList = {
    content: {
        ops: Op[];
    };
    changeList: ChangeList
}

describe('SharedString', () => {
    it('fromDelta', () => {
        // TODO: fromDelta and then toDelta should work as expected
    })

    it('clone', () => {
        // cloned object should behave the same as original
        // but cloned object must be separate from the original
    })

    it('equals', () => {
        // equals should properly distinguish same and different object
    })

    it('toDelta', () => {
        const contentGen = ContentGen()

        // inverse function property: SharedString.fromDelta(content).toDelta() == content
        forAll((content:IDelta) => {
            const ss = SharedString.fromDelta(content)
            expectEqual(normalizeOps(content.ops), normalizeOps(ss.toDelta().ops))
        }, contentGen)

        const contentChangeGen = ContentChangeListGen()

        // same inverse function property. This time SharedString.toDelta() is the content
        forAll((contentAndChangeList:ContentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss = SharedString.fromDelta(content)
            for(const change of changes)
                ss.applyChange(change, "x")
            expectEqual(normalizeOps(SharedString.fromDelta(ss.toDelta()).toDelta().ops), normalizeOps(ss.toDelta().ops))
        }, contentChangeGen)
    })

    it('toDelta branch', () => {
        const contentGen = ContentGen()

        // invariant: SharedString.toDelta(branch) on SS with no previous changes should be the same as toDelta() without branch
        forAll((content:IDelta) => {
            const ss = SharedString.fromDelta(content)
            expectEqual(normalizeOps(content.ops), normalizeOps(ss.toDelta("any").ops))
            expectEqual(normalizeOps(ss.toDelta().ops), normalizeOps(ss.toDelta("any").ops))
        }, contentGen)

        const contentChangeGen = ContentChangeListGen()

        // sharedstring with changes applied should emit the correct delta
        forAll((contentAndChangeList:ContentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss = SharedString.fromDelta(content)
            for(const change of changes)
                ss.applyChange(change, "x")
            expectEqual(normalizeOps(SharedString.fromDelta(ss.toDelta("x")).toDelta("x").ops), normalizeOps(ss.toDelta("x").ops))
            // toDelta(branch): any changes made by x should be invisible to y
            expectEqual(ss.toDelta("y").ops, normalizeOps(content.ops))
        }, contentChangeGen)
    })

    it('toFlattenedDelta', () => {
        // all changes are properly flattened
    })

    it('applyChanges', () => {
        // TODO:
    })

    // wildcard must see all changes as if it's been flattened
    it('applyChanges wildcard 1 (* < b)', () => {
        const ss = SharedString.fromString("123456")
        ss.applyChange({ops:[{delete:1}]}, "a")
        ss.applyChange({ops:[{delete:1}]}, "*") // should be aware of delete of '1' of a
        expectEqual(ss.toDelta().ops, [{insert:"3456"}])
        ss.applyChange({ops:[{insert:'b'},{retain:2},{insert:'b'}]}, 'b') // -> b1b3456, should not be aware of a but aware of *
        expectEqual(ss.toDelta().ops, [{insert:"b3b456"}])
        ss.applyChange({ops:[{delete:1}]}, "*")
        expectEqual(ss.toDelta().ops, [{insert:"3b456"}])
        ss.applyChange({ops:[{retain:1}, {insert:'x'}]}, "*")
        expectEqual(ss.toDelta().ops, [{insert:"3xb456"}]) // order should be kept
        ss.applyChange({ops:[{delete:3},{retain:1},{insert:'c'}]}, 'b') // should be aware of all changes except a's
        expectEqual(ss.toDelta().ops, [{insert:"bc456"}]) // order should be kept
    })

    // wildcard should not affect other branches later on
    it('applyChanges wildcard 1 (_ < b)', () => {
        const ss = SharedString.fromString("123456")
        ss.applyChange({ops:[{delete:1}]}, "a")
        ss.applyChange({ops:[{delete:1}]}, "_") // should be aware of delete of '1' of a
        expectEqual(ss.toDelta().ops, [{insert:"3456"}])
        ss.applyChange({ops:[{insert:'b'},{retain:2},{insert:'b'}]}, 'b') // -> b12b3456, should not be aware of a and _
        expectEqual(ss.toDelta().ops, [{insert:"bb3456"}])
        ss.applyChange({ops:[{delete:1}]}, "_")
        expectEqual(ss.toDelta().ops, [{insert:"b3456"}])
        ss.applyChange({ops:[{retain:1}, {insert:'x'}]}, "_")
        expectEqual(ss.toDelta().ops, [{insert:"bx3456"}]) // order should be kept
        ss.applyChange({ops:[{delete:3},{retain:1},{insert:'c'}]}, 'b')
        expectEqual(ss.toDelta().ops, [{insert:"bxc3456"}]) // order should be kept
    })

    it('applyChanges wildcard 1 (% < *)', () => {
        const ss = SharedString.fromString("123456")
        ss.applyChange({ops:[{delete:1}]}, "a")
        ss.applyChange({ops:[{delete:1}]}, "*") // should be aware of delete of '1'
        expectEqual(ss.toDelta().ops, [{insert:"3456"}])
        ss.applyChange({ops:[{insert:'b'},{retain:2},{insert:'b'}]}, '%') // -> b12b3456, should not be aware of above ops
        expectEqual(ss.toDelta().ops, [{insert:"b3b456"}])
        ss.applyChange({ops:[{delete:1}]}, "*")
        expectEqual(ss.toDelta().ops, [{insert:"3b456"}])
        ss.applyChange({ops:[{retain:1}, {insert:'x'}]}, "*")
        expectEqual(ss.toDelta().ops, [{insert:"3xb456"}])
        ss.applyChange({ops:[{delete:3},{retain:1},{insert:'c'}]}, '%') // should be aware of all changes except a's
        expectEqual(ss.toDelta().ops, [{insert:"bc456"}]) // order should be kept
    })

     // wildcard should not affect other branches later on
    it('applyChanges wildcard 1 (% < _)', () => {
        const ss = SharedString.fromString("123456")
        ss.applyChange({ops:[{delete:1}]}, "a")
        ss.applyChange({ops:[{delete:1}]}, "_") // should be aware of delete of '1' of a
        expectEqual(ss.toDelta().ops, [{insert:"3456"}])
        ss.applyChange({ops:[{insert:'b'},{retain:2},{insert:'b'}]}, 'b') // -> b12b3456, should not be aware of a and _
        expectEqual(ss.toDelta().ops, [{insert:"bb3456"}])
        ss.applyChange({ops:[{delete:1}]}, "_")
        expectEqual(ss.toDelta().ops, [{insert:"b3456"}])
        ss.applyChange({ops:[{retain:1}, {insert:'x'}]}, "_")
        expectEqual(ss.toDelta().ops, [{insert:"bx3456"}]) // order should be kept
        ss.applyChange({ops:[{delete:3},{retain:1},{insert:'c'}]}, 'b')
        expectEqual(ss.toDelta().ops, [{insert:"bxc3456"}]) // order should be kept
    })

    it('applyChanges wildcard 2', () => {
        const content = {"ops":[{"insert":"cc"}]}
        const changes = [
            {"ops":[{"insert":"pddq"},{"delete":2}]},
            {"ops":[{"delete":4},{"insert":{"x":"d"}}]},
            {"ops":[{"insert":"xaz"},{"delete":1}]}]

        const ss1 = SharedString.fromDelta(content)
        const ss2 = SharedString.fromDelta(content)

        for(const change of changes)
            ss1.applyChange(change, "x")

        for(const change of changes)
            ss2.applyChange(change, "*")

        expectEqual(ss1.toDelta(), {"ops":[{"insert":"xaz"}]} )
        expectEqual(ss1.toDelta(), ss2.toDelta())
    })

    it('applyChanges wildcard: * or _ change behaves the same as other branches when no other change is present', () => {
        const contentChangeGen = ContentChangeListGen()

        forAll((contentAndChangeList:ContentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss1 = SharedString.fromDelta(content)
            const ss2 = SharedString.fromDelta(content)
            const ss3 = SharedString.fromDelta(content)
            for(const change of changes)
                ss1.applyChange(change, "x")

            for(const change of changes)
                ss2.applyChange(change, "*")

            for(const change of changes)
                ss3.applyChange(change, "_")

            expectEqual(ss1.toDelta(), ss2.toDelta(), JSONStringify(ss1) + " vs " + JSONStringify(ss2) + ", changes: " + JSONStringify(changes))
            expectEqual(ss1.toDelta(), ss3.toDelta(), JSONStringify(ss1) + " vs " + JSONStringify(ss3) + ", changes: " + JSONStringify(changes))

        }, contentChangeGen)
    })

    const contentChangeGen = ContentChangeListGen(1, 2, true, false)

    // generate initial shared string
    const sharedStringGen = contentChangeGen.map(contentAndChangeList => {
        const content = contentAndChangeList.content
        const changes = contentAndChangeList.changeList.deltas
        const ss = SharedString.fromDelta(content)
        for(const change of changes)
            ss.applyChange(change, "x")
        return ss
    })

    // generate additional delta from shared string
    const ssAndDeltaGen = sharedStringGen.chain(ss => {
        const len = contentLength(ss.toDelta())
        const deltaGen = DeltaGen(len, true, false)
        return deltaGen
    })

    it('applyChanges change applies as if it were applied to a flattened delta', () => {
        forAll((ssAndDelta:[SharedString, Delta]) => {
            const [ss, delta] = ssAndDelta
            const ss2 = ss.clone()
            const ss3 = SharedString.fromDelta(ss.toDelta())

            // TODO: make separate test
            // check ss.clone().toDelta() == SharedString.fromDelta(ss.toDelta()).toDelta()
            expectEqual(normalizeOps(ss2.toDelta().ops), normalizeOps(ss3.toDelta().ops), JSONStringify(ss.toDelta()) + " / " + JSONStringify(delta))

            // apply change
            ss2.applyChange(delta, "x")
            ss3.applyChange(delta, "y")
            // must be identical
            expectEqual(normalizeOps(ss2.toDelta().ops), normalizeOps(ss3.toDelta().ops), JSONStringify(ss.clone()) + " vs " + JSONStringify(SharedString.fromDelta(ss.toDelta())) + ", ss: " + JSONStringify(ss.toDelta()) + ", delta: " + JSONStringify(delta))
        }, ssAndDeltaGen)
    })

    it('applyChanges wildcard change applies as if it was applied to a flattened delta', () => {

        forAll((ssAndDelta:[SharedString, Delta]) => {
            const [ss, delta] = ssAndDelta
            const ss2 = ss.clone()
            const ss3 = SharedString.fromDelta(ss.toDelta())
            // apply change
            ss2.applyChange(delta, "*")
            ss3.applyChange(delta, "*")
            // must be identical
            expectEqual(normalizeOps(ss2.toDelta().ops), normalizeOps(ss3.toDelta().ops),
                "ss2: " + JSONStringify(ss.clone()) + " -> " + JSONStringify(ss2)
                 + "\n vs ss3: " + JSONStringify(SharedString.fromDelta(ss.toDelta())) + " -> " + JSONStringify(ss3)
                 + "\n, ss: " + JSONStringify(ss.toDelta())
                + "\n, delta: " + JSONStringify(delta))
        }, ssAndDeltaGen)
    })

    const ssAndDeltaDeltaGen = ssAndDeltaGen.chainAsTuple((ssAndDelta:[SharedString,Delta]) => {
        const [ss,delta] = ssAndDelta
        ss.applyChange(delta, "*")
        const len = contentLength(ss.toDelta())
        const deltaGen = DeltaGen(len, true, false)
        return deltaGen
    })

})