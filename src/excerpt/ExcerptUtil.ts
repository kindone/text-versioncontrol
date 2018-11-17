import Delta = require("quill-delta")
import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import { IDelta } from "../primitive/IDelta"
import { ISourceInfo } from "./SourceInfo"



export class ExcerptUtil
{

    public static excerptMarker(sourceUri:string, sourceRev:number, destRev:number): {begin:AttributeMap, end:AttributeMap}
    {
        const header = { uri: sourceUri, srcRev: sourceRev, destRev}
        return {begin: {beginExcerpt: header},
                end: {endExcerpt: header}}
    }

    public static take(offset:number, retain:number, length:number):IDelta {
        // ....start....end...length
        let delta = new Delta()
        if(offset > 0)
            delta = delta.delete(offset)

        delta = delta.retain(retain)

        if(length - retain - offset > 0)
            delta = delta.delete(length - retain - offset)

        return delta
    }

    public static paste(rev:number, offset:number, sourceInfo:ISourceInfo):IDelta {
        const {begin, end} = this.excerptMarker(sourceInfo.uri, sourceInfo.rev, rev)
        let ops:Op[] = []
        ops.push({insert: begin})
        ops = ops.concat(sourceInfo.content.ops)
        ops.push({insert: end})
        return new Delta(ops)
    }

}