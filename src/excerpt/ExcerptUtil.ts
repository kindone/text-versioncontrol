import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import { Change } from '../primitive/Change'
import { ExDelta } from '../primitive/ExDelta'
import { JSONStringify } from '../primitive/util';
import { Excerpt } from './Excerpt';
import { ExcerptMarker } from './ExcerptMarker';
import { ExcerptSource } from './ExcerptSource';
import { ExcerptTarget } from './ExcerptTarget';


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

    public static makeExcerptMarker(markedAt:'left'|'right', sourceUri:string, sourceRev:number, sourceStart:number, sourceEnd:number, targetUri:string, targetRev:number, targetStart:number, targetEnd:number = -1): ExcerptMarker
    {
        // const header = { sourceUri, sourceRev, targetUri, targetRev, length}
        const value = { excerpted: sourceUri + "?rev=" + sourceRev + "&start=" + sourceStart + "&end=" + sourceEnd}

        if(targetEnd < 0)
            targetEnd = targetStart + sourceEnd - sourceStart + 1 // marker itself is included
        const attributes = {markedAt, targetUri, targetRev:targetRev.toString(), targetStart: targetStart.toString(), targetEnd: targetEnd.toString()}

        const op = {insert: value, attributes}

        if(!ExcerptUtil.isExcerptMarker(op))
            throw new Error("error: " + JSONStringify(op))
        return op
    }

    // target ranges: marker itself is included
    public static getPasteWithMarkers(source:ExcerptSource, targetUri:string, targetRev:number, targetStart:number):Change {
        const leftMarkerOp:Op = this.makeExcerptMarker('left', source.uri, source.rev, source.start, source.end, targetUri, targetRev,  targetStart)
        const rightMarkerOp:Op = this.makeExcerptMarker('right', source.uri, source.rev, source.start, source.end, targetUri, targetRev,  targetStart)

        if(!ExcerptUtil.isExcerptMarker(leftMarkerOp))
            throw new Error("Unexpected error. Check marker and checker implementation: " + JSONStringify(leftMarkerOp))
        if(!ExcerptUtil.isExcerptMarker(rightMarkerOp))
            throw new Error("Unexpected error. Check marker and checker implementation: " + JSONStringify(rightMarkerOp))

        const ops:Op[] = [leftMarkerOp].concat(source.content.ops).concat([rightMarkerOp])

        return new Delta(ops)
    }

    public static isExcerptURI(uri:string) {
        const split:string[] = uri.split("?")
        if(split.length !== 2)
            return false

        return /^rev=[0-9]+&start=[0-9]+&end=[0-9]+$/.test(split[1])
    }

    public static isLeftExcerptMarker(op: Op, includeCopied = false):boolean {
        if(!this.isExcerptMarker(op, includeCopied))
            return false

        if(!op.attributes)
            return false

        return (op.attributes.markedAt === 'left')
    }

    public static isRightExcerptMarker(op: Op, includeCopied = false):boolean {
        if(!this.isExcerptMarker(op, includeCopied))
            return false

        if(!op.attributes)
            return false

        return (op.attributes.markedAt === 'right')
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
             && (typeof attributes.targetRev === 'string')
             && (typeof attributes.targetStart === 'string')
             && (typeof attributes.targetEnd === 'string')
             && (typeof attributes.markedAt === 'string')
    }

    public static setExcerptMarkersAsCopied(ops:Op[]):Op[] {
        return ops.map(op => {
            if(ExcerptUtil.isExcerptMarker(op)) {
                return {...op, attributes: {...op.attributes, copied:"true"}}
            }
            else {
                return op
            }
        })
    }

    public static decomposeMarker(op:Op) {
        if(!this.isExcerptMarker(op))
            throw new Error("Given op is not a marker: " + JSONStringify(op))

        const marker:any = op
        const source = marker.insert.excerpted
        const {sourceUri, sourceRev, sourceStart, sourceEnd} = this.splitSource(source)
        const targetUri = marker.attributes.targetUri as string
        const targetRev = Number.parseInt(marker.attributes.targetRev, 10)
        const targetStart = Number.parseInt(marker.attributes.targetStart, 10)
        const targetEnd = Number.parseInt(marker.attributes.targetEnd, 10)

        return new Excerpt({type:'excerpt', uri:sourceUri, rev: sourceRev, start:sourceStart, end:sourceEnd},
             new ExcerptTarget(targetUri, targetRev, targetStart, targetEnd))
    }

    public static splitSource(source:string) {
        if(!ExcerptUtil.isExcerptURI(source))
            throw new Error('unsupported value: ' + source)

        const [sourceUri,rest] = source.split("?")

        const result = /^rev=([0-9]+)&start=([0-9]+)&end=([0-9]+)$/.exec(rest)
        if(!result)
            throw new Error('unsupported value: ' + source)

        const [full, sourceRevStr, sourceStartStr, sourceEndStr] = result
        const sourceRev = Number.parseInt(sourceRevStr, 10)
        const sourceStart = Number.parseInt(sourceStartStr, 10)
        const sourceEnd = Number.parseInt(sourceEndStr, 10)
        return {sourceUri, sourceRev, sourceStart, sourceEnd}
    }
}
