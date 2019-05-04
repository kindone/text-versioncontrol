import { History } from '../history/History'
import { SyncResponse } from '../history/SyncResponse'
import { DocServer } from './DocServer'
import { RepoSyncRequest } from './RepoClient'

export interface RepoSyncResponse {
    [name: string]: SyncResponse
}

export class RepoServer {
    public docs: { [name: string]: DocServer } = {}

    constructor(docNames: string[]) {
        for (const docName of docNames) {
            this.docs[docName] = new DocServer(new History(docName))
        }
    }

    public merge(syncRequest: RepoSyncRequest): RepoSyncResponse {
        const syncResponse: RepoSyncResponse = {}
        for (const docName in syncRequest) {
            if (this.docs[docName]) {
                const docSyncRequest = syncRequest[docName]
                syncResponse[docName] = this.docs[docName].merge(docSyncRequest)
            }
        }
        return syncResponse
    }
}
