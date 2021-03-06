import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { AttributeFragment, Fragment } from './Fragment'

// result fragments and transformed ops
interface OpsWithDiff {
    ops: Op[]
    diff: number
}

export class DeltaIterator {
    private fragmentIdx = 0
    private offsetAtFragment = 0

    constructor(public readonly branch: string, public fragments: Fragment[]) {}

    public retain(amount: number): OpsWithDiff {
        return this.mapCurrent(amnt => ({ retain: amnt }), amount)
    }

    public delete(amount: number): OpsWithDiff {
        return this.mapCurrent(amnt => ({ delete: amnt }), amount)
    }

    // insert/embed consumes nothing, so no need to advance

    public insert(str: string): Op[] {
        return this.inserted({ insert: str })
    }

    public insertWithAttribute(str: string, attr: object): Op[] {
        return this.inserted({ insert: str, attributes: attr })
    }

    public embed(obj: object): Op[] {
        return this.inserted({ insert: obj })
    }

    public embedWithAttribute(obj: object, attr: object): Op[] {
        return this.inserted({ insert: obj, attributes: attr })
    }

    public current(): Fragment {
        return this.fragments[this.fragmentIdx]
    }

    public hasNext(): boolean {
        return this.fragmentIdx < this.fragments.length
    }

    private nextFragment(): void {
        this.fragmentIdx++
        this.offsetAtFragment = 0
    }

    private nextUntilVisible(): Op[] {
        const ops: Op[] = []
        // deleted by other + deleted by me
        while (this.hasNext() && !this.current().isVisibleTo(this.branch)) {
            // inserted by other, retain added
            if (this.current().isInsertedByNonWildcardOther(this.branch) && !this.current().isDeleted()) {
                ops.push({ retain: this.current().size() - this.offsetAtFragment })
            }
            // else: deleted by me: do nothing
            // go to next fragment
            this.nextFragment()
        }
        return ops
    }

    private mapCurrent(opGen: (amount: number, attrFragment?: AttributeFragment) => Op, amount: number): OpsWithDiff {
        let ops: Op[] = []

        do {
            // retain (taking fragments) if current fragment is not visible
            ops = ops.concat(this.nextUntilVisible())
            if (!this.hasNext() || amount <= 0) break

            // current: visible fragment
            const remaining = this.current().size() - (this.offsetAtFragment + amount)
            if (remaining > 0) {
                // take some of current and finish
                if (!this.current().isDeletedByNonWildcardOther(this.branch)) {
                    ops.push(opGen(amount, this.current().attrs))
                }
                this.offsetAtFragment += amount
                return { ops, diff: 0 }
            } else if (remaining === 0) {
                // take rest of current and finish
                if (!this.current().isDeletedByNonWildcardOther(this.branch)) {
                    ops.push(opGen(this.current().size() - this.offsetAtFragment, this.current().attrs))
                }
                this.nextFragment()
                return { ops, diff: 0 }
            } else {
                // overwhelms current fragment
                // first take rest of current
                const takeAmount = this.current().size() - this.offsetAtFragment
                if (!this.current().isDeletedByNonWildcardOther(this.branch)) {
                    ops.push(opGen(takeAmount, this.current().attrs))
                }
                // adjust amount
                amount -= takeAmount // > 0 by condition
                this.nextFragment()
            }
        } while (amount > 0 && this.hasNext())

        return { ops, diff: amount < 0 ? amount : 0 }
    }

    private inserted(op: Op): Op[] {
        const ops = this.nextForInsert()
        return ops.concat(op)
    }

    private nextForInsert(): Op[] {
        let retain = 0
        // if it's not visible, should advancefor tiebreak
        while (this.hasNext() && this.current().shouldAdvanceForTiebreak(this.branch)) {
            if (!this.current().isDeleted()) {
                retain += this.current().size() - this.offsetAtFragment
            }
            this.nextFragment()
        }
        return retain > 0 ? [{ retain }] : []
    }
}
