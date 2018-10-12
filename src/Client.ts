import Delta = require('quill-delta')
import { ISyncResponse, TextHistory } from './TextHistory'


export class Client {
    private history: TextHistory
    private synchedRev: number = 0
    private synchedClientRev: number = 0
    private pending: Delta[] = []

    constructor() {
        this.history = new TextHistory('client')
    }

    public apply(deltas: Delta[]) {
        this.history.apply(deltas)
        this.pending = this.pending.concat(deltas)
    }

    public sync(response: ISyncResponse) {
        this.history.merge({
            baseRev: this.synchedClientRev,
            branchName: 'server',
            deltas: response.deltas
        })
        this.synchedRev = response.revision
        this.synchedClientRev = this.history.getCurrentRev()
        this.pending = []
    }

    public getSyncRequest() {
        return {
            baseRev: this.synchedRev,
            branchName: this.history.name,
            deltas: this.pending
        }
    }

    public getText() {
        return this.history.getText()
    }
}
