import jsc = require('jsverify')
import Delta = require('quill-delta')
import * as _ from 'underscore'
import { Change } from '../primitive/Change'
import { Range } from '../primitive/Range'
import { contentLength, JSONStringify, normalizeOps, expectEqual, normalizeChanges, lastRetainsRemoved } from '../primitive/util'
import Op from 'quill-delta/dist/Op';
import { ExcerptUtil } from '../excerpt';

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