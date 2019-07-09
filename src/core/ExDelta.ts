import AttributeMap from 'quill-delta/dist/AttributeMap';
import Op from 'quill-delta/dist/Op';
import { DeltaContext } from './DeltaContext';
import { IDelta } from './IDelta';
import { contentLength, hasNoEffect, cropContent, normalizeOps, deltaLength, minContentLengthForChange, flattenDeltas, transformDeltas } from './util';


export class ExDelta implements IDelta {
    constructor(public ops:Op[] = [], public contexts?:DeltaContext[]) {
    }

    /* changes the object */
    public delete(count:number):ExDelta {
        if(count <= 0)
            return this

        this.ops.push({delete: count})
        return this
    }

    /* changes the object */
    public retain(count: number, attributes?: AttributeMap):ExDelta {
        if(count <= 0)
            return this

        if(attributes)
            this.ops.push({retain: count, attributes})
        else
            this.ops.push({retain: count})
        return this
    }

    /* changes the object */
    public insert(content: string | object, attributes?: AttributeMap):ExDelta {
        if(attributes)
            this.ops.push({insert: content, attributes})
        else
            this.ops.push({insert: content})
        return this
    }

    public compose(other:IDelta):ExDelta {
        return new ExDelta(flattenDeltas(this, other).ops)
    }

    public transform(other:IDelta, priority = false):ExDelta {
        return new ExDelta(transformDeltas(this, other, priority).ops)
    }

    public length():number {
        return deltaLength(this)
    }

    /* only for content (should have no retains or deletes)*/
    public contentLength():number {
        return contentLength(this)
    }

    public minRequiredBaseContentLength():number {
        return minContentLengthForChange(this)
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