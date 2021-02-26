import { forAll, interval, Property, Random } from "jsproptest"
import { contentLengthIncreased, minContentLengthForChange } from "../core/primitive"
import { JSONStringify } from "../core/util"
import { ArraySplitsGen, ArraySplit } from "./generator/ArraySplit"
import { ChangeList, ChangeListGen } from "./generator/ChangeList"
import { DeltaGen } from "./generator/Delta"

describe('generate', () => {

    it('attributeMap', () => {
    })

    it('ArraySplit', () => {
        const minLength = 1
        const maxLength = 30
        const tupleGen = interval(minLength, maxLength).chain(length => interval(minLength, length)).chain(lenthAndMinSplits => interval(lenthAndMinSplits[1], lenthAndMinSplits[0])).map(tup => [tup[0][0], tup[0][1], tup[1]])
        const prop = new Property((tup:[number, number, number]) => {
            const [length, minSplits, maxSplits] = tup
            const arraySplitsGen = ArraySplitsGen(length, minSplits, maxSplits)
            expect(length).toBeGreaterThanOrEqual(minSplits)
            expect(length).toBeGreaterThanOrEqual(maxSplits)
            expect(minSplits).toBeLessThanOrEqual(maxSplits)

            forAll((arraySplits:ArraySplit[]) => {
                expect(arraySplits[arraySplits.length-1].from + arraySplits[arraySplits.length-1].length).toBe(length)

                return (arraySplits.length >= minSplits && arraySplits.length <= maxSplits)
            }, arraySplitsGen)
        })
        prop.setNumRuns(100).forAll(tupleGen)
    })

    it('generate Delta', () => {
        const prop = new Property((initialLength:number, seed:number):void => {
            const random = new Random(seed.toString())
            const delta = DeltaGen(initialLength).generate(random).value
            const minLength = minContentLengthForChange(delta)
            if(minLength != initialLength)
                throw new Error(`${initialLength},${minLength},${JSONStringify(delta)}`)
            const newLength = contentLengthIncreased(initialLength, delta)
            if(newLength < 0)
                throw new Error(`${initialLength},${newLength},${JSONStringify(delta)}`)
        })
        prop.setNumRuns(10000).forAll(interval(0, 30), interval(0, 100))
    })

    it('Delta bug', () => {
        const random = new Random('65')
        expect(contentLengthIncreased(11, DeltaGen(11).generate(random).value)).toBeGreaterThanOrEqual(0)
    })

    it('generate ChangeList', () => {
        // forAll((initialLength:number, numChanges:number, seed:number):void => {
        //     const random = new Random(seed.toString())
        //     ChangeListGen(initialLength, numChanges).generate(random)
        // }, interval(0, 10), interval(1, 20), interval(0, 100))
        // const random = new Random()
        // for(let i = 0; i < 1000; i++)
        //     console.log(JSONStringify(ChangeListGen().generate(random).value))
        forAll((_changeList:ChangeList):void => {
        }, ChangeListGen(10, 50))
    })
})