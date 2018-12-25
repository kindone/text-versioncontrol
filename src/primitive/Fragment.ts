import AttributeMap from 'quill-delta/dist/AttributeMap'
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Embedded } from './Embedded'
import { Modification, Status } from './Modification'

export interface AttributeFragment {
    val?: AttributeMap
    mod?: { [branch: string]: AttributeMap }
}

export class Fragment {
    public static initial(str: string, attrs?: AttributeMap): Fragment {
        if (attrs) return new Fragment(str, { val: attrs })
        else return new Fragment(str)
    }

    public static initialEmbedded(obj: object, attrs?: AttributeMap): Fragment {
        if (attrs) return new Fragment(new Embedded(obj), { val: attrs })
        else return new Fragment(new Embedded(obj))
    }

    public static insert(str: string, branch: string): Fragment {
        return new Fragment(str, undefined, branch)
    }

    public static insertWithAttribute(str: string, attrs: AttributeMap, branch: string): Fragment {
        return new Fragment(str, { val: attrs }, branch)
    }

    public static embed(obj: object, branch: string): Fragment {
        return new Fragment(new Embedded(obj), undefined, branch)
    }

    public static embedWithAttribute(obj: object, attrs: AttributeMap, branch: string): Fragment {
        return new Fragment(new Embedded(obj), { val: attrs }, branch)
    }

    public readonly val: string | Embedded
    public readonly attrs?: AttributeFragment
    public readonly mod: Modification

    constructor(
        val: string | Embedded,
        attrs?: AttributeFragment,
        insertedBy?: string,
        deletedBy: Set<string> = new Set(),
    ) {
        this.val = val
        this.attrs = attrs
        this.mod = new Modification(insertedBy, deletedBy)
    }

    public size() {
        return this.val.length
    }

    public clone(): Fragment {
        return new Fragment(this.val.concat(), this.attrs, this.mod.insertedBy, new Set(this.mod.deletedBy))
    }

    public slice(begin: number, end?: number): Fragment {
        return new Fragment(this.val.slice(begin, end), this.attrs, this.mod.insertedBy, new Set(this.mod.deletedBy))
    }

    public sliceWithAttribute(attr: AttributeMap, branch: string, begin: number, end?: number): Fragment {
        const newAttrs = this.applyAttributes(attr, branch)
        return new Fragment(this.val.slice(begin, end), newAttrs, this.mod.insertedBy, new Set(this.mod.deletedBy))
    }

    public sliceWithDelete(branch: string, begin: number, end?: number): Fragment {
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

    public isDeletedByOther(branch: string) {
        return this.mod.isDeletedByOther(branch)
    }

    public equals(cs: Fragment) {
        return _.isEqual(this.val, cs.val) && _.isEqual(this.attrs, this.attrs) && this.mod.equals(cs.mod)
    }

    public toFlattenedOp(): Op {
        if (this.mod.isDeleted()) return { delete: this.val.length }

        const attributes = this.getAttributes()

        if (this.mod.isInserted()) {
            const insert = this.val

            if (_.isEmpty(attributes)) return { insert }
            else return { insert, attributes }
        }

        const retain = this.val.length
        if (_.isEmpty(attributes)) return { retain }
        else return { retain, attributes }
    }

    public toOp(): Op {
        let insert: string | object = ''

        if (typeof this.val === 'string') insert = this.val
        else insert = this.val.value

        if (!this.attrs || _.isEmpty(this.attrs)) return { insert }
        else {
            const attributes = this.getAttributes()
            if (_.isEmpty(attributes)) return { insert }
            else return { insert, attributes: this.getAttributes() }
        }
    }

    public toText(): string {
        // TODO: attributes
        switch (this.mod.status) {
            case Status.INITIAL:
            case Status.INSERTED:
                return typeof this.val === 'string' ? this.val : this.val.toString()
            default:
                return ''
        }
    }

    public toHtml(): string {
        // TODO: attributes
        const valueStr = typeof this.val === 'string' ? this.val : `<span class='embed'>${this.val.toString()}</span>`
        switch (this.mod.status) {
            case Status.INITIAL:
                return valueStr
            case Status.DELETED: {
                const Bclasses = _.map(Array.from(this.mod.deletedBy), key => {
                    return 'B' + key
                })
                return `<span class='deleted ${Bclasses}'>${valueStr}</span>`
            }
            case Status.INSERTED:
                return `<span class='inserted B${this.mod.insertedBy}'>${valueStr}</span>`
            case Status.INSERTED_THEN_DELETED:
                return `<span class='inserted deleted B${this.mod.insertedBy}'>${valueStr}</span>`
            default:
                return ''
        }
    }

    // flattened attributes
    public getAttributes(): AttributeMap {
        if (!this.attrs) return {}

        if (!this.attrs.mod) {
            return this.attrValWithoutNullFields()
        }
        // take branches in reverse order to let a branch with higher priority overrides others
        const projected: AttributeMap = this.attrValWithoutNullFields()
        const branches = _.keys(this.attrs.mod)
        for (const branch of Object.keys(this.attrs.mod).sort()) {
            // set or unset fields by mod
            const mod = this.attrs.mod[branch]
            for (const field in mod) {
                if (mod[field] === null) delete projected[field]
                else projected[field] = mod[field]
            }
        }
        return projected
    }

    private attrValWithoutNullFields(): AttributeMap {
        if (!this.attrs || !this.attrs.val) return {}

        const result: AttributeMap = {}
        for (const field of Object.keys(this.attrs.val)) {
            if (this.attrs.val[field] !== null) result[field] = this.attrs.val[field]
        }
        return result
    }

    private applyAttributes(attrToApply: AttributeMap, branch: string): AttributeFragment {
        if (!this.attrs) return { mod: { [branch]: attrToApply } }

        if (!this.attrs.mod) {
            return { val: this.attrs.val, mod: { [branch]: attrToApply } }
        }

        const branchAttr: AttributeMap = {
            ...this.attrs.mod[branch],
            ...attrToApply,
        }

        if (this.attrs.val) return { val: this.attrs.val, mod: { ...this.attrs.mod, [branch]: branchAttr } }
        else return { mod: { ...this.attrs.mod, [branch]: branchAttr } }
    }
}
