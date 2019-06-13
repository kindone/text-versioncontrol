import Delta = require('quill-delta')
import * as _ from 'underscore'
import { SharedString } from '../SharedString'
import { expectEqual, JSONStringify, flattenChanges } from '../util'
import { randomInt, randomSharedString, randomUserDeltas } from '../../__tests__/random'
import { Change } from '../Change';

describe('hand-made scenarios', () => {
    it('scenario 1', () => {
        const str = SharedString.fromString('world')
        expect(str.toText()).toBe('world')
        str.applyChange(new Delta().insert('hello '), 'me')
        expect(str.toText()).toBe('hello world')

        const op = str.applyChange(new Delta().retain(6).delete(5), 'me')
        // console.log("altered:", op)
        expect(str.toText()).toBe('hello ')

        str.applyChange(new Delta().retain(6).insert('world'), 'you')
        expect(str.toText()).toBe('hello world')
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it('scenario 2', () => {
        const str = SharedString.fromString('world')
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('world')
        str.applyChange(new Delta().retain(5).insert('world'), 'you')
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('worldworld')
        str.applyChange(new Delta().insert('hello '), 'me')
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('hello worldworld')
        str.applyChange(new Delta().retain(6).delete(5), 'me')
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('hello world')
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it('scenario 3', () => {
        const str = SharedString.fromString('world')
        // console.log(JSONStringify(str))
        expect(str.applyChange(new Delta().retain(5).insert('world'), 'you')).toEqual(
            new Delta().retain(5).insert('world'),
        )
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('worldworld')
        expect(str.applyChange(new Delta().insert('hello '), 'me')).toEqual(new Delta().insert('hello '))
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('hello worldworld')
        expect(str.applyChange(new Delta().delete(11), 'me')).toEqual(new Delta().delete(11))
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe('world')
        // console.log(str.toText())
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it('scenario 4 delete', () => {
        const str = SharedString.fromString('abcde')
        expect(str.toText()).toBe('abcde')
        const deltas: Change[] = []
        // NOTE:
        // new Delta().retain(2).delete(1).insert("f"))) is saved as {"ops":[{"retain":2},{"insert":"f"},{"delete":1}]}
        let delta = str.applyChange(
            new Delta()
                .retain(2)
                .delete(1)
                .insert('f'),
            'user2',
        ) // ab(f)[c]de
        deltas.push(delta)
        console.log(JSONStringify(delta), JSONStringify(str))
        expect(str.toText()).toBe('abfde')

        delta = str.applyChange(new Delta().delete(3), 'user1') // [ab](f)[c]de
        deltas.push(delta)
        console.log(JSONStringify(delta), JSONStringify(str))
        expect(str.toText()).toBe('fde')

        delta = str.applyChange(new Delta().retain(1).insert('gh'), 'user1') // [ab](f)[c]dghe
        deltas.push(delta)
        console.log(JSONStringify(delta), JSONStringify(str))
        expect(str.toText()).toBe('fdghe')

        const str2 = SharedString.fromString('abcde')
        for (const del of deltas) {
            str2.applyChange(del, 'merged')
            console.log(JSONStringify(str2))
        }
        expect(str2.toText()).toBe('fdghe')
        console.log('html:', str2.toHtml(false))
        console.log('json:', str2.toStyledJSON())
    })
})

function combineRandom(deltasForUsers: Change[][]) {
    const cpDeltasForUsers = _.map(deltasForUsers, deltas => {
        return deltas.slice(0)
    })

    const combined: Array<{ delta: Change; branch: string }> = []

    while (
        _.reduce(
            cpDeltasForUsers,
            (sum, opsForUser) => {
                return (sum += opsForUser.length)
            },
            0,
        ) > 0
    ) {
        while (true) {
            const chosen = randomInt(cpDeltasForUsers.length)
            if (cpDeltasForUsers[chosen].length !== 0) {
                const delta = cpDeltasForUsers[chosen].shift()
                if (delta) combined.push({ delta, branch: 'user' + (chosen + 1) })
                break
            }
        }
    }

    return combined
}

function testCombination(
    ssInitial: SharedString,
    user1Deltas: Change[],
    user2Deltas: Change[],
    user3Deltas: Change[] = [],
) {
    const ssClient1 = ssInitial.clone()
    const ssClient2 = ssInitial.clone()
    const ssClient3 = ssInitial.clone()
    const ssServer = ssInitial.clone()

    expect(ssClient1.equals(ssInitial)).toBe(true)
    expect(ssClient2.equals(ssInitial)).toBe(true)
    expect(ssClient1.equals(ssClient2)).toBe(true)

    const combined1 = combineRandom([user1Deltas, user2Deltas, user3Deltas])
    const combined2 = combineRandom([user1Deltas, user2Deltas, user3Deltas])
    const flattened = combineRandom([
        [flattenChanges(...user1Deltas)],
        [flattenChanges(...user2Deltas)],
        [flattenChanges(...user3Deltas)],
    ])

    const mergedDeltas: Change[] = []
    for (const comb of combined1) {
        mergedDeltas.push(ssClient1.applyChange(comb.delta, comb.branch))
    }

    for (const comb of combined2) {
        ssClient2.applyChange(comb.delta, comb.branch)
    }

    for (const comb of flattened) {
        ssClient3.applyChange(comb.delta, comb.branch)
    }
    for (const mergedDelta of mergedDeltas) {
        ssServer.applyChange(mergedDelta, 'merged')
    }

    // expect(ssInitial.equals(ssClient1)).toBe(false)

    if (!_.isEqual(JSON.parse(JSONStringify(ssClient1.toDelta())), JSON.parse(JSONStringify(ssClient2.toDelta())))) {
        console.log(JSONStringify(ssInitial))
        console.log(JSONStringify(combined1))
        console.log(JSONStringify(combined2))
        console.log(JSONStringify(ssClient1))
        console.log(JSONStringify(ssClient2))
        expectEqual(ssClient1.toDelta(), ssClient2.toDelta())
    }

    if (!_.isEqual(JSON.parse(JSONStringify(ssClient1.toDelta())), JSON.parse(JSONStringify(ssServer.toDelta())))) {
        console.error(JSONStringify(ssInitial))
        console.error(JSONStringify(combined1))
        console.error(JSONStringify(mergedDeltas))
        console.error(JSONStringify(ssClient1))
        console.error(JSONStringify(ssServer))
        expectEqual(ssClient1.toDelta(), ssServer.toDelta())
    }

    if (
        true &&
        !_.isEqual(JSON.parse(JSONStringify(ssClient1.toDelta())), JSON.parse(JSONStringify(ssClient3.toDelta())))
    ) {
        console.log(JSONStringify(ssInitial))
        console.log(JSONStringify(combined1))
        console.log(JSONStringify(flattened))
        console.log(JSONStringify(ssClient1))
        console.log(JSONStringify(ssClient3))
        expectEqual(ssClient1.toDelta(), ssClient3.toDelta())
    }
}

describe('commutativity', () => {
    it('scenario 0', () => {
        for (let j = 0; j < 50; j++) {
            const ss = randomSharedString()
            const user1Deltas = randomUserDeltas(ss.toText().length, 2)
            const user2Deltas = []

            for (let i = 0; i < 60; i++) {
                testCombination(ss, user1Deltas, user2Deltas)
            }
        }
    })
    it('scenario 1', () => {
        for (let j = 0; j < 50; j++) {
            const ss = randomSharedString()
            const user1Deltas = randomUserDeltas(ss.toText().length, 2, false)
            const user2Deltas = randomUserDeltas(ss.toText().length, 1, false)

            for (let i = 0; i < 60; i++) {
                testCombination(ss, user1Deltas, user2Deltas)
            }
        }
    })

    it('scenario 2', () => {
        for (let j = 0; j < 50; j++) {
            const ss = randomSharedString()
            const user1Deltas = randomUserDeltas(ss.toText().length, 4)
            const user2Deltas = randomUserDeltas(ss.toText().length, 4)
            const user3Deltas = randomUserDeltas(ss.toText().length, 5)

            for (let i = 0; i < 60; i++) {
                testCombination(ss, user1Deltas, user2Deltas, user3Deltas)
            }
        }
    })
})

describe('flatten', () => {
    it('scenario 1', () => {
        for (let j = 0; j < 50; j++) {
            const ss = randomSharedString()
            const ss2 = ss.clone()
            const deltas = randomUserDeltas(ss.toText().length, 10)
            for (const delta of deltas) {
                ss.applyChange(delta, 'branch')
            }

            ss2.applyChange(flattenChanges(...deltas), 'branch')

            expectEqual(ss.toDelta(), ss2.toDelta())
        }
    })
})
