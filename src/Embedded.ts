export class Embedded {
    public readonly length:number = 1

    constructor(public readonly value:object) {
    }

    public slice(begin?:number, end?:number):Embedded {
        return new Embedded({...this.value})
    }

    public concat():Embedded {
        return new Embedded({...this.value})
    }
}