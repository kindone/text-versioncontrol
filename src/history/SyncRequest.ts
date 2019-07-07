import { IDelta } from '../primitive/IDelta'

export interface SyncRequest {
    branch: string
    rev: number
    changes: IDelta[]
}

export interface AppendRequest {
    branch: string
    deltas: IDelta[]
}
