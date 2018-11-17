import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { ExtendedDelta } from './excerpt/ExtendedDelta'
import { IDelta } from './primitive/IDelta';


export function JSONStringify(obj:any) {
    return JSON.stringify(obj, (key:string, value:any) => {
        if (typeof value === 'object' && value instanceof Set) {
            return [...Array.from(value)]
        }
        return value
    })
}

export function toJSON(obj:any) {
    return JSON.parse(JSON.stringify(obj))
}

export function expectEqual(obj1:any, obj2:any, msg:string = "Not equal: ") {
    // expect(JSON.parse(JSONStringify(obj1))).toEqual(JSON.parse(JSONStringify(obj2)))
    if(!_.isEqual(JSON.parse(JSONStringify(obj1)), JSON.parse(JSONStringify(obj2))))
    {
        throw new Error(msg +  ": ( " + JSONStringify(obj1) + " and " + JSONStringify(obj2) +" )")
    }
}

export function asDelta(content:string | IDelta):IDelta {
    if(content === '')
    return new Delta([])
    else if(typeof content === 'string')
        return new Delta([{insert: content}])
    else
        return content as IDelta
}

export function deltaLength(delta:IDelta):number {
    return _.reduce(delta.ops, (len, op) => {
        if(typeof op.insert === 'string')
            return len + op.insert.length
        else if(op.insert)
            return len + 1
        else
            return len
    }, 0)
}

export function transformPosition(position:number, deltas:IDelta[]):number
{
    for(const delta of deltas) {
        const d = new Delta(delta.ops)
        position = d.transformPosition(position)
    }

    return position
}


export function normalizeTwoOps(op1:Op, op2:Op):Op[] {
    if(typeof op1.insert === 'string' && typeof op2.insert === 'string' && !op1.attributes && !op2.attributes) {
        return [{insert: (op1.insert as string).concat(op2.insert as string)}]
    }

    if(typeof op1.insert === 'string' && typeof op2.insert === 'string' && op1.attributes && op2.attributes) {
        if(_.isEqual(op1.attributes, op2.attributes))
            return [{insert: (op1.insert as string).concat(op2.insert as string), attributes: op1.attributes}]
    }

    if(op1.delete && op2.delete)
        return [{delete: op1.delete + op2.delete}]
    if(op1.retain && op2.retain && !op1.attributes && !op2.attributes)
        return [{retain: op1.retain + op2.retain}]
    if(op1.retain && op2.retain && op1.attributes && op2.attributes &&
        _.isEqual(op1.attributes, op2.attributes)) {
        return [{retain: op1.retain + op2.retain, attributes: op1.attributes}]
    }
    return [op1, op2]
}


export function normalizeOps(ops:Op[]):Op[]
{
    if(ops.length === 0)
        return ops
    const newOps:Op[] = [ops[0]]
    for(const op of ops.slice(1))
    {
        const normalized = normalizeTwoOps(newOps[newOps.length-1], op)
        if(normalized.length === 1) {
            newOps[newOps.length-1] = normalized[0]
        }
        else// 2
            newOps.push(normalized[1])
    }
    if(newOps[newOps.length-1].retain && !newOps[newOps.length-1].attributes)
        return newOps.slice(0, newOps.length-1)
    else
        return newOps
}

// remove all retain-only deltas in array
export function normalizeDeltas(deltas:IDelta[]):IDelta[]
{
    return _.reduce(deltas, (newChanges:IDelta[], change) => {
        if(!isDeltaWithNoEffect(change))
        {
            newChanges.push(new Delta(normalizeOps(change.ops)))
            return newChanges
        }
        else
            return newChanges
    }, [])
}

export function normalizeDeltasWithRevision(deltas:IDelta[], startRev:number):Array<{delta:IDelta, rev:number}>
{
    let rev = startRev
    return _.reduce(deltas, (newChanges:Array<{delta:IDelta, rev:number}>, change) => {
        if(!isDeltaWithNoEffect(change))
            newChanges.push({delta: new Delta(normalizeOps(change.ops)), rev})

        rev ++

        return newChanges
    }, [])
}

export function isDeltaWithNoEffect(delta:IDelta)
{
    for(const op of delta.ops)
    {
        if(op.insert || op.delete) {
            return false
        }
    }
    return true
}

export function flattenDeltas(delta1:IDelta, delta2:IDelta):IDelta
{
    const sync = delta2.sync || delta1.sync
    const excerpt = delta2.excerpt || delta2.excerpt
    return new ExtendedDelta(new Delta(delta1.ops).compose(new Delta(delta2.ops)).ops, sync, excerpt)
}

export function transformDelta(prev:IDelta, target:IDelta):IDelta
{
    const sync = target.sync
    const excerpt = target.excerpt
    return new ExtendedDelta(new Delta(prev.ops).transform(new Delta(target.ops)).ops, sync, excerpt)
}

export function flattenTransformedDelta(delta1:IDelta, delta2:IDelta):IDelta
{
    return flattenDeltas(delta1, transformDelta(delta1, delta2))
}