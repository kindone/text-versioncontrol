import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import { DeltaContext } from './DeltaContext'
import { IDelta } from './IDelta'
import {
    contentLength,
    hasNoEffect,
    cropContent,
    normalizeOps,
    deltaLength,
    minContentLengthForChange,
    flattenDeltas,
    transformDeltas,
    invertChange,
} from './primitive'

export class Delta implements IDelta {
    constructor(public ops: Op[] = [], public contexts?: DeltaContext[]) {}

    /* changes the object */
    public delete(count: number): Delta {
        if (count <= 0) return this

        this.ops.push({ delete: count })
        return this
    }

    /* changes the object */
    public retain(count: number): Delta {
        if (count <= 0) return this

        this.ops.push({ retain: count })
        return this
    }

    /* changes the object */
    public insert(content: string | object, attributes?: AttributeMap): Delta {
        if (attributes) this.ops.push({ insert: content, attributes })
        else this.ops.push({ insert: content })
        return this
    }

    public length(): number {
        return deltaLength(this)
    }

    /* only for content (should have no retains or deletes)*/
    public contentLength(): number {
        return contentLength(this)
    }

    public minRequiredBaseContentLength(): number {
        return minContentLengthForChange(this)
    }

    public hasNoEffect(): boolean {
        return hasNoEffect(this)
    }

    public take(start: number, end: number): Delta {
        return new Delta(cropContent(this, start, end).ops, this.contexts ? this.contexts.concat() : undefined)
    }

    public normalize(): Delta {
        return new Delta(normalizeOps(this.ops), this.contexts ? this.contexts.concat() : undefined)
    }

    public compose(other: IDelta): Delta {
        return new Delta(flattenDeltas(this, other).ops)
    }

    public apply(other: IDelta): Delta {
        return this.compose(other)
    }

    public transform(other: IDelta, priority = false): Delta {
        return new Delta(transformDeltas(this, other, priority).ops)
    }

    public invert(baseContent: IDelta): IDelta {
        return new Delta(invertChange(baseContent, this).ops, this.contexts ? this.contexts.concat() : undefined)
    }
}
