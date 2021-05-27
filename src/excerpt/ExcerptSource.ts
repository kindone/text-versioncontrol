import { IDelta } from '../core/IDelta'
import { Source } from '../core/Source'

export class ExcerptSource implements Source {
    public readonly type: 'excerpt' | 'sync' = 'excerpt'

    constructor(
        public uri: string,
        public rev: number,
        public start: number,
        public end: number,
        public content: IDelta,
    ) {}
}
