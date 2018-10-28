import { DestInfo } from "./excerpt/DestInfo"
import { Excerpt } from "./excerpt/Excerpt"
import { ISourceInfo, SourceInfo } from "./excerpt/SourceInfo";
import { History, IHistory } from "./History";

export class Document {
    constructor(public readonly uri:string, private readonly history:IHistory = new History(uri)) {
    }

    public getCurrentRev() {
        return this.history.getCurrentRev()
    }

    public getContent() {
        return this.history.getContent()
    }

    public takeExcerpt(rev:number, offset:number, retain:number, length:number):ISourceInfo {
        const content = this.history.simulate([Excerpt.take(offset, retain, length)], this.uri)
        return new SourceInfo(this.uri, rev, offset, retain, length, content)
    }

    public pasteExcerpt(offset:number, sourceInfo:ISourceInfo) {
        const destInfo = new DestInfo(this.getCurrentRev(), offset)
        const excerpt = new Excerpt(sourceInfo, destInfo)
        const paste = excerpt.pasted()
        this.history.append([paste], "$excerpt$")
    }
}