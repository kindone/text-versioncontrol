import Delta = require('quill-delta')
import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import { ExDelta } from '../primitive/ExDelta'
import { IDelta } from '../primitive/IDelta'
import { deltaLength } from '../primitive/util'
import { ExcerptSource } from './ExcerptSource';


export class ExcerptUtil {
    public static take(start: number, end: number, length: number): IDelta {
        // ....start....end...length
        const ops: Op[] = []
        const retain = end - start
        if (start > 0) ops.push({ delete: start })

        ops.push({ retain })

        if (length - end > 0) ops.push({ delete: length - end })

        return new ExDelta(ops)
    }

    public static excerptMarker(sourceUri:string, sourceRev:number, targetRev:number, length:number): AttributeMap
    {
        const header = { sourceUri, sourceRev, targetRev, length}
        return {excerpted: header}
    }

    public static pasteWithMarkers(rev:number, offset:number, source:ExcerptSource):IDelta {
        const {excerpted} = this.excerptMarker(source.uri, source.rev, rev, deltaLength(source.content))
        let ops:Op[] = []
        ops.push({insert: excerpted})
        ops = ops.concat(source.content.ops)
        return new Delta(ops)
    }

    // public static paste(rev:number, offset:number, source:ExcerptSource):IDelta {
    //     return new Delta(source.content.ops)
    // }
}
