import { ContentGen } from '../../__tests__/generator/Content'
import {
    invertChange,
    contentLength,
    minContentLengthForChange,
    normalizeOps,
    filterOutChangesByIndice,
    filterChanges,
    applyChanges,
} from '../primitive'
import { SharedString } from '../SharedString'
import { IDelta } from '../IDelta'
import { History } from '../../history/History'
import { JSONStringify, expectEqual, isEqual } from '../util'
import { DeltaGen } from '../../__tests__/generator/Delta'
import { forAll } from 'jsproptest'
import { Delta } from '../Delta'
import { ContentChangeList, ContentChangeListGen } from '../../__tests__/generator/ContentChangeList'

describe('primitive.ts', () => {
    it('asDelta', () => {

    })

    it('opLength, deltaLength, contentLength, minContentLengthForChange, contentLengthChanged', () => {

    })

    //normalizeTwoOps
    //lastRetainsRemoved
    //emptyOpsRemoved
    //normalizeOps
    //normalizeDeltas
    //hasNoEffect
    //transformDeltas
    //applyChanges
    //flattenDeltas
    //flattenTransformedDelta
    //sliceOp
    //cropContent
    //invertChange
    //filterChanges
    //filterOutChangesByIndice
    //toQuillStyleOrder
})

describe('inverse function property', () => {
    it('basic', () => {
        const contentGen = ContentGen(-1, true, true)
        const changeGen = DeltaGen(-1, true, true)
        forAll(
            (content: IDelta, change: Delta) => {
                change.ops = normalizeOps(change.ops)
                if (contentLength(content) < minContentLengthForChange(change)) return

                const undo = invertChange(content, change)
                const ss1 = SharedString.fromDelta(content)
                ss1.applyChange(change, '_')
                let result = ss1.toDelta()
                result = { ...result, ops: normalizeOps(result.ops) }

                expect(() => contentLength(result) < minContentLengthForChange(undo))

                // invertChange(result, invertChange(content, change)) == change
                expectEqual(invertChange(result, undo), change, JSONStringify(result) + "  " + JSONStringify(undo) + "  " + JSONStringify(invertChange(result, undo)))

                ss1.applyChange(undo, '_')
                expectEqual(normalizeOps(content.ops), normalizeOps(ss1.toDelta().ops), JSONStringify(undo))
                const ss2 = SharedString.fromDelta(result)
                ss2.applyChange(undo, '_')
                ss2.applyChange(change, '_')
                expectEqual(normalizeOps(result.ops), normalizeOps(ss2.toDelta().ops))
            },
            contentGen,
            changeGen,
        )
    })
})

describe('filterChanges', () => {
    it('simple 1', () => {
        const content = { ops: [{ insert: '1234567' }] }
        const changes: IDelta[] = [
            { ops: [{ retain: 1 }, { insert: 'a' }, { retain: 1 }, { delete: 1 }] },
            { ops: [{ delete: 2 }, { insert: 'a' }] },
        ]

        const filtered = filterOutChangesByIndice(content, changes, [0])
        expectEqual(filtered.length, 1)

        const undo = invertChange(content, changes[0])
        let ss = SharedString.fromDelta(content)
        ss.applyChange(changes[0], 'A')
        ss = SharedString.fromDelta(ss.toDelta())
        ss.applyChange(undo, 'B')
        const filt = ss.applyChange(changes[1], 'A')

        const ss2 = SharedString.fromDelta(content)
        ss2.applyChange(filtered[0], 'A')
        if (!isEqual(ss.toDelta(), ss2.toDelta())) throw new Error('')

        expectEqual(filtered[0].ops, [{ delete: 1 }, { insert: 'a' }])
        expectEqual(ss.toDelta().ops, [{ insert: 'a234567' }])
    })

    it('simple 2', () => {
        const content = { ops: [{ insert: '1234567' }] }
        const changes: IDelta[] = [
            { ops: [{ retain: 1 }, { insert: 'a' }, { retain: 1 }, { delete: 1 }] },
            // 1a24567
            { ops: [{ delete: 2 }, { retain: 1 }, { insert: 'a' }] },
            // 2a4567
            { ops: [{ retain: 1 }, { insert: 'b' }, { delete: 2 }] },
            // 2b567
        ]

        expectEqual(applyChanges(content, changes.slice(0, 1)), { ops: [{ insert: '1a24567' }] })
        expectEqual(applyChanges(content, changes.slice(0, 2)), { ops: [{ insert: '2a4567' }] })
        expectEqual(applyChanges(content, changes), { ops: [{ insert: '2b567' }] }) // insert b delete a4

        const zero = filterChanges(content, changes, (idx, change) => false)
        expectEqual(zero.length, 0)

        expectEqual(changes, filterOutChangesByIndice(content, changes, []))
        expectEqual(changes.slice(0, 2), filterOutChangesByIndice(content, changes, [2]))
        expectEqual(changes.slice(0, 1), filterOutChangesByIndice(content, changes, [1, 2]))
        expectEqual([], filterOutChangesByIndice(content, changes, [0, 1, 2]))
        expectEqual(applyChanges(content, filterOutChangesByIndice(content, changes, [])), {
            ops: [{ insert: '2b567' }],
        })
        expectEqual(applyChanges(content, filterOutChangesByIndice(content, changes, [2])), {
            ops: [{ insert: '2a4567' }],
        })
        expectEqual(applyChanges(content, filterOutChangesByIndice(content, changes, [1, 2])), {
            ops: [{ insert: '1a24567' }],
        })

        // expectEqual(filterOutChangesByIndice(content, changes, [0,1]), '') // remain [2] ; insert b, delete 1 '4'
        // TODO
        expectEqual(applyChanges(content, filterOutChangesByIndice(content, changes, [0, 1])), {
            ops: [{ insert: '12b3567' }],
        })
        expectEqual(applyChanges(content, filterOutChangesByIndice(content, changes, [0, 2])), {
            ops: [{ insert: '2a34567' }],
        })
        expectEqual(applyChanges(content, filterOutChangesByIndice(content, changes, [1])), {
            ops: [{ insert: '1a2b567' }],
        })
    })

    it('one', () => {
        const contentChangeGen = ContentChangeListGen(-1, 2, true, true)

        forAll((contentChangeList: ContentChangeList) => {
            const content = contentChangeList.content
            const changeList = contentChangeList.changeList
            const changes = changeList.deltas

            const filtered = filterOutChangesByIndice(content, changes, [0])
            expectEqual(filtered.length, 1)

            const undo = invertChange(content, changes[0])
            let ss = SharedString.fromDelta(content)
            ss.applyChange(changes[0], 'A')
            ss = SharedString.fromDelta(ss.toDelta())
            ss.applyChange(changes[1], 'A')
            ss.applyChange(undo, 'B')

            const ss2 = SharedString.fromDelta(content)
            ss2.applyChange(filtered[0], 'A')
            if (!isEqual(ss.toDelta(), ss2.toDelta())) throw new Error(JSONStringify(ss) + ' / ' + JSONStringify(ss2))
        }, contentChangeGen)
    })
    it('basic', () => {
        const contentChangeGen = ContentChangeListGen(-1, 1, true, true)

        forAll((contentChangeList: ContentChangeList) => {
            const content = contentChangeList.content
            const changes = contentChangeList.changeList.deltas

            for (let i = 0; i < changes.length; i++) {
                const history1 = new History('_', content)
                const targetChange = changes[i]

                // do and undo
                history1.append(changes.slice(0, i)) // 0~i-1 changes
                const undoChange = invertChange(history1.getContent(), targetChange)
                history1.append(changes.slice(i))
                history1.merge({ branch: 'B', rev: i + 1, changes: [undoChange] })
                const result1 = history1.getContent()

                // filtered
                const history2 = new History('C', content)
                history2.append(filterOutChangesByIndice(content, changes, [i]))
                const result2 = history2.getContent()

                // must be equal
                expectEqual(result1, result2)
            }
        }, contentChangeGen)
    })
})
