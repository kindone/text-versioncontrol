import { IDelta } from '../primitive/IDelta'
import { Range } from '../primitive/Range'

export class ExcerptSync {
    constructor(public uri: string, public rev: number, public change: IDelta, public range: Range) {}
}
