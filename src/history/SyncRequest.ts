import { IDelta } from "../primitive/IDelta"

export interface SyncRequest {
    branchName: string
    baseRev: number
    deltas: IDelta[]
}
