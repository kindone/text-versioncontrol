import * as _ from 'underscore'

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