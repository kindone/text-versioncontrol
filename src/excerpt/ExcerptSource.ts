import Delta = require('quill-delta')
import { IDelta } from '../primitive/IDelta'

export class ExcerptSource {
    constructor(
        public uri: string,
        public rev: number,
        public start: number,
        public end: number,
        public content: IDelta,
    ) {}
}
