import jsc = require("jsverify")
import Delta = require("quill-delta")
import * as _ from 'underscore'
import { IDelta } from "../primitive/IDelta";
import { Range } from "../primitive/Range"
import {deltaLength, JSONStringify, normalizeOps, expectEqual} from '../util'



describe("Range", () => {
    it("applyChange", () => {
        const range = new Range(10, 20)
        expectEqual(range.applyChange(new Delta().delete(10)), new Range(0,10))
        expectEqual(range.applyChange(new Delta().delete(11)), new Range(0,9))

        expectEqual(range.applyChange(new Delta().retain(5).delete(5)), new Range(5,15))
        expectEqual(range.applyChange(new Delta().retain(5).delete(6)), new Range(5,14))
        expectEqual(range.applyChange(new Delta().retain(5).delete(15)), new Range(5,5)) // delete all
        expectEqual(range.applyChange(new Delta().retain(5).delete(16)), new Range(5,5))
        expectEqual(range.applyChange(new Delta().retain(10).delete(5)), new Range(10,15))
        expectEqual(range.applyChange(new Delta().retain(11).delete(5)), new Range(10,15)) // internal delete
        expectEqual(range.applyChange(new Delta().retain(11).delete(9)), new Range(10,11))
        expectEqual(range.applyChange(new Delta().retain(11).delete(10)), new Range(10,11))


        expectEqual(range.applyChange(new Delta().insert('123')), new Range(13,23))
        expectEqual(range.applyChange(new Delta().insert('12345')), new Range(15,25))
        expectEqual(range.applyChange(new Delta().insert('1234567890')), new Range(20,30))
        expectEqual(range.applyChange(new Delta().retain(10).insert('12345')), new Range(15,25)) // ** considered external
        expectEqual(range.applyChange(new Delta().retain(11).insert('12345')), new Range(10,25)) // internal
        expectEqual(range.applyChange(new Delta().retain(20).insert('12345')), new Range(10,20)) // ** considered external
        expectEqual(range.applyChange(new Delta().retain(21).insert('12345')), new Range(10,20)) // out-of-bound

        expectEqual(range.applyChange(new Delta().retain(5).delete(15).insert('12345')), new Range(10,10)) // * why??
    })

    it("applyChanges", () => {
        const range = new Range(10, 20)
        const changes = [
            new Delta().delete(11),
            new Delta().insert('123'),
            new Delta().retain(10).insert('12345')
        ]
        expectEqual(range.applyChange(changes[0]).applyChange(changes[1]).applyChange(changes[2]),
            range.applyChanges(changes))
    })

    it("cropChange", () => {
        const range = new Range(10, 20)
        expectEqual(range.cropChange(new Delta().retain(10)), new Delta()) // no-op
        expectEqual(range.cropChange(new Delta().retain(20)), new Delta()) // no-op

        expectEqual(range.cropChange(new Delta().delete(10)), new Delta()) // nothing, only range changes
        expectEqual(range.cropChange(new Delta().delete(11)), new Delta().delete(1))
        expectEqual(range.cropChange(new Delta().delete(11)), new Delta().delete(1))
        expectEqual(range.cropChange(new Delta().delete(20)), new Delta().delete(10))
        expectEqual(range.cropChange(new Delta().delete(21)), new Delta().delete(10)) // overflow

        expectEqual(range.cropChange(new Delta().retain(10).delete(1)), new Delta().delete(1))
        expectEqual(range.cropChange(new Delta().retain(10).delete(10)), new Delta().delete(10))
        expectEqual(range.cropChange(new Delta().retain(10).delete(11)), new Delta().delete(10)) // overflow

        expectEqual(range.cropChange(new Delta().insert('1234567890')), new Delta()) // nothing, only range changes
        expectEqual(range.cropChange(new Delta().retain(10).insert('1')), new Delta()) // nothing, only range changes
        expectEqual(range.cropChange(new Delta().retain(11).insert('1')), new Delta().retain(1).insert('1'))
        expectEqual(range.cropChange(new Delta().retain(11).insert('1234567890')), new Delta().retain(1).insert('1234567890'))
        // delete.insert becomes insert.delete, so won't work: expectEqual(range.crop(new Delta().retain(10).delete(1).insert('123')), new Delta().delete(1).retain(1).insert('123'))
        expectEqual(range.cropChange(new Delta().retain(10).delete(1).retain(1).insert('123')), new Delta().delete(1).retain(1).insert('123'))
        expectEqual(range.cropChange(new Delta().retain(10).delete(1).retain(1).insert('1234567890')), new Delta().delete(1).retain(1).insert('1234567890'))
        expectEqual(range.cropChange(new Delta().retain(10).delete(1).retain(1).insert('1234567890').delete(8)), new Delta().delete(1).retain(1).insert('1234567890').delete(8))
        expectEqual(range.cropChange(new Delta().retain(10).delete(1).retain(1).insert('1234567890').delete(9)), new Delta().delete(1).retain(1).insert('1234567890').delete(8))
        expectEqual(range.cropChange(new Delta().retain(10).delete(1).retain(1).insert('1234567890').retain(8).delete(1)), new Delta().delete(1).retain(1).insert('1234567890'))
        expectEqual(range.cropChange(new Delta().retain(1).insert('123').delete(1).retain(8).delete(1).retain(1).insert('1234567890').retain(8).delete(1)), new Delta().delete(1).retain(1).insert('1234567890'))
        expectEqual(range.cropChange(new Delta().retain(10).delete(1).retain(1).insert('1234567890').retain(7).delete(1).retain(1).delete(1)), new Delta().delete(1).retain(1).insert('1234567890').retain(7).delete(1))
    })

    it("cropChanges", () => {
        const range = new Range(10, 20)

        const changes = [
            new Delta().retain(10),
            new Delta().retain(20)
        ]

        expectEqual(range.cropChanges(changes), []) // normalized
        expectEqual(range.cropChanges(changes), []) // normalized

        changes.push(new Delta().retain(11).insert('123'))
        expectEqual(range.cropChanges(changes), [new Delta().retain(1).insert('123')]) // normalized
        changes.push(new Delta().delete(2))
        expectEqual(range.cropChanges(changes), [new Delta().retain(1).insert('123')]) // left bounded: only range changes
        changes.push(new Delta().retain(8).delete(1))
        expectEqual(range.cropChanges(changes), [new Delta().retain(1).insert('123'), new Delta().delete(1)])

        changes.push(new Delta().retain(9).insert('456'))
        expectEqual(range.cropChanges(changes), [new Delta().retain(1).insert('123'), new Delta().delete(1), new Delta().retain(1).insert('456')])
    })
})


describe("Normalize", () => {
    it("scenario 1", () => {
        expectEqual(normalizeOps(new Delta().retain(5).retain(6).insert('a').insert('a').retain(0).insert('b').delete(1).ops),
            new Delta().retain(11).insert('aab').delete(1).ops)

        expectEqual(normalizeOps(new Delta().retain(-5).retain(6).insert('a', {a:5}).insert('b').delete(1).delete(2).ops),
            new Delta().retain(6).insert('a', {a:5}).insert('b').delete(3).ops) // * minus retain ignored
    })
})