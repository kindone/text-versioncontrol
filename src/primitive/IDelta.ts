import Op from 'quill-delta/dist/Op'

export interface Source {
    type: 'content' | 'change'
    uri: string
    rev: number
    start: number
    end: number
}

export interface IDelta {
    ops: Op[]
    /* source : take excerpt(content) or sync excerpt(change) */
    source?: Source
}
