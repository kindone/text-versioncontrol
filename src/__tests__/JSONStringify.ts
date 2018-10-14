export function JSONStringify(obj:any) {
    return JSON.stringify(obj, (key:string, value:any) => {
        if (typeof value === 'object' && value instanceof Set) {
            return [...Array.from(value)]
        }
        return value
    })
}

export function expectEqual(obj1:any, obj2:any) {
    expect(JSONStringify(obj1)).toEqual(JSONStringify(obj2))
}