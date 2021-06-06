import * as _ from 'underscore'
import { Document } from '../../document/Document'
import { JSONStringify, expectEqual, isEqual } from '../../core/util'
import { ChangeList, ChangeListGen } from '../../__tests__/generator/ChangeList'
import { DocumentSet } from '../../document/DocumentSet'
import { contentLength } from '../../core/primitive'
import {
    Action,
    integers,
    interval,
    just,
    PrintableASCIIStringGen,
    TupleGen,
    chainTuple,
    SetGen,
    UniqueArrayGen,
    statefulProperty,
    actionGenOf,
    Random,
    stringGen,
} from 'jsproptest'
import { Excerpt } from '../Excerpt'

const DocumentInitialGen = (name: string) => stringGen(0, 2, interval(65, 68)).map(content => new Document(name, content))

class ExcerptModel {
    public contentLengths: number[] = []
    public excerptsArr: any[][] = []

    constructor(public documents: Document[]) {
        for (const document of documents) {
            this.contentLengths.push(contentLength(document.getContent()))
            this.excerptsArr.push(document.getFullExcerpts())
        }
    }

    public getExcerpts(id: number) {
        return this.excerptsArr[id]
    }

    public setExcerpts(id: number, excerpts: any[]) {
        this.excerptsArr[id] = excerpts
    }
}

const AppendGen = (docSet: Document[], _: ExcerptModel) =>
    TupleGen(integers(0, docSet.length), interval(1, 2))
        .chain(pair => ChangeListGen(contentLength(docSet[pair[0]].getContent()), pair[1], false, false))
        .map(
            tuple =>
                new Action((docSet: Document[], model: ExcerptModel) => {
                    const [[docId, _], changeList] = tuple

                    expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
                    expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])
                    expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
                    expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

                    const doc = docSet[docId]
                    doc.append(changeList.deltas)

                    // update model
                    model.contentLengths[docId] = contentLength(doc.getContent())
                    // in case excerpts are removed
                    model.setExcerpts(0, docSet[0].getFullExcerpts())
                    model.setExcerpts(1, docSet[1].getFullExcerpts())
                }, `Append(${JSONStringify(tuple)})`),
        )

interface Take {
    id: number
    rev: number
    from: number
    to: number
}

interface Paste {
    id: number
    offset: number
}

// toString() {
//     return `excerpt(${JSONStringify(this.take)}, ${JSONStringify(this.paste)})`
// }

const TakeAndAppendExcerptGen = (docSet: Document[], _: ExcerptModel) => {
    const takeDocArgGen = integers(0, docSet.length).chain(takeDocId => interval(0, docSet[takeDocId].getCurrentRev()))

    const takeGen = chainTuple(takeDocArgGen, tuple => {
        const [takeDocId, takeRev] = tuple
        const takeDoc = docSet[takeDocId]
        const takeLen = contentLength(takeDoc.getContentAt(takeRev))
        // takeFrom, takeTo
        if (takeLen < 2) throw new Error('nothing to take excerpt from')
        return UniqueArrayGen(integers(0, takeLen), 2, 2)
    }).map<Take>(tuple => {
        return { id: tuple[0], rev: tuple[1], from: tuple[2][0], to: tuple[2][1] }
    })

    const pasteDocArgGen = integers(0, docSet.length).chain(pasteDocId =>
        interval(0, docSet[pasteDocId].getCurrentRev()),
    )

    const pasteGen = chainTuple(pasteDocArgGen, tuple => {
        const pasteDocId = tuple[0]
        const pasteDoc = docSet[pasteDocId]
        const pasteLength = contentLength(pasteDoc.getContent())
        // pasteOffset
        return interval(0, pasteLength) // offset may include length
    }).map<Paste>(tuple => {
        return { id: tuple[0], offset: tuple[1] }
    })

    const takeAndPasteGen = TupleGen(takeGen, pasteGen)

    return takeAndPasteGen.map(tuple => {
        const [take, paste] = tuple
        const takeDoc = docSet[take.id]
        const pasteDoc = docSet[paste.id]
        return new Action<Document[], ExcerptModel>((docSet: Document[], model: ExcerptModel) => {
            expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
            expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])

            expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
            expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

            const takeLen = contentLength(takeDoc.getContentAt(take.rev))
            if (takeLen === 0)
                // nothing to excerpt from
                return

            expect(take.from < take.to)
            expect(take.from < takeLen && take.to < takeLen)

            const pasteDoc = docSet[paste.id]
            const pasteLen = contentLength(pasteDoc.getContent())
            const pasteOffset = pasteLen > 0 ? paste.offset % pasteLen : 0
            const pasteRev = pasteDoc.getCurrentRev()

            // perform
            const source = takeDoc.takeExcerptAt(take.rev, take.from, take.to)
            const target = pasteDoc.pasteExcerpt(pasteOffset, source).target

            const debugInfo = [
                take,
                takeDoc.getCurrentRev(),
                paste,
                takeLen,
                take.rev,
                take.from,
                take.to,
                pasteLen,
                pasteOffset,
            ]

            // check pasted content
            expect(contentLength(source.content) > 0)
            expectEqual(
                source.content,
                pasteDoc.takeExcerpt(target.start + 1, target.end).content,
                JSONStringify(debugInfo),
            )

            // check marker
            {
                const actualOp = pasteDoc.takeExcerpt(target.start, target.start + 1).content.ops[0]
                const actualMarker = actualOp.insert
                const actualAttributes = actualOp.attributes

                const expectedMarker = {
                    excerpted: 'doc' + take.id + '?rev=' + take.rev + '&start=' + take.from + '&end=' + take.to,
                }
                const expectedAttributes = {
                    markedAt: 'left',
                    targetUri: 'doc' + paste.id,
                    targetRev: pasteRev.toString(),
                    targetStart: pasteOffset.toString(),
                    targetEnd: (
                        pasteOffset +
                        (take.to - take.from) +
                        1
                    ).toString() /*length: contentLength(source.content).toString()*/,
                    copied: 'true',
                }
                expectEqual(actualMarker, expectedMarker)
                expectEqual(actualAttributes, expectedAttributes)
            }

            // TODO: check right marker

            if (!isEqual(model.getExcerpts(paste.id).length + 1, pasteDoc.getFullExcerpts().length)) {
                throw new Error(
                    JSONStringify(model.getExcerpts(paste.id)) + ' != ' + JSONStringify(pasteDoc.getFullExcerpts()),
                )
            }

            // update model
            model.contentLengths[take.id] = contentLength(docSet[take.id].getContent())
            model.contentLengths[paste.id] = contentLength(docSet[paste.id].getContent())
            model.setExcerpts(0, docSet[0].getFullExcerpts())
            model.setExcerpts(1, docSet[1].getFullExcerpts())
        }, `TakeAndPaste(${JSONStringify(tuple)})`)
    })
}

const UpdateMarkerGen = (docSet: Document[], _: ExcerptModel) =>
    integers(0, docSet.length).map(
        docId =>
            new Action((docSet: Document[], model: ExcerptModel) => {
                // check model
                expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
                expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])

                expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
                expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

                // update model
                model.contentLengths[docId] = contentLength(docSet[docId].getContent())
                model.setExcerpts(0, docSet[0].getFullExcerpts())
                model.setExcerpts(1, docSet[1].getFullExcerpts())
            }, `UpdateMarker(${docId})`),
    )

class MyDocumentSet implements DocumentSet {
    constructor(readonly documents: Document[]) {}

    getDocument(uri: string): Document {
        for (const document of this.documents) {
            if (uri === document.getName()) return document
        }
        throw new Error('invalid uri')
    }
}

function findDocId(docSet: Document[], uri: string): number {
    for (let i = 0; i < docSet.length; i++) {
        if (docSet[i].name === uri) return i
    }
    return -1
}

const SyncExcerptGen = (docSet: Document[], _: ExcerptModel) =>
    integers(0, docSet.length)
        .chain(docId => integers(0, docSet[docId].getFullExcerpts().length))
        .map(tuple => {
            const docId = tuple[0]
            const excerptId = tuple[1]
            return new Action((docSet: Document[], model: ExcerptModel) => {
                // perform check and run
                const targetDoc = docSet[docId]
                const excerpts = targetDoc.getFullExcerpts()
                if (excerpts.length == 0) return

                // check model
                expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
                expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])
                expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
                expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

                const excerpt = excerpts[excerptId].excerpt
                // const excerpt = ExcerptUtil.decomposeMarker(excerptMarker)
                const sourceDocId = findDocId(docSet, excerpt.source.uri)
                expect(sourceDocId != -1)
                const sourceDoc = docSet[sourceDocId]

                const syncs = sourceDoc.getSyncSinceExcerpted(excerpt.source)
                if (syncs.length == 0) return

                const beforeSourceRev = excerpt.source.rev
                const beforeSourceContent = sourceDoc.getContentAt(beforeSourceRev)
                const sourceChanges = sourceDoc.getChangesFrom(beforeSourceRev)
                const afterSourceContent = sourceDoc.getContent()

                const beforeTargetRev = targetDoc.getCurrentRev()
                const beforeContent = targetDoc.getContent()
                targetDoc.syncExcerpt(excerpt, new MyDocumentSet(docSet))
                const afterContent = targetDoc.getContent()

                const newExcerpts = targetDoc.getFullExcerpts()

                // check: number of excerpts shoudn't change
                if (!isEqual(excerpts.length, newExcerpts.length))
                    throw new Error(
                        "FROM: " + excerpts.length + " != TO: " + newExcerpts.length + " BEFORE: " +
                        JSONStringify(beforeContent) +
                            ' VS AFTER: ' +
                            JSONStringify(afterContent) +
                            ' SYNCS: ' +
                            JSONStringify(syncs) +
                            ' TARGET: ' +
                            JSONStringify(targetDoc.getChangesFrom(beforeTargetRev)),
                    )

                // update model
                model.contentLengths[docId] = contentLength(docSet[docId].getContent())
                model.setExcerpts(0, docSet[0].getFullExcerpts())
                model.setExcerpts(1, docSet[1].getFullExcerpts())
            }, `SyncExcerpt(${JSONStringify(tuple)})`)
        })

describe('Excerpt properties', () => {
    it('Document excerpt', () => {
        // const rand = new Random('65')
        // append + take/paste excerpt

        // generator for initial document
        const doc1Gen = DocumentInitialGen('doc0')
        const doc2Gen = DocumentInitialGen('doc1')
        const docSetGen = TupleGen(doc1Gen, doc2Gen)
        const actionGen = actionGenOf(AppendGen, UpdateMarkerGen, TakeAndAppendExcerptGen, SyncExcerptGen)
        const prop = statefulProperty(docSetGen, docSet => new ExcerptModel(docSet), actionGen)
        prop.setNumRuns(1000)
            .setMaxActions(50)
            .go()
    })
})
