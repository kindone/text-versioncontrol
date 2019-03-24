import { Change, Source } from '../primitive/Change'
import { Range } from '../primitive/Range'

export class BatchExcerptSync {
    constructor(public uri: string, public rev: number, public changes: Change[], public ranges: Range[]) {}
}
