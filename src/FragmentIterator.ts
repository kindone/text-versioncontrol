import Op from "quill-delta/dist/Op"
import { Fragment } from "./Fragment"

// result fragments and transformed ops
export interface IResult {
    fragments:Fragment[]
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

    public retain(amount:number):Fragment[] {
        return this.mapCurrent(
            (fragment, unused, begin, end) => fragment.slice(begin,end),
            amount)
    }

    public attribute(amount:number, attr:{[name:string]:any}):Fragment[] {
        return this.mapCurrent(
            (fragment, unused, begin, end) => fragment.sliceWithAttribute(attr, this.branch, begin, end),
            amount)
    }

    public delete(amount:number):Fragment[] {
        return this.mapCurrent(
            (fragment, unused, begin, end) => fragment.sliceWithDelete(this.branch, begin, end),
            amount)
    }

    // insert/embed consumes nothing, so no need to advance

    public insert(str:string):Fragment[] {
        return this.inserted(Fragment.insert(str, this.branch))
    }

    public insertWithAttribute(str:string, attr:{[name:string]:object}):Fragment[] {
        return this.inserted(Fragment.insertWithAttribute(str, attr, this.branch))
    }

    public embed(obj:object):Fragment[] {
        return this.inserted(Fragment.embed(obj, this.branch))
    }

    public embedWithAttribute(obj:object, attr:{[name:string]:object}):Fragment[] {
        return this.inserted(Fragment.embedWithAttribute(obj, attr, this.branch))
    }

    private nextFragment():void {
        this.fragmentIdx++
        this.offsetAtFragment = 0
    }

    private nextUntilVisible():Fragment[] {
        const fragments:Fragment[] = []

        while(this.hasNext() && !this.current().isVisibleTo(this.branch))
        {
            // take rest of current fragment
            fragments.push(this.current().slice(this.offsetAtFragment))
            // go to next fragment
            this.nextFragment()
        }

        return fragments
    }

    private mapCurrent<T=undefined>(
        fragmentGen:(fragment:Fragment, arg:T|undefined, begin:number, end?:number) => Fragment,
        amount:number, arg?:T):Fragment[]
    {
        let fragments:Fragment[] = []

        do
        {
            // skip (taking fragments) if current fragment is not visible
            fragments = fragments.concat(this.nextUntilVisible())
            if(!this.hasNext())
                break

            // current: visible fragment
            const remaining = this.current().size() - (this.offsetAtFragment + amount)
            if(remaining > 0) {
                // take some of current and finish
                fragments.push(fragmentGen(this.current(), arg, this.offsetAtFragment, this.offsetAtFragment+amount))
                this.offsetAtFragment += amount
                return fragments
            }
            else if(remaining === 0)
            {
                // take rest of current and finish
                fragments.push(fragmentGen(this.current(), arg, this.offsetAtFragment))
                this.nextFragment()
                return  fragments
            }
            else { // overwhelms current fragment
                // first take rest of current
                fragments.push(fragmentGen(this.current(), arg, this.offsetAtFragment))

                // adjust amount
                amount -= (this.current().size() - this.offsetAtFragment)
                this.nextFragment()
            }

        } while(amount > 0 && this.hasNext())

        return fragments
    }

    private inserted(fragment:Fragment):Fragment[] {
        if(this.hasNext() && this.current().isVisibleTo(this.branch)) {
            // take current and done, happy
            return [fragment]
        }
        else {
            // find fragment position with tiebreak
            const fragments = this.nextForInsert()
            return fragments.concat(fragment)
        }
    }

    private nextForInsert():Fragment[] {
        const fragments:Fragment[] = []
        // if it's not visible, should advancefor tiebreak
        while(this.hasNext() && this.current().shouldAdvanceForTiebreak(this.branch))
        {
            fragments.push(this.current().slice(this.offsetAtFragment))
            this.nextFragment()
        }
        return fragments
    }
}