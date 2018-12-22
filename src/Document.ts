import Delta = require("quill-delta")
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { Excerpt } from "./excerpt/Excerpt"
import { ExcerptSource } from "./excerpt/ExcerptSource"
import { ExcerptTarget } from "./excerpt/ExcerptTarget"
import { ExcerptUtil } from "./excerpt/ExcerptUtil"
import { SourceSync } from "./excerpt/SourceSyncInfo"
import { History, IHistory } from "./History"
import { IDelta } from "./primitive/IDelta"
import { Range } from "./primitive/Range"
import { asDelta, deltaLength, JSONStringify, flattenTransformedDelta, flattenDeltas, expectEqual } from "./primitive/util"


export class Document {
    private readonly history:IHistory
    private excerpts:Excerpt[] = []

    constructor(public readonly uri:string, content:string | IDelta) {
        this.history = new History(uri, asDelta(content))
    }

    public getCurrentRev() {
        return this.history.getCurrentRev()
    }

    public getExcerpts() {
        return this.excerpts
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

    public getChanges(fromRev:number, toRev:number = -1):IDelta[] {
        return this.history.getChanges(fromRev, toRev)
    }

    public takeExcerpt(offset:number, retain:number):ExcerptSource {
        const fullContentLength = deltaLength(this.history.getContent())
        const takePartial = [ExcerptUtil.take(offset, retain, fullContentLength)]
        const partialContent = this.history.simulateAppend(takePartial, this.uri).content
        return new ExcerptSource(this.uri, this.history.getCurrentRev(), offset, retain, partialContent)
    }

    public takeExcerptAt(rev:number, offset:number, retain:number):ExcerptSource {
        const length = deltaLength(this.history.getContentForRev(rev))
        const takeChange = [ExcerptUtil.take(offset, retain, length)]
        const result = this.history.simulateAppendAt(rev, takeChange, this.uri)
        const content = result.content
        return new ExcerptSource(this.uri, rev, offset, retain, content)
    }

    public pasteExcerpt(offset:number, sourceInfo:ExcerptSource):ExcerptTarget {
        const rev = this.getCurrentRev()+1
        const destInfo = new ExcerptTarget(rev, offset, deltaLength(sourceInfo.content))

        const ops:Op[] = [{retain: offset}]
        this.history.append([new Delta(ops.concat(sourceInfo.content.ops))], "$excerpt$")
        this.excerpts.push(new Excerpt(sourceInfo, destInfo))
        return destInfo
    }

    public syncInfoSinceExcerpted(sourceInfo:ExcerptSource):SourceSync
    {
        const uri = sourceInfo.uri
        const rev = this.getCurrentRev()
        const initialRange = new Range(sourceInfo.offset, sourceInfo.offset+sourceInfo.retain)
        const changes = this.getChanges(sourceInfo.rev)
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

    public syncInfo1SinceExcerpted(sourceInfo:ExcerptSource):SourceSync
    {
        const uri = sourceInfo.uri
        const rev = sourceInfo.rev + 1
        const initialRange = new Range(sourceInfo.offset, sourceInfo.offset + sourceInfo.retain)
        const changesSince = this.getChanges(sourceInfo.rev, sourceInfo.rev) // only 1
        const rangeTransformed = initialRange.applyChanges(changesSince)
        const croppedSourceChanges = initialRange.cropChanges(changesSince)

        return {uri, rev, changes: croppedSourceChanges, range:rangeTransformed}
    }

    public syncExcerpt(syncInfo:SourceSync, destInfo:ExcerptTarget):ExcerptTarget {
        const destRange = new Range(destInfo.offset, destInfo.offset + destInfo.length)

        let adjustedSourceChanges = _.map(syncInfo.changes, (change) => {
          // adjust offset
            if(change.ops.length > 0 && change.ops[0].retain)
                change.ops[0].retain! += destInfo.offset
            else
                change.ops.unshift({retain: destInfo.offset})
            return change
        }, [])

        adjustedSourceChanges = [flattenDeltas(...adjustedSourceChanges)]

        const simulateResult = this.history.simulateMergeAt(destInfo.rev, adjustedSourceChanges, "$simulate$")
        const newDestRange = destRange.applyChanges(simulateResult.resDeltas.concat(simulateResult.reqDeltas))

        const destRev = this.getCurrentRev()+1

        const replaceMarkers:IDelta = new Delta([
            {retain: destRange.start},
            {retain: destRange.end-destRange.start}
            ])

        if(adjustedSourceChanges.length > 0)
            adjustedSourceChanges[adjustedSourceChanges.length-1] = flattenTransformedDelta(adjustedSourceChanges[adjustedSourceChanges.length-1], replaceMarkers)
        else
            adjustedSourceChanges[0] = replaceMarkers

        const syncResult = this.merge(destInfo.rev, adjustedSourceChanges)
        return new ExcerptTarget(this.getCurrentRev(), newDestRange.start, newDestRange.end - newDestRange.start)
    }


}