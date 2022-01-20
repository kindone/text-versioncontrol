import { contentLength } from '../../core/primitive'
import { expectEqual, JSONStringify } from '../../core/util'
import { Document } from '../Document'
import { ChangeList, ChangeListGen } from '../../__tests__/generator/ChangeList'
import {
    Action,
    actionGenOf,
    interval,
    just,
    oneOf,
    PrintableASCIIStringGen,
    statefulProperty,
    TupleGen,
} from 'jsproptest'

const DocumentInitialGen = (name: string) => PrintableASCIIStringGen(0, 20).map(content => new Document(name, content))

class DocumentModel {
    constructor(public contentLength: number) {}
}

describe('Document', () => {
    it('clone', () => {
        const docGen = DocumentInitialGen('doc')
        const cloneActionGen = just(
            new Action((doc: Document, _: DocumentModel) => {
                expectEqual(doc, doc.clone())
            }),
        )

        const actionGen = actionGenOf(cloneActionGen)

        const prop = statefulProperty(
            docGen,
            (document: Document) => new DocumentModel(contentLength(document.getContent())),
            actionGen,
        )
        prop.go()
    })

    it('append', () => {
        const docGen = DocumentInitialGen('doc')
        const appendActionGen = TupleGen(interval(0, 100), interval(0, 20))
            .flatMap(tuple => ChangeListGen(tuple[0], tuple[1]))
            .map(
                changeList =>
                    new Action((doc: Document, model: DocumentModel) => {
                        const version = doc.getCurrentRev()
                        const tempDoc = doc.clone()
                        expectEqual(doc, tempDoc.clone())
                        // impact
                        doc.append(changeList.deltas)
                        // check versions increase by the correct amount
                        expectEqual(changeList.deltas.length + version, doc.getCurrentRev())

                        // check split changes
                        for (const delta of changeList.deltas) {
                            tempDoc.append([delta])
                        }
                        expectEqual(doc.getContent(), tempDoc.getContent())
                        // update model
                        model.contentLength = contentLength(doc.getContent())
                    }),
            )

        const actionGen = actionGenOf(appendActionGen)

        const prop = statefulProperty(
            docGen,
            (document: Document) => new DocumentModel(contentLength(document.getContent())),
            actionGen,
        )
        prop.setMaxActions(10)
            .setNumRuns(10)
            .go()
    })
})
