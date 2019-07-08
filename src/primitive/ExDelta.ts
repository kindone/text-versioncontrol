import AttributeMap from 'quill-delta/dist/AttributeMap';
import Op from 'quill-delta/dist/Op';
import { DeltaContext } from './DeltaContext';
import { IDelta } from './IDelta';
import { contentLength, minContentLengthForChange, flattenDeltas, transformDeltas, hasNoEffect, cropContent, normalizeOps } from './util';


export class ExDelta implements IDelta {
    constructor(public ops:Op[] = [], public contexts?:DeltaContext[]) {
    }

    public delete(count:number):ExDelta {
        this.ops.push({delete: count})
        return this
    }

    public retain(count: number, attributes?: AttributeMap):ExDelta {
        if(attributes)
            this.ops.push({retain: count})
        else
            this.ops.push({retain: count, attributes})
        return this
    }

    public insert(content: string | object, attributes?: AttributeMap):ExDelta {
        if(attributes)
            this.ops.push({insert: content, attributes})
        else
            this.ops.push({insert: content})
        return this
    }

    public length():number {
        return minContentLengthForChange(this)
    }

    /* only for content (should have no retains or deletes)*/
    public contentLength():number {
        return contentLength(this)
    }

    public hasNoEffect():boolean {
        return hasNoEffect(this)
    }

    public cropped(start: number, end: number):ExDelta {
        return new ExDelta(cropContent(this, start, end).ops, this.contexts ? this.contexts.concat() : undefined)
    }

    public normalized():ExDelta {
        return new ExDelta(normalizeOps(this.ops), this.contexts ? this.contexts.concat() : undefined)
    }

}