import { Property, interval, stringGen } from 'jsproptest'

describe('jsproptest', () => {
    it('basic', () => {
        const prop = new Property((a:number, b:string) => {
            return a < 10 || b.length > 3
        })

        expect(() => prop.forAll(interval(0,10), stringGen(0, 10))).toThrow()
    })
})
