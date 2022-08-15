import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Delta } from '../core/Delta'
import { DeltaContext } from '../core/DeltaContext'
import { IDelta } from '../core/IDelta'
import { contentLength, cropContent, minContentLengthForChange, filterChanges, asDelta } from '../core/primitive'
import { Range } from '../core/Range'
import { SharedString } from '../core/SharedString'
import { Source } from '../core/Source'
import { JSONStringify, expectEqual, isEqual } from '../core/util'
import { Excerpt, ExcerptSource, ExcerptTarget, ExcerptUtil, ExcerptSync } from '../excerpt'
import { ExcerptMarkerWithOffset } from '../excerpt/ExcerptUtil'
import { History, IHistory } from '../history/History'
import { SyncResponse } from '../history/SyncResponse'
import { DocumentSet } from './DocumentSet'


export class Document {
    private history: IHistory
    private externalChanges: Map<string,Set<number>>

    constructor(public readonly name: string, content: string | IDelta) {
        this.history = new History(name, asDelta(content))
        this.externalChanges = new Map()
    }

    public getName(): string {
        return this.history.name
    }

    public clone(): Document {
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

    public merge(baseRev: number, changes: IDelta[]): SyncResponse {
        return this.history.merge({ rev: baseRev, branch: '$simulate$', changes })
    }

    public getChangesFrom(fromRev: number): IDelta[] {
        return this.history.getChangesFrom(fromRev)
    }

    public getChangeAt(rev: number): IDelta {
        return this.history.getChangeAt(rev)
    }

    public getChangeFor(rev: number): IDelta {
        return this.history.getChangeFor(rev)
    }

    public getChangesInRange(fromRev: number, toRev: number): IDelta[] {
        return this.history.getChangesInRange(fromRev, toRev)
    }

    // returns {offset, excerpt}
    public getFullExcerpts(): Array<{ offset: number; excerpt: Excerpt }> {
        return ExcerptUtil.getFullExcerpts(this.getContent())
    }

    public getFullExcerptsAt(rev:number): Array<{ offset: number; excerpt: Excerpt }> {
        return ExcerptUtil.getFullExcerpts(this.getContentAt(rev))
    }

    // returns {offset, insert, attributes}
    public getPartialExcerpts(): ExcerptMarkerWithOffset[] {
        return ExcerptUtil.getPartialExcerpts(this.getContent())
    }

    public takeExcerpt(start: number, end: number): ExcerptSource {
        const croppedContent = this.take(start, end)
        const safeCroppedContent = { ...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops) }
        expectEqual(contentLength(safeCroppedContent), end - start)
        return new ExcerptSource(this.name, this.history.getCurrentRev(), start, end, safeCroppedContent)
    }

    public takeExcerptAt(rev: number, start: number, end: number): ExcerptSource {
        const croppedContent = this.takeAt(rev, start, end)
        const safeCroppedContent = { ...croppedContent, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedContent.ops) }
        expectEqual(contentLength(safeCroppedContent), end - start)
        return new ExcerptSource(this.name, rev, start, end, safeCroppedContent)
    }

    public take(start: number, end: number): IDelta {
        const content = this.history.getContent()
        return cropContent(content, start, end)
    }

    public takeAt(rev: number, start: number, end: number): IDelta {
        const content = this.history.getContentAt(rev)
        return cropContent(content, start, end)
    }

    public pasteExcerpt(offset: number, source: ExcerptSource, check = true): Excerpt {
        const rev = this.getCurrentRev()
        const target = new ExcerptTarget(this.name, rev, offset, offset + contentLength(source.content) + 1)

        const pasted = ExcerptUtil.getPasteWithMarkers(source, this.name, rev, offset)
        expectEqual(source.content, cropContent(pasted, 1, contentLength(pasted) - 1))

        const ops: Op[] = [{ retain: offset }]

        const change = new Delta(ops.concat(pasted.ops))
        this.history.append([change])

        // check
        if (check) {
            const leftMarker = this.take(target.start, target.start + 1)
            const rightMarker = this.take(target.end, target.end + 1)

            if (leftMarker.ops.length !== 1 || !ExcerptUtil.isLeftExcerptMarker(leftMarker.ops[0]))
                throw new Error(
                    'left marker check failed: L:' +
                        JSONStringify(leftMarker) +
                        ' |R: ' +
                        JSONStringify(rightMarker) +
                        ', ' +
                        JSONStringify(this.getContentAt(target.rev)),
                )
            if (rightMarker.ops.length !== 1 || !ExcerptUtil.isRightExcerptMarker(rightMarker.ops[0]))
                throw new Error(
                    'right marker check failed: L:' +
                        JSONStringify(leftMarker) +
                        ' |R: ' +
                        JSONStringify(rightMarker) +
                        ', ' +
                        JSONStringify(this.getContentAt(target.rev)),
                )

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
        const rangesTransformed = initialRange.mapChanges(changes)

        // crop
        const safeCroppedChanges = croppedChanges.map(croppedChange => {
            return { ...croppedChange, ops: ExcerptUtil.setExcerptMarkersAsCopied(croppedChange.ops) }
        })

        // add context to changes (only if none exist)
        let rev = excerptSource.rev
        const changesWithContext = safeCroppedChanges.reduce((acc:IDelta[], change:IDelta):IDelta[] => {
            if(!change.context) {
                change.context = {sourceUri: uri, sourceRev: (rev ++)}
            }
            acc.push(change)
            return acc
        }, [])

        return this.composeSyncs(uri, excerptSource.rev, changesWithContext, rangesTransformed)
    }

    public syncExcerpt(excerpt: Excerpt, documentSet: DocumentSet, check = true, revive = false):number {
        if (excerpt.target.uri !== this.name)
            throw new Error('invalid argument (target uri mismatches): ' + JSONStringify(excerpt))

        const source = excerpt.source
        const target = excerpt.target

        const sourceDoc = documentSet.getDocument(source.uri)
        const syncs = sourceDoc.getSyncSinceExcerpted(source)

        if (syncs.length === 0)
            return 0

        const tiebreaker = source.uri === target.uri ? source.rev > target.rev : source.uri > target.uri
        const sourceBranchName = tiebreaker ? 'S' : 's' // S < _ < s

        const beforeContent = this.getContentAt(target.rev)
        const pasteChange = this.getChangeAt(target.rev)

        // starting from pasted state, combine what actually happened and synchronized
        const baseContent = this.getContentAt(target.rev + 1)

        const ss = SharedString.fromDelta(beforeContent)
        ss.applyChange(pasteChange, sourceBranchName)

        const localChanges = this.getChangesFrom(target.rev + 1)

        // adjust offsets of changes from syncs
        let sourceChanges = syncs.map(sync => this.changeShifted(sync.change, target.start + 1))

        if (syncs.length > 0 && contentLength(baseContent) < minContentLengthForChange(sourceChanges[0]))
            throw new Error('invalid sync change. content too short')

        // filter out already applied changes
        const externalChanges = this.externalChanges
        sourceChanges = filterChanges(baseContent, sourceChanges, (_i, change) => {
            const context = change.context
            if(context) {
                // current reference (current doc)
                if(context.sourceUri === target.uri && context.sourceRev <= target.rev + 1)
                    return false
                // external reference
                if(context.sourceUri != target.uri) {
                    const alreadyApplied = externalChanges.has(context.sourceUri) && externalChanges.get(context.sourceUri)!.has(context.sourceRev)
                    this.addExternalChange(context.sourceUri, context.sourceRev)
                    return !alreadyApplied
                }
            }
            return true
        })

        // apply local changes
        for (const localChange of localChanges) {
            ss.applyChange(localChange, '_')
        }

        // apply remote changes and generate new sync records
        const newLocalChanges: IDelta[] = []
        for(const sourceChange of sourceChanges) {
            const newChange = ss.applyChange(sourceChange, sourceBranchName)
            newLocalChanges.push(newChange)
        }

        // add new sync records
        this.append(newLocalChanges)
        return newLocalChanges.length
    }

    /** private methods */

    private changeShifted(change: IDelta, offset: number): IDelta {
        const shiftAmount = offset
        const shiftedChange = new Delta(change.ops.concat(), change.context)
        // adjust offset:
        // utilize first retain if it exists
        if (shiftedChange.ops.length > 0 && shiftedChange.ops[0].retain) {
            shiftedChange.ops[0] = { ...shiftedChange.ops[0], retain: shiftedChange.ops[0].retain! + shiftAmount }
        } else {
            // otherwise just prepend new retain
            shiftedChange.ops.unshift({ retain: shiftAmount })
        }
        return shiftedChange
    }

    private composeSyncs(uri: string, firstRev: number, changes: IDelta[], ranges: Range[]):ExcerptSync[] {
        if (changes.length !== ranges.length)
            throw new Error(
                'Unexpected error in composeSyncs: ' + JSONStringify(changes) + ', ' + JSONStringify(ranges),
            )

        const syncs: ExcerptSync[] = []

        for (let i = 0; i < changes.length; i++) {
            syncs.push({ uri, rev: firstRev++, change: changes[i], range: ranges[i] })
        }
        return syncs
    }

    private addExternalChange(docId:string, revision:number) {
        if(!this.externalChanges.has(docId)) {
            this.externalChanges.set(docId, new Set<number>([revision]))
        }
        else {
            const set = this.externalChanges.get(docId)
            set!.add(revision)
        }
    }
}
