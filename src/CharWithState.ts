export class CharWithState {
    public readonly val: string
    public readonly insertedBy?: string
    public readonly deletedBy: string[] = []

    constructor(val: string, insertedBy?: string, deletedBy:string[] = []) {
        this.val = val
        this.insertedBy = insertedBy
        this.deletedBy = deletedBy
    }

    public isDeletedBy(branch: string) {
        return (
            this.deletedBy.find(by => {
                return by === branch
            }) !== undefined
        )
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
        return this.insertedBy && this.insertedBy < branch
    }

    public isDeleted() {
        return this.deletedBy.length > 0
    }

    public setDeletedBy(branch: string) {
        let firstDelete = false

        if (!this.isDeleted()) firstDelete = true

        if (!this.isDeletedBy(branch)) this.deletedBy.push(branch)

        return firstDelete
    }

    public equals(cs: CharWithState) {
        if (this.deletedBy.length !== cs.deletedBy.length) return false

        this.deletedBy.sort()
        cs.deletedBy.sort()

        for (let i = 0; i < this.deletedBy.length; i++) {
            if (this.deletedBy[i] !== cs.deletedBy[i]) return false
        }

        return this.val === cs.val && cs.insertedBy === cs.insertedBy
    }
}
