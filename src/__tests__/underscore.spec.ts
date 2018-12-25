import * as _ from 'underscore'

describe('underscore', () => {
    it('basics', () => {
        const double = _.map([1, 2, 3], num => {
            return num * 2
        })
        expect(double[2] === 6).toBe(true)
    })

    it('immutability', () => {
        const original = [1, 2, 3]
        const double = _.map(original, num => {
            return num * 2
        })
        expect(double[2] === 6).toBe(true)
        expect(original[2] === 3).toBe(true)
    })
})
