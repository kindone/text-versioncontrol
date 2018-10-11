import Op from "quill-delta/dist/Op"
import { Fragment } from "./Fragment"

// result fragments and transformed ops
export interface OpsWithDiff {
    ops:Op[]
    diff:number
}

export class DeltaIterator
{
    private fragmentIdx = 0
    private offsetAtFragment = 0

    constructor(public readonly branch:string, public fragments:Fragment[]) {}

    public retain(amount:number):OpsWithDiff {
        return this.mapCurrent(
            (amnt) => ({retain: amnt}),
            amount)
    }

    public attribute(amount:number, attr:object):OpsWithDiff {
        return this.mapCurrent(
            (amnt)  => ({retain: amnt, attributes: attr}),
            amount)
    }

    public delete(amount:number):OpsWithDiff {
        return this.mapCurrent(
            (amnt) =>  ({delete: amnt}),
            amount)
    }

    // insert/embed consumes nothing, so no need to advance

    public insert(str:string):Op[] {
        return this.inserted({insert: str})
    }

    public insertWithAttribute(str:string, attr:object):Op[] {
        return this.inserted({insert: str, attributes: attr})
    }

    public embed(obj:object):Op[] {
        return this.inserted({insert: obj})
    }

    public embedWithAttribute(obj:object, attr:object):Op[] {
        return this.inserted({insert:obj, attributes:attr})
    }

    public current(): Fragment {
        return this.fragments[this.fragmentIdx]
    }

    public hasNext(): boolean {
        return this.fragmentIdx < this.fragments.length
    }

    private nextFragment():void {
        this.fragmentIdx++
        this.offsetAtFragment = 0
    }

    private nextUntilVisible():Op[] {
        const ops:Op[] = []
        // deleted by other + deleted by me
        while(this.hasNext() && !this.current().isVisibleTo(this.branch))
        {
            // // already deleted by other (but not own deleted)
            // if(this.current().isDeletedByOther(this.branch) && !this.current().isInserted()) {
            //     deleted += (this.current().size() - this.offsetAtFragment)
            // }
            // inserted by other, retain added
            if(this.current().isInsertedByOther(this.branch)) {
                ops.push({retain: this.current().size() - this.offsetAtFragment})
            }
            // else: deleted by me: do nothing
            // go to next fragment
            this.nextFragment()
        }
        return ops
    }

    private mapCurrent<T=undefined>(
        deltaGen:(amount:number) => Op,
        amount:number, arg?:T):OpsWithDiff
    {
        let ops:Op[] = []

        do
        {
            // retain (taking fragments) if current fragment is not visible
            ops = ops.concat(this.nextUntilVisible())
            if(!this.hasNext() || amount <= 0)
                break

            // current: visible fragment
            const remaining = this.current().size() - (this.offsetAtFragment + amount)
            if(remaining > 0) {
                // take some of current and finish
                if(!this.current().isDeletedByOther(this.branch))
                    ops.push(deltaGen(amount))
                this.offsetAtFragment += amount
                return {ops, diff: 0}
            }
            else if(remaining === 0)
            {
                // take rest of current and finish
                if(!this.current().isDeletedByOther(this.branch))
                    ops.push(deltaGen(this.current().size() - this.offsetAtFragment))
                this.nextFragment()
                return {ops, diff: 0}
            }
            else { // overwhelms current fragment
                // first take rest of current
                const takeAmount = this.current().size() - this.offsetAtFragment
                if(!this.current().isDeletedByOther(this.branch))
                    ops.push(deltaGen(takeAmount))
                // adjust amount
                amount -= takeAmount // > 0 by condition
                this.nextFragment()
            }
        } while(amount > 0 && this.hasNext())

        return {ops, diff: (amount < 0 ? amount : 0)}
    }

    private inserted(op:Op):Op[] {
        const ops = this.nextForInsert()
        return ops.concat(op)
    }

    private nextForInsert():Op[] {
        let retain = 0
        // if it's not visible, should advancefor tiebreak
        while(this.hasNext() && this.current().shouldAdvanceForTiebreak(this.branch))
        {
            retain += (this.current().size() - this.offsetAtFragment)
            this.nextFragment()
        }
        return retain > 0 ? [{retain}] : []
    }
}