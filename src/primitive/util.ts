import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { DeltaComposer } from './DeltaComposer'
import { DeltaTransformer } from './DeltaTransformer'
import { ExDelta } from './ExDelta';
import { IDelta } from './IDelta'
import { SharedString } from './SharedString';




export function JSONStringify(obj: any) {
    return JSON.stringify(obj, (key: string, value: any) => {
        if (typeof value === 'object' && value instanceof Set) {
            return [...Array.from(value)]
        }
        return value
    })
}

export function toJSON(obj: any) {
    return JSON.parse(JSON.stringify(obj))
}
type strfunc = () => string

export function isEqual(obj1: any, obj2: any):boolean {
    return _.isEqual(JSON.parse(JSONStringify(obj1)), JSON.parse(JSONStringify(obj2)))
}

export function expectEqual(obj1: any, obj2: any, msg: string | strfunc = 'Not equal: ') {
    // expect(JSON.parse(JSONStringify(obj1))).toEqual(JSON.parse(JSONStringify(obj2)))
    if (!isEqual(obj1, obj2)) {
        throw new Error((typeof msg === 'string' ? msg : msg()) + ': ( ' + JSONStringify(obj1) + ' and ' + JSONStringify(obj2) + ' )')
    }
}

export function asExDelta(content: string | IDelta): IDelta {
    if (content === '') return new ExDelta([])
    else if (typeof content === 'string') return new ExDelta([{ insert: content }])
    else return content as IDelta
}

export function contentLength(content: IDelta): number {
    return _.reduce(
        content.ops,
        (len, op) => {
            if (typeof op.insert === 'string') return len + op.insert.length
            else if (op.insert) return len + 1
            else throw new Error("content should only consists of inserts")
        },
        0,
    )
}

export function minContentLengthForChange(change: IDelta): number {
    return _.reduce(
        change.ops,
        (len, op) => {
            if(op.insert) return len
            else if(typeof op.retain === 'number') return len + op.retain
            else if(typeof op.delete === 'number') return len + op.delete
            else
                throw new Error("unsupported type:" + JSONStringify(op))
        },
        0,
    )
}

export function contentLengthIncreased(initialLength:number, change:IDelta):number {
    return _.reduce(
        change.ops,
        (len, op) => {
            if (typeof op.insert === 'string') return len + op.insert.length
            else if (op.insert) return len + 1 // embed
            else if (op.delete) return len - op.delete
            else return len
        },
        initialLength,
    )
}

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
    if (op1.retain && op2.retain && !op1.attributes && !op2.attributes)
        return [{ retain: op1.retain + op2.retain }]
    // merge two retains with same attributes
    if (op1.retain && op2.retain && op1.attributes && op2.attributes && _.isEqual(op1.attributes, op2.attributes))
        return [{ retain: op1.retain + op2.retain, attributes: op1.attributes }]

    // cannot merge
    return [op1, op2]
}

export function lastRetainsRemoved(ops:Op[]): Op[] {
    let newOps = ops.concat()

    while(newOps.length > 0 && newOps[newOps.length - 1].retain && !newOps[newOps.length - 1].attributes) {
        newOps = newOps.slice(0, newOps.length - 1)
    }

    return newOps
}

export function emptyOpsRemoved(ops:Op[]): Op[] {
    const newOps = ops.concat()

    return newOps.filter(op => {
        if(op.retain)
            return op.retain > 0
        if(op.delete)
            return op.delete > 0
        if(typeof op.insert === 'string')
            return op.insert.length > 0
        else if(op.insert)
            return true
    })
}

export function normalizeOps(ops: Op[]): Op[] {
    if (ops.length === 0)
        return ops

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

// remove all retain-only deltas in array
export function normalizeDeltas(...deltas: IDelta[]): IDelta[] {
    return _.reduce(
        deltas,
        (newDeltas: IDelta[], delta) => {
            if (!hasNoEffect(delta)) {
                const newDelta = delta.contexts ? new ExDelta(normalizeOps(delta.ops), delta.contexts) : new ExDelta(normalizeOps(delta.ops))
                newDeltas.push(newDelta)
                return newDeltas
            } else return newDeltas
        },
        [],
    )
}

export function hasNoEffect(delta: IDelta):boolean {
    for (const op of delta.ops) {
        if (op.insert || op.delete) {
            return false
        }
    }
    return true
}

// export function flattenDeltasByQuill(...deltas:IDelta[]):IDelta
// {
//     let flattened:IDelta = deltas[0]
//     for(const delta2 of deltas.slice(1))
//     {
//         const sync = delta2.sync || flattened.sync
//         const excerpt = delta2.excerpt || flattened.excerpt
//         flattened = new ExtendedDelta(new Delta(flattened.ops).compose(new Delta(delta2.ops)).ops, sync, excerpt)
//     }
//     return flattened
// }

export function transformDeltas(delta1: IDelta, delta2: IDelta, firstWins: boolean):IDelta {
    const iter = new DeltaTransformer(delta1.ops, firstWins)
    let outOps: Op[] = []
    // console.log('delta2:', delta2.ops)
    for (const op of delta2.ops) {
        if (!iter.hasNext()) {
            outOps.push(op)
            // console.log('rest out:', outOps)
        } else if (op.retain && op.attributes) {
            // attribute
            outOps = outOps.concat(iter.attribute(op.retain, op.attributes))
            // console.log('retain out:', outOps)
        } else if (op.retain) {
            // retain
            outOps = outOps.concat(iter.retain(op.retain))
            // console.log('retain out:', outOps)
        } else if (op.delete) {
            // delete
            outOps = outOps.concat(iter.delete(op.delete))
            // console.log('delete out:', outOps)
        } else if (typeof op.insert === 'string') {
            // insert string
            if (op.attributes) {
                outOps = outOps.concat(iter.insertWithAttribute(op.insert, op.attributes))
            } else {
                outOps = outOps.concat(iter.insert(op.insert))
            }
            // console.log('insert out:', outOps)
        } else if (op.insert) {
            // insert object
            if (op.attributes) {
                outOps = outOps.concat(iter.embedWithAttribute(op.insert, op.attributes))
            } else {
                outOps = outOps.concat(iter.embed(op.insert))
            }
            // console.log('insert out:', outOps)
        }
    }
    return new ExDelta(normalizeOps(outOps))
}

export function applyChanges(content:IDelta, changes:IDelta[]) {
    return flattenDeltas(content, ...changes)
}

export function flattenDeltas(...deltas: IDelta[]):IDelta {
    if (deltas.length === 0) return new ExDelta()

    let flattened: IDelta = deltas[0]

    for (const delta2 of deltas.slice(1)) {
        const iter = new DeltaComposer(flattened.ops)
        let outOps: Op[] = []
        for (const op of delta2.ops) {
            if (!iter.hasNext()) outOps.push(op)
            else if (op.retain && op.attributes) {
                // attribute
                outOps = outOps.concat(iter.attribute(op.retain, op.attributes))
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
        outOps = outOps.concat(iter.rest())
        flattened = new ExDelta(outOps)
    }
    // if(source)
    //     console.error('warning: source information will be lost by flatten')
    return new ExDelta(normalizeOps(flattened.ops))
}

export function opLength(op: Op):number {
    if (typeof op.insert === 'string') return op.insert.length
    else if (op.insert) return 1
    else if (op.retain) return op.retain
    else if (op.delete) return op.delete

    throw new Error('invalid op')
}

// export function transformDeltasByQuill(prev:IDelta, target:IDelta):IDelta
// {
//     const sync = target.sync
//     const excerpt = target.excerpt
//     return new ExtendedDelta(new Delta(prev.ops).transform(new Delta(target.ops)).ops, sync, excerpt)
// }

export function flattenTransformedDelta(delta1: IDelta, delta2: IDelta, firstWins = false): IDelta {
    return flattenDeltas(delta1, transformDeltas(delta1, delta2, firstWins))
}

export function sliceOp(op: Op, start: number, end?: number): Op {
    if (typeof op.insert === 'string') {
        if (op.attributes)
            return { insert: op.insert.slice(start, end), attributes: op.attributes }
        else
            return { insert: op.insert.slice(start, end) }
    } else if (op.insert) {
        if (start > 0)
            return { insert: '' }
        else {
            if (op.attributes)
                return { insert: op.insert, attributes: op.attributes }
            else
                return { insert: op.insert }
        }
    } else if (op.retain) {
        end = end ? end : op.retain
        if (op.attributes)
            return { retain: end - start, attributes: op.attributes }
        else
            return { retain: end - start }
    } else if (op.delete) {
        end = end ? end : op.delete
        return { delete: end - start }
    }

    throw new Error('invalid op')
}

export function sliceOpWithAttributes(op: Op, attr: AttributeMap, start: number, end?: number): Op {
    const newOp: Op = { ...op }
    newOp.attributes = mergeAttributes(op.attributes, attr)
    return sliceOp(newOp, start, end)
}

// unused
function sliceOpWithDelete(op: Op, attr: AttributeMap, start: number, end?: number): Op {
    const newOp: Op = { ...op }
    newOp.attributes = mergeAttributes(op.attributes, attr)
    return sliceOp(newOp, start, end)
}

// precedence: attr2 > attr1
export function mergeAttributes(attr1?: AttributeMap, attr2?: AttributeMap): AttributeMap | undefined {
    if (!attr1 && !attr2) return undefined

    if (!attr1) return attr2
    if (!attr2) return attr1

    const result: AttributeMap = {}
    for (const key of Object.keys(attr1)) {
        result[key] = attr1[key]
    }

    for (const key of Object.keys(attr2)) {
        result[key] = attr2[key]
    }

    return result
}

export function cropContent(content:IDelta, start:number, end:number):IDelta
{
    const fullLength = contentLength(content)
    const length = end - start

    if(fullLength < end)
        throw new Error("invalid argument: " + JSONStringify(content) + ", start: " + start +", end: "+ end)

    if(fullLength ===  end)
        return flattenDeltas(content, new ExDelta([{delete:start}, {retain:length}]))
    else
        return flattenDeltas(content, new ExDelta([{delete:start}, {retain:length}, {delete:fullLength - end}]))
}

export function reverseChange(content:IDelta, change:IDelta):IDelta {
    let offset = 0
    let reversedOps:Op[] = []
    for(const changeOp of change.ops) {
        if(changeOp.retain && changeOp.attributes) {
            const cropped = cropContent(content, offset, offset + changeOp.retain).ops

            for(const contentOp of cropped) {
                const newAttrs:AttributeMap = {}
                for(const key in changeOp.attributes) {
                    if(changeOp.attributes[key] === null) {
                        if(contentOp.attributes && contentOp.attributes[key]) {
                            newAttrs[key] = contentOp.attributes[key]
                        }
                    }
                    else if(typeof changeOp.attributes[key] === 'string') {
                        if(contentOp.attributes && contentOp.attributes[key]) {
                            newAttrs[key] = contentOp.attributes[key]
                        }
                        else {
                            newAttrs[key] = null
                        }
                    }
                }
                // fill in newAttrs
                if(typeof contentOp.insert === 'string') {
                    reversedOps.push({retain: contentOp.insert.length, attributes: newAttrs})
                }
                else if(contentOp.insert) {
                    reversedOps.push({retain: 1, attributes: newAttrs})
                }
            }

            offset += changeOp.retain
        }
        else if(changeOp.retain) {
            reversedOps.push({retain: changeOp.retain})
            offset += changeOp.retain
        }
        else if(typeof changeOp.insert === 'string') {
            reversedOps.push({delete: changeOp.insert.length})
            // offset += op.insert.length
        }
        else if(changeOp.insert) {
            reversedOps.push({delete: 1})
            // offset += 1
        }
        else if(changeOp.delete) {
            reversedOps = reversedOps.concat(cropContent(content, offset, offset + changeOp.delete).ops)
            offset += changeOp.delete
        }
    }
    return {...change, ops: normalizeOps(reversedOps)}
}


export function filterChanges(baseContent:IDelta, changes:IDelta[], criteria:(idx:number, change:IDelta) => boolean):IDelta[] {
    if(changes.length === 0)
        return changes
    if(contentLength(baseContent) < minContentLengthForChange(changes[0]))
        throw new Error('invalid content - change:' + JSONStringify(baseContent) + " - " + JSONStringify(changes))

    const filtered:IDelta[] = []
    const altered = changes.concat()

    const ss = SharedString.fromDelta(baseContent)

    for(let i = 0; i < changes.length; i++) {
        if(criteria(i, altered[i])) {
            ss.applyChange(altered[i], "O")
            filtered.push(altered[i])
        }
        else {
            const targetChange = altered[i]
            const undoChange = reverseChange(ss.toDelta(), targetChange)
            // do and undo to neutralize
            let ss2 = ss.clone()
            ss2.applyChange(targetChange, "O")
            ss2 = SharedString.fromDelta(ss2.toDelta())
            ss2.applyChange(undoChange, "X")

            // update rest
            for(let j = i+1; j < changes.length; j++) {
                altered[j] = ss2.applyChange(altered[j], "O")
            }
        }
    }
    return filtered
}

export function filterOutChangesByIndice(baseContent:IDelta, changes:IDelta[], indicesToRemove:number[]):IDelta[] {
    return filterChanges(baseContent, changes, (idx, change) => !_.contains(indicesToRemove, idx) )
}

