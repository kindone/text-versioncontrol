import * as chalk from 'chalk'
import each from 'jest-each'
import Delta = require('quill-delta')
import * as _ from 'underscore'
import { Document } from '../Document'
import {printChange, printContent, printChangedContent, printChanges} from '../primitive/printer'
import { contentLength, JSONStringify, normalizeOps, expectEqual } from '../primitive/util'
import { ExDelta } from '../primitive/ExDelta';
import { Source } from '../primitive/Change';

describe('Excerpt', () => {

    it('Document crop', () => {
        const doc1 = new Document('doc1', 'My Document 1')
        const doc2 = new Document('doc2', 'Here comes the trouble. HAHAHAHA')

        const source:Source = { type: 'excerpt', uri: "", rev: 0, start: 0, end: 0}
        const doc1Changes = [new ExDelta([], source).delete(3).insert('Your '), new Delta().retain(5).insert('precious ')]

        const doc2Changes = [new Delta().insert('Some introduction here: ')]
        doc1.append(doc1Changes)
        doc2.append(doc2Changes)

        expectEqual(
            JSONStringify(doc1.takeAt(0, 0, 2)),
            JSONStringify({ ops: [{ insert: 'My' }] })
        )

        expectEqual(
            JSONStringify(doc1.takeAt(1, 0, 4)),
            JSONStringify({ ops: [{ insert: 'Your' }] })
        )

        expectEqual(
            JSONStringify(doc1.takeAt(2, 0, 4)),
            JSONStringify({ ops: [{ insert: 'Your' }] })
        )

        expectEqual(
            JSONStringify(doc1.takeAt(2, 5, 9)),
            JSONStringify({ ops: [{ insert: 'prec' }] })
        )

        expectEqual(
            JSONStringify(doc1.take(0, 4)),
            JSONStringify({ ops: [{ insert: 'Your' }] })
        )

    })

    it('Document excerpt', () => {
        const doc1 = new Document('doc1', 'My Document 1')
        const doc2 = new Document('doc2', 'Here comes the trouble. HAHAHAHA')

        const doc1Changes = [new Delta().delete(3).insert('Your '), new Delta().retain(5).insert('precious ')]

        const doc2Changes = [new Delta().insert('Some introduction here: ')]
        doc1.append(doc1Changes)
        doc2.append(doc2Changes)

        const source1 = doc1.takeExcerpt(0, 4) // Your
        expectEqual(
            JSONStringify(source1),
            JSONStringify({ uri: 'doc1', rev: 2, start: 0, end: 4, content: { ops: [{ insert: 'Your' }] }, type: 'excerpt' }),
        )

        const excerpt = doc2.pasteExcerpt(5, source1)
        expectEqual(JSONStringify(excerpt.target), JSONStringify({ rev: 2, offset: 5, length: 5 }))

        expectEqual(
            JSONStringify(doc2.getContent().ops),
            JSONStringify([{"insert":"Some "},{"insert":{"excerpted":"doc1?rev=2"},"attributes":{"targetUri":"doc2","targetRev":2,"length":4}},{"insert":"Yourintroduction here: Here comes the trouble. HAHAHAHA"}])
        )
    })

    each([[false],[true]]).it('Document sync', (method) => {
        const doc1 = new Document('doc1', 'My Document 1')
        const doc2 = new Document('doc2', 'Here comes the trouble. HAHAHAHA')

        const doc1Changes = [
            new Delta([{ delete: 3 }, { insert: 'Your ' }]),
            new Delta([{ retain: 5 }, { insert: 'precious ' }]), // Your precious Document 1
        ]

        const doc2Changes = [
            new Delta().insert('Some introduction here: '), // Some introduction here: Here comes the trouble. HAHAHAHA
        ]

        const doc1ChangesAfterExcerpt = [
            new Delta([{ insert: "No, It's " }, { delete: 4 }, { insert: 'Our' }]), // +8, No, it's Our
            new Delta([{ retain: 13 + 8 }, { insert: ' beautiful ' }, { delete: 1 }]),
            new Delta([{ retain: 13 }, { insert: 'delicious ' }]),
            new Delta([{ retain: 16 }, { insert: 'ete' }, { delete: 6 }]),
        ]

        const doc2ChangesAfterExcerpt = [
            new Delta([{ delete: 4 }, { insert: 'Actual' }]),
            new Delta([{ retain: 11 }, { insert: 'tty' }, { delete: 5 }]), // Actual pre|tty|cious
            new Delta([{ retain: 11 }, { insert: 'ttier' }, { delete: 3 }]),
        ]


        doc1.append(doc1Changes)
        doc2.append(doc2Changes)

        console.log('phases1.doc1: ', printContent(doc1.getContent()))
        console.log('phases1.doc2: ', printContent(doc2.getContent()))

        const source1 = doc1.takeExcerpt(5, 14) // 'precious '
        console.log('sourceInfo:', JSONStringify(source1))

        const excerpt1 = doc2.pasteExcerpt(5, source1) // Some precious introduction here: ...'
        const target1 = excerpt1.target
        console.log('targetInfo:', JSONStringify(target1))

        console.log('phases2.doc2: ', printContent(doc2.getContent()))

        const doc1Content = doc1.getContent()
        const doc2Content = doc2.getContent()
        doc1.append(doc1ChangesAfterExcerpt)
        doc2.append(doc2ChangesAfterExcerpt)

        console.log('phases2.doc1 changes: ', printChangedContent(doc1Content, doc1ChangesAfterExcerpt))
        console.log('phases2.doc2 changes: ', printChangedContent(doc2Content, doc2ChangesAfterExcerpt))

        console.log('phases3.doc1: ', doc1.getCurrentRev(), printContent(doc1.getContent()))
        console.log('phases3.doc2: ', doc2.getCurrentRev(), printContent(doc2.getContent()))


        console.log('phases4.target: ', JSONStringify(target1))
        console.log('phases4.source: ', JSONStringify(source1))

        // method 1
        if (method) {
            const syncs = doc1.getSyncSinceExcerpted(source1)
            console.log('phases4.sync: ', JSONStringify(syncs))
            const target2 = doc2.syncExcerpt(syncs, target1)
            expectEqual(doc2.getContent(), {"ops":[{"insert":"Actual "},{"insert":{"excerpted":"doc1?rev=6"},"attributes":{"targetUri":"doc2","targetRev":9,"length":20}},{"insert":"prettier beautiful introduction here: Here comes the trouble. HAHAHAHA"}]})
            console.log('Sync changes: ', JSONStringify(doc2.getChangesFrom(target1.rev)))
            console.log('phases4.doc2: ', doc2.getCurrentRev(), printContent(doc2.getContent()))
        }
        // method2
        else {
            let source = source1
            let target = target1
            while (source.rev < doc1.getCurrentRev()) {
                const syncs = doc1.getSingleSyncSinceExcerpted(source)
                if(syncs.length == 0)
                    break
                const sync = syncs[0]
                target = doc2.syncExcerpt(syncs, target)
                source = doc1.takeExcerptAt(sync.rev, sync.range.start, sync.range.end)
                console.log('phases4.sync: ', JSONStringify(syncs))
                console.log('phases4.target: ', JSONStringify(target))
                console.log('phases4.source: ', JSONStringify(source))
                console.log('phases4.doc2: ', doc2.getCurrentRev(), printContent(doc2.getContent()))
            }
            expectEqual(doc2.getContent(), {
                "ops":[{"insert":"Actual "},{"insert":{"excerpted":"doc1?rev=6"},"attributes":{"targetUri":"doc2","targetRev":9,"length":20}},{"insert":"prettier beautiful introduction here: Here comes the trouble. HAHAHAHA"}]
            })
            console.log('Sync changes: ', JSONStringify(doc2.getChangesFrom(target1.rev)))
        }
    })

    it('TODO: Overlapping excerpt', () => {
        const doc1 = new Document('doc1', 'aaaa')
        const doc2 = new Document('doc2', 'bbbb')

        const e1 = doc1.takeExcerpt(1, 3)
        const d1 = doc2.pasteExcerpt(1, e1)

        const e2 = doc2.takeExcerpt(1, 3)
        const d2 = doc1.pasteExcerpt(3, e2)

        console.log(JSONStringify(e1))
        console.log(JSONStringify(e2))

        const doc1Changes = [
            new Delta([{ delete: 1 }, { insert: 'A' }]),
            new Delta([{ retain: 1 }, { insert: '1' }]),
            new Delta([{ retain: 2 }, { insert: '1' }]),
        ]

        const doc2Changes = [new Delta([{ insert: 'B' }])]
        doc1.append(doc1Changes)
        doc2.append(doc2Changes)

        const s1 = doc1.getSyncSinceExcerpted(e1)
        doc2.syncExcerpt(s1, d1.target)

        console.log(printContent(doc1.getContent()))
        console.log(printContent(doc2.getContent()))
    })

    // it('Document retain on excerpt', () => {
    //   const doc1 = new Document('doc1', 'My Document 1')
    //   console.log('phase1.doc1: ', JSONStringify(doc1.getContent()))

    //   const sourceInfo1 = doc1.takeExcerpt(3, 8) // Document
    //   console.log('sourceInfo:', JSONStringify(sourceInfo1))

    //   const doc1Changes = [
    //     // new Delta().delete(2).insert('Your'), // My -> Your
    //     new Delta().retain(3).insert('precious ') // Your precious Document 1
    //   ]

    //   doc1.append(doc1Changes)

    //   {
    //     const rangeInit = new Range(sourceInfo1.offset, sourceInfo1.offset+sourceInfo1.retain)
    //     console.log('phase2.changes:', JSONStringify(doc1.changesSince(sourceInfo1.rev)))
    //     const rangeTransformed = rangeInit.applyChanges(doc1.changesSince(sourceInfo1.rev))
    //     console.log('phase2.ranges:', rangeInit, rangeTransformed)

    //     const sourceInfo2 = doc1.takeExcerpt(rangeTransformed.start, rangeTransformed.end - rangeTransformed.start)
    //     console.log('updated sourceInfo: ', JSONStringify(sourceInfo2))
    //     console.log('phase2.doc1: ', JSONStringify(doc1.getContent()))
    //   }

    //   const sourceInfo3 =  doc1.takeExcerpt(3, 9) // 'precious '
    //   console.log('sourceInfo:', JSONStringify(sourceInfo3))

    //   const doc1Changes2 = [
    //     new Delta().delete(3).insert('Our '), // +8, Our
    //     new Delta().retain(13+8).delete(1).insert(' beautiful '),
    //     new Delta().retain(4).insert('delicious '),
    //     new Delta().retain(17).insert('tty').delete(5) // pretty
    //   ]

    //   doc1.append(doc1Changes2)

    //   {

    //     const rangeInit = new Range(sourceInfo3.offset, sourceInfo3.offset+sourceInfo3.retain)
    //     console.log('phase3.changes:', JSONStringify(doc1.changesSince(sourceInfo3.rev)))
    //     const rangeTransformed = rangeInit.applyChanges(doc1.changesSince(sourceInfo3.rev))
    //     console.log('phase3.ranges:', rangeInit, rangeTransformed)

    //     const sourceInfo2 = doc1.takeExcerpt(rangeTransformed.start, rangeTransformed.end - rangeTransformed.start)
    //     console.log('updated sourceInfo: ', JSONStringify(sourceInfo2))
    //     console.log('phase3.doc1: ', JSONStringify(doc1.getContent()))

    //     expectEqual(doc1.getContent(), {"ops":[{"insert":"Our delicious pretty Document beautiful 1"}]})

    //   }
    // })
})


describe('Recursive Excerpts', () => {
    it('Self', () => {
        const source = chalk.default.cyan
        const target = chalk.default.red
        const inserted = chalk.default.green
        const changes = [
            'abcd',
            source('[') + 'ab' + target('[') + 'abcd' + target(']') + 'cd' + source(']'),
            source('[') + 'ab' + target('[') + 'ab' + inserted('x') + 'cd' + target(']') + 'cd' + source(']')
        ]
        let i = 0
        for(const change of changes) {
            console.log('rev ' + (i++) + ': ' + change)
        }


    })
})
