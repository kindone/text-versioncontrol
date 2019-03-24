import { Change } from '../primitive/Change'

export class ExcerptTarget {
    constructor(public rev: number, public offset: number, public length: number) {}
}
