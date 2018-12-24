import Delta = require("quill-delta")
import Op from "quill-delta/dist/Op"
import * as _ from 'underscore'
import { Excerpt, ExcerptSource, ExcerptSync, ExcerptTarget, ExcerptUtil } from "./excerpt"
import { History, IHistory } from "./history/History"
import { IDelta } from "./primitive/IDelta"
import { Range } from "./primitive/Range"
import { asDelta, deltaLength, JSONStringify, flattenTransformedDelta, flattenDeltas, expectEqual } from "./primitive/util"


export class Document {
    private readonly history:IHistory
    private excerpts:Excerpt[] = []

    constructor(public readonly uri:string, content:string | IDelta) {
        this.history = new History(uri, asDelta(content))
    }

    public getCurrentRev():number {
        return this.history.getCurrentRev()
    }

    public getExcerpts():Excerpt[] {
        return this.excerpts
    }

    public getContent():IDelta {
        return this.history.getContent()
    }

    public getContentAt(rev:number):IDelta {
        return this.history.getContentForRev(rev)
    }

    public append(deltas: IDelta[]):number {
        return this.history.append(deltas, this.uri)
    }

    public merge(baseRev:number, deltas:IDelta[]) {
        return this.history.merge({rev: baseRev, branchName: '$simulate$', deltas})
    }

    public getChanges(fromRev:number, toRev:number = -1):IDelta[] {
        return this.history.getChanges(fromRev, toRev)
    }

    public takeExcerpt(start:number, end:number):ExcerptSource {
        const fullContentLength = deltaLength(this.history.getContent())
        const takePartial = [ExcerptUtil.take(start, end, fullContentLength)]
        const partialContent = this.history.simulateAppend(takePartial, this.uri).content
        return new ExcerptSource(this.uri, this.history.getCurrentRev(), start, end, partialContent)
    }

    public takeExcerptAt(rev:number, start:number, end:number):ExcerptSource {
        const length = deltaLength(this.history.getContentForRev(rev))
        const takeChange = [ExcerptUtil.take(start, end, length)]
        const result = this.history.simulateAppendAt(rev, takeChange, this.uri)
        const content = result.content
        return new ExcerptSource(this.uri, rev, start, end, content)
    }

    public pasteExcerpt(offset:number, source:ExcerptSource):ExcerptTarget {
        const rev = this.getCurrentRev()+1
        const target = new ExcerptTarget(rev, offset, deltaLength(source.content))

        const ops:Op[] = [{retain: offset}]
        this.history.append([new Delta(ops.concat(source.content.ops))], "$excerpt$")
        this.excerpts.push(new Excerpt(source, target))
        return target
    }

    public getSyncSinceExcerpted(source:ExcerptSource):ExcerptSync
    {
        const uri = source.uri
        const rev = this.getCurrentRev()
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChanges(source.rev)
        const rangeTransformed = initialRange.applyChanges(changes)
        const croppedChanges = initialRange.cropChanges(changes)

        {
            const changesString = JSONStringify(changes)
            const excerpt1 = this.takeExcerpt(rangeTransformed.start, rangeTransformed.end)
            const flattenedChange = flattenDeltas(...changes)
            const flattenedRange = initialRange.applyChangeOpen(flattenedChange)
            const excerpt2 = this.takeExcerpt(flattenedRange.start, flattenedRange.end)

            // expectEqual([initialRange.applyChange(flattenDeltas(...changes))], rangeTransformed)
            // expectEqual([initialRange.cropChange(flattenDeltas(...changes))], croppedChanges)
            // expectEqual(this.takeExcerpt(rangeTransformed.start, rangeTransformed.end-rangeTransformed.start))
        }

        return {uri, rev, changes: croppedChanges, range:rangeTransformed}
    }

    public getSingleSyncSinceExcerpted(source:ExcerptSource):ExcerptSync
    {
        const uri = source.uri
        const rev = source.rev + 1
        const initialRange = new Range(source.start, source.end)
        const changesSince = this.getChanges(source.rev, source.rev) // only 1
        const rangeTransformed = initialRange.applyChanges(changesSince)
        const croppedSourceChanges = initialRange.cropChanges(changesSince)

        return {uri, rev, changes: croppedSourceChanges, range:rangeTransformed}
    }

    public syncExcerpt(sync:ExcerptSync, target:ExcerptTarget):ExcerptTarget {
        const targetRange = new Range(target.offset, target.offset + target.length)

        let adjustedSourceChanges = _.map(sync.changes, (change) => {
          // adjust offset
            if(change.ops.length > 0 && change.ops[0].retain)
                change.ops[0].retain! += target.offset
            else
                change.ops.unshift({retain: target.offset})
            return change
        }, [])

        adjustedSourceChanges = [flattenDeltas(...adjustedSourceChanges)]

        const simulateResult = this.history.simulateMergeAt(target.rev, adjustedSourceChanges, "$simulate$")
        const newTargetRange = targetRange.applyChanges(simulateResult.resDeltas.concat(simulateResult.reqDeltas))

        const targetRev = this.getCurrentRev()+1

        const replaceMarkers:IDelta = new Delta([
            {retain: targetRange.start},
            {retain: targetRange.end-targetRange.start}
            ])

        if(adjustedSourceChanges.length > 0)
            adjustedSourceChanges[adjustedSourceChanges.length-1] = flattenTransformedDelta(adjustedSourceChanges[adjustedSourceChanges.length-1], replaceMarkers)
        else
            adjustedSourceChanges[0] = replaceMarkers

        const syncResult = this.merge(target.rev, adjustedSourceChanges)
        return new ExcerptTarget(this.getCurrentRev(), newTargetRange.start, newTargetRange.end - newTargetRange.start)
    }


}