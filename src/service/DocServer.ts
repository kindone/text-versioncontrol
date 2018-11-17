import { History, IHistory, ISyncRequest, ISyncResponse } from '../History'

export class DocServer {
    private history: IHistory

    constructor(history:IHistory = new History('server')) {
        this.history = history
    }

    public merge(syncRequest: ISyncRequest): ISyncResponse {
        return this.history.merge(syncRequest)
    }

    public getText() {
        return this.history.getText()
    }
}
