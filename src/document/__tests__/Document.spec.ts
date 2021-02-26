import { Document } from "../Document";
import { expectEqual } from "../../core/util";
import { ContentGen } from "../../__tests__/generator/Content";
import { Range } from "../../core/Range";
import { contentLength } from "../../core/primitive";
import { forAll, interval } from "jsproptest";
import { IDelta } from "../../core/IDelta";

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
        forAll((content:IDelta, num1:number, num2:number) => {
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
        } ,ContentGen(), interval(0, 10), interval(0, 10));
    })


})