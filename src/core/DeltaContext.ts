export interface DeltaContext {
    type: 'paste' | 'sync'
    sourceUri:string
    sourceRev:number
    targetUri:string
    targetRev:number
}