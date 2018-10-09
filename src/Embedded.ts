export class Embedded {
    public readonly length:number = 1

    constructor(public readonly value:object) {
    }

    public slice(begin?:number, end?:number):Embedded {
        return this
    }

    public concat() {
        return this
    }
}