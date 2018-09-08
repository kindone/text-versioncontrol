import { TextHistory, MergeRequest, SyncResponse } from './TextHistory'

export class Server {
    history: TextHistory = new TextHistory('server')

    constructor() {}

    merge(mergeRequest: MergeRequest): SyncResponse {
        const operations = this.history.merge(mergeRequest)
        const revision = this.history.getCurrentRev()

        return { operations, revision }
    }

    getText() {
        return this.history.getText()
    }
}
