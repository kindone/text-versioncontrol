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
        // const header = { sourceUri, sourceRev, targetUri, targetRev, length}
        const value = { excerpted: sourceUri + "?rev=" + sourceRev }
        const attributes = {targetUri, targetRev, length}
        const op = {insert: value, attributes}

        if(!ExcerptUtil.isExcerptMarker(op))
            throw new Error("error: " + JSONStringify(op))
        return op
    }

    public static getPasteWithMarkers(uri:string, rev:number, offset:number, source:ExcerptSource):Change {
        const markerOp = this.makeExcerptMarker(source.uri, source.rev, uri, rev, contentLength(source.content))
        let ops:Op[] = []
        if(!ExcerptUtil.isExcerptMarker(markerOp))
            throw new Error("Unexpected error. Check marker and checker implementation: " + JSONStringify(markerOp))
        ops.push(markerOp)
        // const safeSourceOps = ExcerptUtil.setExcerptMarkersAsCopied(source.content.ops)
        ops = ops.concat(source.content.ops)
        return new Delta(ops)
    }

    public static isExcerptURI(uri:string) {
        const split:string[] = uri.split("?")
        if(split.length !== 2)
            return false

        return /^rev=[0-9]+$/.test(split[1])
    }

    public static isExcerptMarker(op:Op, includeCopied = false):boolean {
        if(!op.insert || (typeof op.insert !== 'object'))
            return false

        const insert:any = op.insert
        const attributes:any = op.attributes

        if(!insert.hasOwnProperty('excerpted') || !attributes || typeof insert.excerpted !== 'string')
            return false
        // filter out copied
        if(!includeCopied && attributes.hasOwnProperty('copied'))
            return false

        if(!ExcerptUtil.isExcerptURI(insert.excerpted))
            return false

        return (typeof attributes.targetUri === 'string')
             && (typeof attributes.targetRev === 'number')
             && (typeof attributes.length === 'number')
    }

    public static setExcerptMarkersAsCopied(ops:Op[]):Op[] {
        return ops.map(op => {
            if(ExcerptUtil.isExcerptMarker(op)) {
                return {...op, attributes: {...op.attributes, copied:true}}
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
