import Op from "quill-delta/dist/Op"
import { Fragment } from "./Fragment"

// result fragments and transformed ops
export interface IResult {
    fragments:Fragment[]
    ops:Op[]
    diff:number
}

export class FragmentIterator
{
    private fragmentIdx = 0
    private offsetAtFragment = 0

    constructor(public readonly branch:string, public fragments:Fragment[]) {}

    public current(): Fragment {
        return this.fragments[this.fragmentIdx]
    }

    public hasNext(): boolean {
        return this.fragmentIdx < this.fragments.length
    }

    public nextPeek(): Fragment {
        return this.fragments[this.fragmentIdx+1]
    }

    public rest(): Fragment[] {
        const fragments = this.hasNext() ? [this.current().slice(this.offsetAtFragment)] : []
        return fragments.concat(this.fragments.slice(this.fragmentIdx+1))
    }

    public retain(amount:number):IResult {
        return this.mapCurrent(
            (fragment, unused, begin, end) => fragment.slice(begin,end),
            (amnt) => ({retain: amnt}),
            amount)
    }

    public attribute(amount:number, attr:object):IResult {
        return this.mapCurrent(
            (fragment, unused, begin, end) => fragment.sliceWithAttribute(attr, this.branch, begin, end),
            (amnt)  => ({retain: amnt, attributes: attr}),
            amount)
    }

    public delete(amount:number):IResult {
        return this.mapCurrent(
            (fragment, unused, begin, end) => fragment.sliceWithDelete(this.branch, begin, end),
            (amnt) =>  ({delete: amnt}),
            amount)
    }

    // insert/embed consumes nothing, so no need to advance

    public insert(str:string):IResult {
        return this.inserted(Fragment.insert(str, this.branch))
    }

    public insertWithAttribute(str:string, attr:object):IResult {
        return this.inserted(Fragment.insertWithAttribute(str, attr, this.branch))
    }

    public embed(obj:object):IResult {
        return this.inserted(Fragment.embed(obj, this.branch))
    }

    public embedWithAttribute(obj:object, attr:object):IResult {
        return this.inserted(Fragment.embedWithAttribute(obj, attr, this.branch))
    }

    private nextFragment():void {
        this.fragmentIdx++
        this.offsetAtFragment = 0
    }

    private nextVisible():IResult {
        const fragments:Fragment[] = []
        let diff = 0

        while(this.hasNext() && !this.current().isVisibleTo(this.branch))
        {
            // take rest of current fragment
            fragments.push(this.current().slice(this.offsetAtFragment))

            // inserted by other, diff should be added
            if(this.current().isInsertedByOther(this.branch)) {
                if(!this.current().isDeleted()) {
                    diff += (this.current().size() - this.offsetAtFragment)
                }
            } // deleted by other
            else if(this.current().isDeletedByOther(this.branch)) {
                diff -= (this.current().size() - this.offsetAtFragment)
            }
            // go to next fragment
            this.nextFragment()
        }

        if(diff > 0)
            return {fragments, ops: [{retain: diff}], diff: 0}
        else
            return {fragments, ops:[], diff}
    }

    private mapCurrent<T=undefined>(
        fragmentGen:(fragment:Fragment, arg:T|undefined, begin:number, end?:number) => Fragment,
        opGen: (amount:number) => Op, amount:number, arg?:T):IResult {
        let fragments:Fragment[] = []
        let ops:Op[] = []
        let diff = 0

        if(this.hasNext() && !this.current().isVisibleTo(this.branch)) {
            const advresult = this.nextVisible()
            fragments = fragments.concat(advresult.fragments)
            ops = ops.concat(advresult.ops)
            diff += advresult.diff
            amount += diff
        }

        while(amount > 0 && this.hasNext()) {
            const remaining = this.current().size() - (this.offsetAtFragment + amount)
            if(remaining > 0) {
                // take some of current and finish
                fragments.push(fragmentGen(this.current(), arg, this.offsetAtFragment, this.offsetAtFragment+amount))
                ops.push(opGen(amount))
                this.offsetAtFragment += amount
                return {fragments, ops, diff}
            }
            else if(remaining === 0)
            {
                // take rest of current and finish
                fragments.push(fragmentGen(this.current(), arg, this.offsetAtFragment))
                ops.push(opGen(amount))
                this.nextFragment()
                return {fragments, ops, diff}
            }
            else { // overwhelms current fragment
                // first take rest of current
                fragments.push(fragmentGen(this.current(), arg, this.offsetAtFragment))
                ops.push(opGen(this.current().size() - this.offsetAtFragment))
                // adjust amount
                amount -= (this.current().size() - this.offsetAtFragment)
                this.nextFragment()
                const advresult = this.nextVisible()
                fragments = fragments.concat(advresult.fragments)
                ops = ops.concat(advresult.ops)
                diff += advresult.diff
                amount += diff
            }
        }

        return {fragments, ops, diff}
    }

    private inserted(fragment:Fragment):IResult {
        const insertOps = [fragment.toOp()]
        if(this.hasNext() && this.current().isVisibleTo(this.branch)) {
            // take current and done, happy
            return {fragments: [fragment], ops: insertOps, diff: 0}
        }
        else {
            // find fragment position with tiebreak
            const {fragments, ops, diff} = this.nextForInsert()
            return {fragments: fragments.concat(fragment), ops: insertOps.concat(ops), diff}
        }
    }

    private nextForInsert():IResult {
        const fragments:Fragment[] = []
        let diff = 0
        // if it's not visible, should advancefor tiebreak
        while(this.hasNext() && this.current().shouldAdvanceForTiebreak(this.branch))
        {
            fragments.push(this.current().slice(this.offsetAtFragment))
            diff += this.current().size()
            this.nextFragment()
        }
        const ops:Op[] = diff > 0 ? [{retain: diff}] : []
        return {fragments, ops, diff: 0}
    }
}