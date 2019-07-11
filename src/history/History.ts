import * as _ from 'underscore'
import { IDelta } from '../core/IDelta'
import { asDelta } from '../core/primitive';
import { SharedString } from '../core/SharedString'
import { expectEqual } from '../core/util'
import { Savepoint } from './Savepoint'
import { SyncRequest } from './SyncRequest'
import { MergeResult } from './SyncResponse'


export interface IHistory {
    readonly name: string
    getCurrentRev(): number

    getContent(): IDelta
    getContentAt(rev: number): IDelta

    getChangeAt(rev: number): IDelta
    getChangeFor(rev: number): IDelta
    getChangesFrom(fromRev: number): IDelta[]
    getChangesFromTo(fromRev: number, toRev: number): IDelta[]

    simulateAppend(changes: IDelta[]): MergeResult
    simulateAppendAt(baseRev: number, changes: IDelta[]): MergeResult
    simulateMergeAt(baseRev: number, changes: IDelta[], branchName: string): MergeResult
    simulateRebaseAt(baseRev: number, changes: IDelta[], branchName: string): MergeResult

    append(changes: IDelta[]): number
    merge(mergeRequest: SyncRequest): MergeResult
    rebase(rebaseRequest: SyncRequest): MergeResult

    clone():IHistory
}

export class History implements IHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20

    private savepoints: Savepoint[] = []
    private changes: IDelta[] = []

    constructor(public readonly name: string, initialContent: string | IDelta = '', private readonly initialRev = 0) {
        this.doSavepoint(initialRev, asDelta(initialContent))
    }

    public clone():History {
        const cloned = new History(this.name, '', this.initialRev)
        cloned.savepoints = this.savepoints.concat()
        cloned.changes = this.changes.concat()
        return cloned
    }

    public append(changes: IDelta[]): number {
        this.mergeAt(this.getCurrentRev(), changes)
        return this.getCurrentRev()
    }

    public merge(mergeRequest: SyncRequest): MergeResult {
        return this.mergeAt(mergeRequest.rev, mergeRequest.changes, mergeRequest.branch)
    }

    // prioritize remote
    public rebase(rebaseRequest: SyncRequest): MergeResult {
        const baseRev = rebaseRequest.rev
        const changes = rebaseRequest.changes
        const branchName = rebaseRequest.branch

        const result = this.simulateRebase(branchName ? branchName : this.name, changes, baseRev)

        // old + rebased + transformed
        this.changes = this.changes.slice(0, baseRev - this.initialRev)
        this.changes = this.changes.concat(result.reqChanges)
        this.changes = this.changes.concat(result.resChanges)

        this.invalidateSavepoints(baseRev)
        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE <= this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    public simulateAppend(changes: IDelta[]): MergeResult {
        return this.simulateMergeAt(this.getCurrentRev(), changes, '$append$')
    }

    public simulateAppendAt(fromRev: number, changes: IDelta[]): MergeResult {
        const baseRevText = this.getContentAt(fromRev)
        const ss = SharedString.fromDelta(baseRevText)

        let newChanges: IDelta[] = []
        for (const change of changes) {
            newChanges = newChanges.concat(ss.applyChange(change, '$append$'))
        }

        return { rev: fromRev + changes.length, reqChanges: newChanges, resChanges: [], content: ss.toDelta() }
    }

    public simulateMergeAt(baseRev: number, remoteChanges: IDelta[], branchName: string): MergeResult {
        const baseRevText = this.getContentAt(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        const localChanges = this.getChangesFrom(baseRev)

        for (const localChange of localChanges) {
            ss.applyChange(localChange, this.name)
        }

        let newChanges: IDelta[] = []
        for (const change of remoteChanges) {
            newChanges = newChanges.concat(ss.applyChange(change, branchName))
        }

        return {
            rev: baseRev + remoteChanges.length + localChanges.length,
            reqChanges: newChanges,
            resChanges: localChanges,
            content: ss.toDelta(),
        }
    }

    public simulateRebaseAt(baseRev: number, changes: IDelta[], branchName: string): MergeResult {
        return this.simulateRebase(branchName, changes, baseRev)
    }

    public getCurrentRev(): number {
        return this.changes.length + this.initialRev
    }

    public getContent(): IDelta {
        return this.getContentAt(this.getCurrentRev())
    }

    public getContentAt(rev: number): IDelta {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = SharedString.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++) {
            ss.applyChange(this.getChangeAt(i), '_')
        }

        return ss.toDelta()
    }

    public getChangeAt(rev: number): IDelta {
        if(!(0 <= rev - this.initialRev && rev - this.initialRev < this.changes.length  ))
            throw new Error('invalid argument: ' + 'rev='+rev + ' not in [' + this.initialRev + ',' + (this.changes.length + this.initialRev) + ')')
        return this.changes[rev - this.initialRev]
    }

    public getChangeFor(rev: number): IDelta {
        return this.getChangeAt(rev-1)
    }

    public getChangesFrom(fromRev: number): IDelta[] {
        return this.changes.slice(fromRev - this.initialRev)
    }

    public getChangesFromTo(fromRev: number, toRev: number): IDelta[] {
        if (toRev >= 0) return this.changes.slice(fromRev - this.initialRev, toRev + 1 - this.initialRev)
        else return this.getChangesFrom(fromRev)
    }

    private mergeAt(baseRev: number, changes: IDelta[], name?: string): MergeResult {
        const result = this.simulateMergeAt(baseRev, changes, name ? name : this.name)

        this.changes = this.changes.concat(result.reqChanges)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE < this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    private simulateRebase(branchName: string, remoteChanges: IDelta[], baseRev: number): MergeResult {
        const baseRevText = this.getContentAt(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        let newChanges: IDelta[] = []

        for (const change of remoteChanges) {
            ss.applyChange(change, branchName)
        }

        const localChanges = this.getChangesFrom(baseRev)
        for (const localChange of localChanges) {
            newChanges = newChanges.concat(ss.applyChange(localChange, this.name))
        }

        return {
            rev: baseRev + remoteChanges.length + localChanges.length,
            reqChanges: remoteChanges,
            resChanges: newChanges,
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
            ss.applyChange(this.getChangeAt(rev), '_')
        }
    }

    private invalidateSavepoints(baseRev:number) {
        this.savepoints = this.savepoints.filter(savepoint => savepoint.rev <= baseRev)
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
