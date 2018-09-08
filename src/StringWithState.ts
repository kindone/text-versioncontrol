import { CharWithState } from './CharWithState'
import { Operation } from './Operation'
import * as _ from 'underscore'

class Util {
    static charsInsertedByBranch(branch: string, content: string) {
        let chars: CharWithState[] = []

        for (let i = 0; i < content.length; i++) {
            chars.push(new CharWithState(content[i], branch))
        }

        return chars
    }
}

export class StringWithState {
    chars: CharWithState[] = []

    constructor(str: string) {
        for (let i = 0; i < str.length; i++) this.chars.push(new CharWithState(str.charAt(i)))
    }

    branchPosToCharsPos(pos: number, branch: string) {
        for (let i = 0, iBranch = 0; i < this.chars.length; ) {
            if (iBranch == pos) return i

            if (this.chars[i].isVisibleTo(branch)) iBranch++

            i++
        }

        //assert: somethings wrong if iBranch < from
        return this.chars.length
    }

    findTiebreakIdxInChars(start: number, branch: string) {
        for (let i = start; i < this.chars.length; i++) {
            if (!this.chars[i].shouldAdvanceForTiebreak(branch)) return i
        }
        return this.chars.length
    }

    markDeletedBy(branch: string, from: number, numDeleted: number, content: string) {
        const from_visible = _.reduce(
            this.chars.slice(0, from),
            (sum, char) => {
                return char.isVisible() ? sum + 1 : sum
            },
            0,
        )

        let i_visible = from_visible
        const insert_op = new Operation(from_visible, 0, content)

        let deleted_idxs: number[] = []
        let numMarkDeleted = 0

        for (let i = from; i < this.chars.length && numMarkDeleted < numDeleted; i++) {
            const char = this.chars[i]
            const was_visible = char.isVisible()

            if (char.isVisibleTo(branch)) {
                char.setDeletedBy(branch)
                numMarkDeleted++
            }

            if (was_visible) {
                // changed
                if (!char.isVisible()) deleted_idxs.push(i_visible)
                i_visible++
            }
        }

        let deletes: number[][] = []
        let acc: number[] = []
        _.each(deleted_idxs, idx => {
            if (acc.length > 0 && acc[acc.length - 1] == idx - 1) acc.push(idx)
            else {
                acc = [idx]
                deletes.push(acc)
            }
        })

        let shift = 0
        const del_ops = _.map(deletes, del => {
            const op = new Operation(del[0] - shift, del.length, '')
            shift += del.length
            return op
        }).concat(insert_op)

        return del_ops
    }

    apply(op: Operation, branch: string, debug = false) {
        const from = this.branchPosToCharsPos(op.from, branch)
        const from_tiebreak = this.findTiebreakIdxInChars(from, branch)

        let prefix = this.chars.slice(0, from_tiebreak)
        let suffix = this.chars.slice(from_tiebreak)

        const new_ops = this.markDeletedBy(branch, from_tiebreak, op.numDeleted, op.content)
        let inserted_chars = Util.charsInsertedByBranch(branch, op.content)

        if (debug) console.log('prefix:', prefix, from, from_tiebreak, inserted_chars, suffix)

        // result
        this.chars = prefix.concat(inserted_chars).concat(suffix)

        return new_ops
    }

    clone() {
        let ss = new StringWithState('')
        for (let i = 0; i < this.chars.length; i++) {
            let char = new CharWithState(this.chars[i].val, this.chars[i].insertedBy)
            char.deletedBy = this.chars[i].deletedBy.slice(0)
            ss.chars.push(char)
        }
        if (!ss.equals(this)) throw 'error'
        return ss
    }

    equals(ss: StringWithState) {
        if (this.chars.length != ss.chars.length) return false
        for (let i = 0; i < this.chars.length; i++) {
            if (!ss.chars[i].equals(this.chars[i])) return false
        }
        return true
    }

    toText() {
        let text = ''
        for (let i = 0; i < this.chars.length; i++) {
            if (this.chars[i].deletedBy.length == 0) text += this.chars[i].val
        }
        return text
    }

    toHtml() {
        let html = ''
        let prevclassesstr = ''
        for (let i = 0; i < this.chars.length; i++) {
            const cs = this.chars[i]
            let classes: string[] = []
            let branches: { [id in string]: boolean } = {}
            if (cs.deletedBy.length > 0) {
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
                if (classesstr == prevclassesstr) {
                    html += cs.val
                } else {
                    if (prevclassesstr != '') html += '</span>'
                    html += `<span class='${classesstr}'>${cs.val}`
                }

                prevclassesstr = classesstr
            } else {
                if (prevclassesstr != '') html += '</span>'
                html += cs.val
                prevclassesstr = ''
            }
        }

        if (prevclassesstr != '') html += '</span>'

        return html
    }

    toString() {
        // console.log(this.chars)
        return this.chars
    }
}
