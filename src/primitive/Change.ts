import Op from 'quill-delta/dist/Op'
import { IDelta } from './IDelta';

export interface Source {
    type: 'excerpt' | 'sync'
    uri: string
    rev: number
    start: number
    end: number
}

export interface Change extends IDelta {
    ops: Op[]
    /* source : take excerpt(content) or sync excerpt(change) */
    source?: Source
}
