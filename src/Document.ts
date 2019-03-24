import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Excerpt, ExcerptSource, BatchExcerptSync, ExcerptTarget, ExcerptUtil, ExcerptSync } from './excerpt'
import { History, IHistory } from './history/History'
import { SyncResponse } from './history/SyncResponse'
import { Change } from './primitive/Change'
import { ExDelta } from './primitive/ExDelta'
import { Range } from './primitive/Range'
import {
    asChange,
    JSONStringify,
    flattenTransformedChange,
    flattenChanges,
    expectEqual,
    normalizeChanges,
    contentLength,
} from './primitive/util'



export class Document {
    private history: IHistory

    constructor(public readonly uri: string, content: string | Change) {
        this.history = new History(uri, asChange(content))
    }

    public clone():Document
    {
        const doc = new Document(this.uri, '')
        doc.history = this.history.clone()
        return doc
    }

    public getCurrentRev(): number {
        return this.history.getCurrentRev()
    }

    public getContent(): Change {
        return this.history.getContent()
    }

    public getContentAt(rev: number): Change {
        return this.history.getContentAt(rev)
    }

    public append(deltas: Change[]): number {
        return this.history.append(deltas)
    }

    public merge(baseRev: number, deltas: Change[]):SyncResponse {
        return this.history.merge({ rev: baseRev, branchName: '$simulate$', deltas })
    }

    public getChange(rev: number): Change[] {
        return this.history.getChange(rev)
    }

    public getChangesFrom(fromRev: number): Change[] {
        return this.history.getChangesFrom(fromRev)
    }

    public getChangesFromTo(fromRev: number, toRev: number): Change[] {
        return this.history.getChangesFromTo(fromRev, toRev)
    }

    public getPastedExcerpts() {
        const excerpts = []
        let offset = 0
        const content = this.getContent()
        for(const op of content.ops)
        {
            if(!op.insert)
                throw new Error('content is in invalid state: ' + JSONStringify(op))

            if(typeof op.insert === 'string')
            {
                offset += op.insert.length
            }
            else {
                if(ExcerptUtil.isExcerptMarker(op)) {
                    const excerptedOp:any = op
                    excerpts.push({offset, ...excerptedOp.insert.excerpted})
                }
                offset ++
            }
        }

        return excerpts
    }

    public takeExcerpt(start: number, end: number): ExcerptSource {
        const fullContentLength = contentLength(this.history.getContent())
        const takePartialContent = [ExcerptUtil.take(start, end, fullContentLength)]
        const croppedContent = this.history.simulateAppend(takePartialContent).content
        const safeCroppedContent = {...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops)}
        return new ExcerptSource(this.uri, this.history.getCurrentRev(), start, end, safeCroppedContent)
    }

    public takeExcerptAt(rev: number, start: number, end: number): ExcerptSource {
        const fullContentLength = contentLength(this.history.getContentAt(rev))
        const takePartialContent = [ExcerptUtil.take(start, end, fullContentLength)]
        const croppedContent = this.history.simulateAppendAt(rev, takePartialContent).content
        const safeCroppedContent = {...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops)}
        return new ExcerptSource(this.uri, rev, start, end, safeCroppedContent)
    }

    public pasteExcerpt(offset: number, source: ExcerptSource): Excerpt {
        const rev = this.getCurrentRev() + 1
        const target = new ExcerptTarget(rev, offset, contentLength(source.content)+1)
        // const pasted = source.content
        const pasted = ExcerptUtil.getPasteWithMarkers(this.uri, rev, offset, source)
        expectEqual(contentLength(source.content) + 1, contentLength(pasted))

        const ops: Op[] = [{ retain: offset }]
        this.history.append([new ExDelta(ops.concat(pasted.ops), source)])
        return new Excerpt(source, target)
    }

    public getSyncSinceExcerpted(source: ExcerptSource): ExcerptSync[] {
        const uri = source.uri
        const lastRev = this.getCurrentRev()
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFrom(source.rev)
        const croppedChanges = normalizeChanges(initialRange.cropChanges(changes))
        const rangesTransformed = initialRange.mapChanges(croppedChanges)

        return this.composeSyncs(uri, lastRev, croppedChanges, rangesTransformed)
    }

    public getSingleSyncSinceExcerpted(source: ExcerptSource): ExcerptSync[] {
        const uri = source.uri
        const rev = source.rev + 1
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFromTo(source.rev, source.rev) // only 1 change
        const croppedChanges = initialRange.cropChanges(changes)
        const rangesTransformed = initialRange.mapChanges(croppedChanges)
        return this.composeSyncs(uri, rev, croppedChanges, rangesTransformed)
    }

    public syncExcerpt(syncs: ExcerptSync[], target: ExcerptTarget): ExcerptTarget {
        const initialTargetRange = new Range(target.offset, target.offset + target.length)

        const syncChanges = this.changesShiftedToTarget(syncs, target)

        let targetRange = initialTargetRange
        // let sourceRev = syncs.rev - syncChanges.length
        let targetRev = target.rev

        for(let i = 0; i < syncs.length; i++) {
            const sync = syncs[i]
            const sourceUri = sync.uri
            const sourceRev = sync.rev
            const sourceRange = sync.range
            const targetUri = this.uri
            const syncChange = syncChanges[i]
            // simulate
            const simulateResult = this.simulateMergeAt(target.rev, [syncChange])
            const changes = simulateResult.resDeltas.concat(simulateResult.reqDeltas)

            // calculate range from simulation
            const newTargetRange = targetRange.applyChanges(changes)
            // get updated excerpt marker from range
            const excerpted = ExcerptUtil.makeExcerptMarker(sourceUri, sourceRev, targetUri, this.getCurrentRev() + 1, newTargetRange.end - newTargetRange.start)
            const replaceMarker = new Delta([
                {retain: targetRange.start},
                {delete: 1},
                {insert: excerpted}])
            // flatten change and marker into single change
            const flattened = flattenTransformedChange(syncChange, replaceMarker)

            flattened.source = {type: 'sync', uri: sync.uri, rev: sourceRev, start: sourceRange.start, end: sourceRange.end}
            // actual merge
            this.merge(targetRev, [flattened])
            // console.log('transformedSync: ', `${targetRev}->${this.getCurrentRev()}`, JSONStringify(flattened))

            // update targetRev
            targetRev = this.getCurrentRev()
            targetRange = newTargetRange
        }

        // return updated target
        return new ExcerptTarget(targetRev, targetRange.start, targetRange.end - targetRange.start)
    }

    /** private methods */

    private changesShiftedToTarget(syncs: ExcerptSync[], target:ExcerptTarget):Change[]
    {
        const shiftAmount = target.offset+1
        const shiftedSyncChanges = _.map(syncs, sync => {
            const change = sync.change
            // adjust offset:
            // utilize first retain if it exists
            if (change.ops.length > 0 && change.ops[0].retain) {
                change.ops[0].retain! += shiftAmount
            // otherwise just append new retain
            } else {
                change.ops.unshift({ retain: shiftAmount })
            }
            return change
        }, [])
        return shiftedSyncChanges
    }

    private simulateMergeAt(rev:number, changes:Change[]):SyncResponse
    {
        return this.history.simulateMergeAt(rev, changes, '$simulate$')
    }

    private composeSyncs(uri:string, lastRev:number, changes:Change[], ranges:Range[]) {
        if(changes.length !== ranges.length)
            throw new Error("Unexpected error in composeSyncs: " + JSONStringify(changes) + ", " + JSONStringify(ranges))

        const syncs:ExcerptSync[] = []
        let rev = lastRev - changes.length + 1
        for(let i = 0; i < changes.length; i++, rev++) {
            syncs.push({ uri, rev, change: changes[i], range: ranges[i] })
        }
        return syncs
    }
}
