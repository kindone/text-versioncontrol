import { IDelta, IExtendedDelta } from "../primitive/IDelta";
import { Range } from "../primitive/Range";
import { ExtendedDelta } from "./ExtendedDelta";
import { SourceInfo } from "./SourceInfo";


export interface ISourceSyncInfo
{
    uri:string
    rev:number
    range:Range
    changes:IDelta[]
}

export interface ISyncInfo {
    uri:string
    rev:number
}


export class SourceSyncInfo implements ISourceSyncInfo
{
    public static toExtendedDeltas(sourceSyncInfo:ISourceSyncInfo):IExtendedDelta[] {

        const deltas:IExtendedDelta[] = []
        const syncInfo = {uri: sourceSyncInfo.uri, rev: sourceSyncInfo.rev, range: sourceSyncInfo.range}
        for(const change of sourceSyncInfo.changes)
        {
            deltas.push(new ExtendedDelta(change.ops, syncInfo))
        }
        return deltas
    }

    constructor(
        public uri:string,
        public rev:number,
        public changes:IDelta[],
        public range:Range)
    {
    }
}