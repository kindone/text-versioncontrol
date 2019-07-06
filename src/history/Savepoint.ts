import { IDelta } from '../primitive/IDelta'

export class Savepoint {
    constructor(public rev: number, public content: IDelta) {}
}
