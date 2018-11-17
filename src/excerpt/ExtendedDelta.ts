import Op from "quill-delta/dist/Op"
import { IExtendedDelta } from "../primitive/IDelta";


export class ExtendedDelta implements IExtendedDelta
{
    constructor(public ops:Op[], public sync?: string, public excerpt?:string)
    {
    }
}