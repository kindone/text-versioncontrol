import Op from "quill-delta/dist/Op";

export interface IExtendedDelta
{
    ops: Op[]
    sync?: string
    excerpt?: string
}

export interface IDelta extends IExtendedDelta
{
    ops: Op[]
}

