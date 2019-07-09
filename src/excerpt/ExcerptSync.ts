import { IDelta } from '../core/IDelta'
import { Range } from '../core/Range'

export class ExcerptSync {
    constructor(public uri: string, public rev: number, public change: IDelta, public range: Range) {}
}
