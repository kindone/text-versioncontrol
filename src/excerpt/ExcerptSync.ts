import { Change } from '../primitive/Change'
import { Range } from '../primitive/Range'

export class ExcerptSync {
    constructor(public uri: string, public rev: number, public change: Change, public range: Range) {}
}
