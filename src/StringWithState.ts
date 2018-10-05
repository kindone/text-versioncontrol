import * as _ from 'underscore'
import { CharsWithState } from './CharsWithState'
import { CharWithState } from './CharWithState'
import { Operation } from './Operation'


export class StringWithState {
    private static charsInsertedByBranch(branch: string, content: string) {
        const chars: CharWithState[] = []

        for (const c of content) {
            chars.push(new CharWithState(c, branch))
        }

        return new CharsWithState(chars)
    }

    public chars: CharsWithState

    constructor(str: string) {
        this.chars = CharsWithState.fromString(str)
    }

    public branchPosToCharsPos(pos: number, branch: string) {
        for (let i = 0, iBranch = 0; i < this.chars.length; ) {
            if (iBranch === pos) return i

            if (this.chars.isVisibleTo(i, branch)) iBranch++

            i++
        }

        // assert: somethings wrong if iBranch < from
        return this.chars.length
    }

    public findTiebreakIdxInChars(start: number, branch: string) {
        for (let i = start; i < this.chars.length; i++) {
            if (!this.chars.shouldAdvanceForTiebreak(i, branch)) return i
        }
        return this.chars.length
    }

    public markDeletedBy(branch: string, from: number, numDeleted: number, content: string) {
        const fromVisible = this.chars.visiblePosOf(from)

        let iVisible = fromVisible
        const insertOp = new Operation(fromVisible, 0, content)

        const deletedIdxs: number[] = []
        let numMarkDeleted = 0

        for (let i = from; i < this.chars.length && numMarkDeleted < numDeleted; i++) {
            const wasVisible = this.chars.isVisible(i)

            if (this.chars.isVisibleTo(i, branch)) {
                this.chars.setDeletedBy(i, branch)
                numMarkDeleted++
            }

            if (wasVisible) {
                // changed
                if (!this.chars.isVisible(i)) deletedIdxs.push(iVisible)
                iVisible++
            }
        }

        const deletes: number[][] = []
        let acc: number[] = []
        _.each(deletedIdxs, idx => {
            if (acc.length > 0 && acc[acc.length - 1] === idx - 1) acc.push(idx)
            else {
                acc = [idx]
                deletes.push(acc)
            }
        })

        let shift = 0
        const delOps = _.map(deletes, del => {
            const op = new Operation(del[0] - shift, del.length, '')
            shift += del.length
            return op
        }).concat(insertOp)

        return delOps
    }

    public apply(op: Operation, branch: string, debug = false) {
        const from = this.branchPosToCharsPos(op.from, branch)
        const fromTiebreak = this.findTiebreakIdxInChars(from, branch)

        const prefix = this.chars.slice(0, fromTiebreak)
        const suffix = this.chars.slice(fromTiebreak)

        const newOps = this.markDeletedBy(branch, fromTiebreak, op.numDeleted, op.content)
        const insertedChars = StringWithState.charsInsertedByBranch(branch, op.content)

        // if (debug) console.log('prefix:', prefix, from, fromTiebreak, insertedChars, suffix)

        // result
        this.chars = prefix.concat(insertedChars).concat(suffix)

        return newOps
    }

    public clone() {
        const ss =  new StringWithState('')
        ss.chars = this.chars.clone()
        return ss
    }

    public equals(ss: StringWithState) {
        return this.chars.equals(ss.chars)
    }

    public toText() {
        return this.chars.toText()
    }

    public toHtml() {
        return this.chars.toHtml()
    }

    public toString() {
        // console.log(this.chars)
        return this.chars
    }



}
