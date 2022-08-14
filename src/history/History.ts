import * as _ from 'underscore'
import { IDelta } from '../core/IDelta'
import { asDelta, normalizeDeltas, normalizeOps } from '../core/primitive'
import { SharedString } from '../core/SharedString'
import { expectEqual } from '../core/util'
import { SyncRequest } from './SyncRequest'
import { MergeResult } from './SyncResponse'


class Savepoint {
    constructor(public rev: number, public content: IDelta) {}
}


/**
 * History
 *   Revision convention:
 *      0: initial content
 *      getContentAt(getCurrentRev()) => current (latest) content
 *      Content at n = content at (n-1) + change at (n-1)
 *      Content at n = content at (n-1) + change for n
 */
export interface IHistory {
    readonly name: string
    getCurrentRev(): number

    getContent(): IDelta
    getContentAt(rev: number): IDelta

    getChangeAt(rev: number): IDelta
    getChangeFor(rev: number): IDelta
    getChangesFrom(fromRev: number): IDelta[]

    /**
     * changes in range [fromRev,toRev)
     * @param fromRev  inclusive start
     * @param toRev exclusive end
     */
    getChangesInRange(fromRev: number, toRev: number): IDelta[]

    append(changes: IDelta[]): number
    merge(mergeRequest: SyncRequest): MergeResult
    rebase(rebaseRequest: SyncRequest): MergeResult

    clone(): IHistory
}

export class History implements IHistory {
    public static readonly DEFAULT_MIN_SAVEPOINT_RATE = 20

    private savepoints: Savepoint[] = []
    private changes: IDelta[] = []

    constructor(private _name: string, initialContent: string | IDelta = '', private initialRev = 0, private minSavepointRate = History.DEFAULT_MIN_SAVEPOINT_RATE) {
        this.doSavepoint(initialRev, asDelta(initialContent))
    }

    public get name():string {
        return this._name
    }

    public static create(name:string, initialContent:IDelta, changes:IDelta[], initialRev:number = 0, minSavepointRate = History.DEFAULT_MIN_SAVEPOINT_RATE, savepoints?:Savepoint[]):History {
        const history = new History(name, initialContent, initialRev, minSavepointRate)
        history.changes = changes
        if(savepoints)
            history.savepoints = savepoints
        else
            history.rebuildSavepoints(initialContent)

        return history
    }

    public getObject() {
        return {
            name: this._name.concat(),
            changes: this.changes.concat(),
            initialRev: this.initialRev,
            minSavepointRate: this.minSavepointRate,
            savepoints: this.savepoints.concat()
        }
    }

    public clone(): History {
        const cloned = new History(this.name, '', this.initialRev)
        cloned.savepoints = this.savepoints.concat()
        cloned.changes = this.changes.concat()
        return cloned
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
        if (!(0 <= rev - this.initialRev && rev - this.initialRev < this.changes.length))
            throw new Error(
                'invalid argument: ' +
                    'rev=' +
                    rev +
                    ' not in [' +
                    this.initialRev +
                    ',' +
                    (this.changes.length + this.initialRev) +
                    ')',
            )
        return this.changes[rev - this.initialRev]
    }

    public getChangeFor(rev: number): IDelta {
        return this.getChangeAt(rev - 1)
    }

    public getChangesFrom(fromRev: number): IDelta[] {
        return this.changes.slice(fromRev - this.initialRev)
    }

    public getChangesInRange(fromRev: number, toRev: number): IDelta[] {
        return this.changes.slice(fromRev - this.initialRev, toRev - this.initialRev)
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
        if (this.getLatestSavepointRev() + this.minSavepointRate <= this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    private simulateMergeAt(baseRev: number, remoteChanges: IDelta[], branchName: string): MergeResult {
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

    private mergeAt(baseRev: number, changes: IDelta[], name?: string): MergeResult {
        const result = this.simulateMergeAt(baseRev, changes, name ? name : this.name)

        this.changes = this.changes.concat(result.reqChanges)

        if (this.getLatestSavepointRev() + this.minSavepointRate <= this.getCurrentRev()) {
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

    private rebuildSavepoints(initialContent:IDelta): void {
        this.savepoints = [
            new Savepoint(this.initialRev, initialContent)
        ]

        const initial = this.savepoints[0]
        const ss = SharedString.fromDelta(initial.content)
        for (let rev = this.initialRev; rev < this.getCurrentRev(); rev++) {
            ss.applyChange(this.getChangeAt(rev), '_')
            if((rev + 1 - this.initialRev) % this.minSavepointRate == 0) {
                this.doSavepoint(rev+1, ss.toDelta())
            }
        }

        this.checkSavepoints()
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
                    normalizeOps(ss.toDelta().ops),
                    normalizeOps(this.savepoints[j].content.ops),
                    'savepoint is not correct at (' + rev + ',' + j + '):',
                )
                j++
            }
            ss.applyChange(this.getChangeAt(rev), '_')
        }
    }

    private invalidateSavepoints(baseRev: number) {
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
