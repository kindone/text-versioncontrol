import Delta = require("quill-delta")
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { DestInfo, IDestInfo } from "./excerpt/DestInfo"
import { Excerpt } from "./excerpt/Excerpt"
import { ISourceInfo, SourceInfo } from "./excerpt/SourceInfo"
import { ISourceSyncInfo } from "./excerpt/SourceSyncInfo"
import { History, IHistory } from "./History"
import { IDelta } from "./primitive/IDelta"
import { Range } from "./primitive/Range"
import { asDelta, deltaLength } from "./util"



export class Document {
    private readonly history:IHistory

    constructor(public readonly uri:string, content:string | IDelta) {
        this.history = new History(uri, asDelta(content))
    }

    public getCurrentRev() {
        return this.history.getCurrentRev()
    }

    public getContent() {
        return this.history.getContent()
    }

    public append(deltas: IDelta[]) {
        this.history.append(deltas, this.uri)
    }

    public merge(baseRev:number, deltas:IDelta[]) {
        this.history.merge({baseRev, branchName: '$simulate$', deltas})
    }

    public changesSince(rev:number):IDelta[] {
        return this.history.getChanges(rev, -1)
    }

    public syncInfoSinceExcerpted(sourceInfo:ISourceInfo):ISourceSyncInfo
    {
        const uri = sourceInfo.uri
        const rev = this.getCurrentRev()
        const initialRange = new Range(sourceInfo.offset, sourceInfo.offset+sourceInfo.retain)
        const changesSince = this.changesSince(sourceInfo.rev)
        const rangeTransformed = initialRange.applyChanges(changesSince)
        const croppedSourceChanges = initialRange.cropChanges(changesSince)

        return {uri, rev, changes: croppedSourceChanges, range:rangeTransformed}
    }


    public syncExcerpt(syncInfo:ISourceSyncInfo, destInfo:IDestInfo) {
        const croppedSourceChanges = syncInfo.changes
        const destOffset = destInfo.offset + 1 // 1 for marker
        const adjustedSourceChanges = destOffset === 0 ? croppedSourceChanges : _.map(croppedSourceChanges, (change) => {
          // adjust offset
          if(change.ops[0].retain)
            change.ops[0].retain += destOffset
          else
            change.ops.unshift({retain: destOffset})
          return change
        }, [])

        const markers = Excerpt.excerptMarker(syncInfo.uri, syncInfo.rev, this.getCurrentRev())
        const replaceMarkers = new Delta().retain(destInfo.offset).delete(1).insert(markers.begin).retain(deltaLength(destInfo.content)-2).delete(1).insert(markers.end)
        adjustedSourceChanges.unshift(replaceMarkers)

        this.merge(destInfo.rev, adjustedSourceChanges)
    }

    public takeExcerpt(offset:number, retain:number):ISourceInfo {
        const length = deltaLength(this.history.getContent())
        const content = this.history.simulate([Excerpt.take(offset, retain, length)], this.uri)

        return new SourceInfo(this.uri, this.history.getCurrentRev(), offset, retain, length, content)
    }

    public takeExcerptAt(rev:number, offset:number, retain:number):ISourceInfo {
        const length = deltaLength(this.history.getContentForRev(rev))
        const content = this.history.simulate([Excerpt.take(offset, retain, length)], this.uri)
        return new SourceInfo(this.uri, rev, offset, retain, length, content)
    }

    public pasteExcerpt(offset:number, sourceInfo:ISourceInfo):IDestInfo {
        const rev = this.getCurrentRev()+1
        const pasted = Excerpt.paste(rev, offset, sourceInfo)
        const destInfo = new DestInfo(rev, offset, pasted)

        const ops:Op[] = [{retain: offset}]
        this.history.append([new Delta(ops.concat(pasted.ops))], "$excerpt$")
        return destInfo
    }

}