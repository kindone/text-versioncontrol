import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op'
import * as _ from 'underscore'
import { Excerpt, ExcerptSource, ExcerptSync, ExcerptTarget, ExcerptUtil } from './excerpt'
import { History, IHistory } from './history/History'
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
        const target = new ExcerptTarget(rev, offset, deltaLength(source.content))

        const ops: Op[] = [{ retain: offset }]
        this.history.append([new ExDelta(ops.concat(source.content.ops), source)])
        return target
    }

    public getSyncSinceExcerpted(source: ExcerptSource): ExcerptSync {
        const uri = source.uri
        const rev = this.getCurrentRev()
        const initialRange = new Range(source.start, source.end)
        const changes = this.getChangesFrom(source.rev)
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

        return { uri, rev, changes: croppedChanges, range: rangeTransformed }
    }

    public getSingleSyncSinceExcerpted(source: ExcerptSource): ExcerptSync {
        const uri = source.uri
        const rev = source.rev + 1
        const initialRange = new Range(source.start, source.end)
        const changesSince = this.getChangesFromTo(source.rev, source.rev) // only 1
        const rangeTransformed = initialRange.applyChanges(changesSince)
        const croppedSourceChanges = initialRange.cropChanges(changesSince)

        return { uri, rev, changes: croppedSourceChanges, range: rangeTransformed }
    }

    public syncExcerpt(sync: ExcerptSync, target: ExcerptTarget): ExcerptTarget {
        const targetRange = new Range(target.offset, target.offset + target.length)

        let adjustedSourceChanges = _.map(
            sync.changes,
            change => {
                // adjust offset
                if (change.ops.length > 0 && change.ops[0].retain) {
                    change.ops[0].retain! += target.offset
                } else {
                    change.ops.unshift({ retain: target.offset })
                }
                return change
            },
            [],
        )

        adjustedSourceChanges = [flattenDeltas(...adjustedSourceChanges)]

        const simulateResult = this.history.simulateMergeAt(target.rev, adjustedSourceChanges, '$simulate$')
        const newTargetRange = targetRange.applyChanges(simulateResult.resDeltas.concat(simulateResult.reqDeltas))

        const targetRev = this.getCurrentRev() + 1
        this.merge(target.rev, adjustedSourceChanges)
        return new ExcerptTarget(this.getCurrentRev(), newTargetRange.start, newTargetRange.end - newTargetRange.start)
    }
}
