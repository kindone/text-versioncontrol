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

    public isVisibleTo(branch: string): boolean {
        // wildcard can see any change unless it's deleted
        if (branch === '*' || branch === '_') return !this.isDeleted()

        // if deleted by myself or a wildcard, then it's not visible
        if (this.isDeletedBy(branch) || this.isDeletedByWildcard()) return false
        // if inserted by other but not a wildcard, then it's not visible
        if (this.isInsertedByNonWildcardOther(branch)) return false

        return true
    }

    public shouldAdvanceForTiebreak(branch: string): boolean {
        // use tiebreaking string comparison on inserted branch
        return this.insertedBy !== undefined && this.insertedBy < branch
    }

    public isInserted(): boolean {
        return this.insertedBy !== undefined
    }

    public isInsertedByOther(branch: string): boolean {
        return this.insertedBy !== undefined && this.insertedBy !== branch
    }

    public isInsertedByNonWildcardOther(branch: string): boolean {
        return this.isInsertedByOther(branch) && !this.isInsertedByWildcard()
    }

    public isDeleted(): boolean {
        return this.deletedBy.size > 0
    }

    public isDeletedByOther(branch: string): boolean {
        return this.isDeleted() && !this.deletedBy.has(branch)
    }

    public isDeletedByNonWildcardOther(branch: string): boolean {
        return this.isDeletedByOther(branch) && !this.isDeletedByWildcard()
    }

    public equals(md: Modification): boolean {
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

    private isDeletedBy(branch: string): boolean {
        return this.deletedBy.has(branch)
    }

    private isInsertedByWildcard(): boolean {
        return this.insertedBy === '*'
    }

    private isDeletedByWildcard(): boolean {
        return this.isDeleted() && this.deletedBy.has('*')
    }
}
