import fc from "fast-check";
import { expectEqual, contentLength, JSONStringify } from "../primitive/util";
import { Document } from "../Document";
import { ChangeList, ChangeListArbitrary } from "./generator/ChangeList";


const DocumentInitialGen = (name:string) => fc.asciiString(20).map(content => new Document(name, content))


class DocumentModel {
    constructor(public contentLength:number) {}
}

class CloneCommand implements fc.Command<DocumentModel, Document> {
    public check(model: Readonly<DocumentModel>):boolean { return false }

    public run(model: DocumentModel, doc: Document): void {
        expectEqual(doc, doc.clone())
    }
    public toString() {
        return `clone()`
    }

    // public [fc.cloneMethod]() {
    //     return new CloneCommand()
    // }
}

class AppendCommand implements fc.Command<DocumentModel, Document> {
    // constructor(public readonly seed:number) {

    // }
    constructor(public readonly changeList:ChangeList) {}

    public check(model: Readonly<DocumentModel>):boolean {
        fc.pre(this.changeList.lengths[0] === model.contentLength)
        return true
    }

    public run(model: DocumentModel, doc: Document): void {
        const version = doc.getCurrentRev()
        const tempDoc = doc.clone()
        expectEqual(doc, tempDoc.clone())
        // impact
        doc.append(this.changeList.deltas)
       // check versions increase by the correct amount
        expectEqual(this.changeList.deltas.length + version, doc.getCurrentRev())

        // check split changes
        for(const delta of this.changeList.deltas)
        {
            tempDoc.append([delta])
        }
        expectEqual(doc.getContent(), tempDoc.getContent())
        // update model
        model.contentLength = contentLength(doc.getContent())
        // print
        // console.log(JSONStringify(this.changeList))
    }
    public toString() {
        return `append(${JSONStringify(this.changeList)})`
    }

    public [fc.cloneMethod]() {
        return new AppendCommand(this.changeList)
    }
}

describe('Clone properties', () => {
    it('basic', () => {
        const docArb = DocumentInitialGen('doc')
        const commandsArb = fc.commands([
            fc.constant(new CloneCommand())
        ])

        fc.assert(
            fc.property(docArb, commandsArb, (initialDoc, commands) => {
              const real = initialDoc
              const model = new DocumentModel(contentLength(initialDoc.getContent()))
              fc.modelRun(() => ({ model, real }), commands);
            }),
            { verbose: true, numRuns:1000 }
        )

    })
})

describe('Append properties', () => {
    it('basic', () => {
        const docArb = DocumentInitialGen('doc')
        const commandsArb = fc.commands([
            fc.record({initialLength:fc.integer(0, 100), numChanges: fc.integer(0,10)}).chain(
                rec => new ChangeListArbitrary(rec.initialLength, rec.numChanges).map(changeList => new AppendCommand(changeList)))
        ])

        fc.assert(
            fc.property(docArb, commandsArb, (initialDoc, commands) => {
              const real = initialDoc
              const model = new DocumentModel(contentLength(initialDoc.getContent()))
              fc.modelRun(() => ({ model, real }), commands);
            }),
            { verbose: true, numRuns:100 }
        )

    })
})
