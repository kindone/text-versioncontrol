import * as chalk from 'chalk'
import each from 'jest-each'
import Delta = require('quill-delta')
import * as _ from 'underscore'
import { Document } from '../../document/Document'
import {printChange, printContent, printChangedContent, printChanges} from '../../primitive/printer'
import { contentLength, JSONStringify, normalizeOps, expectEqual, isEqual, applyChanges, minContentLengthForChange } from '../../primitive/util'
import { ExDelta } from '../../primitive/ExDelta';
import { Source } from '../../primitive/Source';
import { Change } from '../../primitive/Change';
import { ExcerptUtil } from '../ExcerptUtil';
import Op from 'quill-delta/dist/Op';

describe('Excerpt', () => {

    it('Document crop', () => {
        const doc1 = new Document('doc1', 'My Document 1')
        const doc2 = new Document('doc2', 'Here comes the trouble. HAHAHAHA')

        const doc1Changes = [new ExDelta([]).delete(3).insert('Your '), new Delta().retain(5).insert('precious ')]

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

        const doc1Changes = [new Delta().delete(3).insert('Your '), new Delta().retain(5).insert('precious ')] // Your precious Document 1

        const doc2Changes = [new Delta().insert('Some introduction here: ')] // Some introduction here: Here comes ...
        doc1.append(doc1Changes)
        doc2.append(doc2Changes)

        const source1 = doc1.takeExcerpt(0, 4) // Your
        expectEqual(
            JSONStringify(source1),
            JSONStringify({ uri: 'doc1', rev: 2, start: 0, end: 4, content: { ops: [{ insert: 'Your' }] }, type: 'excerpt' }),
        )

        const excerpt = doc2.pasteExcerpt(5, source1)
        expectEqual(JSONStringify(excerpt.target), JSONStringify({ uri: "doc2", rev: 2, start: 5, end: 10 }))

        expectEqual(
            JSONStringify(doc2.getContent().ops),
            JSONStringify([{"insert":"Some "},{"insert":{"excerpted":"doc1?rev=2&start=0&end=4"},"attributes":{"markedAt":"left", "targetUri":"doc2","targetRev":"2","targetStart":"5", "targetEnd":"10"}},{"insert":"Your"}, {"insert":{"excerpted":"doc1?rev=2&start=0&end=4"},"attributes":{"markedAt":"right", "targetUri":"doc2","targetRev":"2","targetStart":"5", "targetEnd":"10"}}, {"insert": "introduction here: Here comes the trouble. HAHAHAHA"}])
        )
    })

    /*each([[false],[true]]).*/it('Document sync', (/*method*/) => {
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


        const syncs = doc1.getSyncSinceExcerpted(source1)
        console.log('phases4.sync: ', JSONStringify(syncs))
        doc2.syncExcerpt(excerpt1, { getDocument: (uri:String) => uri === 'doc1' ? doc1 : doc2})
        expectEqual(doc2.getContent(),
            {"ops":[
                {"insert":"Actual "},
                {"insert":{"excerpted":"doc1?rev=2&start=5&end=14"},"attributes":{"markedAt":"left","targetUri":"doc2","targetRev":"2","targetStart":"5","targetEnd":"15"}},
                {"insert":"prettier beautiful "},
                {"insert":{"excerpted":"doc1?rev=2&start=5&end=14"},"attributes":{"markedAt":"right","targetUri":"doc2","targetRev":"2","targetStart":"5","targetEnd":"15"}},
                {"insert":"introduction here: Here comes the trouble. HAHAHAHA"}]
            })
        console.log('Sync changes: ', JSONStringify(doc2.getChangesFrom(target1.rev)))
        console.log('phases4.doc2: ', doc2.getCurrentRev(), printContent(doc2.getContent()))

        // do again and get same result
        doc2.syncExcerpt(excerpt1, { getDocument: (uri:String) => uri === 'doc1' ? doc1 : doc2})
        expectEqual(doc2.getContent(),
            {"ops":[
                {"insert":"Actual "},
                {"insert":{"excerpted":"doc1?rev=2&start=5&end=14"},"attributes":{"markedAt":"left","targetUri":"doc2","targetRev":"2","targetStart":"5","targetEnd":"15"}},
                {"insert":"prettier beautiful "},
                {"insert":{"excerpted":"doc1?rev=2&start=5&end=14"},"attributes":{"markedAt":"right","targetUri":"doc2","targetRev":"2","targetStart":"5","targetEnd":"15"}},
                {"insert":"introduction here: Here comes the trouble. HAHAHAHA"}]
            })

    })

    // it('revive deleted left marker', () => {
    //     const doc1 = new Document('doc1', 'aaaa')
    //     const doc2 = new Document('doc2', 'bbbb')
    //     const excerptSource = doc1.takeExcerpt(1, 3)
    //     const excerpt = doc2.pasteExcerpt(1, excerptSource)
    //     const deleteChange = {ops:[{retain:excerpt.target.start-1},{delete:3}]}

    //     expectEqual(doc2.getFullExcerpts().length, 1)
    //     expectEqual(doc2.getPartialExcerpts().length, 0)
    //     doc2.append([deleteChange])
    //     expectEqual(doc2.getFullExcerpts().length, 0)
    //     expectEqual(doc2.getPartialExcerpts().length, 1)

    //     const syncs =  doc1.getSyncSinceExcerpted(excerptSource) // nothing but...
    //     doc2.syncExcerpt(excerpt, { getDocument: (uri:String) => uri === 'doc1' ? doc1 : doc2}, false, true)

    //     expectEqual(doc2.getFullExcerpts().length, 1) // repaired
    //     expectEqual(doc2.getPartialExcerpts().length, 0)
    // })

    // it('revive deleted right marker', () => {

    //     const doc1 = new Document('doc1', 'aaaa')
    //     const doc2 = new Document('doc2', 'bbbb')
    //     const excerptSource = doc1.takeExcerpt(1, 3)
    //     const excerpt = doc2.pasteExcerpt(1, excerptSource)
    //     const deleteChange = {ops:[{retain:excerpt.target.end-1},{delete:3}]}

    //     expectEqual(doc2.getFullExcerpts().length, 1)
    //     expectEqual(doc2.getPartialExcerpts().length, 0)
    //     doc2.append([deleteChange])
    //     expectEqual(doc2.getFullExcerpts().length, 0)
    //     expectEqual(doc2.getPartialExcerpts().length, 1)

    //     const syncs =  doc1.getSyncSinceExcerpted(excerptSource) // nothing but...
    //     doc2.syncExcerpt(excerpt, { getDocument: (uri:String) => uri === 'doc1' ? doc1 : doc2}, false, true)

    //     expectEqual(doc2.getFullExcerpts().length, 1) // repaired
    //     expectEqual(doc2.getPartialExcerpts().length    , 0)
    // })


    it('TODO: Overlapping excerpt', () => {
        const doc1 = new Document('doc1', 'aaaa')
        const doc2 = new Document('doc2', 'bbbb')

        const source1 = doc1.takeExcerpt(1, 3)
        const excerpt1 = doc2.pasteExcerpt(1, source1)

        const source2 = doc2.takeExcerpt(1, 3)
        const excerpt2 = doc1.pasteExcerpt(3, source2)

        console.log(JSONStringify(source1))
        console.log(JSONStringify(source2))

        console.log(printContent(doc1.getContent()))
        console.log(printContent(doc2.getContent()))

        const doc1Changes = [
            new Delta([{ delete: 1 }, { insert: 'A' }]),
            // new Delta([{ retain: 1 }, { insert: '1' }]),
            // new Delta([{ retain: 2 }, { insert: '1' }]),
        ]

        const doc2Changes = [new Delta([{ insert: 'B' }])]
        doc1.append(doc1Changes)
        doc2.append(doc2Changes)

        console.log(printContent(doc1.getContent()))
        console.log(printContent(doc2.getContent()))

        const target = doc2.updateExcerptMarkers(excerpt1.target)

        console.log(printContent(doc1.getContent()))
        console.log(printContent(doc2.getContent()))

        const s1 = doc1.getSyncSinceExcerpted(source1)
        doc2.syncExcerpt(excerpt1, { getDocument: (uri:String) => uri === 'doc1' ? doc1 : doc2})

        console.log(printContent(doc1.getContent()))
        console.log(printContent(doc2.getContent()))
    })
})

const textOnly = (change:Change):string => {
    return _.reduce(change.ops, (str:string, op:Op) => {
        if(typeof op.insert === 'string')
            return str += op.insert
        else
            return str
    },"")
}

describe('Mutual Excerpts', () => {
    it('on same doc', () => {
        const doc1 = new Document("doc1", "ab")
        const source1 = doc1.takeExcerpt(0,2)
        doc1.pasteExcerpt(2, source1) // (ab)[ab]
        expectEqual(textOnly(doc1.getContent()), "abab")
        expectEqual(doc1.getContent(), {"ops":[
            {"insert":"ab"},
            {"insert":{"excerpted":"doc1?rev=0&start=0&end=2"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"1","targetStart":"2","targetEnd":"5"}},
            {"insert":"ab"},
            {"insert":{"excerpted":"doc1?rev=0&start=0&end=2"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"1","targetStart":"2","targetEnd":"5"}}
        ]})


        const source2 = doc1.takeExcerpt(3,5)
        doc1.pasteExcerpt(1, source2) // a[ab]b(ab)
        expectEqual(textOnly(doc1.getContent()), "aabbab")
        expectEqual(doc1.getContent(), {"ops":[
            {"insert":"a"},
            {"insert":{"excerpted":"doc1?rev=1&start=3&end=5"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"1","targetEnd":"4"}},
            {"insert":"ab"},
            {"insert":{"excerpted":"doc1?rev=1&start=3&end=5"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"2","targetStart":"1","targetEnd":"4"}},
            {"insert":"b"},
            {"insert":{"excerpted":"doc1?rev=0&start=0&end=2"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"1","targetStart":"2","targetEnd":"5"}},
            {"insert":"ab"},
            {"insert":{"excerpted":"doc1?rev=0&start=0&end=2"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"1","targetStart":"2","targetEnd":"5"}}
        ]})

        const excerpt1 = doc1.getFullExcerpts()[0].excerpt
        const excerpt2 = doc1.getFullExcerpts()[1].excerpt

        console.log('sync for excerpt1:', JSONStringify(doc1.getSyncSinceExcerpted(excerpt1.source)))
        console.log('sync for excerpt2:', JSONStringify(doc1.getSyncSinceExcerpted(excerpt2.source)))

        doc1.syncExcerpt(excerpt1, { getDocument: (uri:String) => doc1})
        expectEqual(textOnly(doc1.getContent()), "aabbab")

        doc1.syncExcerpt(excerpt2,  { getDocument: (uri:String) => doc1})
        expectEqual(textOnly(doc1.getContent()), "aabbaabb")

        // FIXME: should stay the same
        // doc1.syncExcerpt(excerpt1, { getDocument: (uri:String) => doc1})
        // expectEqual(textOnly(doc1.getContent()), "aabbaabb")

    })
})



describe('Regression', () => {
    it('case 1', () => {
        const before = {"ops":[{"insert":"Zx+\u0015\u0006bu\u000ek\u001ee"},{"insert":{"excerpted":"doc1?rev=2&start=9&end=20"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"5","targetStart":"11","targetEnd":"26"}},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14"}},{"insert":"&"},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14"}},{"insert":"\u001ee"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":"&"},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":"\u001eeS"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":"S"},{"insert":{"excerpted":"doc1?rev=2&start=9&end=20"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"5","targetStart":"11","targetEnd":"26"}},{"insert":"S\u0019~S"}]}
        const after = {"ops":[{"insert":"Zx+\u0015\u0006bu\u000ek\u001ee"},{"insert":{"excerpted":"doc1?rev=5&start=9&end=28"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"9","targetStart":"11","targetEnd":"34"}},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14"}},{"insert":"&"},{"insert":{"excerpted":"doc1?rev=2&start=9&end=20"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"5","targetStart":"11","targetEnd":"26","copied":"true"}},{"insert":"\u001ee"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":"&"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":"&"},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":"\u001eeS"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":{"excerpted":"doc1?rev=2&start=9&end=20"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"5","targetStart":"11","targetEnd":"26","copied":"true"}},{"insert":"eS"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":"S"},{"insert":{"excerpted":"doc1?rev=5&start=9&end=28"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"9","targetStart":"11","targetEnd":"34"}},{"insert":"S\u0019~S"}]}

        const changes = [{"ops":[{"retain":20},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}},{"insert":"\u001eeS"},{"insert":{"excerpted":"doc1?rev=0&start=9&end=12"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"1","targetStart":"11","targetEnd":"15","copied":"true"}}],"source":[{"uri":"doc1","rev":3},{"uri":"doc1","rev":2}]},{"ops":[{"retain":21},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}},{"insert":"&"},{"insert":{"excerpted":"doc0?rev=0&start=3&end=4"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"2","targetStart":"12","targetEnd":"14","copied":"true"}}],"source":[{"uri":"doc1","rev":4},{"uri":"doc1","rev":3}]},{"ops":[{"retain":14},{"delete":1},{"insert":{"excerpted":"doc1?rev=2&start=9&end=20"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"5","targetStart":"11","targetEnd":"26","copied":"true"}},{"retain":14},{"delete":1},{"insert":{"excerpted":"doc1?rev=2&start=9&end=20"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"5","targetStart":"11","targetEnd":"26","copied":"true"}}],"source":[{"uri":"doc1","rev":5},{"uri":"doc1","rev":4}]},{"ops":[{"retain":11},{"delete":1},{"insert":{"excerpted":"doc1?rev=5&start=9&end=28"},"attributes":{"markedAt":"left","targetUri":"doc1","targetRev":"9","targetStart":"11","targetEnd":"34"}},{"retain":22},{"delete":1},{"insert":{"excerpted":"doc1?rev=5&start=9&end=28"},"attributes":{"markedAt":"right","targetUri":"doc1","targetRev":"9","targetStart":"11","targetEnd":"34"}}]}]

        let intermediate:Change = before
        for(const change of changes) {
            const length1 = contentLength(intermediate)
            const length2 = minContentLengthForChange(change)
            if(length1 < length2)
                throw new Error('cannot change content')
            intermediate = applyChanges(intermediate, [change])
            console.log('full:', ExcerptUtil.getFullExcerpts(intermediate))
            console.log('partial:', ExcerptUtil.getPartialExcerpts(intermediate))
        }
    })

})