import Op from 'quill-delta/dist/Op'

export interface Change {
    ops: Op[]
    source?: {uri:string, rev:number}
}
