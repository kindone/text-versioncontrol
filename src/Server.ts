import { ISyncRequest, ISyncResponse, TextHistory } from './TextHistory'

export class Server {
    private history: TextHistory = new TextHistory('server')

    public merge(syncRequest: ISyncRequest): ISyncResponse {
        const deltas = this.history.merge(syncRequest)
        const revision = this.history.getCurrentRev()

        return { deltas, revision }
    }

    public getText() {
        return this.history.getText()
    }
}
