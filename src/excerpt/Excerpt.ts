import Delta = require("quill-delta")
import Op from "quill-delta/dist/Op"
import { IDelta } from "../primitive/IDelta"
import { IDestInfo } from "./DestInfo"
import { ISourceInfo } from "./SourceInfo"


export class Excerpt
{
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
        const header = { uri: sourceInfo.uri, srcRev: sourceInfo.rev, destRev: rev}
        let ops:Op[] = [{retain: offset}, {insert: {beginExcerpt: header}}]
        ops = ops.concat(sourceInfo.content.ops)
        ops.push({insert: {endExcerpt: header}})
        return new Delta(ops)
    }

    constructor(public readonly sourceInfo:ISourceInfo, public readonly destInfo:IDestInfo) {
    }

    // used to represent excerpt from source
    public taken():IDelta {
        // ....start....end...length
        const {offset, retain, length} = this.sourceInfo
        return Excerpt.take(offset, retain, length)
    }

    public pasted():IDelta {
        return Excerpt.paste(this.destInfo.rev, this.destInfo.offset, this.sourceInfo)
    }

}