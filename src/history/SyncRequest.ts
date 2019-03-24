import { Change } from '../primitive/Change'

export interface SyncRequest {
    branchName: string
    rev: number
    deltas: Change[]
}

export interface AppendRequest {
    branchName: string
    deltas: Change[]
}
