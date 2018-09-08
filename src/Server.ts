import { ISyncRequest, ISyncResponse, TextHistory } from './TextHistory'

export class Server {
    private history: TextHistory = new TextHistory('server')

    public merge(syncRequest: ISyncRequest): ISyncResponse {
        const operations = this.history.merge(syncRequest)
        const revision = this.history.getCurrentRev()

        return { operations, revision }
    }

    public getText() {
        return this.history.getText()
    }
}
