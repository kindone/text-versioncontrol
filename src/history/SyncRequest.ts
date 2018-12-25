import { IDelta } from '../primitive/IDelta'

export interface SyncRequest {
    branchName: string
    rev: number
    deltas: IDelta[]
}

export interface AppendRequest {
    branchName: string
    deltas: IDelta[]
}
