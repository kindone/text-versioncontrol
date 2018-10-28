import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'

export class Operation {
    public readonly from: number
    public readonly numDeleted: number
    public readonly content: string

    constructor(from: number, numDeleted: number, content: string) {
        this.from = from
        this.numDeleted = numDeleted
        this.content = content
    }

    public toDelta() {
        const ops:Op[] = []
        if(this.from > 0) {
            ops.push( {retain: this.from})
        }

        if(this.numDeleted > 0) {
            ops.push( {delete: this.numDeleted})
        }

        if(this.content.length > 0) {
            ops.push({insert: this.content})
        }

        return new Delta(ops)
    }
}
