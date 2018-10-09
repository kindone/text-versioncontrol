import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from "underscore"

describe("Quill Delta basic operations", () => {
    it("length", () => {
        expect(new Delta().insert('Hello').length()).toBe(5)
        expect(new Delta().insert('A').retain(2).delete(1).length()).toBe(4)
    })
    it("compose", () => {
        const initial = new Delta().insert('Hello')
        const delta = new Delta().retain(1).insert('x').delete(1)
        // console.log(initial.compose(delta))

    })
})