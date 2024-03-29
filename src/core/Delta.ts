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
    constructor(public ops: Op[] = [], public context?: DeltaContext) {}

    static clone(delta:IDelta) {
        return new Delta(delta.ops.concat(), delta.context)
    }

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
        return new Delta(cropContent(this, start, end).ops, this.context)
    }

    public normalize(): Delta {
        return new Delta(normalizeOps(this.ops), this.context)
    }

    public compose(other: IDelta): Delta {
        return new Delta(flattenDeltas(this, other).ops, this.context)
    }

    public apply(other: IDelta): Delta {
        return this.compose(other)
    }

    public transform(other: IDelta, priority = false): Delta {
        return new Delta(transformDeltas(this, other, priority).ops, this.context)
    }

    public invert(baseContent: IDelta): IDelta {
        return new Delta(invertChange(baseContent, this).ops, this.context)
    }
}
