import Op from "quill-delta/dist/Op";
import { IExcerpt } from "../excerpt/Excerpt";
import { ISyncInfo } from "../excerpt/SourceSyncInfo";

export interface IExtendedDelta
{
    ops: Op[]
    sync?: ISyncInfo
    excerpt?: IExcerpt
}

export interface IDelta extends IExtendedDelta
{
    ops: Op[]
}

