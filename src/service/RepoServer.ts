import { History, ISyncRequest, ISyncResponse } from "../History"
import { DocServer } from "./DocServer";
import { IRepoSyncRequest } from "./RepoClient";


export interface IRepoSyncResponse {
    [name:string]:ISyncResponse
}


export class RepoServer
{
    public docs:{[name:string]:DocServer} = {}

    constructor(docNames:string[]) {
        for(const docName of docNames)
            this.docs[docName] = new DocServer(new History(docName))
    }

    public merge( syncRequest: IRepoSyncRequest): IRepoSyncResponse {
        const syncResponse:IRepoSyncResponse = {}
        for(const docName in syncRequest)
        {
            if(this.docs[docName]) {
                const docSyncRequest = syncRequest[docName]
                syncResponse[docName] = this.docs[docName].merge(docSyncRequest)
            }
        }
        return  syncResponse
    }

    public getText(docName:string) {
        return this.docs[docName].getText()
    }
}