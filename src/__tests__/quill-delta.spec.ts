import Delta = require('quill-delta')
import * as _ from "underscore"
import { expectEqual, transformPosition, JSONStringify } from '../util';

describe("Quill Delta basic operations", () => {
    it("negative value ignored", () => {
        expectEqual(new Delta().delete(-1), new Delta())
        expectEqual(new Delta().retain(-1), new Delta())
    })

    it("length", () => {
        expect(new Delta().insert('Hello').length()).toBe(5)
        expect(new Delta().insert('A').retain(2).delete(1).length()).toBe(4)
    })
    it("order of insert over delete", () => {
        expect(new Delta().retain(2).delete(2).insert('Hello').ops).toEqual([ { retain: 2 }, { insert: 'Hello' }, { delete: 2 } ])
        expect(new Delta().retain(2).insert('Hello').delete(2).ops).toEqual([ { retain: 2 }, { insert: 'Hello' }, { delete: 2 } ])
    })
    it("compose1", () => {
        const initial = new Delta().insert('Hello')
        const delta = new Delta().retain(1).insert('x').delete(1)
        expect(initial.compose(delta).ops).toEqual([ { insert: 'Hxllo' } ])
    })

    it("compose2", () => {
        const delta = new Delta().retain(3).insert('first')
        const target = new Delta().delete(4).retain(5).delete(6)
        // console.log('compose2:', delta.compose(target).ops)
        expectEqual(delta.compose(target).ops, [ { insert: 'irst' }, { delete: 3 }, { retain: 1 }, { delete: 6 } ])
    })

    it("compose3", () => {
        const delta = new Delta().delete(4).retain(5).delete(6)
        const target = new Delta().retain(3).insert('first')
        // console.log('compose3:', delta.compose(target).ops)
        expectEqual(delta.compose(target).ops, [ { delete: 4 }, { retain: 3 }, { insert: 'first' }, { retain: 2 }, { delete: 6 } ])
    })

    it("compose actual", () => {
        // flatten
        const delta = new Delta([{"retain":16},{"insert":" beautiful "},{"delete":1}])
        const target = new Delta([{"retain":7},{"insert":{"beginExcerpt":{"uri":"doc1","srcRev":4,"destRev":7}}},{"delete":1},{"retain":9},{"insert":{"endExcerpt":{"uri":"doc1","srcRev":4,"destRev":7}}},{"delete":1}])
        console.log('compose.transform:', JSONStringify(delta.transform(target).ops))
        expectEqual(delta.compose(target).ops, [{"retain":7},{"insert":{"beginExcerpt":{"uri":"doc1","srcRev":4,"destRev":7}}},{"delete":1},{"retain":8},{"insert":" "},{"insert":{"endExcerpt":{"uri":"doc1","srcRev":4,"destRev":7}}},{"insert":"eautiful "},{"delete":1}])
        console.log('compose.transformed.compose:', JSONStringify(delta.compose(delta.transform(target)).ops))
    })


    it("mutable", () => {
        const delta = new Delta()
        expectEqual(delta.insert("a"), delta)
    })

    it("transformation of delta", () => {
        const delta = new Delta().delete(4).retain(5).delete(6)
        const target = new Delta().retain(3).insert('first')
        expectEqual( delta.transform(target, true).ops,  [ { insert: 'first' } ])
    })

    it("transformation of delta2", () => {
        const delta = new Delta().delete(4).retain(5).delete(6)
        const target = new Delta().retain(3).insert('first')
        expectEqual( delta.transform(target, false).ops,  [ { insert: 'first' } ])
    })

    it("transformation of delta3", () => {
        const delta = new Delta().retain(3).insert('first')
        const target = new Delta().delete(4).retain(5).delete(6)
        expectEqual( delta.transform(target, true).ops,  [ { delete: 3 }, { retain: 5 }, { delete: 1 },        { retain: 5 },
            { delete: 6 } ])
    })

    it("transformation of delta4", () => {
        const delta = new Delta().retain(3).insert('first')
        const target = new Delta().delete(4).retain(5).delete(6)
        expectEqual( delta.transform(target, false).ops,  [ { delete: 3 }, { retain: 5 }, { delete: 1 },
            { retain: 5 }, { delete: 6 } ])
    })

    it("transformation of delta5", () => {
        const delta = new Delta().retain(6).insert('first')
        const target = new Delta().delete(4).retain(5).delete(6)
        expectEqual( delta.transform(target, true).ops,  [ { delete: 4 }, { retain: 10 }, { delete: 6 } ])
    })

    it("transformation of delta6", () => {
        const delta = new Delta().retain(6).insert('first')
        const target = new Delta().delete(4).retain(5).delete(6)
        // console.log(delta.transform(target, false))
        expectEqual( delta.transform(target, false).ops,  [ { delete: 4 }, { retain: 10 }, { delete: 6 } ])
    })

    it("transformation of positions", () => {
        expectEqual(new Delta().delete(10).transformPosition(10), 0)
        expectEqual(new Delta().delete(11).transformPosition(10), 0)

        expectEqual(new Delta().retain(5).delete(5).transformPosition(10), 5)
        expectEqual(new Delta().retain(5).delete(6).transformPosition(10), 5)
        expectEqual(new Delta().retain(5).delete(15).transformPosition(10), 5)
        expectEqual(new Delta().retain(5).delete(16).transformPosition(10), 5)
        expectEqual(new Delta().retain(10).delete(5).transformPosition(10), 10)
        expectEqual(new Delta().retain(11).delete(5).transformPosition(10), 10)
        expectEqual(new Delta().retain(11).delete(9).transformPosition(10), 10)
        expectEqual(new Delta().retain(11).delete(10).transformPosition(10), 10)

        expectEqual(new Delta().insert('123').transformPosition(10), 13)
        expectEqual(new Delta().insert('12345').transformPosition(10), 15)
        expectEqual(new Delta().retain(10).insert('12345').transformPosition(10), 15)
        expectEqual(new Delta().retain(11).insert('12345').transformPosition(10), 10)
        expectEqual(new Delta().retain(20).insert('12345').transformPosition(10), 10)
        expectEqual(new Delta().retain(21).insert('12345').transformPosition(10), 10)
        expectEqual(new Delta().retain(5).delete(15).insert('12345').transformPosition(10), 10) // *??

        // 20
        expectEqual(new Delta().delete(10).transformPosition(20), 10)
        expectEqual(new Delta().delete(11).transformPosition(20), 9)

        expectEqual(new Delta().retain(5).delete(5).transformPosition(20), 15)
        expectEqual(new Delta().retain(5).delete(6).transformPosition(20), 14)
        expectEqual(new Delta().retain(5).delete(15).transformPosition(20), 5)
        expectEqual(new Delta().retain(5).delete(16).transformPosition(20), 5)
        expectEqual(new Delta().retain(10).delete(5).transformPosition(20), 15)
        expectEqual(new Delta().retain(11).delete(5).transformPosition(20), 15)
        expectEqual(new Delta().retain(11).delete(9).transformPosition(20), 11)
        expectEqual(new Delta().retain(11).delete(10).transformPosition(20), 11)

        expectEqual(new Delta().insert('123').transformPosition(20), 23)
        expectEqual(new Delta().insert('12345').transformPosition(20), 25)
        expectEqual(new Delta().retain(10).insert('12345').transformPosition(20), 25)
        expectEqual(new Delta().retain(11).insert('12345').transformPosition(20), 25)
        expectEqual(new Delta().retain(20).insert('12345').transformPosition(20), 25) // * different from range
        expectEqual(new Delta().retain(21).insert('12345').transformPosition(20), 20)

        expectEqual(new Delta().retain(5).delete(15).insert('12345').transformPosition(20), 10) // *??
    })
})