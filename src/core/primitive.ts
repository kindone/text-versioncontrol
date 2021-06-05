import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Delta } from './Delta'
import { DeltaComposer } from './DeltaComposer'
import { DeltaTransformer } from './DeltaTransformer'
import { IDelta } from './IDelta'
import { SharedString } from './SharedString'
import { JSONStringify } from './util'

/**
 * Coerces string or Delta as Delta
 * @param content content as string or insert-only IDelta
 * @returns A Delta in IDelta type
 */
export function asDelta(content: string | IDelta): IDelta {
    if (content === '') return new Delta([])
    else if (typeof content === 'string') return new Delta([{ insert: content }])
    else return content as IDelta
}

/**
 * Length of an Op, summing up the numbers in the operation
 */
export function opLength(op: Op): number {
    if (typeof op.insert === 'string') return op.insert.length
    else if (op.insert) return 1
    else if (op.retain) return op.retain
    else if (op.delete) return op.delete

    throw new Error('invalid op')
}

/**
 * Length of an IDelta, summing up the numbers ({delete: n} or retain also adds up n) in the operations
 */
export function deltaLength(delta: IDelta): number {
    return _.reduce(delta.ops, (len, op) => len + opLength(op), 0)
}

/** Length of a content in IDelta, counting the string lengths. content should consists of inserts only */
export function contentLength(content: IDelta): number {
    return _.reduce(
        content.ops,
        (len, op) => {
            if (typeof op.insert === 'string') return len + op.insert.length
            else if (op.insert) return len + 1
            else throw new Error('content should only consists of inserts')
        },
        0,
    )
}

/** Get the minimum content length required to apply a change (e.g. too many delete cannot be applied if the content is too short) 
* idea: insert don't require length, as it adds up content, but retain or delete consumes content
*/
export function minContentLengthForChange(change: IDelta): number {
    return _.reduce(
        change.ops,
        (len, op) => {
            if (op.insert) return len
            else if (typeof op.retain === 'number') return len + op.retain
            else if (typeof op.delete === 'number') return len + op.delete
            else throw new Error('unsupported type:' + JSONStringify(op))
        },
        0,
    )
}

/** Get the positive or negative length to be added to a content if a change is applied 
 * (Delete adds negative length and insert adds positive length. retain has no effect)
*/
export function contentLengthChanged(initialLength: number, change: IDelta): number {
    return _.reduce(
        change.ops,
        (len, op) => {
            if (typeof op.insert === 'string') return len + op.insert.length
            else if (op.insert) return len + 1
            // embed
            else if (op.delete) return len - op.delete
            else return len
        },
        initialLength,
    )
}

/** Compacts two ops into equivalent one, by combining operators of same type
 */
export function normalizeTwoOps(op1: Op, op2: Op): Op[] {
    // concatenate two strings with no attributes
    if (typeof op1.insert === 'string' && typeof op2.insert === 'string' && !op1.attributes && !op2.attributes) {
        return [{ insert: (op1.insert as string).concat(op2.insert as string) }]
    }

    // concatenate two strings with same attributes
    if (typeof op1.insert === 'string' && typeof op2.insert === 'string' && op1.attributes && op2.attributes) {
        if (_.isEqual(op1.attributes, op2.attributes)) {
            return [{ insert: (op1.insert as string).concat(op2.insert as string), attributes: op1.attributes }]
        }
    }
    // merge two deletes
    if (op1.delete && op2.delete) return [{ delete: op1.delete + op2.delete }]
    // merge two retains with no attributes
    if (op1.retain && op2.retain && !op1.attributes && !op2.attributes) return [{ retain: op1.retain + op2.retain }]
    // merge two retains with same attributes
    if (op1.retain && op2.retain && op1.attributes && op2.attributes && _.isEqual(op1.attributes, op2.attributes))
        return [{ retain: op1.retain + op2.retain, attributes: op1.attributes }]

    // cannot merge
    return [op1, op2]
}

/** We can remove retains in the rear, as they have no effect */
export function lastRetainsRemoved(ops: Op[]): Op[] {
    let newOps = ops.concat()

    while (newOps.length > 0 && newOps[newOps.length - 1].retain && !newOps[newOps.length - 1].attributes) {
        newOps = newOps.slice(0, newOps.length - 1)
    }

    return newOps
}

/** We can remove empty ops, as they have no effect */
export function emptyOpsRemoved(ops: Op[]): Op[] {
    const newOps = ops.concat()

    return newOps.filter(op => {
        if (op.retain) return op.retain > 0
        if (op.delete) return op.delete > 0
        if (typeof op.insert === 'string') return op.insert.length > 0
        else if (op.insert) return true
    })
}

/** Compact Ops by combining ops and removing ops with no effects */
export function normalizeOps(ops: Op[]): Op[] {
    if (ops.length === 0) return ops

    let newOps: Op[] = [ops[0]]
    for (const op of ops.slice(1)) {
        // try normalize last of newOps and first of oldOps
        const normalized = normalizeTwoOps(newOps[newOps.length - 1], op)
        // normalization succeded, replace last of newOps
        if (normalized.length === 1) {
            newOps[newOps.length - 1] = normalized[0]
        }
        // normalization failed, add old op
        else {
            newOps.push(normalized[1])
        }
    }
    newOps = emptyOpsRemoved(newOps)
    // remove meaningless retain in the back
    return lastRetainsRemoved(newOps)
}

/** remove all retain-only deltas in array */
export function normalizeDeltas(...deltas: IDelta[]): IDelta[] {
    return _.reduce(
        deltas,
        (newDeltas: IDelta[], delta) => {
            if (!hasNoEffect(delta)) {
                const newDelta = delta.contexts
                    ? new Delta(normalizeOps(delta.ops), delta.contexts)
                    : new Delta(normalizeOps(delta.ops))
                newDeltas.push(newDelta)
                return newDeltas
            } else return newDeltas
        },
        [],
    )
}

/** Check if a delta has no non-zero lengthed insert or delete */
export function hasNoEffect(delta: IDelta): boolean {
    for (const op of delta.ops) {
        if (op.insert || op.delete) {
            return false
        }
    }
    return true
}

/**
 * Transforms second delta as if first delta preceded the second delta
 * @param delta1 Preceding delta
 * @param delta2 Succeeding delta
 * @param firstWins tie-breaking scheme. Use true for first delta takes precedes second. Use false otherwise.
 * @returns  transformed delta2 as if delta1 has preceded it
 */
export function transformDeltas(delta1: IDelta, delta2: IDelta, firstWins: boolean): IDelta {
    const iter = new DeltaTransformer(delta1.ops, firstWins)
    let outOps: Op[] = []

    for (const op of delta2.ops) {
        if (!iter.hasNext()) {
            outOps.push(op)
        } else if (op.retain) {
            // retain
            outOps = outOps.concat(iter.retain(op.retain))
        } else if (op.delete) {
            // delete
            outOps = outOps.concat(iter.delete(op.delete))
        } else if (typeof op.insert === 'string') {
            // insert string
            if (op.attributes) {
                outOps = outOps.concat(iter.insertWithAttribute(op.insert, op.attributes))
            } else {
                outOps = outOps.concat(iter.insert(op.insert))
            }
        } else if (op.insert) {
            // insert object
            if (op.attributes) {
                outOps = outOps.concat(iter.embedWithAttribute(op.insert, op.attributes))
            } else {
                outOps = outOps.concat(iter.embed(op.insert))
            }
        }
    }
    return new Delta(normalizeOps(outOps))
}

/** Apply changes on a content */
export function applyChanges(content: IDelta, changes: IDelta[]) {
    return flattenDeltas(content, ...changes)
}

/** Flatten multiple deltas as single equivalent delta */
export function flattenDeltas(...deltas: IDelta[]): IDelta {
    if (deltas.length === 0) return new Delta()

    let flattened: IDelta = deltas[0]

    for (const delta2 of deltas.slice(1)) {
        const iter = new DeltaComposer(flattened.ops)
        let outOps: Op[] = []
        for (const op of delta2.ops) {
            if (!iter.hasNext()) outOps.push(op)
            else if (op.retain) {
                // retain
                outOps = outOps.concat(iter.retain(op.retain))
            } else if (op.delete) {
                // delete
                outOps = outOps.concat(iter.delete(op.delete))
            } else if (typeof op.insert === 'string') {
                // insert string
                if (op.attributes) {
                    outOps = outOps.concat(iter.insertWithAttribute(op.insert, op.attributes))
                } else {
                    outOps = outOps.concat(iter.insert(op.insert))
                }
            } else if (op.insert) {
                // insert object
                if (op.attributes) {
                    outOps = outOps.concat(iter.embedWithAttribute(op.insert, op.attributes))
                } else {
                    outOps = outOps.concat(iter.embed(op.insert))
                }
            }
        }
        outOps = outOps.concat(iter.rest())
        flattened = new Delta(outOps)
    }
    // if(source)
    //     console.error('warning: source information will be lost by flatten')
    return new Delta(normalizeOps(flattened.ops))
}

/** FIXME: unused and untested */
export function flattenTransformedDelta(delta1: IDelta, delta2: IDelta, firstWins = false): IDelta {
    return flattenDeltas(delta1, transformDeltas(delta1, delta2, firstWins))
}

/** slice single op. if offset exceeds the op length, it returns empty operation */
export function sliceOp(op: Op, start: number, end?: number): Op {
    if (typeof op.insert === 'string') {
        if (op.attributes && start < op.insert.length) return { insert: op.insert.slice(start, end), attributes: op.attributes }
        else return { insert: op.insert.slice(start, end) }
    } else if (op.insert) {
        if (start > 0) return { insert: '' }
        else {
            if (op.attributes) return { insert: op.insert, attributes: op.attributes }
            else return { insert: op.insert }
        }
    } else if (op.retain) {
        end = end ? end : op.retain
        return { retain: end - start }
    } else if (op.delete) {
        end = end ? end : op.delete
        return { delete: end - start }
    }

    throw new Error('invalid op')
}

export function cropContent(content: IDelta, start: number, end: number): IDelta {
    const fullLength = contentLength(content)
    const length = end - start

    if (fullLength < end)
        throw new Error('invalid argument: ' + JSONStringify(content) + ', start: ' + start + ', end: ' + end)

    if (fullLength === end) return flattenDeltas(content, new Delta([{ delete: start }, { retain: length }]))
    else return flattenDeltas(content, new Delta([{ delete: start }, { retain: length }, { delete: fullLength - end }]))
}

/**
 * Get an undo change. Undo change would cancel out the forward change if applied together
 * @param baseContent Base content on which the change will be applied (required to calculate undo)
 * @param change forward change
 * @returns undo change
 */
export function invertChange(baseContent: IDelta, change: IDelta): IDelta {
    let offset = 0
    let reversedOps: Op[] = []
    for (const changeOp of change.ops) {
        if (changeOp.retain) {
            reversedOps.push({ retain: changeOp.retain })
            offset += changeOp.retain
        } else if (typeof changeOp.insert === 'string') {
            reversedOps.push({ delete: changeOp.insert.length })
        } else if (changeOp.insert) {
            reversedOps.push({ delete: 1 })
        } else if (changeOp.delete) {
            reversedOps = reversedOps.concat(cropContent(baseContent, offset, offset + changeOp.delete).ops)
            offset += changeOp.delete
        }
    }
    return { ...change, ops: normalizeOps(reversedOps) }
}

/**
 * Filters Filters changes that are fulfilling criteria given a base content and sequence of changes.
 * Useful to rule out certain changes while keeping (the effect of) rest of changes intact
 * @param baseContent Base content on which the changes will be applied (required to calculate undo)
 * @param changes Original changes
 * @param criteria Function that receives index and target change and returns boolean indicating whether the change should be included or not
 * @returns Altered changes
 */
export function filterChanges(
    baseContent: IDelta,
    changes: IDelta[],
    criteria: (idx: number, change: IDelta) => boolean,
): IDelta[] {
    if (changes.length === 0) return changes
    if (contentLength(baseContent) < minContentLengthForChange(changes[0]))
        throw new Error('invalid content - change:' + JSONStringify(baseContent) + ' - ' + JSONStringify(changes))

    const filtered: IDelta[] = []
    // initialize altered as original changes
    const altered = changes.concat()

    const ss = SharedString.fromDelta(baseContent)

    for (let i = 0; i < changes.length; i++) {
        if (criteria(i, altered[i])) {
            ss.applyChange(altered[i], 'O')
            filtered.push(altered[i])
        } else {
            const targetChange = altered[i]
            const undoChange = invertChange(ss.toDelta(), targetChange)
            // do and undo to neutralize
            let ss2 = ss.clone()
            ss2.applyChange(targetChange, 'O')
            ss2 = SharedString.fromDelta(ss2.toDelta())
            ss2.applyChange(undoChange, 'X')

            // update rest
            for (let j = i + 1; j < changes.length; j++) {
                altered[j] = ss2.applyChange(altered[j], 'O')
            }
        }
    }
    return filtered
}

/**
 * Filters Filters out some changes indicated by indices, given a base content and sequence of changes.
 * Useful to rule out certain changes while keeping (the effect of) rest of changes intact
 * @param baseContent Base content on which the changes will be applied (required to calculate undo)
 * @param changes Original changes
 * @param indicesToRemove indices to filter out
 * @returns Altered changes
 */
export function filterOutChangesByIndice(baseContent: IDelta, changes: IDelta[], indicesToRemove: number[]): IDelta[] {
    return filterChanges(baseContent, changes, (idx, change) => !_.contains(indicesToRemove, idx))
}

/** Reorder delete+insert pair as Quill would have generated them */
export function toQuillStyleOrder(delta:IDelta):IDelta {
    const altered = new Delta(delta.ops.concat())
    for(let i = 0; i < delta.ops.length-1; i++) {
        if(altered.ops[i].delete && altered.ops[i+1].insert) {
            const temp = altered.ops[i]
            altered.ops[i] = altered.ops[i+1]
            altered.ops[i+1] = temp
        }
    }
    return altered
}
