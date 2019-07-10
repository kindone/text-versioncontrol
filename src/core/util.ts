import * as _ from 'underscore'

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
    if (!isEqual(obj1, obj2)) {
        throw new Error((typeof msg === 'string' ? msg : msg()) + ': ( ' + JSONStringify(obj1) + ' and ' + JSONStringify(obj2) + ' )')
    }
}
