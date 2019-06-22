import Delta = require('quill-delta')
import * as _ from 'underscore'
import { Change } from '../primitive/Change'
import { SharedString } from '../primitive/SharedString'
import { asChange, expectEqual } from '../primitive/util'
import { Savepoint } from './Savepoint'
import { SyncRequest, AppendRequest } from './SyncRequest'
import { MergeResult } from './SyncResponse'

export interface IHistory {
    readonly name: string
    getCurrentRev(): number

    getContent(): Change
    getContentAt(rev: number): Change

    getChange(rev: number): Change[]
    getChangesFrom(fromRev: number): Change[]
    getChangesFromTo(fromRev: number, toRev: number): Change[]

    simulateAppend(deltas: Change[]): MergeResult
    simulateAppendAt(baseRev: number, deltas: Change[]): MergeResult
    simulateMergeAt(baseRev: number, deltas: Change[], branchName: string): MergeResult
    simulateRebaseAt(baseRev: number, deltas: Change[], branchName: string): MergeResult

    append(deltas: Change[]): number
    merge(mergeRequest: SyncRequest): MergeResult
    rebase(rebaseRequest: SyncRequest): MergeResult

    clone():IHistory
}

export class History implements IHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20

    private savepoints: Savepoint[] = []
    private deltas: Change[] = []

    constructor(public readonly name: string, initialContent: string | Change = '', private readonly initialRev = 0) {
        this.doSavepoint(initialRev, asChange(initialContent))
    }

    public clone():History {
        const cloned = new History(this.name, '', this.initialRev)
        cloned.savepoints = this.savepoints.concat()
        cloned.deltas = this.deltas.concat()
        return cloned
    }

    public append(deltas: Change[]): number {
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

        this.invalidateSavepoints(baseRev)
        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE <= this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    public simulateAppend(deltas: Change[]): MergeResult {
        return this.simulateMergeAt(this.getCurrentRev(), deltas, '$append$')
    }

    public simulateAppendAt(fromRev: number, deltas: Change[]): MergeResult {
        const baseRevText = this.getContentAt(fromRev)
        const ss = SharedString.fromDelta(baseRevText)

        let newDeltas: Change[] = []
        for (const delta of deltas) {
            newDeltas = newDeltas.concat(ss.applyChange(delta, '$append$'))
        }

        return { rev: fromRev + deltas.length, reqDeltas: newDeltas, resDeltas: [], content: ss.toDelta() }
    }

    public simulateMergeAt(baseRev: number, remoteDeltas: Change[], branchName: string): MergeResult {
        const baseRevText = this.getContentAt(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        const localDeltas = this.getChangesFrom(baseRev)

        for (const localDelta of localDeltas) {
            ss.applyChange(localDelta, this.name)
        }

        let newDeltas: Change[] = []
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

    public simulateRebaseAt(baseRev: number, deltas: Change[], branchName: string): MergeResult {
        return this.simulateRebase(branchName, deltas, baseRev)
    }

    public getCurrentRev(): number {
        return this.deltas.length + this.initialRev
    }

    public getContent(): Change {
        return this.getContentAt(this.getCurrentRev())
    }

    public getContentAt(rev: number): Change {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = SharedString.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++) {
            ss.applyChange(this.deltas[i - this.initialRev], '_')
        }

        return ss.toDelta()
    }

    public getChange(rev: number): Change[] {
        return this.deltas.slice(rev - this.initialRev, rev + 1 - this.initialRev)
    }

    public getChangesFrom(fromRev: number): Change[] {
        return this.deltas.slice(fromRev - this.initialRev)
    }

    public getChangesFromTo(fromRev: number, toRev: number): Change[] {
        if (toRev >= 0) return this.deltas.slice(fromRev - this.initialRev, toRev + 1 - this.initialRev)
        else return this.deltas.slice(fromRev - this.initialRev)
    }

    private mergeAt(baseRev: number, deltas: Change[], name?: string): MergeResult {
        const result = this.simulateMergeAt(baseRev, deltas, name ? name : this.name)

        this.deltas = this.deltas.concat(result.reqDeltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE < this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    private simulateRebase(branchName: string, remoteDeltas: Change[], baseRev: number): MergeResult {
        const baseRevText = this.getContentAt(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        let newDeltas: Change[] = []

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

    private invalidateSavepoints(baseRev:number) {
        this.savepoints = this.savepoints.filter(savepoint => savepoint.rev <= baseRev)
    }

    private doSavepoint(rev: number, content: Change): void {
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
