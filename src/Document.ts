import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Excerpt, ExcerptSource, BatchExcerptSync, ExcerptTarget, ExcerptUtil, ExcerptSync } from './excerpt'
import { History, IHistory } from './history/History'
import { SyncResponse } from './history/SyncResponse'
import { Change } from './primitive/Change'
import { ExDelta } from './primitive/ExDelta'
import { printChange } from './primitive/printer';
import { Range } from './primitive/Range'
import {
    asChange,
    JSONStringify,
    flattenTransformedChange,
    flattenChanges,
    expectEqual,
    normalizeChanges,
    contentLength,
    cropContent,
    isEqual
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
        const croppedContent = this.take(start, end)
        const safeCroppedContent = {...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops)}
        return new ExcerptSource(this.uri, this.history.getCurrentRev(), start, end, safeCroppedContent)
    }

    public takeExcerptAt(rev: number, start: number, end: number): ExcerptSource {
        const croppedContent = this.takeAt(rev, start, end)
        const safeCroppedContent = {...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops)}
        return new ExcerptSource(this.uri, rev, start, end, safeCroppedContent)
    }

    public take(start:number, end:number):Change {
        const content = this.history.getContent()
        return cropContent(content, start, end - start)
    }

    public takeAt(rev:number, start:number, end:number):Change {
        const content = this.history.getContentAt(rev)
        return cropContent(content, start, end - start)
    }

    public pasteExcerpt(offset: number, source: ExcerptSource): Excerpt {
        const rev = this.getCurrentRev() + 1
        const target = new ExcerptTarget(rev, offset, contentLength(source.content)+1)
        // const pasted = source.content
        const pasted = ExcerptUtil.getPasteWithMarkers(this.uri, rev, offset, source)
        expectEqual(source.content, cropContent(pasted, 1))

        const ops: Op[] = [{ retain: offset }]
        const change = new ExDelta(ops.concat(pasted.ops), source)
        this.history.append([change])
        // expectEqual([change], this.history.getChange(this.history.getCurrentRev()-1))

        return new Excerpt(source, target)
    }

    public getSyncSinceExcerpted(source: ExcerptSource): ExcerptSync[] {
        const uri = source.uri
        const lastRev = this.getCurrentRev()
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFrom(source.rev)
        // const croppedChanges = normalizeChanges(initialRange.cropChanges(changes))
        const croppedChanges = initialRange.cropChanges(changes)
        const rangesTransformed = initialRange.mapChanges(changes)

        //  check
        for(let i = 0; i < changes.length; i++) {
            const change = changes[i]
            const croppedChange = croppedChanges[i]
            const range = (i === 0 ? initialRange : rangesTransformed[i-1])

            if(!isEqual(range.cropChange(change), croppedChange)) {
                console.error("failed in iteration: ", i)
                console.error('initial range:', initialRange)
                console.error('changes:' , JSONStringify(changes))
                console.error('croppedChanges:' , JSONStringify(croppedChanges))
                console.error('ranges:' , JSONStringify(rangesTransformed))
                console.error('range.cropChange(change):', range.cropChange(change))
                for(let j = 0; j < changes.length; j++) {
                    console.error(`range[${j}].cropChange(changes[${j}]):`, rangesTransformed[j].cropChange(changes[j]))
                }
                console.error('croppedChange:', croppedChange)
            }
        }

        // if(JSONStringify(normalizeChanges(croppedChanges)) !== JSONStringify(croppedChanges)) {
        //     console.error('croppedChanges:' , JSONStringify(croppedChanges))
        //     console.error('normalizeChanges(croppedChanges):' , JSONStringify(normalizeChanges(croppedChanges)))
        //     console.error('initialRange.mapChanges(changes):' , initialRange.mapChanges(changes))
        //     console.error('initialRange.mapChanges(croppedChanges):' , initialRange.mapChanges(croppedChanges))
        //     console.error('initialRange.mapChanges(normalizeChanges(croppedChanges)):' , initialRange.mapChanges(normalizeChanges(croppedChanges)))
        // }

        return this.composeSyncs(uri, lastRev, croppedChanges, rangesTransformed)
    }

    public getSingleSyncSinceExcerpted(source: ExcerptSource): ExcerptSync[] {
        const uri = source.uri
        const rev = source.rev + 1
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFromTo(source.rev, source.rev) // only 1 change
        const croppedChanges = initialRange.cropChanges(changes)
        const rangesTransformed = initialRange.mapChanges(changes)
        return this.composeSyncs(uri, rev, croppedChanges, rangesTransformed)
    }

    public syncExcerpt(syncs: ExcerptSync[], target: ExcerptTarget): ExcerptTarget {
        // const syncChanges = this.changesShiftedToTarget(syncs, target)
        const initialTargetRange = new Range(target.offset, target.offset + target.length)
        let targetRange = initialTargetRange
        let targetRev = target.rev

        for(const sync of syncs) {
            // const sync = syncs[i]
            const sourceUri = sync.uri
            const sourceRev = sync.rev
            const sourceRange = sync.range
            const targetUri = this.uri
            const syncChange = this.changeShifted(sync, targetRange.start+1) // +1 for marker
            // simulate without marker
            const simulatedResult = this.simulateMergeAt(targetRev, [syncChange])
            const simulatedChangesMerged = simulatedResult.resDeltas.concat(simulatedResult.reqDeltas)

            // calculate range from simulation
            const newTargetRange = targetRange.applyChanges(simulatedChangesMerged)
            // get updated excerpt marker from range
            const excerptMarker = ExcerptUtil.makeExcerptMarker(sourceUri, sourceRev, targetUri, this.getCurrentRev() + 1, newTargetRange.end - newTargetRange.start)
            const excerptMarkerReplaceChange = new Delta([
                {retain: targetRange.start},
                {delete: 1},
                {insert: excerptMarker}])
            // flatten the change and the marker into single change
            const flattenedChange = flattenTransformedChange(syncChange, excerptMarkerReplaceChange)
            flattenedChange.source = {type: 'sync', uri: sync.uri, rev: sourceRev, start: sourceRange.start, end: sourceRange.end}
            // actual merge
            const result = this.merge(targetRev, [flattenedChange])
            console.log('transformedSync.rev: ', `${targetRev}->${this.getCurrentRev()}`)
            console.log('transformedSync.syncChange: ', JSONStringify(sync.change))
            console.log("transformedSync.syncChangeShifted:", JSONStringify(syncChange))
            console.log("transformedSync.excerptMarkerReplaceChange:", JSONStringify(excerptMarkerReplaceChange))
            console.log("transformedSync.flattenedChange:", JSONStringify(flattenedChange))
            console.log("transformedSync.result:", JSONStringify(result))
            console.log("transformedSync.content:", printChange(this.getContent()))
            console.log("transformedSync.targetRange:", newTargetRange)
            expectEqual(cropContent(this.getContent(), newTargetRange.start, 1), new ExDelta([{insert: excerptMarker}]))

            // update targetRev
            targetRev = this.getCurrentRev()
            targetRange = newTargetRange
        }

        // return updated target
        return new ExcerptTarget(targetRev, targetRange.start, targetRange.end - targetRange.start)
    }

    /** private methods */

    private changeShifted(sync: ExcerptSync, offset:number):Change {
        const shiftAmount = offset
        const change = new ExDelta(sync.change.ops, sync.change.source)
        // adjust offset:
        // utilize first retain if it exists
        if (change.ops.length > 0 && change.ops[0].retain) {
            change.ops[0].retain! += shiftAmount
        // otherwise just append new retain
        } else {
            change.ops.unshift({ retain: shiftAmount })
        }
        return change
    }

    private changesShiftedToTarget(syncs: ExcerptSync[], target:ExcerptTarget):Change[]
    {
        const shiftAmount = target.offset+1 // +1 for marker
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
