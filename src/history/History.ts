import Delta = require('quill-delta')
import * as _ from 'underscore'
import { IDelta } from '../primitive/IDelta'
import { SharedString } from '../primitive/SharedString'
import { asDelta, expectEqual } from '../primitive/util'
import { Savepoint } from './Savepoint';
import { SyncRequest } from './SyncRequest';
import { SyncResponse } from './SyncResponse';


type MergeResult = SyncResponse

export interface IHistory {
    readonly name:string
    getCurrentRev(): number
    getText(): string
    getTextForRev(rev: number): string
    getContent(): IDelta
    getContentForRev(rev: number): IDelta
    getChanges(fromRev:number, toRev:number): IDelta[]

    simulateAppend(deltas: IDelta[], name: string): MergeResult
    simulateAppendAt(baseRev:number, deltas: IDelta[], name: string): MergeResult
    simulateMergeAt(baseRev:number, deltas: IDelta[], name: string): MergeResult
    simulateRebaseAt(baseRev:number, deltas: IDelta[], name:string): MergeResult
    append(deltas: IDelta[], name?: string): number
    merge(mergeRequest: SyncRequest): SyncResponse
    rebase(rebaseRequest: SyncRequest): SyncResponse
}

export class History implements IHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20

    private savepoints: Savepoint[] = []
    private deltas: IDelta[] = []

    constructor(public readonly name: string, initialContent: string | IDelta = '', private readonly initialRev = 0) {
        this.doSavepoint(initialRev, asDelta(initialContent))
    }

    public append(deltas: IDelta[], name?: string): number {
        this.mergeAt(this.getCurrentRev(), deltas, name)
        return this.getCurrentRev()
    }

    public merge(mergeRequest: SyncRequest): SyncResponse {
        return this.mergeAt(mergeRequest.rev, mergeRequest.deltas, mergeRequest.branchName)
    }

    // prioritize remote
    public rebase(rebaseRequest: SyncRequest):SyncResponse {
        const baseRev = rebaseRequest.rev
        const deltas = rebaseRequest.deltas
        const name = rebaseRequest.branchName

        const result = this.simulateRebase(name ? name : this.name, deltas, baseRev)

        // old + rebased + transformed
        this.deltas = this.deltas.slice(0, baseRev - this.initialRev)
        this.deltas = this.deltas.concat(result.reqDeltas)
        this.deltas = this.deltas.concat(result.resDeltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE <this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    public simulateAppend(deltas: IDelta[], name: string): MergeResult
    {
        return this.simulateMergeAt(this.getCurrentRev(), deltas, name)
    }

    public simulateAppendAt(fromRev:number, deltas: IDelta[], name: string): MergeResult
    {
        const baseRevText = this.getContentForRev(fromRev)
        const ss = SharedString.fromDelta(baseRevText)

        let newDeltas: IDelta[] = []
        for (const delta of deltas)
            newDeltas = newDeltas.concat(ss.applyChange(delta, name))

        return { rev: fromRev + deltas.length, reqDeltas: newDeltas, resDeltas: [], content: ss.toDelta() }
    }

    public simulateMergeAt(
        baseRev:number, remoteDeltas: IDelta[], name: string
    ): MergeResult {
        const baseRevText = this.getContentForRev(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        const localDeltas = this.getChanges(baseRev)

        for(const localDelta of localDeltas)
            ss.applyChange(localDelta, this.name)

        let newDeltas: IDelta[] = []
        for (const delta of remoteDeltas)
            newDeltas = newDeltas.concat(ss.applyChange(delta, name))

        return { rev: (baseRev + remoteDeltas.length + localDeltas.length), reqDeltas: newDeltas, resDeltas: localDeltas, content: ss.toDelta() }
    }

    public simulateRebaseAt(baseRev:number, deltas: IDelta[], name:string):MergeResult
    {
        return this.simulateRebase(name, deltas, baseRev)
    }

    public getCurrentRev(): number {
        return this.deltas.length + this.initialRev
    }

    public getText(): string {
        return this.getTextForRev(this.getCurrentRev())
    }

    public getTextForRev(rev: number): string {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = SharedString.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++)
            ss.applyChange(this.deltas[i - this.initialRev], '_')

        return ss.toText()
    }

    public getContent(): IDelta {
        return this.getContentForRev(this.getCurrentRev())
    }

    public getContentForRev(rev: number): IDelta {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = SharedString.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++)
            ss.applyChange(this.deltas[i - this.initialRev], '_')

        return ss.toDelta()
    }

    public getChanges(fromRev:number, toRev:number = -1): IDelta[] {
        if(toRev >= 0)
            return this.deltas.slice(fromRev - this.initialRev, toRev + 1 - this.initialRev)
        else
            return this.deltas.slice(fromRev - this.initialRev)
    }

    private mergeAt(baseRev: number, deltas: IDelta[], name?: string):MergeResult {
        const result = this.simulateMergeAt(baseRev, deltas, name ? name : this.name)

        this.deltas = this.deltas.concat(result.reqDeltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE < this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return result
    }

    private simulateRebase(
        name: string,
        remoteDeltas: IDelta[],
        baseRev: number
    ): MergeResult {
        const baseRevText = this.getContentForRev(baseRev)
        const ss = SharedString.fromDelta(baseRevText)
        let newDeltas: IDelta[] = []

        for (const delta of remoteDeltas)
            ss.applyChange(delta, name)

        const localDeltas = this.getChanges(baseRev)
        for (const localDelta of localDeltas)
            newDeltas = newDeltas.concat(ss.applyChange(localDelta, this.name))

        return { rev: (baseRev + remoteDeltas.length + localDeltas.length), reqDeltas: remoteDeltas, resDeltas: newDeltas, content: ss.toDelta() }
    }

    private checkSavepoints(): void {
        const initial = this.savepoints[0]
        if (initial.rev !== this.initialRev) throw new Error('initial savepoint rev must be first rev')

        const ss = SharedString.fromDelta(initial.content)
        let j = 0
        for (let rev = this.initialRev; rev < this.getCurrentRev(); rev++) {
            if (rev > this.getLatestSavepointRev()) break

            if (rev === this.savepoints[j].rev) {
                expectEqual(ss.toDelta(), this.savepoints[j].content, 'savepoint is not correct at (' + rev + ',' + j + '):')
                j++
            }
            ss.applyChange(this.deltas[rev-this.initialRev], '_')
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
