import { History, IHistory } from '../history/History'
import { SyncRequest } from '../history/SyncRequest'
import { SyncResponse } from '../history/SyncResponse'

export class DocServer {
    private history: IHistory

    constructor(history: IHistory = new History('server')) {
        this.history = history
    }

    public merge(syncRequest: SyncRequest): SyncResponse {
        return this.history.merge(syncRequest)
    }

    public getText() {
        return this.history.getText()
    }
}
