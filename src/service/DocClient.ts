import Delta = require('quill-delta')
import { History, IHistory } from '../history/History'
import { SyncResponse } from '../history/SyncResponse'
import { Change } from '../primitive/Change'

export class DocClient {
    private history: IHistory
    private synchedRev: number = 0
    private synchedClientRev: number = 0
    private pending: Change[] = []

    constructor(history: IHistory = new History('client')) {
        this.history = history
    }

    public apply(deltas: Change[]) {
        this.history.append(deltas)
        this.pending = this.pending.concat(deltas)
    }

    public sync(response: SyncResponse) {
        this.history.merge({
            rev: this.synchedClientRev,
            branchName: 'server',
            deltas: response.resDeltas,
        })
        this.synchedRev = response.rev
        this.synchedClientRev = this.history.getCurrentRev()
        this.pending = []
    }

    public getSyncRequest() {
        return {
            rev: this.synchedRev,
            branchName: this.history.name,
            deltas: this.pending,
        }
    }

    public getText() {
        return this.history.getText()
    }
}
