import * as _ from 'underscore'
import { IDelta } from './primitive/IDelta';

export function JSONStringify(obj:any) {
    return JSON.stringify(obj, (key:string, value:any) => {
        if (typeof value === 'object' && value instanceof Set) {
            return [...Array.from(value)]
        }
        return value
    })
}


export function expectEqual(obj1:any, obj2:any, msg:string = "Not equal: ") {
    // expect(JSON.parse(JSONStringify(obj1))).toEqual(JSON.parse(JSONStringify(obj2)))
    if(!_.isEqual(JSON.parse(JSONStringify(obj1)), JSON.parse(JSONStringify(obj2))))
    {
        throw new Error(msg +  ": ( " + JSONStringify(obj1) + " and " + JSONStringify(obj2) +" )")
    }
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