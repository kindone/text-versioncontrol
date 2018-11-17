import Delta = require('quill-delta')
import * as _ from 'underscore'
import { IDelta } from './primitive/IDelta'
import { StringWithState } from './primitive/StringWithState'
import { asDelta, expectEqual } from './util'

export interface ISavepoint
{
    rev: number
    content: IDelta
}

export interface ISyncRequest {
    branchName: string
    baseRev: number
    deltas: IDelta[]
}

export interface ISyncResponse {
    deltas: IDelta[]
    rev: number
}

export interface IHistory {
    readonly name:string
    getCurrentRev(): number
    getText(): string
    getTextForRev(rev: number): string
    getContent(): IDelta
    getContentForRev(rev: number): IDelta
    getChanges(fromRev:number, toRev:number): IDelta[]

    simulate(deltas: IDelta[], name: string): IDelta
    simulateAt(baseRev:number, deltas: IDelta[], name: string):{ deltas: IDelta[]; content: IDelta }
    simulateRebaseAt(baseRev:number, deltas: IDelta[], name:string):{ deltas: IDelta[]; content: IDelta }
    append(deltas: IDelta[], name?: string): number
    merge(mergeRequest: ISyncRequest): ISyncResponse
    rebase(rebaseRequest: ISyncRequest): ISyncResponse
}

export class History implements IHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20

    private savepoints: ISavepoint[] = []
    private deltas: IDelta[] = []

    constructor(public readonly name: string, initialContent: string | IDelta = '', private readonly initialRev = 0) {
        this.doSavepoint(initialRev, asDelta(initialContent))
    }

    public append(deltas: IDelta[], name?: string): number {
        this.mergeAt(this.getCurrentRev(), deltas, name)
        return this.getCurrentRev()
    }

    public merge(mergeRequest: ISyncRequest): ISyncResponse {

        const deltas = this.mergeAt(mergeRequest.baseRev, mergeRequest.deltas, mergeRequest.branchName)
        const rev = this.getCurrentRev()
        return {rev, deltas}
    }

    // prioritize remote
    public rebase(rebaseRequest: ISyncRequest):ISyncResponse {
        const baseRev = rebaseRequest.baseRev
        const deltas = rebaseRequest.deltas
        const name = rebaseRequest.branchName

        const result = this.simulateRebase(name ? name : this.name, deltas, baseRev)

        this.deltas = this.deltas.slice(0, baseRev - this.initialRev)
        this.deltas = this.deltas.concat(deltas)
        this.deltas = this.deltas.concat(result.deltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE <this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        const rev = this.getCurrentRev()
        return {rev, deltas: result.deltas}
    }

    public simulate(deltas: IDelta[], name: string): IDelta
    {
        const result = this.simulateMerge(name, deltas, this.getCurrentRev())
        return result.content
    }

    public simulateAt(baseRev:number, deltas: IDelta[], name: string):{ deltas: IDelta[]; content: IDelta }
    {
        const result = this.simulateMerge(name, deltas, baseRev)
        return result
    }

    public simulateRebaseAt(baseRev:number, deltas: IDelta[], name:string):{ deltas: IDelta[]; content: IDelta }
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
        const ss = StringWithState.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++)
            ss.apply(this.deltas[i - this.initialRev], '_')

        return ss.toText()
    }

    public getContent(): IDelta {
        return this.getContentForRev(this.getCurrentRev())
    }

    public getContentForRev(rev: number): IDelta {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = StringWithState.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++)
            ss.apply(this.deltas[i - this.initialRev], '_')

        return ss.toDelta()
    }

    public getChanges(fromRev:number, toRev:number = -1): IDelta[] {
        if(toRev >= 0)
            return this.deltas.slice(fromRev - this.initialRev, toRev - this.initialRev)
        else
            return this.deltas.slice(fromRev - this.initialRev)
    }

    private mergeAt(baseRev: number, deltas: IDelta[], name?: string): IDelta[] {
        const baseToCurr = this.getChanges(baseRev)
        const result = this.simulateMerge(name ? name : this.name, deltas, baseRev)

        this.deltas = this.deltas.concat(result.deltas)

        if (this.getLatestSavepointRev() + History.MIN_SAVEPOINT_RATE < this.getCurrentRev()) {
            this.doSavepoint(this.getCurrentRev(), result.content)
            this.checkSavepoints()
        }
        return baseToCurr
    }

    private simulateMerge(
        name: string,
        remoteDeltas: IDelta[],
        baseRev: number
    ): { deltas: IDelta[]; content: IDelta } {
        const baseRevText = this.getContentForRev(baseRev)
        const ss = StringWithState.fromDelta(baseRevText)
        let newDeltas: IDelta[] = []
        for (let rev = baseRev; rev < this.getCurrentRev(); rev++)
            ss.apply(this.deltas[rev - this.initialRev], this.name)

        for (const delta of remoteDeltas)
            newDeltas = newDeltas.concat(ss.apply(delta, name))

        return { deltas: newDeltas, content: ss.toDelta() }
    }

    private simulateRebase(
        name: string,
        remoteDeltas: IDelta[],
        baseRev: number
    ): { deltas: IDelta[]; content: IDelta } {
        const baseRevText = this.getContentForRev(baseRev)
        const ss = StringWithState.fromDelta(baseRevText)
        let newDeltas: IDelta[] = []

        for (const delta of remoteDeltas)
            ss.apply(delta, name)

        for (let rev = baseRev; rev < this.getCurrentRev(); rev++)
            newDeltas = newDeltas.concat(ss.apply(this.deltas[rev - this.initialRev], this.name))

        return { deltas: newDeltas, content: ss.toDelta() }
    }

    private checkSavepoints(): void {
        const initial = this.savepoints[0]
        if (initial.rev !== this.initialRev) throw new Error('initial savepoint rev must be first rev')

        const ss = StringWithState.fromDelta(initial.content)
        let j = 0
        for (let rev = this.initialRev; rev < this.getCurrentRev(); rev++) {
            if (rev > this.getLatestSavepointRev()) break

            if (rev === this.savepoints[j].rev) {
                expectEqual(ss.toDelta(), this.savepoints[j].content, 'savepoint is not correct at (' + rev + ',' + j + '):')
                j++
            }
            ss.apply(this.deltas[rev-this.initialRev], '_')
        }
    }

    private doSavepoint(rev: number, content: IDelta): void {
        this.savepoints.push({ rev, content })
    }

    private getLatestSavepointRev(): number {
        return this.savepoints[this.savepoints.length - 1].rev
    }

    private getNearestSavepointForRev(rev: number): ISavepoint {
        // return this.savepoints[0]
        let nearestSavepoint = this.savepoints[0]
        for (const savepoint of this.savepoints) {
            if (rev <= savepoint.rev) break
            nearestSavepoint = savepoint
        }

        return nearestSavepoint
    }
}
