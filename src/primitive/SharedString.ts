import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { DeltaIterator } from './DeltaIterator'
import { Fragment } from './Fragment'
import { FragmentIterator, IResult } from './FragmentIterator'
import { IDelta } from './IDelta'
import { normalizeOps } from './util'

export class SharedString {
    public static fromString(str: string) {
        return new SharedString([new Fragment(str)])
    }

    public static fromDelta(delta: IDelta) {
        const fs = _.reduce(
            delta.ops,
            (fragments: Fragment[], op) => {
                if (typeof op.insert === 'string') {
                    fragments.push(Fragment.initial(op.insert, op.attributes))
                } else if (op.insert) {
                    fragments.push(Fragment.initialEmbedded(op.insert, op.attributes))
                }
                return fragments
            },
            [],
        )

        return new SharedString(fs)
    }

    private fragments: Fragment[]

    constructor(fragments: Fragment[]) {
        this.fragments = fragments
    }

    public applyChange(delta: IDelta, branch: string, debug = false): IDelta {
        const fragmentIter = new FragmentIterator(branch, this.fragments)
        const deltaIter = new DeltaIterator(branch, this.fragments)

        let newFragments: Fragment[] = []
        let newOps: Op[] = []
        let diff = 0 // always <= 0

        for (const op of delta.ops) {
            // update attributes
            if (op.retain && op.attributes) {
                const fragments = fragmentIter.attribute(op.retain, op.attributes)
                newFragments = newFragments.concat(fragments)

                const retain = op.retain + diff
                if (retain > 0) {
                    const opsWithDiff = deltaIter.attribute(retain, op.attributes)
                    newOps = newOps.concat(opsWithDiff.ops)
                    diff = opsWithDiff.diff
                } else {
                    diff = retain
                }
            }
            // retain
            else if (op.retain) {
                newFragments = newFragments.concat(fragmentIter.retain(op.retain))

                const retain = op.retain + diff
                if (retain > 0) {
                    const opsWithDiff = deltaIter.retain(retain)
                    newOps = newOps.concat(opsWithDiff.ops)
                    diff = opsWithDiff.diff
                } else diff += op.retain
            }
            // delete
            else if (op.delete) {
                newFragments = newFragments.concat(fragmentIter.delete(op.delete))
                const del = op.delete + diff
                if (del > 0) {
                    const opsWithDiff = deltaIter.delete(del)
                    newOps = newOps.concat(opsWithDiff.ops)
                    diff = opsWithDiff.diff
                } else {
                    diff += op.delete
                }
            } else if (op.insert) {
                let fragments: Fragment[] = []
                let ops: Op[] = []
                if (op.attributes) {
                    if (typeof op.insert === 'string') {
                        fragments = fragmentIter.insertWithAttribute(op.insert, op.attributes)
                        ops = deltaIter.insertWithAttribute(op.insert, op.attributes)
                    } else {
                        fragments = fragmentIter.embedWithAttribute(op.insert, op.attributes)
                        ops = deltaIter.embedWithAttribute(op.insert, op.attributes)
                    }
                } else {
                    if (typeof op.insert === 'string') {
                        fragments = fragmentIter.insert(op.insert)
                        ops = deltaIter.insert(op.insert)
                    } else {
                        fragments = fragmentIter.embed(op.insert)
                        ops = deltaIter.embed(op.insert)
                    }
                }
                newFragments = newFragments.concat(fragments)
                newOps = newOps.concat(ops)
            }
        }

        this.fragments = newFragments.concat(fragmentIter.rest())
        return new Delta(normalizeOps(newOps))
    }

    public clone() {
        return new SharedString(this.fragments.concat())
    }

    public equals(ss: SharedString) {
        if (this.fragments.length !== ss.fragments.length) return false

        for (let i = 0; i < this.fragments.length; i++) {
            if (!this.fragments[i].equals(ss.fragments[i])) return false
        }
        return true
    }

    public toText() {
        return _.reduce(
            this.fragments,
            (result: string, fragment) => {
                return result.concat(fragment.toText())
            },
            '',
        )
    }

    public toFlattenedDelta(): IDelta {
        const ops = _.map(
            this.fragments,
            fragment => {
                return fragment.toFlattenedOp()
            },
            [],
        )

        return new Delta(ops)
    }

    public toDelta(): IDelta {
        const ops = _.reduce(
            this.fragments,
            (result: Op[], fragment) => {
                const op = fragment.toOp()
                if (!fragment.isDeleted() && op.insert !== '') return result.concat(fragment.toOp())
                else return result
            },
            [],
        )

        return new Delta(normalizeOps(ops))
    }

    public toHtml() {
        return _.reduce(this.fragments, (result: string, fragment) => {
            return result.concat(fragment.toHtml())
        })
    }

    public toString() {
        return this.fragments
    }

    public getFragmentAtIdx(idx: number, branch: string): Fragment | null {
        let current = 0
        for (const fragment of this.fragments) {
            if (fragment.isVisibleTo(branch)) {
                current += fragment.val.length
                if (current >= idx) return fragment
            }
        }
        return null
    }
}
