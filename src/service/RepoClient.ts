import { IDelta } from '../core/IDelta'
import { History } from '../history/History'
import { SyncRequest } from '../history/SyncRequest'
import { DocClient } from './DocClient'
import { RepoSyncResponse } from './RepoServer'

export interface RepoSyncRequest {
    [name: string]: SyncRequest
}

export class RepoClient {
    public docs: { [name: string]: DocClient } = {}

    constructor(docNames: string[]) {
        for (const docName of docNames) {
            this.docs[docName] = new DocClient(new History(docName))
        }
    }

    public apply(docName: string, deltas: IDelta[]) {
        this.docs[docName].apply(deltas)
    }

    public sync(syncResponse: RepoSyncResponse) {
        for (const docName in syncResponse) {
            if (this.docs[docName]) {
                this.docs[docName].sync(syncResponse[docName])
            } else {
                throw new Error('Cannnot sync. No document exists with the name: ' + docName)
            }
        }
    }

    public getSyncRequest(): RepoSyncRequest {
        const repoSyncRequest: RepoSyncRequest = {}
        for (const docName in this.docs) {
            if (docName) {
                repoSyncRequest[docName] = this.docs[docName].getSyncRequest()
            }
        }
        return repoSyncRequest
    }

}
