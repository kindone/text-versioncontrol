import Delta = require('quill-delta')
import * as _ from 'underscore'
import { IDelta } from '../primitive/IDelta'
import { SharedString } from '../primitive/SharedString'
import { asDelta, expectEqual } from '../primitive/util'
import { Savepoint } from './Savepoint'
import { SyncRequest, AppendRequest } from './SyncRequest'
import { MergeResult } from './SyncResponse'

export interface IHistory {
    readonly name: string
    getCurrentRev(): number

    getText(): string
    getTextAt(rev: number): string

    getContent(): IDelta
    getContentAt(rev: number): IDelta

    getChange(rev: number): IDelta[]
    getChangesFrom(fromRev: number): IDelta[]
    getChangesFromTo(fromRev: number, toRev: number): IDelta[]

    simulateAppend(deltas: IDelta[]): MergeResult
    simulateAppendAt(baseRev: number, deltas: IDelta[]): MergeResult
    simulateMergeAt(baseRev: number, deltas: IDelta[], branchName: string): MergeResult
    simulateRebaseAt(baseRev: number, deltas: IDelta[], branchName: string): MergeResult

    append(deltas: IDelta[]): number

    merge(mergeRequest: SyncRequest): MergeResult
    rebase(rebaseRequest: SyncRequest): MergeResult
}

export class History implements IHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20

    private savepoints: Savepoint[] = []
    private deltas: IDelta[] = []

    constructor(public readonly name: string, initialContent: string | IDelta = '', private readonly initialRev = 0) {
        this.doSavepoint(initialRev, asDelta(initialContent))
    }

    public append(deltas: IDelta[]): number {
        this.mergeAt(this.getCurrentRev(), deltas)
        return this.getCurrentRev()
    }

    public merge(mergeRequest: SyncRequest): MergeResult {
        return this.mergeAt(mergeRequest.rev, mergeRequest.deltas, mergeRequest.branchName)
    }

    // prioritize remote
    public rebase(rebaseRequest: SyncRequest): MergeResult {
        const baseRev = rebaseRequest.rev
        const deltas = rebaseRequest.deltas
        const branchName = rebaseRequest.branchName

        const result = this.simulateRebase(branchName ? branchName : this.name, deltas, baseRev)

        // old + rebased + transformed
        this.deltas = this.deltas.slice(0, baseRev - this.initialRev)
        this.deltas = this.deltas.concat(result.reqDeltas)
        this.deltas = this.deltas.concat(result.resDeltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE < this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    public simulateAppend(deltas: IDelta[]): MergeResult {
        return this.simulateMergeAt(this.getCurrentRev(), deltas, '$append$')
    }

    public simulateAppendAt(fromRev: number, deltas: IDelta[]): MergeResult {
        const baseRevText = this.getContentAt(fromRev)
        const ss = SharedString.fromDelta(baseRevText)

        let newDeltas: IDelta[] = []
        for (const delta of deltas) {
            newDeltas = newDeltas.concat(ss.applyChange(delta, '$append$'))
        }

        return { rev: fromRev + deltas.length, reqDeltas: newDeltas, resDeltas: [], content: ss.toDelta() }
    }

    public simulateMergeAt(baseRev: number, remoteDeltas: IDelta[], branchName: string): MergeResult {
        const baseRevText = this.getContentAt(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        const localDeltas = this.getChangesFrom(baseRev)

        for (const localDelta of localDeltas) {
            ss.applyChange(localDelta, this.name)
        }

        let newDeltas: IDelta[] = []
        for (const delta of remoteDeltas) {
            newDeltas = newDeltas.concat(ss.applyChange(delta, branchName))
        }

        return {
            rev: baseRev + remoteDeltas.length + localDeltas.length,
            reqDeltas: newDeltas,
            resDeltas: localDeltas,
            content: ss.toDelta(),
        }
    }

    public simulateRebaseAt(baseRev: number, deltas: IDelta[], branchName: string): MergeResult {
        return this.simulateRebase(branchName, deltas, baseRev)
    }

    public getCurrentRev(): number {
        return this.deltas.length + this.initialRev
    }

    public getText(): string {
        return this.getTextAt(this.getCurrentRev())
    }

    public getTextAt(rev: number): string {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = SharedString.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++) {
            ss.applyChange(this.deltas[i - this.initialRev], '_')
        }

        return ss.toText()
    }

    public getContent(): IDelta {
        return this.getContentAt(this.getCurrentRev())
    }

    public getContentAt(rev: number): IDelta {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = SharedString.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++) {
            ss.applyChange(this.deltas[i - this.initialRev], '_')
        }

        return ss.toDelta()
    }

    public getChange(rev: number): IDelta[] {
        return this.deltas.slice(rev - this.initialRev, rev + 1 - this.initialRev)
    }

    public getChangesFrom(fromRev: number): IDelta[] {
        return this.deltas.slice(fromRev - this.initialRev)
    }

    public getChangesFromTo(fromRev: number, toRev: number): IDelta[] {
        if (toRev >= 0) return this.deltas.slice(fromRev - this.initialRev, toRev + 1 - this.initialRev)
        else return this.deltas.slice(fromRev - this.initialRev)
    }

    private mergeAt(baseRev: number, deltas: IDelta[], name?: string): MergeResult {
        const result = this.simulateMergeAt(baseRev, deltas, name ? name : this.name)

        this.deltas = this.deltas.concat(result.reqDeltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE < this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    private simulateRebase(branchName: string, remoteDeltas: IDelta[], baseRev: number): MergeResult {
        const baseRevText = this.getContentAt(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        let newDeltas: IDelta[] = []

        for (const delta of remoteDeltas) {
            ss.applyChange(delta, branchName)
        }

        const localDeltas = this.getChangesFrom(baseRev)
        for (const localDelta of localDeltas) {
            newDeltas = newDeltas.concat(ss.applyChange(localDelta, this.name))
        }

        return {
            rev: baseRev + remoteDeltas.length + localDeltas.length,
            reqDeltas: remoteDeltas,
            resDeltas: newDeltas,
            content: ss.toDelta(),
        }
    }

    private checkSavepoints(): void {
        const initial = this.savepoints[0]
        if (initial.rev !== this.initialRev) throw new Error('initial savepoint rev must be first rev')

        const ss = SharedString.fromDelta(initial.content)
        let j = 0
        for (let rev = this.initialRev; rev < this.getCurrentRev(); rev++) {
            if (rev > this.getLatestSavepointRev()) break

            if (rev === this.savepoints[j].rev) {
                expectEqual(
                    ss.toDelta(),
                    this.savepoints[j].content,
                    'savepoint is not correct at (' + rev + ',' + j + '):',
                )
                j++
            }
            ss.applyChange(this.deltas[rev - this.initialRev], '_')
        }
    }

    private doSavepoint(rev: number, content: IDelta): void {
        this.savepoints.push({ rev, content })
    }

    private getLatestSavepointRev(): number {
        return this.savepoints[this.savepoints.length - 1].rev
    }

    private getNearestSavepointForRev(rev: number): Savepoint {
        // return this.savepoints[0]
        let nearestSavepoint = this.savepoints[0]
        for (const savepoint of this.savepoints) {
            if (rev <= savepoint.rev) break
            nearestSavepoint = savepoint
        }

        return nearestSavepoint
    }
}
