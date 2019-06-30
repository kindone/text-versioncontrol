import Op from 'quill-delta/dist/Op'

export interface Change {
    ops: Op[]
    syncs?: Array<{sourceUri:string, sourceRev:number, targetUri:string, targetRev:number}>
}
