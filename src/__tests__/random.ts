import Delta = require('quill-delta')
import { Operation } from "../Operation"
import { StringWithState } from "../StringWithState"

export function randomString(size: number) {
    return Math.random()
        .toString(36)
        .substr(2, size)
}

export function randomInt(dist: number) {
    // return 0~dist-1
    return Math.floor(Math.random() * dist)
}

export function randomOperation(length: number) {
    const from = randomInt(length) // 0~length-1
    const numDeleted = randomInt(length - from + 1) // 0~length-from

    if (numDeleted > 0) return new Operation(from, numDeleted, randomString(randomInt(3)))
    else return new Operation(from, numDeleted, randomString(randomInt(2) + 1))
}

export function randomDelta(length: number):Delta {
    return randomOperation(length).toDelta()
}

export function randomUserOperations(baseLength: number, numOps = 0) {
    let length = baseLength
    const ops: Operation[] = []
    const numIter = numOps > 0 ? numOps : randomInt(4) + 1
    for (let i = 0; i < numIter; i++) {
        const op = randomOperation(length)
        length += op.content.length - op.numDeleted
        ops.push(op)
    }
    return ops
}

export function randomUserDeltas(baseLength: number, numOps = 0) {
    const userOps = randomUserOperations(baseLength, numOps)
    return userOps.map((userop) => userop.toDelta())
}

export function randomStringWithState() {
    return StringWithState.fromString(randomString(randomInt(5) + 1))
}
