import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Delta } from '../core/Delta'
import { DeltaContext } from '../core/DeltaContext';
import { IDelta } from '../core/IDelta'
import { contentLength, cropContent, minContentLengthForChange, filterChanges, asDelta } from '../core/primitive';
import { Range } from '../core/Range'
import { SharedString } from '../core/SharedString';
import { Source } from '../core/Source'
import { JSONStringify,  expectEqual, isEqual } from '../core/util'
import { Excerpt, ExcerptSource, ExcerptTarget, ExcerptUtil, ExcerptSync } from '../excerpt'
import { ExcerptMarkerWithOffset, } from '../excerpt/ExcerptUtil';
import { History, IHistory } from '../history/History'
import { SyncResponse } from '../history/SyncResponse'
import { DocumentSet } from './DocumentSet';








export class Document {
    private history: IHistory

    constructor(public readonly name: string, content: string | IDelta) {
        this.history = new History(name, asDelta(content))
    }

    public getName():string {
        return this.history.name
    }

    public clone():Document
    {
        const doc = new Document(this.name, '')
        doc.history = this.history.clone()
        return doc
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

    public append(changes: IDelta[]): number {
        return this.history.append(changes)
    }

    public merge(baseRev: number, changes: IDelta[]):SyncResponse {
        return this.history.merge({ rev: baseRev, branch: '$simulate$', changes })
    }

    public getChangesFrom(fromRev: number): IDelta[] {
        return this.history.getChangesFrom(fromRev)
    }

    public getChangeAt(rev: number): IDelta {
        return this.history.getChangeAt(rev)
    }

    public getChangesFromTo(fromRev: number, toRev: number): IDelta[] {
        return this.history.getChangesFromTo(fromRev, toRev)
    }

    // returns {offset, excerpt}
    public getFullExcerpts(): Array<{offset: number, excerpt: Excerpt}> {
        return ExcerptUtil.getFullExcerpts(this.getContent())
    }

    // returns {offset, insert, attributes}
    public getPartialExcerpts(): ExcerptMarkerWithOffset[] {
       return ExcerptUtil.getPartialExcerpts(this.getContent())
    }

    public takeExcerpt(start: number, end: number): ExcerptSource {
        const croppedContent = this.take(start, end)
        const safeCroppedContent = {...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops)}
        expectEqual(contentLength(safeCroppedContent), end - start)
        return new ExcerptSource(this.name, this.history.getCurrentRev(), start, end, safeCroppedContent)
    }

    public takeExcerptAt(rev: number, start: number, end: number): ExcerptSource {
        const croppedContent = this.takeAt(rev, start, end)
        const safeCroppedContent = {...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops)}
        expectEqual(contentLength(safeCroppedContent), end - start)
        return new ExcerptSource(this.name, rev, start, end, safeCroppedContent)
    }

    public take(start:number, end:number):IDelta {
        const content = this.history.getContent()
        return cropContent(content, start, end)
    }

    public takeAt(rev:number, start:number, end:number):IDelta {
        const content = this.history.getContentAt(rev)
        return cropContent(content, start, end)
    }

    public pasteExcerpt(offset: number, source: ExcerptSource, check=true): Excerpt {
        const rev = this.getCurrentRev()
        const target = new ExcerptTarget(this.name, rev, offset, offset + contentLength(source.content)+1)

        const pasted = ExcerptUtil.getPasteWithMarkers(source, this.name, rev, offset)
        expectEqual(source.content, cropContent(pasted, 1, contentLength(pasted) - 1))

        const ops: Op[] = [{ retain: offset }]

        const contexts:DeltaContext[] = [{type: 'paste', sourceUri: source.uri, sourceRev: source.rev, targetUri: this.name, targetRev: rev}]
        const change = new Delta(ops.concat(pasted.ops), contexts)
        this.history.append([change])

        // check
        if(check)
        {
            const leftMarker = this.take(target.start, target.start+1)
            const rightMarker = this.take(target.end, target.end+1)

            if(leftMarker.ops.length !== 1 || !ExcerptUtil.isLeftExcerptMarker(leftMarker.ops[0]))
                throw new Error('left marker check failed: L:' + JSONStringify(leftMarker) + " |R: " + JSONStringify(rightMarker) + ", " + JSONStringify(this.getContentAt(target.rev)))
            if(rightMarker.ops.length !== 1  || !ExcerptUtil.isRightExcerptMarker(rightMarker.ops[0]))
                throw new Error('right marker check failed: L:' + JSONStringify(leftMarker) + " |R: " + JSONStringify(rightMarker) + ", " + JSONStringify(this.getContentAt(target.rev)))

            expectEqual(ExcerptUtil.decomposeMarker(leftMarker.ops[0]).target, target)
            expectEqual(ExcerptUtil.decomposeMarker(rightMarker.ops[0]).target, target)
        }

        return new Excerpt(source, target)
    }

    public getSyncSinceExcerpted(excerptSource: Source): ExcerptSync[] {
        const uri = excerptSource.uri

        const initialRange = new Range(excerptSource.start, excerptSource.end)
        const changes = this.getChangesFrom(excerptSource.rev)
        const croppedChanges = initialRange.cropChanges(changes)

        const safeCroppedÇhanges = croppedChanges.map(croppedChange => {
            return {...croppedChange, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedChange.ops)}
        })
        const rangesTransformed = initialRange.mapChanges(changes)
        return this.composeSyncs(uri, excerptSource.rev, safeCroppedÇhanges, rangesTransformed)
    }

    public syncExcerpt(excerpt:Excerpt, documentSet: DocumentSet, check=true, revive=false)/*: ExcerptTarget*/ {
        const source = excerpt.source
        const target = excerpt.target
        if(target.uri !== this.name)
            throw new Error('invalid argument: ' + JSONStringify(excerpt))
        const sourceDoc = documentSet.getDocument(source.uri)
        const syncs = sourceDoc.getSyncSinceExcerpted(source)

        if(syncs.length === 0)
            return excerpt.target

        // prepend context info and shift change
        let sourceChanges = syncs.map(sync => {
            const change = sync.change
            const newContext:DeltaContext = {type: 'sync', sourceUri: source.uri, sourceRev: sync.rev, targetUri: target.uri, targetRev: target.rev}
            const newContexts = change.contexts ? [newContext].concat(change.contexts) : [newContext]
            return {...change, contexts: newContexts}
        }).map(change => this.changeShifted(change, target.start+1))

        const tiebreaker = (source.uri === target.uri ? (source.rev > target.rev) : (source.uri > target.uri))
        const sourceBranchName = tiebreaker ? "S" : "s"

        const beforeContent = this.getContentAt(target.rev)
        const pasteChange = this.getChangeAt(target.rev)
        const baseContent = this.getContentAt(target.rev+1)
        if(syncs.length > 0 && contentLength(baseContent) < minContentLengthForChange(sourceChanges[0]))
            throw new Error('invalid sync change')

        const ss = SharedString.fromDelta(beforeContent)
        ss.applyChange(pasteChange, sourceBranchName)

        const localChanges = this.getChangesFrom(target.rev+1)

        // filter already applied changes
        sourceChanges = filterChanges(baseContent, sourceChanges, (i, change) => {
            if(change.contexts)
            for(const context of change.contexts.slice(1)) {
                // if the change originated here and old
                if(context.sourceUri === target.uri && context.sourceRev <= target.rev+1)
                    return false
            }
            return true
        })

        // go through already applied syncs
        let idx = 0
        for(const localChange of localChanges) {
            // synchronization change previously synced
            if(localChange.contexts &&
               localChange.contexts[0].targetUri === target.uri &&
               localChange.contexts[0].targetRev === target.rev)
            {
                // bring original change at source and apply
                if(idx >= sourceChanges.length)
                    throw new Error('index out of bound')

                const originalChange = sourceChanges[idx++]
                if(!isEqual(originalChange.contexts![0].sourceRev, localChange.contexts[0].sourceRev))
                    throw new Error('revisions mismatch')

                ss.applyChange(originalChange, sourceBranchName)
            }
            else {
                ss.applyChange(localChange, '_')
            }
        }

        // apply rest and generate new sync records
        const newLocalChanges:IDelta[] =  []
        for(;idx < sourceChanges.length; idx++) {
            const newChange = ss.applyChange(sourceChanges[idx], sourceBranchName)
            newLocalChanges.push(newChange)
        }

        // add new sync records
        this.append(newLocalChanges)
    }

    /** private methods */

    private changeShifted(change: IDelta, offset:number):IDelta {
        const shiftAmount = offset
        const shiftedChange = new Delta(change.ops.concat(), change.contexts)
        // adjust offset:
        // utilize first retain if it exists
        if (shiftedChange.ops.length > 0 && shiftedChange.ops[0].retain) {
            shiftedChange.ops[0] = {...shiftedChange.ops[0], retain: shiftedChange.ops[0].retain! + shiftAmount }
        // otherwise just append new retain
        } else {
            shiftedChange.ops.unshift({ retain: shiftAmount })
        }
        return shiftedChange
    }

    private composeSyncs(uri:string, firstRev:number, changes:IDelta[], ranges:Range[]) {
        if(changes.length !== ranges.length)
            throw new Error("Unexpected error in composeSyncs: " + JSONStringify(changes) + ", " + JSONStringify(ranges))

        const syncs:ExcerptSync[] = []

        for(let i = 0; i < changes.length; i++) {
            syncs.push({ uri, rev: firstRev++, change: changes[i], range: ranges[i] })
        }
        return syncs
    }
}
