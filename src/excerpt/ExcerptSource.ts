import Delta = require('quill-delta')
import { Change, Source } from '../primitive/Change'

export class ExcerptSource implements Source {

    public readonly type:'excerpt'|'sync' = 'excerpt'

    constructor(
        public uri: string,
        public rev: number,
        public start: number,
        public end: number,
        public content: Change,
    ) {}
}
