import { ModAttr } from "./ModAttr";

export class CharWithState {
    public readonly val: string
    public readonly mod:ModAttr

    constructor(val: string, insertedBy?: string, deletedBy:Set<string> = new Set()) {
        this.val = val
        this.mod = new ModAttr(insertedBy, deletedBy)
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

    public setDeletedBy(branch: string) {
        return this.mod.setDeletedBy(branch)
    }

    public equals(cs: CharWithState) {
        return this.val === cs.val && this.mod.equals(cs.mod)
    }
}
