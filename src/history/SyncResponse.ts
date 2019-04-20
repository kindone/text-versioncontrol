import { Change } from '../primitive/Change'

export interface SyncResponse {
    rev: number
    content: Change
    reqDeltas: Change[] // input change (altered)
    resDeltas: Change[] // output change (altered)
}

export type MergeResult = SyncResponse
