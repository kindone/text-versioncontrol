import { DestInfo } from "./DestInfo"
import { SourceInfo } from "./SourceInfo"

export interface IExcerpt {
    source:SourceInfo
    dest: DestInfo
}

export class Excerpt implements IExcerpt
{
    constructor(public source:SourceInfo, public dest:DestInfo)
    {
    }
}