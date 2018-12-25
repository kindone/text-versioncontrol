import { JSONStringify } from '../primitive/util'
import { randomUserDeltas } from './random'

describe('randoms', () => {
    it('hand-made scenario 1', () => {
        console.log(JSONStringify(randomUserDeltas(5, 2)))
    })
})
