export class Operation {
    public readonly from: number
    public readonly numDeleted: number
    public readonly content: string

    constructor(from: number, numDeleted: number, content: string) {
        this.from = from
        this.numDeleted = numDeleted
        this.content = content
    }
}
