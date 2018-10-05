export class ModAttr
{
    public readonly insertedBy?: string
    public readonly deletedBy: Set<string>

    constructor(insertedBy?:string, deletedBy:Set<string> = new Set())
    {
        this.insertedBy = insertedBy
        this.deletedBy = deletedBy
    }

    public isDeletedBy(branch: string) {
        return this.deletedBy.has(branch)
    }

    public isInsertedBy(branch: string) {
        return this.insertedBy && this.insertedBy === branch
    }

    public isInsertedByOther(branch: string) {
        return this.insertedBy && this.insertedBy !== branch
    }

    public isVisibleTo(branch: string) {
        return !this.isDeletedBy(branch) && !this.isInsertedByOther(branch)
    }

    public isVisible() {
        return !this.isDeleted()
    }

    public shouldAdvanceForTiebreak(branch: string) {
        // use tiebreaking string comparison on inserted branch
        return this.insertedBy !== undefined && this.insertedBy < branch
    }

    public isDeleted() {
        return this.deletedBy.size > 0
    }

    public setDeletedBy(branch: string) {
        this.deletedBy.add(branch)
        return this.deletedBy.size === 1
    }

    public equals(md: ModAttr) {
        if(this.deletedBy.size !== md.deletedBy.size) {
            return false
        }

        for (const elem in this.deletedBy)
        {
            if(!md.deletedBy.has(elem)) {
                return false
            }
        }

        return md.insertedBy === md.insertedBy
    }
}