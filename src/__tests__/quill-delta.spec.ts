import Delta = require('quill-delta')
import * as _ from "underscore"

describe("Quill Delta basic operations", () => {
    it("length", () => {
        expect(new Delta().insert('Hello').length()).toBe(5)
        expect(new Delta().insert('A').retain(2).delete(1).length()).toBe(4)
    })
    it("order of insert over delete", () => {
        expect(new Delta().retain(2).delete(2).insert('Hello').ops).toEqual([ { retain: 2 }, { insert: 'Hello' }, { delete: 2 } ])
        expect(new Delta().retain(2).insert('Hello').delete(2).ops).toEqual([ { retain: 2 }, { insert: 'Hello' }, { delete: 2 } ])
    })
    it("compose", () => {
        const initial = new Delta().insert('Hello')
        const delta = new Delta().retain(1).insert('x').delete(1)
        expect(initial.compose(delta).ops).toEqual([ { insert: 'Hxllo' } ])
    })
})