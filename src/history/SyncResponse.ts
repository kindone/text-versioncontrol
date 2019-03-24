import { Change } from '../primitive/Change'

export interface SyncResponse {
    rev: number
    content: Change
    reqDeltas: Change[]
    resDeltas: Change[]
}

export type MergeResult = SyncResponse
