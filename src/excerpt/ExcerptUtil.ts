import Delta = require("quill-delta")
import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import { IDelta } from "../primitive/IDelta"
import { ExcerptSource } from "./ExcerptSource"



export class ExcerptUtil
{

    public static take(start:number, end:number, length:number):IDelta {
        // ....start....end...length
        const ops:Op[] = []
        const retain = end - start
        if(start > 0)
            ops.push({delete:start})

        ops.push({retain})

        if(length - end > 0)
            ops.push({delete:(length - end)})

        return new Delta(ops)
    }

    // public static excerptMarker(sourceUri:string, sourceRev:number, targetRev:number): {begin:AttributeMap, end:AttributeMap}
    // {
    //     const header = { uri: sourceUri, srcRev: sourceRev, targetRev}
    //     return {begin: {beginExcerpt: header},
    //             end: {endExcerpt: header}}
    // }

    // public static pasteWithMarkers(rev:number, offset:number, source:ExcerptSource):IDelta {
    //     const {begin, end} = this.excerptMarker(source.uri, source.rev, rev)
    //     let ops:Op[] = []
    //     ops.push({insert: begin})
    //     ops = ops.concat(source.content.ops)
    //     ops.push({insert: end})
    //     return new Delta(ops)
    // }

    // public static paste(rev:number, offset:number, source:ExcerptSource):IDelta {
    //     return new Delta(source.content.ops)
    // }
}