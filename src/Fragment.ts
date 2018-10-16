import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Embedded } from './Embedded'
import { Modification, Status } from "./Modification"

interface Attributes {
    [name:string]:any
}

interface AttributeFragment {
    val?:Attributes
    mod?:{[branch:string]:Attributes}
}

export class Fragment {

    public static initial(str:string, attrs?:Attributes):Fragment {
        if(attrs)
            return new Fragment(str, {val: attrs})
        else
            return new Fragment(str)
    }

    public static initialEmbedded(obj:object, attrs?:Attributes):Fragment {
        if(attrs)
            return new Fragment(new Embedded(obj), {val: attrs})
        else
            return new Fragment(new Embedded(obj))
    }

    public static insert(str:string, branch:string):Fragment {
        return new Fragment(str, undefined, branch)
    }

    public static insertWithAttribute(str:string, attrs:Attributes, branch:string):Fragment {
        return new Fragment(str, {val: attrs}, branch)
    }

    public static embed(obj:object, branch:string):Fragment {
        return new Fragment(new Embedded(obj), undefined, branch)
    }

    public static embedWithAttribute(obj:object, attrs:Attributes, branch:string):Fragment {
        return new Fragment(new Embedded(obj), {val: attrs}, branch)
    }

    public readonly val: string|Embedded
    public readonly attrs?: AttributeFragment
    public readonly mod: Modification


    constructor(val: string|Embedded, attrs?:AttributeFragment, insertedBy?: string, deletedBy:Set<string> = new Set()) {
        this.val = val
        this.attrs = attrs
        this.mod = new Modification(insertedBy, deletedBy)
    }

    public size() {
        return this.val.length
    }

    public clone():Fragment {
        return new Fragment(this.val.concat(), this.attrs, this.mod.insertedBy, new Set(this.mod.deletedBy))
    }

    public slice(begin:number, end?:number):Fragment {
        return new Fragment(this.val.slice(begin, end), this.attrs, this.mod.insertedBy, new Set(this.mod.deletedBy))
    }

    public sliceWithAttribute(attr:Attributes, branch:string, begin:number, end?:number):Fragment {
        const newAttrs = this.applyAttributes(attr, branch)
        return new Fragment(this.val.slice(begin, end), newAttrs, this.mod.insertedBy, new Set(this.mod.deletedBy))
    }

    public sliceWithDelete(branch:string, begin:number, end?:number):Fragment {
        const newDeletedBy = new Set(this.mod.deletedBy).add(branch)
        return new Fragment(this.val.slice(begin, end), this.attrs, this.mod.insertedBy, newDeletedBy)
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

    public isInserted() {
        return this.mod.isInserted()
    }

    public isDeleted() {
        return this.mod.isDeleted()
    }

    public isDeletedByOther(branch:string) {
        return this.mod.isDeletedByOther(branch)
    }

    public equals(cs: Fragment) {
        return JSON.stringify(this.val) === JSON.stringify(cs.val) && JSON.stringify(this.attrs) === JSON.stringify(this.attrs) && this.mod.equals(cs.mod)
    }

    public toOp():Op {
        if(!this.attrs || _.isEmpty(this.attrs)) {
            if(typeof this.val === 'string')
                return {insert: this.val}
            else
                return {insert: this.val.value}
        }
        else {
            if(typeof this.val === 'string')
                return {insert: this.val, attributes: this.getAttributes()}
            else
                return {insert: this.val.value, attributes: this.getAttributes()}
        }
    }

    public toText():string {
        // TODO: attributes
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
        // TODO: attributes
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

    // flattened attributes
    public getAttributes():Attributes {
        if(!this.attrs)
            return {}

        if(!this.attrs.mod)
        {
            return {...this.attrs.val}
        }
        // take branches in reverse order to let a branch with higher priority overrides others
        const projected:Attributes = {...this.attrs.val}
        const branches = _.keys(this.attrs.mod)
        for(const branch of Object.keys(this.attrs.mod).sort().reverse())
        {
            // set or unset fields by mod
            const mod = this.attrs.mod[branch]
            for(const field in mod) {
                if(mod[field] === null)
                    delete projected[field]
                else
                    projected[field] = mod[field]
            }
        }
        return projected
    }

    private applyAttributes(attrToApply:Attributes, branch:string):AttributeFragment
    {
        if(!this.attrs)
            return {mod:{[branch]: attrToApply}}

        if(!this.attrs.mod)
        {
            return {val:this.attrs.val, mod: {[branch]:attrToApply}}
        }

        const branchAttr:Attributes = {...this.attrs.mod[branch],
            ...attrToApply}
        // for(const field in attrToApply) {
        //     if(attrToApply[field] === null) {
        //         delete branchAttr[field]
        //     }
        //     else {
        //         branchAttr[field] = attrToApply[field]
        //     }
        // }
        if(this.attrs.val)
            return {val: this.attrs.val, mod: {...this.attrs.mod, [branch]: branchAttr}}
        else
            return {mod: {...this.attrs.mod, [branch]: branchAttr}}
    }
}
