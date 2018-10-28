import AttributeMap from "quill-delta/dist/AttributeMap"
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { AttributeFragment, Fragment } from "./Fragment"

// result fragments and transformed ops
export interface OpsWithDiff {
    ops:Op[]
    diff:number
}

function shadowedAttributes(base: AttributeMap, mod: {[branch: string]: AttributeMap}, branches:string[])
{
    const projected:AttributeMap = {...base}
    for(const branch of branches.sort())
    {
        const branchMod = mod[branch]
        for(const field of Object.keys(branchMod))
            projected[field] = branchMod[field]
    }
    return projected
}

function calculateAttributeDelta(attr:AttributeMap, branch:string, attrFragment?:AttributeFragment):AttributeMap | undefined
{
    if(!attrFragment)
        return attr

    const attrDelta:AttributeMap = {}

    // filtered by branches with higher priority
    let shadowed:AttributeMap = {}
    let compared:AttributeMap = {}
    if(attrFragment.mod) {
        const groups:{[higher:string]:string[]} = _.groupBy(Object.keys(attrFragment.mod), (br) => {
            return br > branch ? 'T' : 'F'
        })
        const higherBranches:string[] = groups.T ? groups.T : []
        const lowerBranches:string[] = groups.F ? groups.F : []
        shadowed = shadowedAttributes({}, attrFragment.mod, higherBranches)
        compared = shadowedAttributes(attrFragment.val ? attrFragment.val : {}, attrFragment.mod, lowerBranches)
    }

    for(const field of Object.keys(attr)) {
        // 1. check if the field is not shadowed by branch with higher priority
        // 1. check if the field is different from mods by a branch with lower and equal priority

        const valField = attrFragment.val ? attrFragment.val[field] : undefined

        if(!shadowed.hasOwnProperty(field) && (!compared.hasOwnProperty(field) || compared[field] !== attr[field]))
            attrDelta[field] = attr[field]
    }

    return _.isEmpty(attrDelta) ? undefined : attrDelta
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
        // priority of attribute setting by branch name
        return this.mapCurrent(
            (amnt, attrFragment)  => {
                const attrDelta = calculateAttributeDelta(attr, this.branch, attrFragment)
                return attrDelta ? {retain: amnt, attributes: attrDelta} : {retain: amnt}
            },
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
            // inserted by other, retain added
            if(this.current().isInsertedByOther(this.branch) && !this.current().isDeleted()) {
                ops.push({retain: this.current().size() - this.offsetAtFragment})
            }
            // else: deleted by me: do nothing
            // go to next fragment
            this.nextFragment()
        }
        return ops
    }

    private mapCurrent<T=undefined>(
        opGen:(amount:number, attrFragment?:AttributeFragment) => Op,
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
                    ops.push(opGen(amount, this.current().attrs))
                this.offsetAtFragment += amount
                return {ops, diff: 0}
            }
            else if(remaining === 0)
            {
                // take rest of current and finish
                if(!this.current().isDeletedByOther(this.branch))
                    ops.push(opGen(this.current().size() - this.offsetAtFragment, this.current().attrs))
                this.nextFragment()
                return {ops, diff: 0}
            }
            else { // overwhelms current fragment
                // first take rest of current
                const takeAmount = this.current().size() - this.offsetAtFragment
                if(!this.current().isDeletedByOther(this.branch))
                    ops.push(opGen(takeAmount, this.current().attrs))
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
            if(!this.current().isDeleted())
                retain += (this.current().size() - this.offsetAtFragment)
            this.nextFragment()
        }
        return retain > 0 ? [{retain}] : []
    }
}
