import Delta = require('quill-delta')
import { History, IHistory } from '../history/History'
import { SyncResponse } from '../history/SyncResponse'
import { IDelta } from '../primitive/IDelta'


export class DocClient {
    private history: IHistory
    private synchedRev: number = 0
    private synchedClientRev: number = 0
    private pending: IDelta[] = []

    constructor(history:IHistory = new History('client')) {
        this.history = history
    }

    public apply(deltas: IDelta[]) {
        this.history.append(deltas)
        this.pending = this.pending.concat(deltas)
    }

    public sync(response: SyncResponse) {
        this.history.merge({
            baseRev: this.synchedClientRev,
            branchName: 'server',
            deltas: response.resDeltas
        })
        this.synchedRev = response.rev
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
