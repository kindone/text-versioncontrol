import Delta = require('quill-delta')
import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import { Change } from '../primitive/Change'
import { ExDelta } from '../primitive/ExDelta'
import { contentLength, JSONStringify } from '../primitive/util';
import { ExcerptMarker } from './ExcerptMarker';
import { ExcerptSource } from './ExcerptSource';

export class ExcerptUtil {
    public static take(start: number, end: number, length: number): Change {
        // ....start....end...length
        const ops: Op[] = []
        const retain = end - start
        if (start > 0) ops.push({ delete: start })

        ops.push({ retain })

        if (length - end > 0) ops.push({ delete: length - end })

        return new ExDelta(ops)
    }

    public static makeExcerptMarker(sourceUri:string, sourceRev:number, targetUri:string, targetRev:number, length:number): ExcerptMarker
    {
        const header = { sourceUri, sourceRev, targetUri, targetRev, length}
        return {excerpted: header}
    }

    public static getPasteWithMarkers(uri:string, rev:number, offset:number, source:ExcerptSource):Change {
        const excerpted = this.makeExcerptMarker(source.uri, source.rev, uri, rev, contentLength(source.content))
        let ops:Op[] = []
        const markerOp = {insert: excerpted }
        if(!ExcerptUtil.isExcerptMarker(markerOp))
            throw new Error("Unexpected error. Check marker and checker implementation: " + JSONStringify(markerOp))
        ops.push({insert: excerpted})
        // const safeSourceOps = ExcerptUtil.setExcerptMarkersAsCopied(source.content.ops)
        ops = ops.concat(source.content.ops)
        return new Delta(ops)
    }

    public static isExcerptMarker(op:Op, includeCopied = false):boolean {
        if(!op.insert || (typeof op.insert !== 'object'))
            return false

        const insert:any = op.insert

        if(!insert.hasOwnProperty('excerpted'))
            return false
        // filter out copied
        if(!includeCopied && insert.hasOwnProperty('copied'))
            return false

        const excerpted = insert.excerpted
        if(!excerpted)
            return false
        return (typeof excerpted.sourceUri === 'string')
             && (typeof excerpted.sourceRev === 'number')
             && (typeof excerpted.targetUri === 'string')
             && (typeof excerpted.targetRev === 'number')
             && (typeof excerpted.length === 'number')

    }

    public static setExcerptMarkersAsCopied(ops:Op[]):Op[] {
        return ops.map(op => {
            if(ExcerptUtil.isExcerptMarker(op) && typeof op.insert !== 'string') {
                return {...op, insert: {...op.insert, copied:true}}
            }
            else {
                return op
            }
        })
    }

    // public static paste(rev:number, offset:number, source:ExcerptSource):IDelta {
    //     return new Delta(source.content.ops)
    // }
}
