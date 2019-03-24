import jsc = require('jsverify')
import Delta = require('quill-delta')
import * as _ from 'underscore'
import { Change } from '../primitive/Change'
import { Range } from '../primitive/Range'
import { contentLength, JSONStringify, normalizeOps, expectEqual, normalizeChanges, lastRetainsRemoved } from '../primitive/util'
import Op from 'quill-delta/dist/Op';
import { ExcerptUtil } from '../excerpt';

describe('Range', () => {
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

    it('cropChange', () => {
        const range = new Range(10, 20)
        expectEqual(range.cropChange(new Delta().retain(10)), new Delta()) // no-op
        expectEqual(range.cropChange(new Delta().retain(20)), new Delta()) // no-op

        expectEqual(range.cropChange(new Delta().delete(10)), new Delta()) // nothing, only range changes
        expectEqual(range.cropChange(new Delta().delete(11)), new Delta().delete(1))
        expectEqual(range.cropChange(new Delta().delete(11)), new Delta().delete(1))
        expectEqual(range.cropChange(new Delta().delete(20)), new Delta().delete(10))
        expectEqual(range.cropChange(new Delta().delete(21)), new Delta().delete(10)) // overflow
        expectEqual(range.cropChangeOpen(new Delta().delete(21)), new Delta().delete(10))

        expectEqual(range.cropChange(new Delta().retain(10).delete(1)), new Delta().delete(1))
        expectEqual(range.cropChange(new Delta().retain(10).delete(10)), new Delta().delete(10))
        expectEqual(range.cropChange(new Delta().retain(10).delete(11)), new Delta().delete(10)) // overflow
        expectEqual(range.cropChangeOpen(new Delta().retain(10).delete(1)), new Delta().delete(1))
        expectEqual(range.cropChangeOpen(new Delta().retain(10).delete(10)), new Delta().delete(10))
        expectEqual(range.cropChangeOpen(new Delta().retain(10).delete(11)), new Delta().delete(10)) // overflow

        expectEqual(range.cropChange(new Delta().insert('1234567890')), new Delta()) // nothing, only range changes
        expectEqual(range.cropChange(new Delta().retain(10).insert('1')), new Delta()) // nothing, only range changes
        expectEqual(range.cropChangeOpen(new Delta().retain(9).insert('1')), new Delta()) // nothing, only range changes
        expectEqual(range.cropChangeOpen(new Delta().retain(9).delete(1)), new Delta()) // nothing, only range changes
        expectEqual(range.cropChangeOpen(new Delta().retain(9).delete(2)), new Delta().delete(1)) // nothing, only range changes
        expectEqual(range.cropChangeOpen(new Delta().retain(10).insert('1')), new Delta().insert('1'))
        expectEqual(range.cropChange(new Delta().retain(10).insert({ x: 1 })), new Delta()) // nothing, only range changes
        expectEqual(range.cropChangeOpen(new Delta().retain(10).insert({ x: 1 })), new Delta().insert({ x: 1 }))
        expectEqual(range.cropChange(new Delta().retain(11).insert('1')), new Delta().retain(1).insert('1'))
        expectEqual(range.cropChange(new Delta().retain(11).insert({ x: 1 })), new Delta().retain(1).insert({ x: 1 }))
        expectEqual(
            range.cropChange(new Delta().retain(11).insert('1234567890')),
            new Delta().retain(1).insert('1234567890'),
        )
        expectEqual(
            range.cropChangeOpen(new Delta([{ retain: 10 }, { delete: 1 }, { insert: '123' }])),
            new Delta([{ delete: 1 }, { insert: '123' }]),
        )
        expectEqual(
            range.cropChange(
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
            range.cropChange(
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
            range.cropChange(
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
            range.cropChange(
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
            range.cropChange(
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
            range.cropChange(
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
            range.cropChange(
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
            range.cropChangeOpen(
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
            range.cropChangeOpen(
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
            range.cropChangeOpen(
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
            range.cropChangeOpen(
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
            range.cropChangeOpen(
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
            range.cropChangeOpen(
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
            range.cropChangeOpen(
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

    it('cropChanges', () => {
        const range = new Range(10, 20)

        const changes = [new Delta().retain(10), new Delta().retain(20)]

        expectEqual(normalizeChanges(range.cropChanges(changes)), []) // normalized
        expectEqual(normalizeChanges(range.cropChanges(changes)), []) // normalized

        changes.push(new Delta().retain(11).insert('123'))
        expectEqual(normalizeChanges(range.cropChanges(changes)), [new Delta().retain(1).insert('123')]) // normalized
        changes.push(new Delta().delete(2))
        expectEqual(normalizeChanges(range.cropChanges(changes)), [new Delta().retain(1).insert('123')]) // left bounded: only range changes
        changes.push(new Delta().retain(8).delete(1))
        expectEqual(normalizeChanges(range.cropChanges(changes)), [new Delta().retain(1).insert('123'), new Delta().delete(1)])

        changes.push(new Delta().retain(9).insert('456'))
        expectEqual(normalizeChanges(range.cropChanges(changes)), [
            new Delta().retain(1).insert('123'),
            new Delta().delete(1),
            new Delta().retain(1).insert('456'),
        ])
    })
})

describe('Normalize', () => {
    it('lastRetainRemoved', () => {
        const nothing:Op[] = []
        const one:Op[] = [
            {retain: 5}
        ]
        const two:Op[] = [
            {retain: 5},
            {retain: 7}
        ]

        const nothingToRemove = [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
        ]

        const oneRetain = [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
            { retain: 2 }
        ]

        const twoRetains = [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
            { retain: 2 },
            { retain: 5 }
        ]

        const twoRetainsWithAttr = [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
            { retain: 2, attributes: {'x': 5} },
            { retain: 5, attributes: {'x': 5} }
        ]

        const twoRetainsWithAndWithoutAttr = [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
            { retain: 2, attributes: {'x': 5} },
            { retain: 5}
        ]

        const twoRetainsWithAndWithAttr2 = [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
            { retain: 2 },
            { retain: 5, attributes: {'x': 5} }
        ]

        expectEqual(lastRetainsRemoved(nothing), nothing)
        expectEqual(lastRetainsRemoved(one), [])
        expectEqual(lastRetainsRemoved(two), [])
        expectEqual(lastRetainsRemoved(nothingToRemove), nothingToRemove)
        expectEqual(lastRetainsRemoved(oneRetain), oneRetain.slice(0, -1))
        expectEqual(lastRetainsRemoved(twoRetains), twoRetains.slice(0, -2))
        expectEqual(lastRetainsRemoved(twoRetainsWithAttr), twoRetainsWithAttr)
        expectEqual(lastRetainsRemoved(twoRetainsWithAndWithoutAttr), twoRetainsWithAndWithoutAttr.slice(0, -1))
        expectEqual(lastRetainsRemoved(twoRetainsWithAndWithAttr2), twoRetainsWithAndWithAttr2)
    })


    it('scenario 1', () => {
        expectEqual(
            normalizeOps(
                new Delta()
                    .retain(5)
                    .retain(6)
                    .insert('a')
                    .insert('a')
                    .retain(0)
                    .insert('b')
                    .delete(1).ops,
            ),
            new Delta()
                .retain(11)
                .insert('aab')
                .delete(1).ops,
        )

        expectEqual(
            normalizeOps(
                new Delta()
                    .retain(-5)
                    .retain(6)
                    .insert('a', { a: 5 })
                    .insert('b')
                    .delete(1)
                    .delete(2).ops,
            ),
            new Delta()
                .retain(6)
                .insert('a', { a: 5 })
                .insert('b')
                .delete(3).ops,
        ) // * minus retain ignored
    })
})

describe('Misc', () => {
    it('isExcerptMarker', () => {
        const ops = [
            {insert: 'a'},
            {retain: 6},
            {delete: 3},
            {insert: ExcerptUtil.makeExcerptMarker('c', 1, 'd', 1, 2)},
            {retain: 5, attributes: {x: 65}},
            {insert: ExcerptUtil.makeExcerptMarker('a', 1, 'b', 2, 3)}
        ]

        // temp test
        expectEqual('excerpted' in {insert: ExcerptUtil.makeExcerptMarker('c', 1, 'd', 1, 2)}.insert, true)
        const insert:any = typeof ops[3].insert === 'string' ? {} : ops[3].insert
        expectEqual(typeof insert.excerpted.sourceUri, 'string')

        const toBoolean = ops.map(op => ExcerptUtil.isExcerptMarker(op))
        expectEqual(toBoolean, [false, false, false, true, false, true])
    }),

    it('setExcerptMarkersAsCopied', () => {
        const ops = [
            {insert: 'a'},
            {retain: 6},
            {delete: 3},
            {insert: ExcerptUtil.makeExcerptMarker('c', 1, 'd', 1, 2)},
            {retain: 5, attributes: {x: 65}},
            {insert: ExcerptUtil.makeExcerptMarker('a', 1, 'b', 2, 3), attributes: {x:1}} // not realistic to have attributes in excerpt marker but...
        ]
        const copiedOps = [
            {insert: 'a'},
            {retain: 6},
            {delete: 3},
            {insert: {copied: true, ...ExcerptUtil.makeExcerptMarker('c', 1, 'd', 1, 2)}},
            {retain: 5, attributes: {x: 65}},
            {insert: {copied: true, ...ExcerptUtil.makeExcerptMarker('a', 1, 'b', 2, 3)}, attributes: {x:1}}
        ]


        expectEqual(ExcerptUtil.setExcerptMarkersAsCopied(ops), copiedOps)
    })
})