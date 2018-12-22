import Delta = require('quill-delta')
import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { DeltaComposer } from './DeltaComposer'
import { DeltaTransformer } from './DeltaTransformer'
import { IDelta } from './IDelta'


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

export function transformDeltas(delta1:IDelta, delta2:IDelta, firstWins:boolean)
{
    const iter = new DeltaTransformer(delta1.ops, firstWins)
    let outOps:Op[] = []
    // console.log('delta2:', delta2.ops)
    for(const op of delta2.ops)
    {
        if(!iter.hasNext()) {
            outOps.push(op)
            // console.log('rest out:', outOps)
        }
        else if(op.retain && op.attributes) {
            // attribute
            outOps = outOps.concat(iter.attribute(op.retain, op.attributes))
            // console.log('retain out:', outOps)
        }
        else if(op.retain) {
            // retain
            outOps = outOps.concat(iter.retain(op.retain))
            // console.log('retain out:', outOps)
        }
        else if(op.delete) {
            // delete
            outOps = outOps.concat(iter.delete(op.delete))
            // console.log('delete out:', outOps)
        }
        else if(typeof op.insert === 'string') {
            // insert string
            if(op.attributes)
                outOps = outOps.concat(iter.insertWithAttribute(op.insert, op.attributes))
            else
                outOps = outOps.concat(iter.insert(op.insert))
            // console.log('insert out:', outOps)
        }
        else if(op.insert) {
            // insert object
            if(op.attributes)
                outOps = outOps.concat(iter.embedWithAttribute(op.insert, op.attributes))
            else
                outOps = outOps.concat(iter.embed(op.insert))
            // console.log('insert out:', outOps)
        }
    }
    return new Delta(normalizeOps(outOps))
}

export function flattenDeltas(...deltas:IDelta[])
{
    if(deltas.length === 0)
        return new Delta()

    let flattened:IDelta = deltas[0]
    for(const delta2 of deltas.slice(1))
    {
        const iter = new DeltaComposer(flattened.ops)
        let outOps:Op[] = []
        for(const op of delta2.ops)
        {
            if(!iter.hasNext())
                outOps.push(op)
            else if(op.retain && op.attributes) {
                // attribute
                outOps = outOps.concat(iter.attribute(op.retain, op.attributes))
            }
            else if(op.retain) {
                // retain
                outOps = outOps.concat(iter.retain(op.retain))
            }
            else if(op.delete) {
                // delete
                outOps = outOps.concat(iter.delete(op.delete))
            }
            else if(typeof op.insert === 'string') {
                // insert string
                if(op.attributes)
                    outOps = outOps.concat(iter.insertWithAttribute(op.insert, op.attributes))
                else
                    outOps = outOps.concat(iter.insert(op.insert))
            }
            else if(op.insert) {
                // insert object
                if(op.attributes)
                    outOps = outOps.concat(iter.embedWithAttribute(op.insert, op.attributes))
                else
                    outOps = outOps.concat(iter.embed(op.insert))
            }

        }
        outOps = outOps.concat(iter.rest())
        flattened = new Delta(outOps)
    }
    return new Delta(normalizeOps(flattened.ops))
}

export function opLength(op:Op)
{
    if(typeof op.insert === 'string')
        return op.insert.length
    else if(op.insert)
        return 1
    else if(op.retain)
        return op.retain
    else if(op.delete)
        return op.delete

    throw new Error('invalid op')
}

// export function transformDeltasByQuill(prev:IDelta, target:IDelta):IDelta
// {
//     const sync = target.sync
//     const excerpt = target.excerpt
//     return new ExtendedDelta(new Delta(prev.ops).transform(new Delta(target.ops)).ops, sync, excerpt)
// }

export function flattenTransformedDelta(delta1:IDelta, delta2:IDelta, firstWins = false):IDelta
{
    return flattenDeltas(delta1, transformDeltas(delta1, delta2, firstWins))
}

export function sliceOp(op:Op, begin:number, end?:number):Op
{
    if(typeof op.insert === 'string')
    {
        if(op.attributes)
            return {insert: op.insert.slice(begin, end), attributes: op.attributes}
        else
            return {insert: op.insert.slice(begin, end)}
    }
    else if(op.insert)
    {
        if(begin>0)
            return {insert: ''}
        else
        {
            if(op.attributes)
                return {insert: op.insert, attributes: op.attributes}
            else
                return {insert: op.insert}
        }
    }
    else if(op.retain)
    {
        end = end ? end : op.retain
        if(op.attributes)
            return {retain: end-begin, attributes: op.attributes}
        else
            return {retain: end-begin}
    }
    else if(op.delete)
    {
        end = end ? end : op.delete
        return {delete: end-begin}
    }

    throw new Error('invalid op')
}

export function sliceOpWithAttributes(op:Op, attr:AttributeMap, begin:number, end?:number):Op
{
    const newOp:Op = {...op}
    newOp.attributes = mergeAttributes(op.attributes, attr)
    return sliceOp(newOp, begin, end)
}

export function sliceOpWithDelete(op:Op, attr:AttributeMap, begin:number, end?:number):Op
{
    const newOp:Op = {...op}
    newOp.attributes = mergeAttributes(op.attributes, attr)
    return sliceOp(newOp, begin, end)
}

export function mergeAttributes(attr1?:AttributeMap, attr2?:AttributeMap):AttributeMap|undefined
{
    if(!attr1 && !attr2)
        return undefined

    if(!attr1)
        return attr2
    if(!attr2)
        return attr1

    const result:AttributeMap = {}
    for(const key of Object.keys(attr1))
    {
        result[key] = attr1[key]
    }

    for(const key of Object.keys(attr2))
    {
        result[key] = attr2[key]
    }

    return result
}