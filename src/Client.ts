import { TextHistory, SyncResponse } from './TextHistory'
import { Operation } from './Operation'

export class Client {
    private history: TextHistory
    private synchedRev: number = 0
    private synchedClientRev: number = 0
    private pending: Operation[] = []

    constructor() {
        this.history = new TextHistory('client')
    }

    apply(operations: Operation[]) {
        this.history.apply(operations)
        this.pending = this.pending.concat(operations)
    }

    sync(res: SyncResponse) {
        this.history.merge({
            baseRev: this.synchedClientRev,
            operations: res.operations,
            branchName: 'server',
        })
        this.synchedRev = res.revision
        this.synchedClientRev = this.history.getCurrentRev()
        this.pending = []
    }

    getSyncRequest() {
        return {
            baseRev: this.synchedRev,
            operations: this.pending,
            branchName: this.history.name,
        }
    }

    getText() {
        return this.history.getText()
    }
}
