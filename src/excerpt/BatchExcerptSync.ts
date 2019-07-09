import { IDelta } from '../core/IDelta'
import { Range } from '../core/Range'

export class BatchExcerptSync {
    constructor(public uri: string, public rev: number, public changes: IDelta[], public ranges: Range[]) {}
}
