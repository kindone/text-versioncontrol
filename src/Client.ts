import Delta = require('quill-delta')
import { History, IHistory, ISyncResponse } from './History'
import { IDelta } from './IDelta'

export class Client {
    private history: IHistory
    private synchedRev: number = 0
    private synchedClientRev: number = 0
    private pending: IDelta[] = []

    constructor(history:IHistory = new History('client')) {
        this.history = history
    }

    public apply(deltas: IDelta[]) {
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
