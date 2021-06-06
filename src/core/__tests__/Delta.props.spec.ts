import { expectEqual } from '../util'
import { Delta } from '../Delta'
import { contentLength, cropContent, normalizeDeltas } from '../primitive'
import { forAll, inRange, interval } from 'jsproptest'
import { ContentGen } from '../../__tests__/generator/Content'
import { IDelta } from '../IDelta'

describe('Delta methods', () => {
    it('.take', () => {
        const contentGen = ContentGen()

        forAll((content:IDelta) => {
            const length = contentLength(content)
            // check cropContent full
            expectEqual(cropContent(content, 0, length), normalizeDeltas(content)[0])
        }, contentGen)

        const contentAndRangeGen = contentGen.chain((content:IDelta) => {
            const length = contentLength(content)
            const start = inRange(0, length)
            return start
        }).chainAsTuple((contentAndStart:[IDelta,number])=> {
            const [content, start] = contentAndStart
            const length = contentLength(content)
            const end = interval(start, length)
            return end
        })

        forAll((contentAndRange:[IDelta,number,number]) => {
            const [content, start, end] = contentAndRange
            // check .take == cropContent
            expectEqual(new Delta(content.ops).take(start, end), cropContent(content, start, end))
            // check cropContent 0 length
            expectEqual(new Delta(content.ops).take(start, start), new Delta())
        }, contentAndRangeGen)
    })
})