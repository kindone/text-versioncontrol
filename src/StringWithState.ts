import * as _ from 'underscore'
import { CharWithState } from './CharWithState'
import { Operation } from './Operation'

export class StringWithState {
    private static charsInsertedByBranch(branch: string, content: string) {
        const chars: CharWithState[] = []

        for (const c of content) {
            chars.push(new CharWithState(c, branch))
        }

        return chars
    }

    public chars: CharWithState[] = []

    constructor(str: string) {
        for (let i = 0; i < str.length; i++) this.chars.push(new CharWithState(str.charAt(i)))
    }

    public branchPosToCharsPos(pos: number, branch: string) {
        for (let i = 0, iBranch = 0; i < this.chars.length; ) {
            if (iBranch === pos) return i

            if (this.chars[i].isVisibleTo(branch)) iBranch++

            i++
        }

        // assert: somethings wrong if iBranch < from
        return this.chars.length
    }

    public findTiebreakIdxInChars(start: number, branch: string) {
        for (let i = start; i < this.chars.length; i++) {
            if (!this.chars[i].shouldAdvanceForTiebreak(branch)) return i
        }
        return this.chars.length
    }

    public markDeletedBy(branch: string, from: number, numDeleted: number, content: string) {
        const fromVisible = _.reduce(
            this.chars.slice(0, from),
            (sum, char) => {
                return char.isVisible() ? sum + 1 : sum
            },
            0,
        )

        let iVisible = fromVisible
        const insertOp = new Operation(fromVisible, 0, content)

        const deletedIdxs: number[] = []
        let numMarkDeleted = 0

        for (let i = from; i < this.chars.length && numMarkDeleted < numDeleted; i++) {
            const char = this.chars[i]
            const wasVisible = char.isVisible()

            if (char.isVisibleTo(branch)) {
                char.setDeletedBy(branch)
                numMarkDeleted++
            }

            if (wasVisible) {
                // changed
                if (!char.isVisible()) deletedIdxs.push(iVisible)
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
        const ss = new StringWithState('')
        for (const cs of this.chars) {
            const char = new CharWithState(cs.val, cs.insertedBy, cs.deletedBy.slice(0))
            ss.chars.push(char)
        }
        return ss
    }

    public equals(ss: StringWithState) {
        if (this.chars.length !== ss.chars.length) return false
        for (let i = 0; i < this.chars.length; i++) {
            if (!ss.chars[i].equals(this.chars[i])) return false
        }
        return true
    }

    public toText() {
        let text = ''
        for (const char of this.chars) {
            if (!char.isDeleted()) text += char.val
        }
        return text
    }

    public toHtml() {
        let html = ''
        let prevclassesstr = ''
        for (const cs of this.chars) {
            const classes: string[] = []
            const branches: { [id in string]: boolean } = {}
            if (cs.isDeleted()) {
                classes.push('deleted')
                for (const key of cs.deletedBy) {
                    branches[key] = true
                }
            }
            if (cs.insertedBy) {
                classes.push('inserted')
                branches[cs.insertedBy] = true
            }
            Object.keys(branches).forEach(branch => {
                classes.push(`b${branch}`)
            })

            if (classes.length > 0) {
                const classesstr = classes.join(' ')
                if (classesstr === prevclassesstr) {
                    html += cs.val
                } else {
                    if (prevclassesstr !== '') html += '</span>'
                    html += `<span class='${classesstr}'>${cs.val}`
                }

                prevclassesstr = classesstr
            } else {
                if (prevclassesstr !== '') html += '</span>'
                html += cs.val
                prevclassesstr = ''
            }
        }

        if (prevclassesstr !== '') html += '</span>'

        return html
    }

    public toString() {
        // console.log(this.chars)
        return this.chars
    }



}
