import AttributeMap from 'quill-delta/dist/AttributeMap';
import Op from 'quill-delta/dist/Op';
import { DeltaContext } from './DeltaContext';
import { IDelta } from './IDelta';
import { contentLength, hasNoEffect, cropContent, normalizeOps, deltaLength, minContentLengthForChange, flattenDeltas, transformDeltas } from './util';


export class Delta implements IDelta {
    constructor(public ops:Op[] = [], public contexts?:DeltaContext[]) {
    }

    /* changes the object */
    public delete(count:number):Delta {
        if(count <= 0)
            return this

        this.ops.push({delete: count})
        return this
    }

    /* changes the object */
    public retain(count: number, attributes?: AttributeMap):Delta {
        if(count <= 0)
            return this

        if(attributes)
            this.ops.push({retain: count, attributes})
        else
            this.ops.push({retain: count})
        return this
    }

    /* changes the object */
    public insert(content: string | object, attributes?: AttributeMap):Delta {
        if(attributes)
            this.ops.push({insert: content, attributes})
        else
            this.ops.push({insert: content})
        return this
    }

    public compose(other:IDelta):Delta {
        return new Delta(flattenDeltas(this, other).ops)
    }

    public transform(other:IDelta, priority = false):Delta {
        return new Delta(transformDeltas(this, other, priority).ops)
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

    public cropped(start: number, end: number):Delta {
        return new Delta(cropContent(this, start, end).ops, this.contexts ? this.contexts.concat() : undefined)
    }

    public normalized():Delta {
        return new Delta(normalizeOps(this.ops), this.contexts ? this.contexts.concat() : undefined)
    }

}