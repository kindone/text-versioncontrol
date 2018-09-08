export class CharWithState {
    val: string
    insertedBy?: string
    deletedBy: string[] = []

    constructor(val: string, insertedBy?: string) {
        this.val = val
        this.insertedBy = insertedBy
    }

    isDeletedBy(branch: string) {
        return (
            this.deletedBy.find(by => {
                return by == branch
            }) != undefined
        )
    }

    isInsertedBy(branch: string) {
        return this.insertedBy && this.insertedBy == branch
    }

    isInsertedByOther(branch: string) {
        return this.insertedBy && this.insertedBy != branch
    }

    isVisibleTo(branch: string) {
        return !this.isDeletedBy(branch) && !this.isInsertedByOther(branch)
    }

    isVisible() {
        return !this.isDeleted()
    }

    shouldAdvanceForTiebreak(branch: string) {
        // use tiebreaking string comparison on inserted branch
        return this.insertedBy && this.insertedBy < branch
    }

    isDeleted() {
        return this.deletedBy.length > 0
    }

    setDeletedBy(branch: string) {
        let firstDelete = false

        if (!this.isDeleted()) firstDelete = true

        if (!this.isDeletedBy(branch)) this.deletedBy.push(branch)

        return firstDelete
    }

    equals(cs: CharWithState) {
        if (this.deletedBy.length != cs.deletedBy.length) return false

        this.deletedBy.sort()
        cs.deletedBy.sort()

        for (let i = 0; i < this.deletedBy.length; i++) {
            if (this.deletedBy[i] != cs.deletedBy[i]) return false
        }

        return this.val == cs.val && cs.insertedBy == cs.insertedBy
    }
}
