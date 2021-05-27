import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { SharedString } from '../core/SharedString'
import { IDelta } from '../core/IDelta'
import { Delta } from '../core/Delta'
import { Random } from 'jsproptest'

export function randomString(size: number): string {
    // return Math.random()
    //     .toString(36)
    //     .substr(2, size)
    // return jsc.random(0, Number.MAX_SAFE_INTEGER)
    //     .toString(36)
    //     .substr(2, size)

    let text = ''
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    for (let i = 0; i < size; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return text
}

export function randomInt(dist: number) {
    // return 0~dist-1
    // return Math.floor(Math.random() * dist)
    const random = new Random()
    return random.inRange(0, dist)
}

export function randomAttribute() {
    const kind = randomInt(7)
    switch (kind) {
        case 0:
            return { b: 1 }
        case 1:
            return { b: null }
        case 2:
            return { i: 1 }
        case 3:
            return { i: null }
        case 4:
            return { b: 1, i: 1 }
        case 5:
            return { b: null, i: null }
        case 6:
        default:
            return { b: null, i: 1 }
    }
}

export function randomEmbed() {
    const kind = randomInt(2)
    if (kind === 0) return { x: randomString(2) }
    else return { y: randomString(2) }
}

export function randomInsert(withAttr = true): Op {
    const kind = randomInt(withAttr ? 4 : 2)
    switch (kind) {
        case 0:
            // insert
            return { insert: randomString(2) }
        case 1:
            // embed
            return { insert: randomEmbed() }
        case 2:
            // insert with attribute
            return { insert: randomString(2), attributes: randomAttribute() }
        case 3:
        default:
            return { insert: randomEmbed(), attributes: randomAttribute() }
        // embed with attribute
    }
}

export function randomChanges(baseLength: number, numDeltas: number, withAttr = true): IDelta[] {
    const deltas: IDelta[] = []
    for (let i = 0; i < numDeltas; i++) {
        const delta = new Delta(baseLength > 0 ? randomUserOps(baseLength, withAttr) : [randomInsert(withAttr)])
        deltas.push(delta)
        baseLength += _.reduce(
            delta.ops,
            (diff, op) => {
                if (op.delete) diff -= op.delete
                else if (typeof op.insert === 'string') diff += op.insert.length
                else if (op.insert) diff += 1
                return diff
            },
            0,
        )
    }
    return deltas
}

function randomSplit(baseLength: number, moreThanOne = true) {
    let consumed = 0
    let amount = 0
    const splits: Array<{ from: number; length: number }> = []

    do {
        const remaining = baseLength - consumed
        amount = randomInt(Math.max(1, moreThanOne ? remaining - 1 : remaining)) + 1
        splits.push({ from: consumed, length: amount })

        consumed += amount
    } while (consumed < baseLength)

    return splits
}

export function randomUserOps(baseLength: number, withAttr = true) {
    const baseOps: Op[] = []

    const splits = randomSplit(baseLength)

    for (const split of splits) {
        const action = randomInt(withAttr ? 3 : 2)
        if (action === 0) {
            baseOps.push({ retain: split.length })
        } else if (action === 1) {
            baseOps.push({ delete: split.length })
        } else {
            baseOps.push({ retain: split.length, attributes: randomAttribute() })
        }
    }

    if (randomInt(2) === 0) return baseOps

    const insertPositions = randomSplit(splits.length + 1, false).map(split => split.from)

    let resultOps: Op[] = []
    let pre = 0
    for (const insertPos of insertPositions) {
        resultOps = resultOps.concat(baseOps.slice(pre, insertPos))
        resultOps.push(randomInsert(withAttr))
        pre = insertPos
    }
    resultOps = resultOps.concat(baseOps.slice(insertPositions[insertPositions.length - 1]))

    return resultOps
}

export function randomSharedString() {
    return SharedString.fromString(randomString(randomInt(10) + 1))
}
