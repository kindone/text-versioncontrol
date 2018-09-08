export class Operation {
    from: number
    numDeleted: number
    content: string

    constructor(from: number, numDeleted: number, content: string) {
        this.from = from
        this.numDeleted = numDeleted
        this.content = content
    }
}
