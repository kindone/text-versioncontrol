import Op from 'quill-delta/dist/Op'

import { RetainGen, DeleteGen } from './RetainDelete'
import { InsertGen } from './Insert'
import { elementOf, Generator, interval, just } from 'jsproptest'

export const OpKeyGen = elementOf('retain', 'insert', 'delete')

function OpGen(minLen = 1, maxLen = 100, withEmbed = true, withAttr = true) {
    return interval(0, 2).map(kind => {
        if (kind === 0) {
            return RetainGen(minLen, maxLen, withAttr)
        } else if (kind === 1) {
            return InsertGen(minLen, maxLen, withEmbed, withAttr)
        } else {
            return DeleteGen(minLen, maxLen)
        }
    })
}

export const FixedLengthOpGen = (key: string, length: number, withEmbed = true, withAttr = true): Generator<Op> => {
    if (key === 'retain') {
        return RetainGen(length, length, withAttr)
    } else if (key === 'insert') {
        return InsertGen(length, length, withEmbed, withAttr)
    } else {
        return DeleteGen(length, length)
    }
}

export const basicOpArbitrary = (minLen: number = 1, maxLen: number = 100) => OpGen(minLen, maxLen, false, false)
export const complexOpArbitrary = (minLen: number = 1, maxLen: number = 100) => OpGen(maxLen, maxLen, true, true)

// tweak to generate Arbitrary<Op[]> with empty op generator
export const emptyOpsArbitrary = just(<Op[]>[])
