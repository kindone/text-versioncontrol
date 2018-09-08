import * as _ from "underscore"

describe("underscore", () => {
    it("basics", () => {
        let double = _.map([1, 2, 3], num => {
            return num * 2
        })
        expect(double[2] == 6).toBe(true)
    })

    it("immutability", () => {
        let original = [1, 2, 3]
        let double = _.map(original, num => {
            return num * 2
        })
        expect(double[2] == 6).toBe(true)
        expect(original[2] == 3).toBe(true)
    })
})
