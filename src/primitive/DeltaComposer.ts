import Op from "quill-delta/dist/Op";
import { sliceOp, sliceOpWithAttributes, opLength } from "./util";

export class DeltaComposer
{
    private idx = 0
    private offset = 0

    constructor(public ops:Op[]) {}

    public retain(amount:number):Op[] {
        return this.mapCurrent(
            (op, begin, end) => [sliceOp(op, begin, end)],
            amount)
    }

    public attribute(amount:number, attr:{[name:string]:any}):Op[] {
        return this.mapCurrent(
            (op, begin, end) => {
                return [sliceOpWithAttributes(op, attr, begin, end)]
            },
            amount)
    }

    public delete(amount:number):Op[] {
        return this.mapCurrent(
            (op, begin, end) => {
                if(op.insert)
                    return []
                end = end ? end : opLength(op)
                return [{delete: end - begin}]
            },
            amount)
    }

    // insert/embed consumes nothing, so no need to advance

    public insert(str:string):Op[] {
        return [{insert: str}]
    }

    public insertWithAttribute(str:string, attr:object):Op[] {
        return [{insert: str, attributes: attr}]
    }

    public embed(obj:object):Op[] {
        return [{insert: obj}]
    }

    public embedWithAttribute(obj:object, attr:object):Op[] {
        return [{insert:obj, attributes:attr}]
    }

    public current(): Op {
        return this.ops[this.idx]
    }

    public currentSize():number {
        const op = this.ops[this.idx]

        return opLength(op)
    }

    public sliceCurrent(offset:number):Op {
        return sliceOp(this.current(), offset)
    }

    public hasNext(): boolean {
        return this.idx < this.ops.length
    }

    public rest(): Op[] {
        const ops = this.hasNext() ? [this.sliceCurrent(this.offset)] : []
        return ops.concat(this.ops.slice(this.idx+1))
    }

    private nextOp():void {
        this.idx++
        this.offset = 0
    }

    private nextUntilVisible():Op[] {
        const ops:Op[] = []
        while(this.hasNext() && this.current().delete)
        {
            ops.push(this.current())
            this.nextOp()
        }
        return ops
    }


    private mapCurrent<T=undefined>(
        opGen:(op:Op, begin:number, end?:number) => Op[],
        amount:number):Op[]
    {
        let ops:Op[] = []

        do
        {
            // retain (taking fragments) if current fragment is not visible
            ops = ops.concat(this.nextUntilVisible())
            if(!this.hasNext() || amount <= 0)
                break

            // current: visible fragment
            const remaining = this.currentSize() - (this.offset + amount)
            if(remaining > 0) {
                // take some of current and finish
                ops = ops.concat(opGen(this.current(), this.offset, this.offset+amount))
                this.offset += amount
                return ops
            }
            else if(remaining === 0)
            {
                // take rest of current and finish
                ops = ops.concat(opGen(this.current(), this.offset))
                this.nextOp()
                return ops
            }
            else { // overwhelms current fragment
                // first take rest of current
                const takeAmount = this.currentSize() - this.offset

                ops = ops.concat(opGen(this.current(), this.offset))
                // adjust amount
                amount -= takeAmount // > 0 by condition
                this.nextOp()
            }
        } while(amount > 0 && this.hasNext())

        if(amount > 0){
            // pseudo-retain
            ops = ops.concat(opGen({retain: amount}, 0))
        }

        return ops
    }
}