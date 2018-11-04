import Delta = require("quill-delta")
import Op from "quill-delta/dist/Op"
import { normalizeOps, normalizeDeltas} from '../util'
import { IDelta } from "./IDelta"


export interface RangedTransforms {
    range:Range
    deltas:IDelta[]
}

export class Range
{
    constructor(public readonly start:number, public readonly end:number)
    {
    }

    public applyChanges(deltas:IDelta[]):Range {
        let range:Range = this
        for(const delta of deltas) {
            range = range.applyChange(delta)
        }
        return range
    }

    public applyChange(delta:IDelta):Range {
        let cursor = 0
        let start = this.start
        let end = this.end

        for(const op of delta.ops)
        {
            const tmpStart = start
            // console.log('  op:', op, 'cursor:', cursor, 'start:', start, 'end:', end)
            if(op.retain)
            {
                cursor += op.retain
            }
            else if(typeof op.insert === 'string')
            {
                const amount = op.insert.toString().length

                if(cursor <= start) {
                    start += amount
                }
                end += amount
                cursor += amount

            }
            else if(op.insert)
            {
                if(cursor <= start) {
                    start += 1
                }
                end += 1
                cursor += 1
            }
            else if(op.delete)
            {
                if(cursor <= start)
                    start = Math.max(cursor, start - op.delete)

                end = Math.max(cursor, end - op.delete)
            }

            if(cursor >= end) // 'cursor > end' for same effect as transformPosition(end)
                break
        }
        return new Range(start, end)
    }

    public cropChanges(deltas:IDelta[]):IDelta[]
    {
        let range:Range = this
        const newDeltas:IDelta[] = []
        for(const delta of deltas)
        {
            const newDelta = range.cropChange(delta)
            range = range.applyChange(delta)
            newDeltas.push(newDelta)
        }

        return normalizeDeltas(newDeltas)
    }

    public cropChange(delta:IDelta):IDelta
    {
        let cursor = 0
        let start = this.start
        let end = this.end
        const ops:Op[] = []

        for(const op of delta.ops)
        {
            if(op.retain)
            {
                const left = Math.max(cursor, start)
                const right = cursor + op.retain
                if(right > left) {
                    ops.push({retain: right-left})
                }

                cursor += op.retain
            }
            else if(typeof op.insert === 'string')
            {
                const amount = op.insert.toString().length
                if(cursor <= start) {
                    start += amount
                }
                else
                    ops.push({insert:op.insert})
                end += amount
                cursor += amount
            }
            else if(op.insert)
            {
                if(cursor <= start) {
                    start += 1
                    ops.push({insert:op.insert})
                }
                start += 1
                cursor += 1
            }
            else if(op.delete)
            {
                const left = Math.max(cursor, start)
                const right = Math.min(cursor + op.delete, end)
                if(right > left)
                    ops.push({delete: right-left})

                if(cursor <= start)
                    start = Math.max(cursor, start - op.delete)

                end = Math.max(cursor, end - op.delete)
            }

            if(cursor > end)
                break
        }

        return new Delta(normalizeOps(ops))
    }

}