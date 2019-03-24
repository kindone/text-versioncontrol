import { Change } from '../primitive/Change'

export class Savepoint {
    constructor(public rev: number, public content: Change) {}
}
