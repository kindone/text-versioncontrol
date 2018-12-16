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
        const ops:Op[] = []
        if(offset > 0)
            ops.push({delete:offset})

        ops.push({retain})

        if(length - retain - offset > 0)
            ops.push({delete:(length - retain - offset)})

        return new Delta(ops)
    }

    public static pasteWithMarkers(rev:number, offset:number, sourceInfo:ISourceInfo):IDelta {
        const {begin, end} = this.excerptMarker(sourceInfo.uri, sourceInfo.rev, rev)
        let ops:Op[] = []
        ops.push({insert: begin})
        ops = ops.concat(sourceInfo.content.ops)
        ops.push({insert: end})
        return new Delta(ops)
    }

    public static paste(rev:number, offset:number, sourceInfo:ISourceInfo):IDelta {
        let ops:Op[] = []
        ops = ops.concat(sourceInfo.content.ops)
        return new Delta(ops)
    }


}