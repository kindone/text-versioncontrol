import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Excerpt, ExcerptSource, ExcerptSync, ExcerptTarget, ExcerptUtil } from './excerpt'
import { History, IHistory } from './history/History'
import { SyncResponse } from './history/SyncResponse'
import { ExDelta } from './primitive/ExDelta'
import { IDelta } from './primitive/IDelta'
import { Range } from './primitive/Range'
import {
    asDelta,
    deltaLength,
    JSONStringify,
    flattenTransformedDelta,
    flattenDeltas,
    expectEqual,
} from './primitive/util'



export class Document {
    private readonly history: IHistory

    constructor(public readonly uri: string, content: string | IDelta) {
        this.history = new History(uri, asDelta(content))
    }

    public getCurrentRev(): number {
        return this.history.getCurrentRev()
    }

    public getContent(): IDelta {
        return this.history.getContent()
    }

    public getContentAt(rev: number): IDelta {
        return this.history.getContentAt(rev)
    }

    public append(deltas: IDelta[]): number {
        return this.history.append(deltas)
    }

    public merge(baseRev: number, deltas: IDelta[]) {
        return this.history.merge({ rev: baseRev, branchName: '$simulate$', deltas })
    }

    public getChange(rev: number): IDelta[] {
        return this.history.getChange(rev)
    }

    public getChangesFrom(fromRev: number): IDelta[] {
        return this.history.getChangesFrom(fromRev)
    }

    public getChangesFromTo(fromRev: number, toRev: number): IDelta[] {
        return this.history.getChangesFromTo(fromRev, toRev)
    }

    public takeExcerpt(start: number, end: number): ExcerptSource {
        const fullContentLength = deltaLength(this.history.getContent())
        const takePartial = [ExcerptUtil.take(start, end, fullContentLength)]
        const partialContent = this.history.simulateAppend(takePartial).content
        return new ExcerptSource(this.uri, this.history.getCurrentRev(), start, end, partialContent)
    }

    public takeExcerptAt(rev: number, start: number, end: number): ExcerptSource {
        const length = deltaLength(this.history.getContentAt(rev))
        const takeChange = [ExcerptUtil.take(start, end, length)]
        const result = this.history.simulateAppendAt(rev, takeChange)
        const content = result.content
        return new ExcerptSource(this.uri, rev, start, end, content)
    }

    public pasteExcerpt(offset: number, source: ExcerptSource): ExcerptTarget {
        const rev = this.getCurrentRev() + 1
        const target = new ExcerptTarget(rev, offset, deltaLength(source.content)+1)
        // const pasted = source.content
        const pasted = ExcerptUtil.pasteWithMarkers(rev, offset, source)
        expectEqual(deltaLength(source.content) + 1, deltaLength(pasted))

        const ops: Op[] = [{ retain: offset }]
        this.history.append([new ExDelta(ops.concat(pasted.ops), source)])
        return target
    }

    public getSyncSinceExcerpted(source: ExcerptSource): ExcerptSync {
        const uri = source.uri
        const rev = this.getCurrentRev()
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFrom(source.rev)
        const croppedChanges = initialRange.cropChanges(changes)
        const rangeTransformed = initialRange.applyChanges(changes)

        return { uri, rev, changes: croppedChanges, range: rangeTransformed }
    }

    public getSingleSyncSinceExcerpted(source: ExcerptSource): ExcerptSync {
        const uri = source.uri
        const rev = source.rev + 1
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFromTo(source.rev, source.rev) // only 1 change
        const croppedChanges = initialRange.cropChanges(changes)
        const rangeTransformed = initialRange.applyChanges(changes)

        return { uri, rev, changes: croppedChanges, range: rangeTransformed }
    }

    public syncExcerpt(sync: ExcerptSync, target: ExcerptTarget): ExcerptTarget {
        const initialTargetRange = new Range(target.offset, target.offset + target.length)

        const syncChanges = this.shiftSyncChanges(sync, target)

        let targetRange = initialTargetRange
        let sourceRev = sync.rev - syncChanges.length
        let targetRev = target.rev
        for(const syncChange of syncChanges) {
            const simulateResult = this.simulateMergeAt(target.rev, [syncChange])
            const changes = simulateResult.resDeltas.concat(simulateResult.reqDeltas)

            const newTargetRange = targetRange.applyChanges(changes)
            const {excerpted} = ExcerptUtil.excerptMarker(sync.uri, sourceRev++, this.getCurrentRev() + 1, newTargetRange.end - newTargetRange.start)
            const replaceMarker = new Delta([
                {retain: targetRange.start},
                {delete: 1},
                {insert: excerpted}])
            const flattened = flattenTransformedDelta(syncChange, replaceMarker)
            this.merge(targetRev, [flattened])
            // console.log('transformedSync: ', `${targetRev}->${this.getCurrentRev()}`, JSONStringify(flattened))
            targetRev = this.getCurrentRev()
            targetRange = newTargetRange
        }

        return new ExcerptTarget(targetRev, targetRange.start, targetRange.end - targetRange.start)
    }

    /** private methods */

    private shiftSyncChanges(sync: ExcerptSync, target:ExcerptTarget):IDelta[]
    {
        const shiftedSyncChanges = _.map(
                sync.changes,
                change => {
                    // adjust offset
                    if (change.ops.length > 0 && change.ops[0].retain) {
                        change.ops[0].retain! += target.offset+1
                    } else {
                        change.ops.unshift({ retain: target.offset+1 })
                    }
                    return change
                },
                [],
            )
        return shiftedSyncChanges
    }

    private simulateMergeAt(rev:number, changes:IDelta[]):SyncResponse
    {
        return this.history.simulateMergeAt(rev, changes, '$simulate$')
    }
}
