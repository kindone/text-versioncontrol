import { Operation } from './Operation'
import { ISyncResponse, TextHistory } from './TextHistory'


export class Client {
    private history: TextHistory
    private synchedRev: number = 0
    private synchedClientRev: number = 0
    private pending: Operation[] = []

    constructor() {
        this.history = new TextHistory('client')
    }

    public apply(operations: Operation[]) {
        this.history.apply(operations)
        this.pending = this.pending.concat(operations)
    }

    public sync(response: ISyncResponse) {
        this.history.merge({
            baseRev: this.synchedClientRev,
            branchName: 'server',
            operations: response.operations
        })
        this.synchedRev = response.revision
        this.synchedClientRev = this.history.getCurrentRev()
        this.pending = []
    }

    public getSyncRequest() {
        return {
            baseRev: this.synchedRev,
            branchName: this.history.name,
            operations: this.pending
        }
    }

    public getText() {
        return this.history.getText()
    }
}
