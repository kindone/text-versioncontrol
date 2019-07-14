import { SharedString } from "../SharedString";
import { contentArbitrary } from "../../__tests__/generator/Content";
import * as fc from "fast-check";
import { contentLength, normalizeOps} from "../primitive";
import { expectEqual, JSONStringify } from "../util";
import { contentChangeListArbitrary } from "../../__tests__/generator/ContentChangeList";
import { deltaArbitrary } from "../../__tests__/generator/Delta";

describe('SharedString', () => {
    it('fromDelta', () => {

    })

    it('clone', () => {

    })

    it('equals', () => {

    })

    it('toDelta', () => {
        const contentArb = contentArbitrary()

        // toDelta and original content
        fc.assert(fc.property(contentArb, (content) => {
            const ss = SharedString.fromDelta(content)
            expectEqual(normalizeOps(content.ops), normalizeOps(ss.toDelta().ops))
        }), {numRuns:1000})

        const contentChangeArb = contentChangeListArbitrary()

        // sharedstring with changes applied should emit the correct delta
        fc.assert(fc.property(contentChangeArb, (contentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss = SharedString.fromDelta(content)
            for(const change of changes)
                ss.applyChange(change, "x")
            expectEqual(normalizeOps(SharedString.fromDelta(ss.toDelta()).toDelta().ops), normalizeOps(ss.toDelta().ops))
        }))
    })

    it('toDelta branch', () => {
        const contentArb = contentArbitrary()

        // toDelta and original content
        fc.assert(fc.property(contentArb, (content) => {
            const ss = SharedString.fromDelta(content)
            expectEqual(normalizeOps(content.ops), normalizeOps(ss.toDelta("any").ops))
        }), {numRuns:1000})

        const contentChangeArb = contentChangeListArbitrary()

        // sharedstring with changes applied should emit the correct delta
        fc.assert(fc.property(contentChangeArb, (contentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss = SharedString.fromDelta(content)
            for(const change of changes)
                ss.applyChange(change, "x")
            expectEqual(normalizeOps(SharedString.fromDelta(ss.toDelta("x")).toDelta("x").ops), normalizeOps(ss.toDelta("x").ops))
            expectEqual(ss.toDelta("y").ops, normalizeOps(content.ops)) // should be invisible to other branch
        }))
    })

    it('toFlattenedDelta', () => {
        // ??
    })

    it('applyChanges', () => {

    })

    // wildcard must see all changes as if it's been flattened
    // wildcard should not affect other branches later on
    it('applyChanges wildcard 1 (* < b)', () => {
        const ss = SharedString.fromString("123456")
        ss.applyChange({ops:[{delete:1}]}, "a")
        ss.applyChange({ops:[{delete:1}]}, "*") // should be aware of delete of '1'
        expectEqual(ss.toDelta().ops, [{insert:"3456"}])
        ss.applyChange({ops:[{insert:'b'},{retain:2},{insert:'b'}]}, 'b') // -> b12b3456, should not be aware of above ops
        expectEqual(ss.toDelta().ops, [{insert:"bb3456"}])
        ss.applyChange({ops:[{delete:1}]}, "*")
        expectEqual(ss.toDelta().ops, [{insert:"b3456"}])
        ss.applyChange({ops:[{retain:1}, {insert:'x'}]}, "*")
        ss.applyChange({ops:[{delete:3},{retain:1},{insert:'c'}]}, 'b') // (b12b3456) => ()
        expectEqual(ss.toDelta().ops, [{insert:"bcx3456"}]) // order should be kept
    })

    it('applyChanges wildcard 1 (% < *)', () => {
        const ss = SharedString.fromString("123456")
        ss.applyChange({ops:[{delete:1}]}, "a")
        ss.applyChange({ops:[{delete:1}]}, "*") // should be aware of delete of '1'
        expectEqual(ss.toDelta().ops, [{insert:"3456"}])
        ss.applyChange({ops:[{insert:'b'},{retain:2},{insert:'b'}]}, '%') // -> b12b3456, should not be aware of above ops
        expectEqual(ss.toDelta().ops, [{insert:"bb3456"}])
        ss.applyChange({ops:[{delete:1}]}, "*")
        expectEqual(ss.toDelta().ops, [{insert:"b3456"}])
        ss.applyChange({ops:[{retain:1}, {insert:'x'}]}, "*")
        ss.applyChange({ops:[{delete:3},{retain:1},{insert:'c'}]}, '%') // (b12b3456) => ()
        expectEqual(ss.toDelta().ops, [{insert:"bcx3456"}]) // order should be kept
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

    it('applyChanges wildcard: * change behaves the same when no other change is present', () => {
        const contentChangeArb = contentChangeListArbitrary()

        fc.assert(fc.property(contentChangeArb, (contentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss1 = SharedString.fromDelta(content)
            const ss2 = SharedString.fromDelta(content)
            for(const change of changes)
                ss1.applyChange(change, "x")

            for(const change of changes)
                ss2.applyChange(change, "*")

            expectEqual(ss1.toDelta(), ss2.toDelta())

        }), {numRuns:1000})
    })

    it('applyChanges wildcard change applies as if it were applied to a flattened delta', () => {
        const contentChangeArb = contentChangeListArbitrary()

        fc.assert(fc.property(contentChangeArb, (contentAndChangeList) => {
            const content = contentAndChangeList.content
            const changes = contentAndChangeList.changeList.deltas
            const ss = SharedString.fromDelta(content)
            for(const change of changes)
                ss.applyChange(change, "x")

            const len = contentLength(ss.toDelta())
            const deltaArb = deltaArbitrary(len)
            fc.assert(fc.property(deltaArb, (delta) => {
                const ss3 = ss.clone()
                const ss2 = SharedString.fromDelta(ss.toDelta())
                ss3.applyChange(delta, "*")
                ss2.applyChange(delta, "*")
                expectEqual(normalizeOps(ss3.toDelta().ops), normalizeOps(ss2.toDelta().ops), JSONStringify(content) + " => " + JSONStringify(changes) + " / " + JSONStringify(delta))
            }))


        }))
    })
})