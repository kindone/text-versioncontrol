import { History, IHistory, ISyncRequest, ISyncResponse } from './History'

export class Server {
    private history: IHistory

    constructor(history:IHistory = new History('server')) {
        this.history = history
    }

    public merge(syncRequest: ISyncRequest): ISyncResponse {
        const deltas = this.history.merge(syncRequest)
        const revision = this.history.getCurrentRev()

        return { deltas, revision }
    }

    public getText() {
        return this.history.getText()
    }
}
