import { JSONStringify } from '../core/util'
import { randomChanges } from './random'

describe('randoms', () => {
    it('hand-made scenario 1', () => {
        console.log(JSONStringify(randomChanges(5, 2)))
    })
})
