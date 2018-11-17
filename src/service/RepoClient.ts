import { History, ISyncResponse, ISyncRequest } from "../History"
import { IDelta } from "../primitive/IDelta"
import { DocClient } from "./DocClient"
import { IRepoSyncResponse } from "./RepoServer"

export interface IRepoSyncRequest {
    [name:string]:ISyncRequest
}

export class RepoClient
{
    public docs:{[name:string]:DocClient} = {}

    constructor(docNames:string[]) {
        for(const docName of docNames)
            this.docs[docName] = new DocClient(new History(docName))
    }

    public apply(docName:string, deltas: IDelta[]) {
        this.docs[docName].apply(deltas)
    }

    public sync(syncResponse:IRepoSyncResponse) {
        for(const docName in syncResponse) {
            if(this.docs[docName])
                this.docs[docName].sync(syncResponse[docName])
            else
                throw new Error('Cannnot sync. No document exists with the name: ' + docName)
        }
    }

    public getSyncRequest():IRepoSyncRequest {
        const repoSyncRequest:IRepoSyncRequest = {}
        for(const docName in this.docs)
        {
            if(docName)
                repoSyncRequest[docName] = this.docs[docName].getSyncRequest()
        }
        return repoSyncRequest
    }

    public getText(docName:string) {
        return this.docs[docName].getText()
    }
}