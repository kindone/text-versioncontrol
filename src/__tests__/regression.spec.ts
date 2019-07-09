import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Range } from '../core/Range'
import { SharedString } from '../core/SharedString'
import { expectEqual, JSONStringify, flattenDeltas, contentLength, minContentLengthForChange } from '../core/util'
import { randomString, randomInt } from './random'
import { IDelta } from '../core/IDelta';
import { ExDelta } from '../core/ExDelta';

describe('text spec regression', () => {
    it('case 1', () => {
        const initial = '02f'
        const client1 = SharedString.fromString(initial)
        client1.applyChange(new ExDelta().retain(2).retain(1, { b: null, i: 1 }), 'user2')
        // console.log(JSONStringify(client1))
        client1.applyChange(
            new ExDelta()
                .retain(1, { i: null })
                .retain(1)
                .retain(1, { b: null, i: null }),
            'user1',
        )
        client1.applyChange(
            new ExDelta()
                .insert('haq')
                .retain(2)
                .delete(1)
                .insert({ x: 'nw' }),
            'user1',
        )
        // console.log(JSONStringify(client1))

        const client2 = SharedString.fromString(initial)
        client2.applyChange(
            new ExDelta()
                .retain(1, { i: null })
                .retain(1)
                .retain(1, { b: null, i: null }),
            'user1',
        )
        client2.applyChange(
            new ExDelta()
                .insert('haq')
                .retain(2)
                .delete(1)
                .insert({ x: 'nw' }),
            'user1',
        )
        // console.log(JSONStringify(client2))
        client2.applyChange(new ExDelta().retain(2).retain(1, { b: null, i: 1 }), 'user2')
        // console.log(JSONStringify(client2))

        expectEqual(client1.toDelta(), client2.toDelta())
    })

    it('case 3', () => {
        const initial = 'y'
        const client1 = SharedString.fromString(initial)
        client1.applyChange(new ExDelta().retain(1), 'user2')
        // console.log(JSONStringify(client1))
        client1.applyChange(
            new ExDelta()
                .insert('ykp')
                .retain(1)
                .insert({ x: '47' }),
            'user2',
        )
        // console.log(JSONStringify(client1))
        client1.applyChange(
            new ExDelta()
                .delete(1)
                .retain(3)
                .retain(1),
            'user2',
        )
        // console.log(JSONStringify(client1))
        client1.applyChange(
            new ExDelta()
                .insert('c20')
                .delete(3)
                .retain(1),
            'user2',
        )
        // console.log(JSONStringify(client1))
        client1.applyChange(new ExDelta().delete(1), 'user1')
        // console.log(JSONStringify(client1))
        client1.applyChange(new ExDelta().insert({ x: 'y9' }).insert('i12'), 'user1')
        // console.log(JSONStringify(client1))
        client1.applyChange(
            new ExDelta()
                .insert({ x: 'lv' })
                .delete(3)
                .delete(1),
            'user1',
        )
        // console.log(JSONStringify(client1))
        client1.applyChange(new ExDelta().retain(1), 'user1')

        const client2 = SharedString.fromString(initial)
        client2.applyChange(new ExDelta().delete(1), 'user1')
        // console.log(JSONStringify(client2))
        client2.applyChange(new ExDelta().retain(1), 'user2')
        // console.log(JSONStringify(client2))
        client2.applyChange(new ExDelta().insert({ x: 'y9' }).insert('i12'), 'user1')
        // console.log(JSONStringify(client2))
        client2.applyChange(
            new ExDelta()
                .insert({ x: 'lv' })
                .delete(3)
                .delete(1),
            'user1',
        )
        // console.log(JSONStringify(client2))
        client2.applyChange(new ExDelta().retain(1), 'user1')
        // console.log(JSONStringify(client2))
        client2.applyChange(
            new ExDelta()
                .insert('ykp')
                .retain(1)
                .insert({ x: '47' }),
            'user2',
        )
        // console.log(JSONStringify(client2))
        client2.applyChange(
            new ExDelta()
                .delete(1)
                .retain(3)
                .retain(1),
            'user2',
        )
        // console.log(JSONStringify(client2))
        client2.applyChange(
            new ExDelta()
                .insert('c20')
                .delete(3)
                .retain(1),
            'user2',
        )
        // console.log(JSONStringify(client2))

        expectEqual(client1.toDelta(), client2.toDelta())
    })

    it('case 4', () => {
        const initial = 'v'
        const client1 = SharedString.fromString(initial)
        const delta1 = client1.applyChange(new ExDelta().delete(1), 'user2')
        const delta2 = client1.applyChange(new ExDelta().insert({ x: 'tx' }), 'user2')
        const delta3 = client1.applyChange(new ExDelta().retain(1), 'user1')
        const delta4 = client1.applyChange(
            new ExDelta()
                .insert('tia')
                .delete(1)
                .insert({ x: 'l2' }),
            'user1',
        )

        const server = SharedString.fromString(initial)
        server.applyChange(delta1, 'merged')
        server.applyChange(delta2, 'merged')
        server.applyChange(delta3, 'merged')
        server.applyChange(delta4, 'merged')

        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 5', () => {
        const initial = 'h6ji'
        const client1 = SharedString.fromString(initial)
        const delta1 = client1.applyChange(new ExDelta().delete(3).retain(1), 'user1')
        const delta2 = client1.applyChange(
            new ExDelta()
                .insert('w7j')
                .delete(2)
                .insert({ x: 'xd' })
                .delete(1)
                .insert({ y: 'kv' })
                .retain(1)
                .insert({ x: 'ne' }),
            'user2',
        )
        const delta3 = client1.applyChange(new ExDelta().retain(1), 'user1')
        const delta4 = client1.applyChange(
            new ExDelta()
                .insert('jq4')
                .delete(6)
                .retain(1)
                .insert('69a'),
            'user2',
        )

        const server = SharedString.fromString(initial)
        server.applyChange(delta1, 'merged')
        server.applyChange(delta2, 'merged')
        server.applyChange(delta3, 'merged')
        server.applyChange(delta4, 'merged')

        // console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 6', () => {
        const initial = 'ye'
        const client1 = SharedString.fromString(initial)
        const deltas: IDelta[] = []
        deltas.push(client1.applyChange(new ExDelta().delete(1).delete(1), 'user2'))
        deltas.push(client1.applyChange(new ExDelta().insert({ x: 'lv' }), 'user2'))
        deltas.push(client1.applyChange(new ExDelta().retain(1).delete(1), 'user1'))
        deltas.push(
            client1.applyChange(
                new ExDelta()
                    .insert({ y: 'se' })
                    .delete(1)
                    .insert({ x: '1g' }),
                'user1',
            ),
        )

        // console.log(deltas)
        const server = SharedString.fromString(initial)
        for (const delta of deltas) {
            server.applyChange(delta, 'merged')
        }

        // console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 7', () => {
        const initial = '9zxh9'
        const client1 = SharedString.fromString(initial)
        const deltas: IDelta[] = []
        deltas.push(
            client1.applyChange(
                new ExDelta()
                    .insert('u4t')
                    .delete(2)
                    .delete(1)
                    .delete(1)
                    .delete(1),
                'user2',
            ),
        )
        deltas.push(
            client1.applyChange(
                new ExDelta()
                    .insert('29l')
                    .retain(1)
                    .delete(1)
                    .retain(1),
                'user2',
            ),
        )
        deltas.push(
            client1.applyChange(
                new ExDelta()
                    .insert({ y: '7a' })
                    .delete(1)
                    .delete(1)
                    .delete(1)
                    .insert('etw')
                    .delete(1)
                    .retain(1)
                    .insert({ x: 'm4' }),
                'user1',
            ),
        )
        deltas.push(client1.applyChange(new ExDelta().delete(5).delete(1), 'user1'))

        // console.log(JSONStringify(deltas))
        const server = SharedString.fromString(initial)
        for (const delta of deltas) {
            server.applyChange(delta, 'merged')
        }

        // console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 8', () => {
        const initial = 'ju'
        const client1 = SharedString.fromString(initial)
        const combined: Array<{ ops: Op[]; branch: string }> = [
            { ops: [{ insert: { x: '7w' } }, { delete: 1 }, { insert: 'a4' }, { retain: 1 }], branch: 'user1' },
            { ops: [{ retain: 1 }, { delete: 2 }, { delete: 1 }], branch: 'user1' },
            { ops: [{ insert: { x: 'ds' } }, { retain: 1 }, { insert: { x: 'qj' } }, { retain: 1 }], branch: 'user2' },
            { ops: [{ retain: 2 }, { delete: 1 }, { delete: 1 }], branch: 'user2' },
        ]

        const server = SharedString.fromString(initial)
        // console.log(JSONStringify(server.fragments))
        for (const c of combined) {
            const newDelta = client1.applyChange(new ExDelta(c.ops), c.branch)
            server.applyChange(newDelta, 'merged')
            // console.log(JSONStringify(c.ops), c.branch)
            // console.log(JSONStringify(client1.fragments))
            // console.log(JSONStringify(newDelta.ops))
            // console.log(JSONStringify(server.fragments))
        }

        // console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 9 with attr', () => {
        const initial = 'ux'
        const client1 = SharedString.fromString(initial)
        const combined: Array<{ ops: Op[]; branch: string }> = [
            {
                ops: [
                    { insert: { y: 'u8' } },
                    { retain: 1, attributes: { b: 1 } },
                    { retain: 1, attributes: { b: 1, i: 1 } },
                    { insert: 'h6', attributes: { b: null } },
                ],
                branch: 'user2',
            },
            { ops: [{ delete: 1 }, { retain: 1 }], branch: 'user1' },
            { ops: [{ insert: 'xm', attributes: { b: null, i: 1 } }, { retain: 1 }], branch: 'user1' },
        ]

        const server = SharedString.fromString(initial)
        // console.log(JSONStringify(server.fragments))
        for (const c of combined) {
            const newDelta = client1.applyChange(new ExDelta(c.ops), c.branch)
            server.applyChange(newDelta, 'merged')
            // console.log(JSONStringify(c.ops), c.branch)
            // console.log(JSONStringify(client1.fragments))
            // console.log(JSONStringify(newDelta.ops))
            // console.log(JSONStringify(server.fragments))
        }

        console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 10 with attr', () => {
        const initial = 'rd'
        const client1 = SharedString.fromString(initial)
        const combined: Array<{ ops: Op[]; branch: string }> = [
            { ops: [{ retain: 1 }, { retain: 1, attributes: { b: null } }], branch: 'user1' },
            { ops: [{ retain: 1, attributes: { i: 1 } }, { retain: 1 }], branch: 'user1' },
            { ops: [{ retain: 1 }, { retain: 1, attributes: { b: 1 } }], branch: 'user2' },
        ]

        const server = SharedString.fromString(initial)
        // console.log(JSONStringify(server.fragments))
        for (const c of combined) {
            const newDelta = client1.applyChange(new ExDelta(c.ops), c.branch)
            server.applyChange(newDelta, 'merged')
            // console.log(JSONStringify(c.ops), c.branch)
            // console.log(JSONStringify(client1.fragments))
            // console.log(JSONStringify(newDelta.ops))
            // console.log(JSONStringify(server.fragments))
        }

        // console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 11 with attr', () => {
        const initial = 'gr'
        const client1 = SharedString.fromString(initial)
        const combined: Array<{ ops: Op[]; branch: string }> = [
            {
                ops: [
                    { insert: { y: 'iw' }, attributes: { b: null, i: null } },
                    { retain: 1 },
                    { retain: 1 },
                    { insert: 'o4', attributes: { i: 1 } },
                ],
                branch: 'user1',
            },
            { ops: [{ retain: 1 }, { retain: 1, attributes: { b: null, i: null } }], branch: 'user2' },
            {
                ops: [
                    { retain: 2, attributes: { b: null, i: null } },
                    { retain: 1, attributes: { b: 1 } },
                    { retain: 1, attributes: { i: 1 } },
                    { retain: 1 },
                ],
                branch: 'user1',
            },
        ]

        const server = SharedString.fromString(initial)
        // console.log(JSONStringify(server.fragments))
        for (const c of combined) {
            const newDelta = client1.applyChange(new ExDelta(c.ops), c.branch)
            server.applyChange(newDelta, 'merged')
            // console.log(JSONStringify(c.ops), c.branch)
            // console.log(JSONStringify(client1.fragments))
            // console.log(JSONStringify(newDelta.ops))
            // console.log(JSONStringify(server.fragments))
        }

        console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
        expectEqual(client1.toDelta(), server.toDelta())
    })

    it('case 12 with long attr', () => {
        const initial = 'gr'
        const client1 = SharedString.fromString(initial)
        const combined: Array<{ ops: Op[]; branch: string }> = [
            { ops: [{ retain: 1, attributes: { i: 1 } }, { delete: 1 }], branch: 'user1' },
            { ops: [{ retain: 1, attributes: { b: null } }, { delete: 1 }], branch: 'user3' },
            {
                ops: [
                    { insert: { y: 'wi' } },
                    { retain: 1 },
                    { retain: 1 },
                    { insert: { y: '3m' }, attributes: { b: null, i: 1 } },
                ],
                branch: 'user2',
            },
            { ops: [{ insert: 'ia' }, { delete: 3 }, { retain: 1, attributes: { b: 1, i: 1 } }], branch: 'user2' },
            { ops: [{ insert: 'r7' }, { delete: 1 }, { insert: 'ga' }], branch: 'user3' },
            { ops: [{ retain: 1 }, { retain: 1 }, { delete: 1 }], branch: 'user2' },
            { ops: [{ delete: 1 }, { delete: 1 }], branch: 'user2' },
            {
                ops: [
                    { insert: '2m', attributes: { b: null } },
                    { delete: 1 },
                    { insert: 'ub', attributes: { b: null, i: 1 } },
                ],
                branch: 'user1',
            },
            { ops: [{ retain: 2 }, { retain: 1 }, { retain: 1, attributes: { i: 1 } }], branch: 'user1' },
            {
                ops: [
                    { insert: { x: 'fk' }, attributes: { b: 1, i: 1 } },
                    { retain: 1 },
                    { retain: 1 },
                    { insert: 'kx', attributes: { b: 1 } },
                    { delete: 1 },
                    { insert: '00', attributes: { i: null } },
                    { delete: 1 },
                ],
                branch: 'user3',
            },
            { ops: [{ retain: 2, attributes: { i: null } }, { retain: 4 }, { delete: 1 }], branch: 'user3' },
            {
                ops: [
                    { insert: { x: 'nm' }, attributes: { i: null } },
                    { retain: 5, attributes: { b: null, i: 1 } },
                    { insert: { y: 'gx' } },
                    { retain: 1 },
                    { insert: { y: 'xb' } },
                ],
                branch: 'user3',
            },
        ]

        const server = SharedString.fromString(initial)
        // console.log(JSONStringify(server.fragments))
        for (const c of combined) {
            const newDelta = client1.applyChange(new ExDelta(c.ops), c.branch)
            server.applyChange(newDelta, 'merged')
            // console.log(JSONStringify(c.ops), c.branch)
            // console.log(JSONStringify(client1.fragments))
            // console.log(JSONStringify(newDelta.ops))
            // console.log(JSONStringify(server.fragments))
            expectEqual(client1.toDelta(), server.toDelta())
        }

        // console.log(JSONStringify(client1.toDelta()), JSONStringify(server.toDelta()))
    })
})

describe('text spec regression2', () => {
    it('case 1', () => {
        for (let i = 0; i < 20; i++) {
            const str = randomString(randomInt(35 - 16) + 16)
            const ss1 = SharedString.fromString(str)
            const ss2 = ss1.clone()
            const deltas = [
                { ops: [{ insert: "No, It's " }, { delete: 4 }, { insert: 'Our' }] }, // +8
                { ops: [{ retain: 21 }, { insert: ' beautiful ' }, { delete: 1 }] }, // 22
                { ops: [{ retain: 13 }, { insert: 'delicious ' }] },
                { ops: [{ retain: 16 }, { insert: 'ete' }, { delete: 6 }] },
            ]

            const flattened = [flattenDeltas(...deltas)]

            for (const delta of deltas) {
                ss1.applyChange(delta, 'a')
            }

            for (const delta of flattened) {
                ss2.applyChange(delta, 'a')
            }

            expectEqual(ss1.toDelta(), ss2.toDelta(), `string: ${str}, flattened: ${JSONStringify(flattened)} `)

            const start = randomInt(20)
            const range = new Range(start, start + randomInt(20))

            expectEqual(range.applyChanges(deltas), range.applyChanges(flattened))
        }
    })
})
