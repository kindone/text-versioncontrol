import { IDelta } from '../core/IDelta'

export class Savepoint {
    constructor(public rev: number, public content: IDelta) {}
}
