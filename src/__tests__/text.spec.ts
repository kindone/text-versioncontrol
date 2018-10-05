import * as _ from "underscore"
import { Operation } from "../Operation"
import { StringWithState } from "../StringWithState"
import { randomInt, randomStringWithState, randomUserOperations } from "./random"


describe("hand-made scenarios", () => {
    it("scenario 1", () => {
        const str = new StringWithState("world")

        str.apply(new Operation(0, 0, "hello "), "me")
        expect(str.toText()).toBe("hello world")

        const op = str.apply(new Operation(6, 5, ""), "me", true)
        // console.log("altered:", op)
        expect(str.toText()).toBe("hello ")

        str.apply(new Operation(6, 0, "world"), "you")
        expect(str.toText()).toBe("hello world")
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it("scenario 2", () => {
        const str = new StringWithState("world")

        str.apply(new Operation(5, 0, "world"), "you")
        str.apply(new Operation(0, 0, "hello "), "me")
        str.apply(new Operation(6, 5, ""), "me")
        // console.log(str.toHtml())
        // console.log(str.toString())
    })

    it("scenario 2", () => {
        const str = new StringWithState("world")

        str.apply(new Operation(5, 0, "world"), "you")
        str.apply(new Operation(0, 0, "hello "), "me")
        str.apply(new Operation(0, 11, ""), "me")
        // console.log(str.toText())
        // console.log(str.toHtml())
        // console.log(str.toString())
    })
})

function combineRandom(opsForUsers: Operation[][]) {
    const cpOpsForUsers = _.map(opsForUsers, ops => {
        return ops.slice(0)
    })

    const combined: Array<{ op: Operation; branch: string }> = []

    while (
        _.reduce(
            cpOpsForUsers,
            (sum, opsForUser) => {
                return (sum += opsForUser.length)
            },
            0
        ) > 0
    ) {
        while (true) {
            const chosen = randomInt(cpOpsForUsers.length)
            if (cpOpsForUsers[chosen].length !== 0) {
                const op = cpOpsForUsers[chosen].shift()
                if (op) combined.push({ op, branch: "user" + (chosen + 1) })
                break
            }
        }
    }

    return combined
}

function testCombination(
    ssInitial: StringWithState,
    user1Ops: Operation[],
    user2Ops: Operation[],
    user3Ops: Operation[]
) {
    const ssClient1 = ssInitial.clone()
    const ssClient2 = ssInitial.clone()
    const ssServer = ssInitial.clone()

    expect(ssClient1.equals(ssInitial)).toBe(true)
    expect(ssClient2.equals(ssInitial)).toBe(true)
    expect(ssClient1.equals(ssClient2)).toBe(true)

    const combined1 = combineRandom([user1Ops, user2Ops, user3Ops])
    const combined2 = combineRandom([user1Ops, user2Ops, user3Ops])

    let mergedOps: Operation[] = []
    for (const comb of combined1) {
        const mergedOpParts = ssClient1.apply(comb.op, comb.branch)
        mergedOps = mergedOps.concat(mergedOpParts)
    }

    for (const comb of combined2) {
        ssClient2.apply(comb.op, comb.branch)
    }

    for (const mergedOp of mergedOps) {
        ssServer.apply(mergedOp, "merged")
    }

    expect(ssInitial.equals(ssClient1)).toBe(false)

    if (!ssClient1.equals(ssClient2)) {
        // console.log(ss_initial.toString())
        // console.log(combined1)
        // console.log(combined2)
        // console.log(ss_client1.toString())
        // console.log(ss_client2.toString())
        expect(ssClient1.equals(ssClient2)).toBe(true)
    }

    if (ssClient1.toText() !== ssServer.toText()) {
        // console.log(ss_initial.toString())
        // console.log(combined1)
        // console.log(merged_ops)
        // console.log(ss_client1.toString())
        // console.log(ss_server.toString())
        expect(ssClient1.toText() === ssServer.toText()).toBe(true)
    }
}

describe("commutativity", () => {
    it("scenario 1", () => {
        for (let j = 0; j < 200; j++) {
            const ss = randomStringWithState()
            const user1Ops = randomUserOperations(ss.chars.length)
            const user2Ops = randomUserOperations(ss.chars.length)
            const user3Ops = randomUserOperations(ss.chars.length)

            for (let i = 0; i < 60; i++) {
                testCombination(ss, user1Ops, user2Ops, user3Ops)
            }
        }
    })
})
