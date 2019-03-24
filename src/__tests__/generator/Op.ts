import * as fc from 'fast-check'
import { Arbitrary, Random, Shrinkable} from 'fast-check'

import Op from 'quill-delta/dist/Op'


import { retainArbitrary,  deleteArbitrary } from './RetainDelete';
import { insertArbitrary } from './Insert';


export const OpKeyGen = fc.constantFrom('retain', 'insert', 'delete')
// const OpComplexKeyGen = fc.constantFrom('retain', 'insert', 'delete')

class OpArbitrary extends Arbitrary<Op> {
    constructor(readonly minLen:number = 1, readonly maxLen:number = 100,
         readonly withEmbed = false, readonly withAttr = false) {
        super()
    }

    public generate(mrng:Random):Shrinkable<Op> {
        const kind = mrng.nextInt(0, 2)
        if(kind === 0) {
            return retainArbitrary(this.minLen, this.maxLen, this.withAttr).generate(mrng)
        }
        else if(kind === 1) {
            return insertArbitrary(this.minLen, this.maxLen, this.withEmbed, this.withAttr).generate(mrng)
        }
        else if (kind === 2) {
            return deleteArbitrary(this.minLen, this.maxLen).generate(mrng)
        }
    }
}

export const FixedLengthOpGen = (key:string, length:number, withEmbed = false, withAttr = false):Arbitrary<Op> => {
    if(key === 'retain') {
        return retainArbitrary(length, length, withAttr)
    }
    else if(key === 'insert') {
        return insertArbitrary(length, length, withEmbed, withAttr)
    }
    else {
        return deleteArbitrary(length, length)
    }
}

export const basicOpArbitrary = (minLen:number = 1, maxLen:number = 100) => new OpArbitrary(minLen, maxLen)
export const complexOpArbitrary = (minLen:number = 1, maxLen:number = 100) => new OpArbitrary(maxLen, maxLen, true, true)

// tweak to generate Arbitrary<Op[]> with empty op generator
export const emptyOpsArbitrary = fc.constant(<Op[]>[])

