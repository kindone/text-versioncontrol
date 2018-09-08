import * as _ from "underscore"
import { randomInt, randomStringWithState, randomUserOperations } from "./random"
import { StringWithState } from "../StringWithState"
import { Operation } from "../Operation"

describe("hand-made scenarios", () => {
    it("scenario 1", () => {
        var str = new StringWithState("world")

        str.apply(new Operation(0, 0, "hello "), "me")
        expect(str.toText()).toBe("hello world")

        let op = str.apply(new Operation(6, 5, ""), "me", true)
        console.log("altered:", op)
        expect(str.toText()).toBe("hello ")

        str.apply(new Operation(6, 0, "world"), "you")
        expect(str.toText()).toBe("hello world")
        console.log(str.toHtml())
        console.log(str.toString())
    })

    it("scenario 2", () => {
        var str = new StringWithState("world")

        str.apply(new Operation(5, 0, "world"), "you")
        str.apply(new Operation(0, 0, "hello "), "me")
        str.apply(new Operation(6, 5, ""), "me")
        console.log(str.toHtml())
        console.log(str.toString())
    })

    it("scenario 2", () => {
        var str = new StringWithState("world")

        str.apply(new Operation(5, 0, "world"), "you")
        str.apply(new Operation(0, 0, "hello "), "me")
        str.apply(new Operation(0, 11, ""), "me")
        console.log(str.toText())
        console.log(str.toHtml())
        console.log(str.toString())
    })
})

function combineRandom(ops_for_users: Operation[][]) {
    let cp_ops_for_users = _.map(ops_for_users, ops => {
        return ops.slice(0)
    })

    let combined: { op: Operation; branch: string }[] = []

    while (
        _.reduce(
            cp_ops_for_users,
            (sum, ops_for_user) => {
                return (sum += ops_for_user.length)
            },
            0
        ) > 0
    ) {
        while (true) {
            let chosen = randomInt(cp_ops_for_users.length)
            if (cp_ops_for_users[chosen].length != 0) {
                let op = cp_ops_for_users[chosen].shift()
                if (op) combined.push({ op, branch: "user" + (chosen + 1) })
                break
            }
        }
    }

    return combined
}

function testCombination(
    ss_initial: StringWithState,
    user1_ops: Operation[],
    user2_ops: Operation[],
    user3_ops: Operation[]
) {
    let ss_client1 = ss_initial.clone()
    let ss_client2 = ss_initial.clone()
    let ss_server = ss_initial.clone()

    expect(ss_client1.equals(ss_initial)).toBe(true)
    expect(ss_client2.equals(ss_initial)).toBe(true)
    expect(ss_client1.equals(ss_client2)).toBe(true)

    let combined1 = combineRandom([user1_ops, user2_ops, user3_ops])
    let combined2 = combineRandom([user1_ops, user2_ops, user3_ops])

    let merged_ops: Operation[] = []
    for (let i = 0; i < combined1.length; i++) {
        const merged_op_parts = ss_client1.apply(combined1[i].op, combined1[i].branch)
        merged_ops = merged_ops.concat(merged_op_parts)
    }

    for (let i = 0; i < combined2.length; i++) {
        ss_client2.apply(combined2[i].op, combined2[i].branch)
    }

    for (let i = 0; i < merged_ops.length; i++) {
        ss_server.apply(merged_ops[i], "merged")
    }

    expect(ss_initial.equals(ss_client1)).toBe(false)

    if (!ss_client1.equals(ss_client2)) {
        console.log(ss_initial.toString())
        console.log(combined1)
        console.log(combined2)
        console.log(ss_client1.toString())
        console.log(ss_client2.toString())
        expect(ss_client1.equals(ss_client2)).toBe(true)
    }

    if (ss_client1.toText() != ss_server.toText()) {
        console.log(ss_initial.toString())
        console.log(combined1)
        console.log(merged_ops)
        console.log(ss_client1.toString())
        console.log(ss_server.toString())
        expect(ss_client1.toText() == ss_server.toText()).toBe(true)
    }
}

describe("commutativity", () => {
    it("scenario 1", () => {
        for (let j = 0; j < 200; j++) {
            let ss = randomStringWithState()
            let user1_ops = randomUserOperations(ss.chars.length)
            let user2_ops = randomUserOperations(ss.chars.length)
            let user3_ops = randomUserOperations(ss.chars.length)

            for (let i = 0; i < 60; i++) {
                testCombination(ss, user1_ops, user2_ops, user3_ops)
            }
        }
    })
})
