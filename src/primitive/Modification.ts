export enum Status {
    INITIAL = 0,
    DELETED,
    INSERTED,
    INSERTED_THEN_DELETED,
}

export class Modification {
    public readonly insertedBy?: string
    public readonly deletedBy: Set<string>

    constructor(insertedBy?: string, deletedBy: Set<string> = new Set()) {
        this.insertedBy = insertedBy
        this.deletedBy = deletedBy
    }

    public get status(): Status {
        if (this.insertedBy) {
            return this.isDeleted() ? Status.INSERTED_THEN_DELETED : Status.INSERTED
        }
        return this.isDeleted() ? Status.DELETED : Status.INITIAL
    }

    public isDeletedBy(branch: string) {
        return this.deletedBy.has(branch)
    }

    // public isInsertedBy(branch: string) {
    //     return this.insertedBy && this.insertedBy === branch
    // }

    public isInsertedByOther(branch: string) {
        return this.insertedBy !== undefined && this.insertedBy !== branch
    }

    // public isInsertedThenDeletedBy(branch: string) {
    //     return this.isInsertedBy(branch) && this.isDeletedBy(branch)
    // }

    public isVisibleTo(branch: string) {
        if(branch === '*')
            return !this.isDeleted()
        else
            return !this.isDeletedBy(branch) && !this.isInsertedByOther(branch)
    }

    public isVisible() {
        return !this.isDeleted()
    }

    public shouldAdvanceForTiebreak(branch: string) {
        // use tiebreaking string comparison on inserted branch
        if(branch === '*')
            return false
        else
            return this.insertedBy !== undefined && this.insertedBy < branch && this.insertedBy  !== '*'
    }

    public isInserted() {
        return this.insertedBy !== undefined
    }

    public isDeleted() {
        return this.deletedBy.size > 0
    }

    public isDeletedByOther(branch: string) {
        return this.isDeleted() && !this.deletedBy.has(branch)
    }

    // public setDeletedBy(branch: string) {
    //     this.deletedBy.add(branch)
    //     return this.deletedBy.size === 1
    // }

    public equals(md: Modification) {
        if (this.deletedBy.size !== md.deletedBy.size) {
            return false
        }

        for (const elem in this.deletedBy) {
            if (!md.deletedBy.has(elem)) {
                return false
            }
        }

        return md.insertedBy === md.insertedBy
    }
}
