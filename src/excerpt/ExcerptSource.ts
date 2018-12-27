import Delta = require('quill-delta')
import { IDelta, Source } from '../primitive/IDelta'

export class ExcerptSource {

    public readonly type = 'content'

    constructor(
        public uri: string,
        public rev: number,
        public start: number,
        public end: number,
        public content: IDelta,
    ) {}
}
