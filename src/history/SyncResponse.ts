import { IDelta } from "../primitive/IDelta"

export interface SyncResponse {
    rev: number
    content: IDelta
    reqDeltas: IDelta[]
    resDeltas: IDelta[]
}