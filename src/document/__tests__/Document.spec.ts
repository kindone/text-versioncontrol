import { Document } from "../Document";
import { expectEqual, contentLength } from "../../primitive/util";
import * as fc from 'fast-check'
import { contentArbitrary } from "../../__tests__/generator/Content";
import { Range } from "../../primitive/Range";

describe('document', () => {

    it('take0-1', () => {
        const doc = new Document('doc1', 'a')

        expectEqual(doc.take(0, 1),
            {ops: [{insert:"a"}]}
        )
    })

    it('take0-0', () => {
        const doc = new Document('doc1', 'a')

        expectEqual(doc.take(0, 0),
            {ops: []}
        )
    })

    it('take0-len', () => {
        const doc = new Document('doc1', 'a')

        expectEqual(doc.take(0, contentLength(doc.getContent())),
            doc.getContent()
        )
    })

    it('take empty', () => {
        const doc = new Document('doc1', '')

        expectEqual(doc.take(0, 0),
            doc.getContent()
        )
    })

    // invalid range (overflow)
    it('take0-len+1', () => {
        const doc = new Document('doc1', 'a')
        expect(() => {doc.take(0, contentLength(doc.getContent())+1)}).toThrow('invalid argument')
    })

    it('document.take equals range.crop', () => {
        // return
        fc.assert(
            fc.property(contentArbitrary(), fc.integer(0, 10), fc.integer(0, 10), (content, num1, num2) => {
                // console.log(content)
                const len = contentLength(content)
                const n1 = len > 0 ? num1 % len : 0
                const n2 = len > 0 ? num2 % len : 0

                const start = n1 > n2 ? n2 : n1
                const end = n1 > n2 ? n1 : n2

                const doc = new Document('doc1', content)
                const take = doc.take(start, end)

                const crop = new Range(start, end).cropContent(doc.getContent())
                // console.log(take, crop)
            })
            ,{ verbose: true, numRuns:100, endOnFailure: true }
        );
    })


})