import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Embedded } from './Embedded'
import { Modification, Status } from "./Modification"



export class Fragment {

    public static insert(str:string, branch:string):Fragment {
        return new Fragment(str, undefined, branch)
    }

    public static insertWithAttribute(str:string, attr:object, branch:string):Fragment {
        return new Fragment(str, attr, branch)
    }

    public static embed(obj:object, branch:string):Fragment {
        return new Fragment(new Embedded(obj), undefined, branch)
    }

    public static embedWithAttribute(obj:object, attr:object, branch:string):Fragment {
        return new Fragment(new Embedded(obj), attr, branch)
    }

    public readonly val: string|Embedded
    public readonly attr?: object
    public readonly mod: Modification


    constructor(val: string|Embedded, attr?: object, insertedBy?: string, deletedBy:Set<string> = new Set()) {
        this.val = val
        this.mod = new Modification(insertedBy, deletedBy)
    }

    public size() {
        return this.val.length
    }

    public clone():Fragment {
        return new Fragment(this.val.concat(), this.attr, this.mod.insertedBy, this.mod.deletedBy)
    }

    public slice(begin:number, end?:number):Fragment {
        return new Fragment(this.val.slice(begin, end), this.attr, this.mod.insertedBy, this.mod.deletedBy)
    }

    public sliceWithAttribute(attr:object, branch:string, begin:number, end?:number):Fragment {
        return new Fragment(this.val.slice(begin, end), attr, branch, this.mod.deletedBy)
    }

    public sliceWithDelete(branch:string, begin:number, end?:number):Fragment {
        const newDeletedBy = new Set(this.mod.deletedBy).add(branch)
        return new Fragment(this.val.slice(begin, end), this.attr, this.mod.insertedBy, newDeletedBy)
    }

    public isDeletedBy(branch: string) {
        return this.mod.isDeletedBy(branch)
    }

    public isInsertedBy(branch: string) {
        return this.mod.isInsertedBy(branch)
    }

    public isInsertedByOther(branch: string) {
        return this.mod.isInsertedByOther(branch)
    }

    public isVisibleTo(branch: string) {
        return this.mod.isVisibleTo(branch)
    }

    public isVisible() {
        return this.mod.isVisible()
    }

    public shouldAdvanceForTiebreak(branch: string) {
        // use tiebreaking string comparison on inserted branch
        return this.mod.shouldAdvanceForTiebreak(branch)
    }

    public isDeleted() {
        return this.mod.isDeleted()
    }

    public isDeletedByOther(branch:string) {
        return this.mod.isDeletedByOther(branch)
    }

    public equals(cs: Fragment) {
        return this.val === cs.val && this.mod.equals(cs.mod)
    }

    public toOp():Op {
        if(this.attr)
            return {insert: this.val, attributes: this.attr}
        else
            return {insert: this.val}
    }

    public toText():string {
        switch(this.mod.status)
        {
            case Status.INITIAL:
            case Status.INSERTED:
                return (typeof this.val === 'string' ? this.val : this.val.toString())
            default:
                return ""
        }
    }

    public toHtml():string {
        const valueStr = (typeof this.val === 'string' ? this.val : `<span class='embed'>${this.val.toString()}</span>`)
        switch(this.mod.status)
        {
            case Status.INITIAL:
                return valueStr
            case Status.DELETED: {
                const Bclasses = _.map(Array.from(this.mod.deletedBy), (key) => {
                    return "B" + key
                })
                return `<span class='deleted ${Bclasses}'>${valueStr}</span>`
            }
            case Status.INSERTED:
                return `<span class='inserted B${this.mod.insertedBy}'>${valueStr}</span>`
            case Status.INSERTED_THEN_DELETED:
                return `<span class='inserted deleted B${this.mod.insertedBy}'>${valueStr}</span>`
            default:
                return ""
        }
    }
}
