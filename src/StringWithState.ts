import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Fragment } from './Fragment'
import { FragmentIterator, IResult } from './FragmentIterator';



export class StringWithState {
    public static fromString(str: string) {
        return new StringWithState([new Fragment(str)])
    }
    public fragments: Fragment[]

    constructor(fragments:Fragment[]) {
        this.fragments = fragments
    }

    public apply(delta: Delta, branch: string, debug = false):Delta {
        const fragmentIter = new FragmentIterator(branch, this.fragments)

        let fragments:Fragment[] = []
        let opsTransformed:Op[] = []
        let diff = 0 // always <= 0

        for(const op of delta.ops)
        {
            // update attributes
            if(op.retain && op.attributes) {
                const retain = op.retain + diff
                if(retain > 0)
                {
                    const result = fragmentIter.attribute(retain, op.attributes)
                    fragments = fragments.concat(result.fragments)
                    opsTransformed = opsTransformed.concat(result.ops)
                    diff = result.diff
                }
                else
                    diff = retain
            }
            // retain
            else if(op.retain) {
                const retain = op.retain + diff
                if(retain > 0)
                {
                    const result = fragmentIter.retain(retain)
                    fragments = fragments.concat(result.fragments)
                    opsTransformed = opsTransformed.concat(result.ops)
                    diff = result.diff
                }
                else
                    diff = retain
            }
            // delete
            else if(op.delete) {
                const del = op.delete + diff
                if(del > 0)
                {
                    const result = fragmentIter.delete(op.delete)
                    fragments = fragments.concat(result.fragments)
                    opsTransformed = opsTransformed.concat(result.ops)
                    diff = result.diff
                }
                else
                    diff = del
            }
            else if(op.insert) {
                let result:IResult = {fragments:[], ops:[], diff:0}
                if(op.attributes) {
                    if(typeof op.insert === 'string')
                        result = fragmentIter.insertWithAttribute(op.insert, op.attributes)
                    else
                        result = fragmentIter.embedWithAttribute(op.insert, op.attributes)
                }
                else {
                    if(typeof op.insert === 'string')
                        result = fragmentIter.insert(op.insert)
                    else
                        result = fragmentIter.embed(op.insert)
                }
                fragments = fragments.concat(result.fragments)
                opsTransformed = opsTransformed.concat(result.ops)
                diff += result.diff
            }
        }

        this.fragments = fragments.concat(fragmentIter.rest())
        return new Delta(this.normalizeOps(opsTransformed))
    }

    public clone() {
        return new StringWithState(this.fragments.concat())
    }

    public equals(ss: StringWithState) {
        if(this.fragments.length !== ss.fragments.length)
            return false

        for(let i = 0; i < this.fragments.length; i++)
        {
            if(!this.fragments[i].equals(ss.fragments[i]))
                return false
        }
        return true
    }

    public toText() {
        return _.reduce(this.fragments, (result:string, fragment) => {
            return result.concat(fragment.toText())
        },"")
    }

    public toHtml() {
        return _.reduce(this.fragments, (result:string, fragment) => {
            return result.concat(fragment.toHtml())
        })
    }

    public toString() {
        return this.fragments
    }

    public getFragmentAtIdx(idx:number, branch:string):Fragment|null {
        let current = 0
        for(const fragment of this.fragments) {
            if(fragment.isVisibleTo(branch)) {
                current += fragment.val.length
                if(current >= idx)
                    return fragment
            }
        }
        return null
    }

    private normalizeOps(ops:Op[]):Op[]
    {
        if(ops.length === 0)
            return ops
        const newOps:Op[] = [ops[0]]
        for(const op of ops.slice(1))
        {
            const normalized = this.normalizeTwoOps(newOps[newOps.length-1], op)
            if(normalized.length === 1) {
                newOps[newOps.length-1] = normalized[0]
            }
            else// 2
                newOps.push(normalized[1])
        }
        return newOps
    }

    private normalizeTwoOps(op1:Op, op2:Op):Op[] {
        if(op1.insert && op2.insert && !op1.attributes && !op2.attributes)
            return [{insert: (op1.insert as string).concat(op2.insert as string)}]
        if(op1.delete && op2.delete)
            return [{delete: op1.delete + op2.delete}]
        if(op1.retain && op2.retain && !op1.attributes && !op2.attributes)
            return [{retain: op1.retain + op2.retain}]
        if(op1.retain && op2.retain && op1.attributes && op2.attributes &&
            [JSON.stringify(op1.attributes) === JSON.stringify(op2.attributes)]) {
            return [{retain: op1.retain + op2.retain, attributes: op1.attributes}]
        }
        return [op1, op2]
    }
}
