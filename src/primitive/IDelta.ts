import Op from 'quill-delta/dist/Op'

export interface IDelta {
    ops: Op[]
    /* source : take excerpt(content) or sync excerpt(change) */
    source?: { type: 'content' | 'change'; uri: number; rev: number; start: number; end: number }
}
