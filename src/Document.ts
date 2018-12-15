import Delta = require("quill-delta")
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { DestInfo, IDestInfo } from "./excerpt/DestInfo"
import { ExcerptUtil } from "./excerpt/ExcerptUtil"
import { ISourceInfo, SourceInfo } from "./excerpt/SourceInfo"
import { ISourceSyncInfo } from "./excerpt/SourceSyncInfo"
import { History, IHistory } from "./History"
import { IDelta } from "./primitive/IDelta"
import { Range } from "./primitive/Range"
import { asDelta, deltaLength, JSONStringify, flattenTransformedDelta, flattenDeltas, expectEqual } from "./primitive/util"



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

    public getContentAt(rev:number) {
        return this.history.getContentForRev(rev)
    }

    public append(deltas: IDelta[]) {
        this.history.append(deltas, this.uri)
    }

    public merge(baseRev:number, deltas:IDelta[]) {
        return this.history.merge({baseRev, branchName: '$simulate$', deltas})
    }

    public changesSince(fromRev:number, toRev:number = -1):IDelta[] {
        return this.history.getChanges(fromRev, toRev)
    }


    public takeExcerpt(offset:number, retain:number):ISourceInfo {
        const length = deltaLength(this.history.getContent())
        const takeChange = [ExcerptUtil.take(offset, retain, length)]
        const content = this.history.simulateAppend(takeChange, this.uri).content
        return new SourceInfo(this.uri, this.history.getCurrentRev(), offset, retain, content)
    }

    public takeExcerptAt(rev:number, offset:number, retain:number):ISourceInfo {
        const length = deltaLength(this.history.getContentForRev(rev))
        const takeChange = [ExcerptUtil.take(offset, retain, length)]
        const result = this.history.simulateAppendAt(rev, takeChange, this.uri)
        const content = result.content
        return new SourceInfo(this.uri, rev, offset, retain, content)
    }

    public pasteExcerpt(offset:number, sourceInfo:ISourceInfo):IDestInfo {
        const rev = this.getCurrentRev()+1
        const pasted = ExcerptUtil.paste(rev, offset, sourceInfo)
        const destInfo = new DestInfo(rev, offset, deltaLength(pasted))

        const ops:Op[] = [{retain: offset}]
        this.history.append([new Delta(ops.concat(pasted.ops))], "$excerpt$")
        return destInfo
    }

    public syncInfoSinceExcerpted(sourceInfo:ISourceInfo):ISourceSyncInfo
    {
        const uri = sourceInfo.uri
        const rev = this.getCurrentRev()
        const initialRange = new Range(sourceInfo.offset, sourceInfo.offset+sourceInfo.retain)
        const changes = this.changesSince(sourceInfo.rev)
        const rangeTransformed = initialRange.applyChanges(changes)
        const croppedChanges = initialRange.cropChanges(changes)

        {
            const changesString = JSONStringify(changes)
            const excerpt1 = this.takeExcerpt(rangeTransformed.start, rangeTransformed.end-rangeTransformed.start)
            const flattenedChange = flattenDeltas(...changes)
            const flattenedRange = initialRange.applyChangeOpen(flattenedChange)
            const excerpt2 = this.takeExcerpt(flattenedRange.start, flattenedRange.end-flattenedRange.start)

            // expectEqual([initialRange.applyChange(flattenDeltas(...changes))], rangeTransformed)
            // expectEqual([initialRange.cropChange(flattenDeltas(...changes))], croppedChanges)
            // expectEqual(this.takeExcerpt(rangeTransformed.start, rangeTransformed.end-rangeTransformed.start))
        }

        return {uri, rev, changes: croppedChanges, range:rangeTransformed}
    }

    public syncInfo1SinceExcerpted(sourceInfo:ISourceInfo):ISourceSyncInfo
    {
        const uri = sourceInfo.uri
        const rev = sourceInfo.rev + 1
        const initialRange = new Range(sourceInfo.offset, sourceInfo.offset + sourceInfo.retain)
        const changesSince = this.changesSince(sourceInfo.rev, sourceInfo.rev) // only 1
        const rangeTransformed = initialRange.applyChanges(changesSince)
        const croppedSourceChanges = initialRange.cropChanges(changesSince)

        return {uri, rev, changes: croppedSourceChanges, range:rangeTransformed}
    }

    public syncExcerpt(syncInfo:ISourceSyncInfo, destInfo:IDestInfo):IDestInfo {
        const destRange = new Range(destInfo.offset, destInfo.offset + destInfo.length)

        let adjustedSourceChanges = _.map(syncInfo.changes, (change) => {
          // adjust offset
            if(change.ops.length > 0 && change.ops[0].retain)
                change.ops[0].retain! += destInfo.offset+1
            else
                change.ops.unshift({retain: destInfo.offset+1})
            return change
        }, [])

        adjustedSourceChanges = [flattenDeltas(...adjustedSourceChanges)]

        const simulateResult = this.history.simulateMergeAt(destInfo.rev, adjustedSourceChanges, "$simulate$")
        const newDestRange = destRange.applyChanges(simulateResult.resDeltas.concat(simulateResult.reqDeltas))

        const destRev = this.getCurrentRev()+1

        const markers = ExcerptUtil.excerptMarker(syncInfo.uri, syncInfo.rev, destRev)
        const replaceMarkers:IDelta = new Delta([
            {retain: destRange.start},
            {delete: 1},
            {insert: markers.begin},
            {retain: destRange.end-destRange.start-2},
            {delete: 1},
            {insert: markers.end}])

        replaceMarkers.sync = syncInfo

        if(adjustedSourceChanges.length > 0)
            adjustedSourceChanges[adjustedSourceChanges.length-1] = flattenTransformedDelta(adjustedSourceChanges[adjustedSourceChanges.length-1], replaceMarkers)
        else
            adjustedSourceChanges[0] = replaceMarkers

        const syncResult = this.merge(destInfo.rev, adjustedSourceChanges)
        return new DestInfo(this.getCurrentRev(), newDestRange.start, newDestRange.end - newDestRange.start)
    }


}