import * as _ from 'underscore'
import QDelta = require("quill-delta");
import { expectEqual, flattenDeltas, transformDeltas, cropContent } from '../util'
import { ExDelta as ExDelta } from '../ExDelta';

describe('Quill Delta basic operations', () => {
    it('negative value ignored', () => {
        expectEqual(new QDelta().delete(-1), new QDelta())
        expectEqual(new QDelta().retain(-1), new QDelta())

        expectEqual(new ExDelta().delete(-1), new ExDelta())
        expectEqual(new ExDelta().retain(-1), new ExDelta())
    })

    it('mutability of operations', () => {
        const delta = new QDelta()
        expectEqual(delta.insert('a'), delta)
        const exDelta = new ExDelta()
        expectEqual(exDelta.insert('a'), exDelta)
    })

    it('length', () => {
        expect(new QDelta().insert('Hello').length()).toBe(5)
        expect(
            new QDelta()
                .insert('A')
                .retain(2)
                .delete(1)
                .length(),
        ).toBe(4)

        expect(new ExDelta().insert('Hello').length()).toBe(5)
        expect(
            new ExDelta()
                .insert('A')
                .retain(2)
                .delete(1)
                .length(),
        ).toBe(4)
    })

    it('BUG? order of insert over delete', () => {
        // delete comes next to insert
        expect(
            new QDelta()
                .retain(2)
                .delete(2)
                .insert('Hello').ops,
        ).toEqual([{ retain: 2 }, { insert: 'Hello' }, { delete: 2 }])
        expect(
            new QDelta()
                .retain(2)
                .insert('Hello')
                .delete(2).ops,
        ).toEqual([{ retain: 2 }, { insert: 'Hello' }, { delete: 2 }])

        expect(
            new ExDelta()
                .retain(2)
                .delete(2)
                .insert('Hello').ops,
        ).toEqual([{ retain: 2 }, { delete: 2 }, { insert: 'Hello' }])
        expect(
            new ExDelta()
                .retain(2)
                .insert('Hello')
                .delete(2).ops,
        ).toEqual([{ retain: 2 }, { insert: 'Hello' }, { delete: 2 }])
    })

    it('compose on empty - immutability', () => {
        {
            const initial = new QDelta()
            const delta = new QDelta()
                .retain(1)
                .insert('x')
                .delete(1)
            expectEqual(initial.compose(delta), delta)
            expectEqual(initial, new QDelta())
            expectEqual(delta, new QDelta()
                .retain(1)
                .insert('x')
                .delete(1))
            expectEqual(flattenDeltas(initial, delta), delta)
        }

        {
            const initial = new ExDelta()
            const delta = new ExDelta()
                .retain(1)
                .insert('x')
                .delete(1)
            expectEqual(initial.compose(delta), delta)
            expectEqual(initial, new ExDelta())
            expectEqual(delta, new ExDelta()
                .retain(1)
                .insert('x')
                .delete(1))
            expectEqual(flattenDeltas(initial, delta), delta)
        }

    })

    it('compose1', () => {
        const initial = new QDelta().insert('Hello')
        const delta = new QDelta()
            .retain(1)
            .insert('x')
            .delete(1)
        expect(initial.compose(delta).ops).toEqual([{ insert: 'Hxllo' }])
        expect(flattenDeltas(initial, delta).ops).toEqual([{ insert: 'Hxllo' }])
    })

    it('compose2', () => {
        const delta = new QDelta().retain(3).insert('first')
        const target = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        // console.log('compose2:', delta.compose(target).ops)
        expectEqual(delta.compose(target).ops, [{ insert: 'irst' }, { delete: 3 }, { retain: 1 }, { delete: 6 }])
        expectEqual(flattenDeltas(delta, target).ops, [{ delete: 3 }, { insert: 'irst' }, { retain: 1 }, { delete: 6 }])
    })

    it('compose3', () => {
        const delta = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        const target = new QDelta().retain(3).insert('first')
        // console.log('compose3:', delta.compose(target).ops)
        expectEqual(delta.compose(target).ops, [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
        ])
        expectEqual(flattenDeltas(delta, target).ops, [
            { delete: 4 },
            { retain: 3 },
            { insert: 'first' },
            { retain: 2 },
            { delete: 6 },
        ])
    })

    it('compose actual', () => {
        // flatten
        const delta = new QDelta([{ retain: 16 }, { insert: ' beautiful ' }, { delete: 1 }])
        const target = new QDelta([
            { retain: 7 },
            { insert: { beginExcerpt: { uri: 'doc1', srcRev: 4, destRev: 7 } } },
            { delete: 1 },
            { retain: 9 },
            { insert: { endExcerpt: { uri: 'doc1', srcRev: 4, destRev: 7 } } },
            { delete: 1 },
        ])

        expectEqual(delta.compose(target).ops, [
            { retain: 7 },
            { insert: { beginExcerpt: { uri: 'doc1', srcRev: 4, destRev: 7 } } },
            { delete: 1 },
            { retain: 8 },
            { insert: ' ' },
            { insert: { endExcerpt: { uri: 'doc1', srcRev: 4, destRev: 7 } } },
            { insert: 'eautiful ' },
            { delete: 1 },
        ])
        expectEqual(flattenDeltas(delta, target).ops, [
            { retain: 7 },
            { insert: { beginExcerpt: { uri: 'doc1', srcRev: 4, destRev: 7 } } },
            { delete: 1 },
            { retain: 8 },
            { insert: ' ' },
            { insert: { endExcerpt: { uri: 'doc1', srcRev: 4, destRev: 7 } } },
            { insert: 'eautiful ' },
            { delete: 1 },
        ])
    })

    it('compose null retain', () => {
        // flatten
        const delta = new QDelta([{ retain: 16 }, { insert: ' beautiful ' }, { delete: 1 }])
        const target = new QDelta([{ retain: 1, attributes: { a: null, b: null } }])
        expectEqual(delta.compose(target).ops, [
            { retain: 1, attributes: { a: null, b: null } },
            { retain: 15 },
            { insert: ' beautiful ' },
            { delete: 1 },
        ])
        expectEqual(flattenDeltas(delta, target).ops, [
            { retain: 1, attributes: { a: null, b: null } },
            { retain: 15 },
            { insert: ' beautiful ' },
            { delete: 1 },
        ])
    })

    it('compose null retain ignores original content', () => {
        // flatten
        const delta = new QDelta([{ insert: ' beautiful ' }, { delete: 1 }])
        const target = new QDelta([{ retain: 1, attributes: { a: null, b: null } }])
        expectEqual(delta.compose(target).ops, [{ insert: ' beautiful ' }, { delete: 1 }])
        expectEqual(flattenDeltas(delta, target).ops, [
            { insert: ' ', attributes: { a: null, b: null } },
            { insert: 'beautiful ' },
            { delete: 1 },
        ])
    })

    it('compose actual null retain', () => {
        // flatten
        const delta = new QDelta([
            { insert: { y: 'wt' }, attributes: { b: null } },
            { retain: 1, attributes: { i: 1 } },
            { delete: 1 },
        ])
        const target = new QDelta([
            { insert: 'lt' },
            { retain: 1, attributes: { b: null, i: null } },
            { insert: { y: 'tb' }, attributes: { b: 1, i: 1 } },
            { delete: 1 },
            { insert: '9e' },
        ])
        expectEqual(delta.compose(target).ops, [
            { insert: 'lt' },
            { insert: { y: 'wt' } },
            { attributes: { b: 1, i: 1 }, insert: { y: 'tb' } },
            { insert: '9e' },
            { delete: 2 },
        ])
        expectEqual(flattenDeltas(delta, target).ops, [
            { insert: 'lt' },
            { insert: { y: 'wt' }, attributes: { b: null, i: null } },
            { insert: { y: 'tb' }, attributes: { b: 1, i: 1 } },
            { delete: 1 },
            { insert: '9e' },
            { delete: 1 },
        ])
    })

    it('compose actual deletes', () => {
        //
        const delta = new QDelta([{ insert: { y: 'ah' } }, { retain: 1 }, { retain: 1 }, { insert: { y: 'fj' } }])
        const target = new QDelta([{ delete: 3 }, { retain: 1 }])
        expectEqual(delta.compose(target).ops, [{ insert: { y: 'fj' } }, { delete: 2 }])
        expectEqual(flattenDeltas(delta, target).ops, [{ delete: 2 }, { insert: { y: 'fj' } }])
    })

    it('compose example', () => {
        // delete reordered to back of all inserts
        const delta = new QDelta([{ insert: '71' }, { delete: 1 }, { insert: 'nw' }])
        const target = new QDelta([{ retain: 4 }])
        expectEqual(delta.compose(target).ops, [{ insert: '71nw' }, { delete: 1 }])
        expectEqual(flattenDeltas(delta, target).ops, [{ insert: '71' }, { delete: 1 }, { insert: 'nw' }])
    })

    it('crop by compose', () => {
        // delete reordered to back of all inserts
        const delta = new QDelta([{ insert: 'ab' }, { insert: 'cd', attributes:{x: "ef"} }, { insert: 'gh' }])
        const target = new QDelta([{ delete: 1 }, {retain:3}, {delete: 2}])
        // expectEqual(delta.compose(target).ops, [{ insert: '71nw' }, { delete: 1 }])
        expectEqual(flattenDeltas(delta, target).ops, [{ insert: 'b' }, { insert: 'cd', attributes:{x: "ef"} }])
    })

    it('crop by offset and length', () => {
        const delta = new QDelta([{ insert: 'ab' }, { insert: 'cd', attributes:{x: "ef"} }, { insert: 'gh' }])
        expectEqual(cropContent(delta, 0, 6), delta)
        expectEqual(cropContent(delta, 1, 6).ops, [{ insert: 'b' }, { insert: 'cd', attributes:{x: "ef"} }, { insert: 'gh' }])
        expectEqual(cropContent(delta, 2, 6).ops, [{ insert: 'cd', attributes:{x: "ef"} }, { insert: 'gh' }])
        expectEqual(cropContent(delta, 2, 5).ops, [{ insert: 'cd', attributes:{x: "ef"} }, { insert: 'g' }])
        expectEqual(cropContent(delta, 2, 4).ops, [{ insert: 'cd', attributes:{x: "ef"} }])
        expectEqual(cropContent(delta, 2, 3).ops, [{ insert: 'c', attributes:{x: "ef"} }])
    })


    it('transform on empty delta', () => {
        const delta = new QDelta([{ insert: '71' }, { delete: 1 }, { insert: 'nw' }])
        expectEqual(transformDeltas(new QDelta(), delta, true), delta)
        expectEqual(transformDeltas(new QDelta(), delta, true).ops, [{"insert":"71"},{"delete":1},{"insert":"nw"}])
        // note that delta.transform will reorder delete and insert
        expectEqual(new QDelta().transform(delta, true).ops, [{"insert":"71nw"},{"delete":1}])

        const exDelta = new ExDelta([{ insert: '71' }, { delete: 1 }, { insert: 'nw' }])
        expectEqual(transformDeltas(new ExDelta(), exDelta, true), exDelta)
        expectEqual(new ExDelta().transform(exDelta, true), exDelta)
    })


    it('immutability of transformation', () => {
        const delta = new QDelta()
        delta.transform(new QDelta([{ insert: '71' }, { delete: 1 }, { insert: 'nw' }]))
        expectEqual(delta, new QDelta())

        const exDelta = new ExDelta()
        exDelta.transform(new ExDelta([{ insert: '71' }, { delete: 1 }, { insert: 'nw' }]))
        expectEqual(exDelta, new ExDelta())
    })

    it('transformation of delta', () => {
        const delta = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        const target = new QDelta().retain(3).insert('first')
        expectEqual(delta.transform(target, true).ops, [{ insert: 'first' }])
        expectEqual(transformDeltas(delta, target, true).ops, [{ insert: 'first' }])
    })

    it('transformation of delta2', () => {
        const delta = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        const target = new QDelta().retain(3).insert('first')
        expectEqual(delta.transform(target, false).ops, [{ insert: 'first' }])
        expectEqual(transformDeltas(delta, target, false).ops, [{ insert: 'first' }])
    })

    it('transformation of delta3', () => {
        const delta = new QDelta().retain(3).insert('first')
        const target = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        expectEqual(delta.transform(target, true).ops, [
            { delete: 3 },
            { retain: 5 },
            { delete: 1 },
            { retain: 5 },
            { delete: 6 },
        ])
        expectEqual(transformDeltas(delta, target, true).ops, [
            { delete: 3 },
            { retain: 5 },
            { delete: 1 },
            { retain: 5 },
            { delete: 6 },
        ])
    })

    it('transformation of delta4', () => {
        const delta = new QDelta().retain(3).insert('first')
        const target = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        expectEqual(delta.transform(target, false).ops, [
            { delete: 3 },
            { retain: 5 },
            { delete: 1 },
            { retain: 5 },
            { delete: 6 },
        ])
        expectEqual(transformDeltas(delta, target, false).ops, [
            { delete: 3 },
            { retain: 5 },
            { delete: 1 },
            { retain: 5 },
            { delete: 6 },
        ])
    })

    it('transformation of delta5', () => {
        const delta = new QDelta().retain(6).insert('first')
        const target = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        expectEqual(delta.transform(target, true).ops, [{ delete: 4 }, { retain: 10 }, { delete: 6 }])
        expectEqual(transformDeltas(delta, target, true).ops, [{ delete: 4 }, { retain: 10 }, { delete: 6 }])
    })

    it('transformation of delta6', () => {
        const delta = new QDelta().retain(6).insert('first')
        const target = new QDelta()
            .delete(4)
            .retain(5)
            .delete(6)
        expectEqual(delta.transform(target, false).ops, [{ delete: 4 }, { retain: 10 }, { delete: 6 }])
        expectEqual(transformDeltas(delta, target, false).ops, [{ delete: 4 }, { retain: 10 }, { delete: 6 }])
    })

    it('transformation of delta7', () => {
        const delta = new QDelta().retain(6).insert('first')
        const target = new QDelta()
            .delete(4)
            .insert('second')
            .delete(6) // => insert.delete(10)
        expectEqual(delta.transform(target, false).ops, [
            { insert: 'second' },
            { delete: 6 },
            { retain: 5 },
            { delete: 4 },
        ])
        expectEqual(transformDeltas(delta, target, false).ops, [
            { insert: 'second' },
            { delete: 6 },
            { retain: 5 },
            { delete: 4 },
        ])
    })

    it('transformation of delta8 reordered', () => {
        const delta = new QDelta([{ delete: 2 }, { retain: 4 }, { insert: 'first' }]) // .delete(2).retain(4).insert('first')
        const target = new QDelta([{ delete: 4 }, { insert: 'second' }, { delete: 6 }]) // .delete(4).insert('second').delete(6)
        expectEqual(delta.transform(target, false).ops, [
            { insert: 'second' },
            { delete: 4 },
            { retain: 5 },
            { delete: 4 },
        ])
        expectEqual(transformDeltas(delta, target, false).ops, [
            { delete: 2 },
            { insert: 'second' },
            { delete: 2 },
            { retain: 5 },
            { delete: 4 },
        ])
    })

    // it("transformation of random deltas", () => {
    //     for(let i = 0; i <  20; i++)
    //     {
    //         const delta = randomUserDeltas(5, 1, false)[0]
    //         const target = randomUserDeltas(5, 1, false)[0]
    //         expectEqual(delta.transform(target, false).ops, transformChanges(delta, target, false).ops, JSONStringify(delta.ops) + " and " + JSONStringify(target.ops))
    //     }

    // })

    it('transformation of positions', () => {
        expectEqual(new QDelta().delete(10).transformPosition(10), 0)
        expectEqual(new QDelta().delete(11).transformPosition(10), 0)

        expectEqual(
            new QDelta()
                .retain(5)
                .delete(5)
                .transformPosition(10),
            5,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(6)
                .transformPosition(10),
            5,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(15)
                .transformPosition(10),
            5,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(16)
                .transformPosition(10),
            5,
        )
        expectEqual(
            new QDelta()
                .retain(10)
                .delete(5)
                .transformPosition(10),
            10,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .delete(5)
                .transformPosition(10),
            10,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .delete(9)
                .transformPosition(10),
            10,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .delete(10)
                .transformPosition(10),
            10,
        )

        expectEqual(new QDelta().insert('123').transformPosition(10), 13)
        expectEqual(new QDelta().insert('12345').transformPosition(10), 15)
        expectEqual(
            new QDelta()
                .retain(10)
                .insert('12345')
                .transformPosition(10),
            15,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .insert('12345')
                .transformPosition(10),
            10,
        )
        expectEqual(
            new QDelta()
                .retain(20)
                .insert('12345')
                .transformPosition(10),
            10,
        )
        expectEqual(
            new QDelta()
                .retain(21)
                .insert('12345')
                .transformPosition(10),
            10,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(15)
                .insert('12345')
                .transformPosition(10),
            10,
        ) // *??

        // 20
        expectEqual(new QDelta().delete(10).transformPosition(20), 10)
        expectEqual(new QDelta().delete(11).transformPosition(20), 9)

        expectEqual(
            new QDelta()
                .retain(5)
                .delete(5)
                .transformPosition(20),
            15,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(6)
                .transformPosition(20),
            14,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(15)
                .transformPosition(20),
            5,
        )
        expectEqual(
            new QDelta()
                .retain(5)
                .delete(16)
                .transformPosition(20),
            5,
        )
        expectEqual(
            new QDelta()
                .retain(10)
                .delete(5)
                .transformPosition(20),
            15,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .delete(5)
                .transformPosition(20),
            15,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .delete(9)
                .transformPosition(20),
            11,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .delete(10)
                .transformPosition(20),
            11,
        )

        expectEqual(new QDelta().insert('123').transformPosition(20), 23)
        expectEqual(new QDelta().insert('12345').transformPosition(20), 25)
        expectEqual(
            new QDelta()
                .retain(10)
                .insert('12345')
                .transformPosition(20),
            25,
        )
        expectEqual(
            new QDelta()
                .retain(11)
                .insert('12345')
                .transformPosition(20),
            25,
        )
        expectEqual(
            new QDelta()
                .retain(20)
                .insert('12345')
                .transformPosition(20),
            25,
        ) // * different from range
        expectEqual(
            new QDelta()
                .retain(21)
                .insert('12345')
                .transformPosition(20),
            20,
        )

        expectEqual(
            new QDelta()
                .retain(5)
                .delete(15)
                .insert('12345')
                .transformPosition(20),
            10,
        ) // *??
    })
})
