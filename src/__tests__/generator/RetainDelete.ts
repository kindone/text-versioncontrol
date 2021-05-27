import { AttributeMapGen } from './Attribute'
import Op from 'quill-delta/dist/Op'
import AttributeMap from 'quill-delta/dist/AttributeMap'
import { booleanGen, Generator, inRange, integers, TupleGen } from 'jsproptest'

export interface SimpleRetain extends Op {
    retain: number
}

export interface Retain extends Op {
    retain: number
    attributes?: AttributeMap
}

export function SimpleRetainGen(minLen = 1, maxLen = 100): Generator<SimpleRetain> {
    return integers(minLen, maxLen).map(num => {
        return { retain: num }
    })
}

export function RetainGen(minLen = 1, maxLen = 100, withAttr = true): Generator<SimpleRetain> {
    if (withAttr) {
        booleanGen().flatMap(hasAttr => {
            if (hasAttr) {
                return TupleGen(inRange(minLen, maxLen), AttributeMapGen()).map(tuple => {
                    return { retain: tuple[0], attributes: tuple[1] } as SimpleRetain
                })
            } else {
                return SimpleRetainGen(minLen, maxLen)
            }
        })
    }
    return SimpleRetainGen(minLen, maxLen)
}

export function DeleteGen(minLen = 1, maxLen = 100) {
    return inRange(minLen, maxLen).map(num => {
        return { delete: num }
    })
}
