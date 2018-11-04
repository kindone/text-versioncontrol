import { IDelta } from "../primitive/IDelta";
import { Range } from "../primitive/Range";


export interface ISourceSyncInfo
{
    uri:string
    rev:number
    changes:IDelta[]
    range:Range
}

export class SourceSyncInfo implements ISourceSyncInfo
{
    constructor(
        public uri:string,
        public rev:number,
        public changes:IDelta[],
        public range:Range)
    {
    }
}