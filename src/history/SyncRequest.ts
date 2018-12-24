import { IDelta } from "../primitive/IDelta"

export interface SyncRequest {
    branchName: string
    rev: number
    deltas: IDelta[]
}
