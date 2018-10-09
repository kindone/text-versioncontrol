import Delta = require('quill-delta')
import * as _ from "underscore"
import { StringWithState } from "../StringWithState"
import { randomInt, randomStringWithState, randomUserDeltas } from "./random"


function JSONStringify(obj:any) {
    return JSON.stringify(obj, (key:string, value:any) => {
        if (typeof value === 'object' && value instanceof Set) {
            return [...Array.from(value)]
        }
        return value
    })
}

describe("hand-made scenarios", () => {
    it("scenario 1", () => {
        const str = StringWithState.fromString("world")
        expect(str.toText()).toBe("world")
        str.apply(new Delta().insert('hello '), "me")
        expect(str.toText()).toBe("hello world")

        const op = str.apply(new Delta().retain(6).delete(5), "me")
        // console.log("altered:", op)
        expect(str.toText()).toBe("hello ")

        str.apply(new Delta().retain(6).insert("world"), "you")
        expect(str.toText()).toBe("hello world")
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it("scenario 2", () => {
        const str = StringWithState.fromString("world")
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("world")
        str.apply(new Delta().retain(5).insert("world"), "you")
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("worldworld")
        str.apply(new Delta().insert("hello "), "me")
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("hello worldworld")
        str.apply(new Delta().retain(6).delete(5), "me")
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("hello world")
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it("scenario 3", () => {
        const str = StringWithState.fromString("world")
        // console.log(JSONStringify(str))
        expect(str.apply(new Delta().retain(5).insert("world"), "you")).toEqual(new Delta().retain(5).insert("world"))
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("worldworld")
        expect(str.apply(new Delta().insert("hello "), "me")).toEqual(new Delta().insert("hello "))
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("hello worldworld")
        expect(str.apply(new Delta().delete(11), "me")).toEqual(new Delta().delete(11))
        // console.log(JSONStringify(str))
        expect(str.toText()).toBe("world")
        // console.log(str.toText())
        // console.log(str.toHtml())
        // console.log(str.toString())
    })
})

function combineRandom(deltasForUsers: Delta[][]) {
    const cpDeltasForUsers = _.map(deltasForUsers, deltas => {
        return deltas.slice(0)
    })

    const combined: Array<{ delta: Delta; branch: string }> = []

    while (
        _.reduce(
            cpDeltasForUsers,
            (sum, opsForUser) => {
                return (sum += opsForUser.length)
            },
            0
        ) > 0
    ) {
        while (true) {
            const chosen = randomInt(cpDeltasForUsers.length)
            if (cpDeltasForUsers[chosen].length !== 0) {
                const delta = cpDeltasForUsers[chosen].shift()
                if (delta) combined.push({ delta, branch: "user" + (chosen + 1) })
                break
            }
        }
    }

    return combined
}

function testCombination(
    ssInitial: StringWithState,
    user1Deltas: Delta[],
    user2Deltas: Delta[],
    user3Deltas: Delta[] = []
) {
    const ssClient1 = ssInitial.clone()
    const ssClient2 = ssInitial.clone()
    const ssServer = ssInitial.clone()

    expect(ssClient1.equals(ssInitial)).toBe(true)
    expect(ssClient2.equals(ssInitial)).toBe(true)
    expect(ssClient1.equals(ssClient2)).toBe(true)

    const combined1 = combineRandom([user1Deltas, user2Deltas, user3Deltas])
    const combined2 = combineRandom([user1Deltas, user2Deltas, user3Deltas])

    let mergedDeltas: Delta[] = []
    for (const comb of combined1) {
        const mergedDeltaParts = ssClient1.apply(comb.delta, comb.branch)
        mergedDeltas = mergedDeltas.concat(mergedDeltaParts)
    }

    for (const comb of combined2) {
        ssClient2.apply(comb.delta, comb.branch)
    }

    for (const mergedDelta of mergedDeltas) {
        ssServer.apply(mergedDelta, "merged")
    }

    expect(ssInitial.equals(ssClient1)).toBe(false)

    if (!ssClient1.equals(ssClient2)) {
        console.log(JSONStringify(ssInitial))
        console.log(JSONStringify(combined1))
        console.log(JSONStringify(combined2))
        console.log(JSONStringify(ssClient1))
        console.log(JSONStringify(ssClient2))
        expect(ssClient1).toBe(ssClient2)
    }

    if (ssClient1.toText() !== ssServer.toText()) {
        console.log(JSONStringify(ssInitial))
        console.log(JSONStringify(combined1))
        console.log(JSONStringify(mergedDeltas))
        console.log(JSONStringify(ssClient1))
        console.log(JSONStringify(ssServer))
        expect(ssClient1.toText()).toEqual(ssServer.toText())
    }
}

describe("commutativity", () => {
    it("scenario 1", () => {
        for (let j = 0; j < 200; j++) {
            const ss = randomStringWithState()
            const user1Deltas = randomUserDeltas(ss.toText().length,2)
            const user2Deltas = randomUserDeltas(ss.toText().length,2)
            const user3Deltas = randomUserDeltas(ss.toText().length)

            for (let i = 0; i < 60; i++) {
                testCombination(ss, user1Deltas, user2Deltas)// , user3Deltas)
            }
        }
    })
})
