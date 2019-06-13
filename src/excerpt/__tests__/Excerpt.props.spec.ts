import * as fc from 'fast-check'
import * as _ from 'underscore'
import { Document } from '../../document/Document'
import { contentLength, JSONStringify, expectEqual, isEqual } from '../../primitive/util'
import * as prand from 'pure-rand'
import { ChangeListArbitrary, ChangeList } from '../../__tests__/generator/ChangeList';
import { ExcerptUtil } from '../ExcerptUtil';




const DocumentInitialGen = (name:string) => fc.asciiString(20).map(content => new Document(name, content))

class ExcerptModel {
    public contentLengths:number[] = []
    public excerptsArr:any[][] = []

    constructor(public documents:Document[]) {
        for(const document of documents) {
            this.contentLengths.push(contentLength(document.getContent()))
            this.excerptsArr.push(document.getFullExcerpts())
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

        expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
        expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

        const doc = docSet[this.id]
        doc.append(this.getChangeList().deltas)
        model.contentLengths[this.id] = contentLength(doc.getContent())

        // in case excerpts are removed
        model.setExcerpts(0, docSet[0].getFullExcerpts())
        model.setExcerpts(1, docSet[1].getFullExcerpts())

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

        expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
        expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

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
        {
            const actualOp = pasteDoc.takeExcerpt(target.start, target.start+1).content.ops[0]
            const actualMarker = actualOp.insert
            const actualAttributes = actualOp.attributes

            const expectedMarker = {excerpted: "doc" + this.take.id + "?rev=" + takeRev + "&start=" + takeFrom + "&end=" + takeTo}
            const expectedAttributes = {markedAt: "left", targetUri: "doc" + this.paste.id, targetRev: (pasteRev+1).toString(), targetStart: pasteOffset.toString(), targetEnd: (pasteOffset + (takeTo-takeFrom)+ 1).toString()/*length: contentLength(source.content).toString()*/, copied: "true"}
            expectEqual(actualMarker, expectedMarker)
            expectEqual(actualAttributes, expectedAttributes)
        }

        // TODO: check right marker

        if(!isEqual(model.getExcerpts(this.paste.id).length + 1, pasteDoc.getFullExcerpts().length)) {
                throw new Error(JSONStringify(model.getExcerpts(this.paste.id)) + " != " + JSONStringify(pasteDoc.getFullExcerpts()))
        }


        // update model
        model.contentLengths[this.take.id] = contentLength(docSet[this.take.id].getContent())
        model.contentLengths[this.paste.id] = contentLength(docSet[this.paste.id].getContent())
        model.setExcerpts(0, docSet[0].getFullExcerpts())
        model.setExcerpts(1, docSet[1].getFullExcerpts())
    }

    public [fc.cloneMethod]() {
        return new TakeAndPasteExcerptCommand(this.take, this.paste)
    }

    public toString() {
        return `excerpt(${JSONStringify(this.take)}, ${JSONStringify(this.paste)})`
    }
}

class UpdateMarkerCommand implements fc.Command<ExcerptModel, Document[]> {
    constructor(private id:number, private index:number) {}

    public check(m: Readonly<ExcerptModel>):boolean {
        return true
    }

    public run(model: ExcerptModel, docSet: Document[]): void {
        // check model
        expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
        expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])

        expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
        expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

        // update model
        model.contentLengths[this.id] = contentLength(docSet[this.id].getContent())
        model.setExcerpts(0, docSet[0].getFullExcerpts())
        model.setExcerpts(1, docSet[1].getFullExcerpts())
    }

    public [fc.cloneMethod]() {
        return new SyncExcerptCommand(this.id, this.index)
    }

    public toString() {
        return `marker(${JSONStringify(this.id)}, ${JSONStringify(this.index)})`
    }
}

class SyncExcerptCommand implements fc.Command<ExcerptModel, Document[]> {
    constructor(private id:number, private index:number) {}

    public check(m: Readonly<ExcerptModel>):boolean {
        return true
    }

    public run(model: ExcerptModel, docSet: Document[]): void {
        // perform check and run
        const targetDoc = docSet[this.id]
        const excerpts = targetDoc.getFullExcerpts()
        if(excerpts.length == 0)
            return

        // check model
        expectEqual(contentLength(docSet[0].getContent()), model.contentLengths[0])
        expectEqual(contentLength(docSet[1].getContent()), model.contentLengths[1])
        expectEqual(model.getExcerpts(0).length, docSet[0].getFullExcerpts().length)
        expectEqual(model.getExcerpts(1).length, docSet[1].getFullExcerpts().length)

        const index = this.index % excerpts.length
        const excerptMarker = excerpts[index]
        const excerpt = ExcerptUtil.decomposeMarker(excerptMarker)
        const sourceDocId = this.findDocId(docSet, excerpt.source.uri)
        expect(sourceDocId != -1)
        const sourceDoc = docSet[sourceDocId]

        const syncs = sourceDoc.getSyncSinceExcerpted(excerpt.source)
        if(syncs.length == 0)
            return

        targetDoc.syncExcerpt(syncs, excerpt.target)

        const newExcerpts = targetDoc.getFullExcerpts()

        // check: number of excerpts shoudn't change
        expectEqual(newExcerpts.length, excerpts.length)

        // update model
        model.contentLengths[this.id] = contentLength(docSet[this.id].getContent())
        model.setExcerpts(0, docSet[0].getFullExcerpts())
        model.setExcerpts(1, docSet[1].getFullExcerpts())
    }

    public [fc.cloneMethod]() {
        return new SyncExcerptCommand(this.id, this.index)
    }

    public toString() {
        return `sync(${JSONStringify(this.id)}, ${JSONStringify(this.index)})`
    }

    private findDocId(docSet:Document[], uri:string):number {
        for(let i = 0; i < docSet.length; i++) {
            if(docSet[i].name === uri)
                return i
        }
        return -1
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

        const syncExcerptGen = fc.record({
            id:fc.integer(0,1),
            index:fc.nat()
        })

        // command generator
        const commandsArb = fc.commands([
            appendGen.map(append => new AppendToDocCommand(append.id, append.numChanges, append.seed)),
            takeAndPasteGen.map(tnp => new TakeAndPasteExcerptCommand(tnp.take, tnp.paste)),
            // syncExcerptGen.map(sync => new SyncExcerptCommand(sync.id, sync.index))
        ])

        fc.assert(
            fc.property(docSetArb, commandsArb, (initialDocSet, commands) => {
              const real = initialDocSet
              const model = new ExcerptModel(real)
              fc.modelRun(() => ({ model, real }), commands)
            }),
            { verbose: true, numRuns:100, endOnFailure: true }
        )
    })
})