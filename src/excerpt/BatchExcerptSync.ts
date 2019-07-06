import { IDelta } from '../primitive/IDelta'
import { Range } from '../primitive/Range'

export class BatchExcerptSync {
    constructor(public uri: string, public rev: number, public changes: IDelta[], public ranges: Range[]) {}
}
