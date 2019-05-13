import { Change } from '../primitive/Change'

export class ExcerptTarget {
    constructor(public uri:string, public rev: number, public start: number, public end: number) {}
}
