import * as chalk from 'chalk'
import * as fc from 'fast-check'
import Delta = require('quill-delta')
import * as _ from 'underscore'
import { Document } from '../Document'
import { Change } from '../primitive/Change'
import {printChange, printContent, printChangedContent, printChanges} from '../primitive/printer'
import { contentLength, JSONStringify, normalizeOps, expectEqual } from '../primitive/util'

import * as prand from 'pure-rand'
import { ChangeListArbitrary, ChangeList } from './generator/ChangeList';



const DocumentInitialGen = (name:string) => fc.asciiString(20).map(content => new Document(name, content))

class ExcerptModel {
    public contentLengths:number[] = []
    public excerptsArr:any[][] = []

    constructor(public documents:Document[]) {
        for(const document of documents) {
            this.contentLengths.push(contentLength(document.getContent()))
            this.excerptsArr.push(document.getPastedExcerpts())
        }
    }

    public getExcerpts(id:number) {
        return this.excerptsArr[id]
    }

    public setExcerpts(id:number, excerpts:any[]) {
        this.excerptsArr[id] = excerpts
    }
}

class AppendToDocCommand implements fc.Command<ExcerptModel, Document[]> {
    private changeList:ChangeList

    constructor(private id:number, private numChanges:number, private seed:number /*public readonly changeList:ChangeList*/) {}

    public check(model: Readonly<ExcerptModel>):boolean {
        fc.pre(model.contentLengths[this.id] === this.getChangeList().lengths[0])
        return true
    }

    public run(model: ExcerptModel, docSet: Document[]): void {
        expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
        expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])

        expectEqual(model.getExcerpts(0).length, docSet[0].getPastedExcerpts().length)
        expectEqual(model.getExcerpts(1).length, docSet[1].getPastedExcerpts().length)

        const doc = docSet[this.id]
        doc.append(this.getChangeList().deltas)
        model.contentLengths[this.id] = contentLength(doc.getContent())

        // in case excerpts are removed
        model.setExcerpts(0, docSet[0].getPastedExcerpts())
        model.setExcerpts(1, docSet[1].getPastedExcerpts())

    }

    public toString() {
        return `append(${this.id}, ${this.numChanges}, ${this.seed}, ${JSONStringify(this.getChangeList())})`
    }

    public [fc.cloneMethod]() {
        return new AppendToDocCommand(this.id, this.numChanges, this.seed)
    }

    private getChangeList() {
        if(!this.changeList) {
            const random = new fc.Random(prand.mersenne(this.seed))
            this.changeList = new ChangeListArbitrary(1,1).generate(random).value
        }

        return this.changeList
    }
}

interface Take {
    id:number
    rev:number
    from:number
    to:number
}

interface Paste {
    id:number
    offset:number
}


class TakeAndPasteExcerptCommand implements fc.Command<ExcerptModel, Document[]> {
    constructor(private take:Take, private paste:Paste) {}

    public check(m: Readonly<ExcerptModel>):boolean {
        return true
    }

    public run(model: ExcerptModel, docSet: Document[]): void {
        expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
        expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])

        expectEqual(model.getExcerpts(0).length, docSet[0].getPastedExcerpts().length)
        expectEqual(model.getExcerpts(1).length, docSet[1].getPastedExcerpts().length)

        const takeDoc = docSet[this.take.id]
        const takeRev = takeDoc.getCurrentRev() > 0 ? (this.take.rev % takeDoc.getCurrentRev()) : 0
        const takeLen = contentLength(takeDoc.getContentAt(takeRev))
        if(takeLen === 0) // nothing to excerpt from
            return

        const takeFrom = takeLen > 1 ? (this.take.from % (takeLen-1)) : 0
        let takeTo = (takeLen - takeFrom) > 0 ? ((this.take.to % (takeLen - takeFrom)) + takeFrom) : 0
        if(takeFrom === takeTo) {
            takeTo = takeFrom + 1
        }

        expect(takeFrom < takeLen && takeTo < takeLen)

        const pasteDoc = docSet[this.paste.id]
        const pasteLen = contentLength(pasteDoc.getContent())
        const pasteOffset = pasteLen > 0 ? this.paste.offset % pasteLen : 0
        const pasteRev = pasteDoc.getCurrentRev()

        const source = takeDoc.takeExcerptAt(takeRev, takeFrom, takeTo)
        const target = pasteDoc.pasteExcerpt(pasteOffset, source).target

        const debugInfo = [this.take,
            takeDoc.getCurrentRev(),
            this.paste,
            takeLen,
            takeRev,
            takeFrom,
            takeTo,
            pasteLen,
            pasteOffset]

        // check pasted content
        expect(contentLength(source.content) > 0)
        expectEqual(source.content, pasteDoc.takeExcerpt(target.start+1, target.end).content, JSONStringify(debugInfo))

        // check marker
        const actualOp = pasteDoc.takeExcerpt(target.start, target.start+1).content.ops[0]
        const actualMarker = actualOp.insert
        const actualAttributes = actualOp.attributes

        const expectedMarker = {excerpted: "doc" + this.take.id + "?rev=" + takeRev + "&start=" + takeFrom + "&end=" + takeTo}
        const expectedAttributes = {targetUri: "doc" + this.paste.id, targetRev: (pasteRev+1).toString(), targetStart: pasteOffset.toString(), targetEnd: (pasteOffset + (takeTo-takeFrom)).toString()/*length: contentLength(source.content).toString()*/, copied: "true"}
        expectEqual(actualMarker, expectedMarker)
        expectEqual(actualAttributes, expectedAttributes)

        expectEqual(model.getExcerpts(this.paste.id).length + 1, pasteDoc.getPastedExcerpts().length, () => JSONStringify(model.getExcerpts(this.paste.id)) + " != " + JSONStringify(pasteDoc.getPastedExcerpts()))

        // update model
        model.contentLengths[this.take.id] = contentLength(docSet[this.take.id].getContent())
        model.contentLengths[this.paste.id] = contentLength(docSet[this.paste.id].getContent())
        model.setExcerpts(0, docSet[0].getPastedExcerpts())
        model.setExcerpts(1, docSet[1].getPastedExcerpts())
    }

    public [fc.cloneMethod]() {
        return new TakeAndPasteExcerptCommand(this.take, this.paste)
    }

    public toString() {
        return `excerpt(${JSONStringify(this.take)}, ${JSONStringify(this.paste)})`
    }
}

describe('Excerpt properties', () => {
    it('Document excerpt', () => {

        // append + take/paste excerpt

        // generator for initial document
        const doc1Arb = DocumentInitialGen('doc0')
        const doc2Arb = DocumentInitialGen('doc1')
        const docSetArb = fc.tuple(doc1Arb, doc2Arb)

        // // generator for change list
        // const changeListGen = fc.record({
        //     initialLength:fc.integer(0, 20),
        //     numChanges: fc.integer(0,10)}).chain(
        //         rec => new ChangeListArbitrary(rec.initialLength, rec.numChanges))

        const appendGen = fc.record({
            id:fc.integer(0,1),
            numChanges: fc.integer(0,10),
            seed: fc.integer()
        })

        const takeGen = fc.record({
            id:fc.integer(0,1),
            rev:fc.integer(0, 100000),
            from:fc.nat(),
            to:fc.nat()
        })

        const pasteGen = fc.record({
            id:fc.integer(0,1),
            offset:fc.nat()
        })

        const takeAndPasteGen = fc.record({
            take:takeGen,
            paste:pasteGen
        })

        // command generator
        const commandsArb = fc.commands([
            appendGen.map(append => new AppendToDocCommand(append.id, append.numChanges, append.seed)),
            takeAndPasteGen.map(tnp => new TakeAndPasteExcerptCommand(tnp.take, tnp.paste))
        ])

        fc.assert(
            fc.property(docSetArb, commandsArb, (initialDocSet, commands) => {
              const real = initialDocSet
              const model = new ExcerptModel(real)
              fc.modelRun(() => ({ model, real }), commands)
            }),
            { verbose: true, numRuns:100 }
        )
    })
})