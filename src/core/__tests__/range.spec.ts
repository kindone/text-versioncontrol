import { expectEqual } from "../util";
import { Range } from "../Range";
import Delta = require("quill-delta");
import * as fc from "fast-check";
import { deltaArbitrary } from "../../__tests__/generator/Delta";
import * as _ from 'underscore'
import { normalizeDeltas } from "../primitive";

describe('Range', () => {
    it('crop0-1', () => {
        const range = new Range(0, 1)

        expectEqual(range.cropContent({ops:[{insert:"a"}]}),
            {ops: [{insert:"a"}]}
        )
    })

    it('crop0-0', () => {
        const range = new Range(0, 0)

        expectEqual(range.cropContent({ops:[{insert:"a"}]}),
            {ops: []}
        )
    })

    it('crop empty', () => {
        const empty = {ops: []}
        const range = new Range(0, 0)
        expectEqual(range.cropContent(empty), empty)
    })

    it('applyChange', () => {
        const range = new Range(10, 20)
        expectEqual(range.applyChange(new Delta().delete(10)), new Range(0, 10))
        expectEqual(range.applyChange(new Delta().delete(11)), new Range(0, 9))

        expectEqual(range.applyChange(new Delta().retain(5).delete(5)), new Range(5, 15))
        expectEqual(range.applyChange(new Delta().retain(5).delete(6)), new Range(5, 14))
        expectEqual(range.applyChange(new Delta().retain(5).delete(15)), new Range(5, 5)) // delete all
        expectEqual(range.applyChange(new Delta().retain(5).delete(16)), new Range(5, 5))
        expectEqual(range.applyChange(new Delta().retain(10).delete(5)), new Range(10, 15))
        expectEqual(range.applyChange(new Delta().retain(11).delete(5)), new Range(10, 15)) // internal delete
        expectEqual(range.applyChange(new Delta().retain(11).delete(9)), new Range(10, 11))
        expectEqual(range.applyChange(new Delta().retain(11).delete(10)), new Range(10, 11))

        expectEqual(range.applyChangeOpen(new Delta().delete(10)), new Range(0, 10))
        expectEqual(range.applyChangeOpen(new Delta().delete(11)), new Range(0, 9))

        expectEqual(range.applyChangeOpen(new Delta().retain(5).delete(5)), new Range(5, 15))
        expectEqual(range.applyChangeOpen(new Delta().retain(5).delete(6)), new Range(5, 14))
        expectEqual(range.applyChangeOpen(new Delta().retain(5).delete(15)), new Range(5, 5)) // delete all
        expectEqual(range.applyChangeOpen(new Delta().retain(5).delete(16)), new Range(5, 5))
        expectEqual(range.applyChangeOpen(new Delta().retain(10).delete(5)), new Range(10, 15))
        expectEqual(range.applyChangeOpen(new Delta().retain(11).delete(5)), new Range(10, 15)) // internal delete
        expectEqual(range.applyChangeOpen(new Delta().retain(11).delete(9)), new Range(10, 11))
        expectEqual(range.applyChangeOpen(new Delta().retain(11).delete(10)), new Range(10, 11))

        expectEqual(range.applyChange(new Delta().insert('123')), new Range(13, 23))
        expectEqual(range.applyChange(new Delta().insert('12345')), new Range(15, 25))
        expectEqual(range.applyChange(new Delta().insert('1234567890')), new Range(20, 30))
        expectEqual(range.applyChangeOpen(new Delta().insert('123')), new Range(13, 23))
        expectEqual(range.applyChangeOpen(new Delta().insert('12345')), new Range(15, 25))
        expectEqual(range.applyChangeOpen(new Delta().insert('1234567890')), new Range(20, 30))

        expectEqual(range.applyChange(new Delta().retain(10).insert('12345')), new Range(15, 25)) // ** considered external
        expectEqual(range.applyChangeOpen(new Delta().retain(10).insert('12345')), new Range(10, 25)) // ** considered internal
        expectEqual(range.applyChange(new Delta().retain(11).insert('12345')), new Range(10, 25)) // internal
        expectEqual(range.applyChange(new Delta().retain(20).insert('12345')), new Range(10, 20)) // ** considered external
        expectEqual(range.applyChangeOpen(new Delta().retain(20).insert('12345')), new Range(10, 25))
        expectEqual(range.applyChange(new Delta().retain(21).insert('12345')), new Range(10, 20)) // out-of-bound
        expectEqual(range.applyChangeOpen(new Delta().retain(21).insert('12345')), new Range(10, 20)) // out-of-bound

        expectEqual(
            range.applyChange(
                new Delta()
                    .retain(5)
                    .delete(15)
                    .insert('12345'),
            ),
            new Range(10, 10),
        ) // * delete reordered
        expectEqual(range.applyChange(new Delta([{ retain: 5 }, { delete: 15 }, { insert: '12345' }])), new Range(5, 5))
        expectEqual(
            range.applyChangeOpen(
                new Delta()
                    .retain(5)
                    .delete(15)
                    .insert('12345'),
            ),
            new Range(10, 10),
        ) // * delete reordered
        expectEqual(
            range.applyChangeOpen(new Delta([{ retain: 5 }, { delete: 15 }, { insert: '12345' }])),
            new Range(5, 10),
        )
    })

    it('applyChanges', () => {
        const range = new Range(10, 20)
        const changes = [new Delta().delete(11), new Delta().insert('123'), new Delta().retain(10).insert('12345')]
        expectEqual(
            range
                .applyChange(changes[0])
                .applyChange(changes[1])
                .applyChange(changes[2]),
            range.applyChanges(changes),
        )
    })

    it('cropDelta', () => {
        const range = new Range(10, 20)
        expectEqual(range.cropDelta(new Delta().retain(10)), new Delta()) // no-op
        expectEqual(range.cropDelta(new Delta().retain(20)), new Delta()) // no-op

        expectEqual(range.cropDelta(new Delta().delete(10)), new Delta()) // nothing, only range changes
        expectEqual(range.cropDelta(new Delta().delete(11)), new Delta().delete(1))
        expectEqual(range.cropDelta(new Delta().delete(11)), new Delta().delete(1))
        expectEqual(range.cropDelta(new Delta().delete(20)), new Delta().delete(10))
        expectEqual(range.cropDelta(new Delta().delete(21)), new Delta().delete(10)) // overflow
        expectEqual(range.cropDeltaOpen(new Delta().delete(21)), new Delta().delete(10))

        expectEqual(range.cropDelta(new Delta().retain(10).delete(1)), new Delta().delete(1))
        expectEqual(range.cropDelta(new Delta().retain(10).delete(10)), new Delta().delete(10))
        expectEqual(range.cropDelta(new Delta().retain(10).delete(11)), new Delta().delete(10)) // overflow
        expectEqual(range.cropDeltaOpen(new Delta().retain(10).delete(1)), new Delta().delete(1))
        expectEqual(range.cropDeltaOpen(new Delta().retain(10).delete(10)), new Delta().delete(10))
        expectEqual(range.cropDeltaOpen(new Delta().retain(10).delete(11)), new Delta().delete(10)) // overflow

        expectEqual(range.cropDelta(new Delta().insert('1234567890')), new Delta()) // nothing, only range changes
        expectEqual(range.cropDelta(new Delta().retain(10).insert('1')), new Delta()) // nothing, only range changes
        expectEqual(range.cropDeltaOpen(new Delta().retain(9).insert('1')), new Delta()) // nothing, only range changes
        expectEqual(range.cropDeltaOpen(new Delta().retain(9).delete(1)), new Delta()) // nothing, only range changes
        expectEqual(range.cropDeltaOpen(new Delta().retain(9).delete(2)), new Delta().delete(1)) // nothing, only range changes
        expectEqual(range.cropDeltaOpen(new Delta().retain(10).insert('1')), new Delta().insert('1'))
        expectEqual(range.cropDelta(new Delta().retain(10).insert({ x: 1 })), new Delta()) // nothing, only range changes
        expectEqual(range.cropDeltaOpen(new Delta().retain(10).insert({ x: 1 })), new Delta().insert({ x: 1 }))
        expectEqual(range.cropDelta(new Delta().retain(11).insert('1')), new Delta().retain(1).insert('1'))
        expectEqual(range.cropDelta(new Delta().retain(11).insert({ x: 1 })), new Delta().retain(1).insert({ x: 1 }))
        expectEqual(range.cropDelta(new Delta().retain(19).insert('12345')), new Delta().retain(9).insert('12345'))
        expectEqual(range.cropDelta(new Delta().retain(20).insert('12345')), new Delta()) // nothing, only range changes
        expectEqual(range.cropDeltaOpen(new Delta().retain(20).insert('12345')), new Delta().retain(10).insert('12345'))
        expectEqual(
            range.cropDelta(new Delta().retain(11).insert('1234567890')),
            new Delta().retain(1).insert('1234567890'),
        )
        expectEqual(
            range.cropDeltaOpen(new Delta([{ retain: 10 }, { delete: 1 }, { insert: '123' }])),
            new Delta([{ delete: 1 }, { insert: '123' }]),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('123'),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('123'),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890'),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890'),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .delete(8),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890')
                .delete(8),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .delete(9),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890')
                .delete(8),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .retain(8)
                    .delete(1),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890'),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(1)
                    .insert('123')
                    .delete(1)
                    .retain(8)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .retain(8)
                    .delete(1),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890'),
        )
        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .retain(7)
                    .delete(1)
                    .retain(1)
                    .delete(1),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890')
                .retain(7)
                .delete(1),
        )

        expectEqual(
            range.cropDelta(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('123'),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('123'),
        )
        expectEqual(
            range.cropDeltaOpen(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890'),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890'),
        )
        expectEqual(
            range.cropDeltaOpen(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .delete(8),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890')
                .delete(8),
        )
        expectEqual(
            range.cropDeltaOpen(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .delete(9),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890')
                .delete(8),
        )
        expectEqual(
            range.cropDeltaOpen(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .retain(8)
                    .delete(1),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890'),
        )
        expectEqual(
            range.cropDeltaOpen(
                new Delta()
                    .retain(1)
                    .insert('123')
                    .delete(1)
                    .retain(8)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .retain(8)
                    .delete(1),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890'),
        )
        expectEqual(
            range.cropDeltaOpen(
                new Delta()
                    .retain(10)
                    .delete(1)
                    .retain(1)
                    .insert('1234567890')
                    .retain(7)
                    .delete(1)
                    .retain(1)
                    .delete(1),
            ),
            new Delta()
                .delete(1)
                .retain(1)
                .insert('1234567890')
                .retain(7)
                .delete(1),
        )
    })

    it('cropDelta regression', () => {
        const range = new Range(1, 3)

        const changes = [
            {ops: [
                {retain:3}, {insert: {x: "1"}, attributes: {y:"2"}}, {insert: {x: "3"}, attributes: {y:"4"}}, {insert: "a"}, {insert: {x: "5"}, attributes: {y:"6"}}
            ]}
        ]

        expectEqual(range.cropDelta(changes[0]),
            {ops: []}
        )
    })

    it('applyChange regression', () => {
        const range = new Range(1, 3)

        const changes = [
            {ops: [
                {retain:3}, {insert: {x: "1"}, attributes: {y:"2"}}, {insert: {x: "3"}, attributes: {y:"4"}}, {insert: "a"}, {insert: {x: "5"}, attributes: {y:"6"}}
            ]}
        ]

        expectEqual(range.applyChange(changes[0]),
            new Range(1,3)
        )
    })

    it('cropChanges', () => {
        const range = new Range(10, 20)

        const changes = [new Delta().retain(10), new Delta().retain(20)]

        expectEqual(normalizeDeltas(...range.cropChanges(changes)), []) // normalized
        expectEqual(normalizeDeltas(...range.cropChanges(changes)), []) // normalized

        changes.push(new Delta().retain(11).insert('123'))
        expectEqual(normalizeDeltas(...range.cropChanges(changes)), [new Delta().retain(1).insert('123')]) // normalized
        changes.push(new Delta().delete(2))
        expectEqual(normalizeDeltas(...range.cropChanges(changes)), [new Delta().retain(1).insert('123')]) // left bounded: only range changes
        changes.push(new Delta().retain(8).delete(1))
        expectEqual(normalizeDeltas(...range.cropChanges(changes)), [new Delta().retain(1).insert('123'), new Delta().delete(1)])

        changes.push(new Delta().retain(9).insert('456'))
        expectEqual(normalizeDeltas(...range.cropChanges(changes)), [
            new Delta().retain(1).insert('123'),
            new Delta().delete(1),
            new Delta().retain(1).insert('456'),
        ])
    })
})

describe('property tests', () => {
    it('cropChanges and applyChanges',() => {
        const deltaArb = deltaArbitrary(10)
        const fromArb = fc.integer(0, 20)
        const lengthArb = fc.integer(0, 20)
        let minDiff = 1000

        fc.assert(
            fc.property(deltaArb, fromArb, lengthArb, (delta, from, len) => {
                // const length = minContentLengthForChange(delta)
                const range = new Range(from, from + len)
                const rangeLength = range.end - range.start
                const newRange = range.applyChanges([delta])
                const newRangeLength = newRange.end - newRange.start
                const newDelta = range.cropDelta(delta)
                const newDeltaLength1 = _.reduce(newDelta.ops, (len, op) => {
                    if(typeof op.insert === 'string')
                        return len
                    else if(op.insert)
                        return len
                    else if(op.retain)
                        return len + op.retain
                    else if(op.delete)
                        return len + op.delete
                    else
                        throw new Error('unexpected op')
                },0)

                const newDeltaLength2 = _.reduce(newDelta.ops, (len, op) => {
                    if(typeof op.insert === 'string')
                        return len + op.insert.length
                    else if(op.insert)
                        return len + 1
                    else if(op.retain)
                        return len + op.retain
                    else if(op.delete)
                        return len + op.delete
                    else
                        throw new Error('unexpected op')
                },0)

                if(rangeLength < newDeltaLength1)
                    throw new Error(rangeLength.toString() + " < " + newDeltaLength1.toString())
                if(rangeLength - newDeltaLength1 < minDiff )
                    minDiff = rangeLength - newDeltaLength1
                // if(newRangeLength < newDeltaLength2)
                //     throw new Error(newRangeLength.toString() + " < " + newDeltaLength2.toString())
            }),
            { verbose: true, numRuns:100 }
        )
    })
})
