import Op from "quill-delta/dist/Op"
import { IExtendedDelta } from "../primitive/IDelta";
import { IExcerpt } from "./Excerpt"
import { ISyncInfo } from "./SourceSyncInfo";



export class ExtendedDelta implements IExtendedDelta
{
    constructor(public ops:Op[], public sync?: ISyncInfo, public excerpt?:IExcerpt)
    {
    }
}