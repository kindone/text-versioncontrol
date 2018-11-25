import Op from "quill-delta/dist/Op";
import { sliceOp, sliceOpWithAttributes, opLength } from "./util";

export class DeltaTransformer
{
    private idx = 0
    private offset = 0

    constructor(public ops:Op[], private laterWins:boolean) {}

    public retain(amount:number):Op[] {
        return this.mapCurrent(
            (op, begin, end) => {
                const length = opLength(op)
                end = end ? end : length
                if(op.insert)
                    return [{retain: amount + end-begin}]
                else if(op.retain)
                    return [{retain: amount}]
                else if(op.delete) {
                    if(end - begin < amount)
                        return [{retain: amount-(end - begin)}]
                    else
                        return []
                }
                throw new Error('invalid op')
            },
            amount)
    }

    public attribute(amount:number, attributes:{[name:string]:any}):Op[] {
        return this.mapCurrent(
            (op, begin, end) => {
                const length = opLength(op)
                end = end ? end : length
                if(op.insert)
                    return [{retain: end-begin, attributes}]
                else if(op.retain)
                    return [{retain: end-begin, attributes}]
                else if(op.delete)
                    return [{retain: end-begin, attributes}]

                throw new Error('invalid op')
            },
            amount)
    }

    public delete(amount:number):Op[] {
        return this.mapCurrent(
            (op, begin, end) => {
                const length = opLength(op)
                end = end ? end : length
                if(op.insert)
                    return [{delete: end - begin}]
                else if(op.retain)
                    return [{delete: end - begin}]
                else if(op.delete) {
                     return [{delete: end - begin}]
                }
                throw new Error('invalid op')
            },
            amount)
    }

    // insert/embed consumes nothing, so no need to advance

    public insert(str:string):Op[] {
        if(this.current().insert)
        {
            const currentLength = opLength(this.current())
            this.nextOp()
            if(this.laterWins)
                return [{insert: str}, {retain: currentLength}]
            else
                return [{retain: currentLength}, {insert: str}]
        }
        else {
            this.nextOp()
            return [{insert: str}]
        }
    }

    public insertWithAttribute(str:string, attributes:object):Op[] {

        if(this.current().insert)
        {
            const currentLength = opLength(this.current())
            this.nextOp()
            if(this.laterWins)
                return [{insert: str, attributes}, {retain: currentLength}]
            else
                return [{retain: currentLength}, {insert: str, attributes}]
        }
        else {
            this.nextOp()
            return [{insert: str, attributes}]
        }
    }

    public embed(obj:object):Op[] {
        if(this.current().insert)
        {
            const currentLength = opLength(this.current())
            this.nextOp()
            if(this.laterWins)
                return [{insert: obj}, {retain: currentLength}]
            else
                return [{retain: currentLength}, {insert: obj}]
        }
        else {
            this.nextOp()
            return [{insert: obj}]
        }

    }

    public embedWithAttribute(obj:object, attributes:object):Op[] {
        if(this.current().insert)
        {
            const currentLength = opLength(this.current())
            this.nextOp()
            if(this.laterWins)
                return [{insert: obj, attributes}, {retain: currentLength}]
            else
                return [{retain: currentLength}, {insert: obj, attributes}]
        }
        else {
            this.nextOp()
            return [{insert: obj, attributes}]
        }

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


    private mapCurrent(
        opGen:(op:Op, begin:number, end?:number) => Op[],
        amount:number):Op[]
    {
        let ops:Op[] = []

        do
        {
            // retain (taking fragments) if current fragment is not visible
            if(!this.hasNext() || amount <= 0)
                break

            if(this.current().insert) {
                ops.push({retain: this.currentSize()})
                this.nextOp()
                continue
            }

            // current: visible fragment
            const remaining = this.currentSize() - (this.offset + amount)
            if(remaining > 0) {
                // take some of current and finish
                if(!this.current().delete)
                    ops = ops.concat(opGen(this.current(), this.offset, this.offset+amount))
                this.offset += amount
                return ops
            }
            else if(remaining === 0)
            {
                // take rest of current and finish
                if(!this.current().delete)
                    ops = ops.concat(opGen(this.current(), this.offset))
                this.nextOp()
                return ops
            }
            else { // overwhelms current fragment
                // first take rest of current
                const takeAmount = this.currentSize() - this.offset
                if(!this.current().delete)
                    ops = ops.concat(opGen(this.current(), this.offset))
                // adjust amount
                amount -= takeAmount // > 0 by condition
                this.nextOp()
            }
        } while(amount > 0 && this.hasNext())

        return ops
    }
}