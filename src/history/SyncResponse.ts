import { IDelta } from '../core/IDelta'

export interface SyncResponse {
    rev: number
    content: IDelta
    reqChanges: IDelta[] // input change (altered)
    resChanges: IDelta[] // output change (altered)
}

export type MergeResult = SyncResponse
