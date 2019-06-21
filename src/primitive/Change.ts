import Op from 'quill-delta/dist/Op'

export interface Change {
    ops: Op[]
    source?: Array<{uri:string, rev:number}>
}
