import Op from 'quill-delta/dist/Op'
import { ExDelta } from './ExDelta'
import { IDelta } from './IDelta'
import { SharedString } from './SharedString'
import { normalizeOps, normalizeDeltas, deltaLength } from './util'

export interface RangedTransforms {
    range: Range
    deltas: IDelta[]
}

export class Range {
    constructor(public readonly start: number, public readonly end: number) {}

    public applyChanges(deltas: IDelta[], open = false): Range {
        let range: Range = this
        for (const delta of deltas) {
            range = open ? range.applyChangeOpen(delta) : range.applyChange(delta)
        }
        return range
    }

    public applyChange(delta: IDelta): Range {
        let cursor = 0
        let start = this.start
        let end = this.end

        for (const op of delta.ops) {
            // console.log('  op:', op, 'cursor:', cursor, 'start:', start, 'end:', end)
            if (op.retain) {
                cursor += op.retain
            } else if (typeof op.insert === 'string') {
                const amount = op.insert.toString().length

                if (cursor <= start) {
                    start += amount
                }
                end += amount
                cursor += amount
            } else if (op.insert) {
                if (cursor <= start) {
                    start += 1
                }
                end += 1
                cursor += 1
            } else if (op.delete) {
                if (cursor <= start) start = Math.max(cursor, start - op.delete)

                end = Math.max(cursor, end - op.delete)
            }

            if (cursor >= end)
                // 'cursor > end' for same effect as transformPosition(end)
                break
        }
        return new Range(start, end)
    }

    public applyChangeOpen(delta: IDelta): Range {
        let cursor = 0
        let start = this.start
        let end = this.end

        for (const op of delta.ops) {
            // console.log('  op:', op, 'cursor:', cursor, 'start:', start, 'end:', end)
            if (op.retain) {
                cursor += op.retain
            } else if (typeof op.insert === 'string') {
                const amount = op.insert.toString().length

                if (cursor < start) {
                    start += amount
                }
                end += amount
                cursor += amount
            } else if (op.insert) {
                if (cursor < start) {
                    start += 1
                }
                end += 1
                cursor += 1
            } else if (op.delete) {
                if (cursor <= start) start = Math.max(cursor, start - op.delete)

                end = Math.max(cursor, end - op.delete)
            }

            if (cursor > end)
                // 'cursor > end' for same effect as transformPosition(end)
                break
        }
        return new Range(start, end)
    }

    public cropContent(content: IDelta): IDelta {
        const ss = SharedString.fromDelta(content)
        const length = deltaLength(content)
        const cropper = new ExDelta([
            { delete: this.start },
            { retain: this.end - this.start },
            { delete: length - this.end },
        ], content.source)
        ss.applyChange(cropper, 'any')
        return ss.toDelta()
    }

    public cropChanges(deltas: IDelta[], open: boolean = false): IDelta[] {
        let range: Range = this
        const newDeltas: IDelta[] = []
        for (const delta of deltas) {
            const newDelta = open ? range.cropChangeOpen(delta) : range.cropChange(delta)
            range = range.applyChange(delta)
            newDeltas.push(newDelta)
        }

        return normalizeDeltas(newDeltas)
    }

    public cropChange(delta: IDelta, debug = false): IDelta {
        let cursor = 0
        let start = this.start
        let end = this.end
        const ops: Op[] = []

        for (const op of delta.ops) {
            if (op.retain) {
                const left = Math.max(cursor, start)
                const right = cursor + op.retain
                if (right > left) {
                    ops.push({ retain: right - left })
                }
                cursor += op.retain
            } else if (typeof op.insert === 'string') {
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
                const amount = op.insert.toString().length
                if (cursor <= start) {
                    start += amount
                } else {
                    ops.push({ insert: op.insert })
                }
                end += amount
                cursor += amount
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
            } else if (op.insert) {
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
                if (cursor <= start) {
                    start += 1
                } else {
                    ops.push({ insert: op.insert })
                }
                end += 1
                cursor += 1
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
            } else if (op.delete) {
                const left = Math.max(cursor, start)
                const right = Math.min(cursor + op.delete, end)
                if (right > left) {
                    ops.push({ delete: right - left })
                }

                if (cursor <= start) {
                    start = Math.max(cursor, start - op.delete)
                }

                end = Math.max(cursor, end - op.delete)
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end, 'left:', left, 'right:', right)
                }
            }

            if (cursor > end) break
        }

        return new ExDelta(normalizeOps(ops), delta.source)
    }

    public cropChangeOpen(delta: IDelta, debug = false): IDelta {
        let cursor = 0
        let start = this.start
        let end = this.end
        const ops: Op[] = []

        for (const op of delta.ops) {
            if (op.retain) {
                const left = Math.max(cursor, start)
                const right = cursor + op.retain
                if (right > left) {
                    ops.push({ retain: right - left })
                }

                cursor += op.retain
            } else if (typeof op.insert === 'string') {
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
                const amount = op.insert.toString().length
                if (cursor < start) {
                    start += amount
                } else {
                    ops.push({ insert: op.insert })
                }
                end += amount
                cursor += amount
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
            } else if (op.insert) {
                if (cursor < start) {
                    start += 1
                } else {
                    ops.push({ insert: op.insert })
                }

                end += 1
                cursor += 1
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end)
                }
            } else if (op.delete) {
                const left = Math.max(cursor, start)
                const right = Math.min(cursor + op.delete, end)
                if (right > left) {
                    ops.push({ delete: right - left })
                }

                if (cursor <= start) {
                    start = Math.max(cursor, start - op.delete)
                }

                end = Math.max(cursor, end - op.delete)
                if (debug) {
                    console.log('cursor:', cursor, 'start:', start, 'end:', end, 'left:', left, 'right:', right)
                }
            }

            if (cursor > end) break
        }

        return new ExDelta(normalizeOps(ops), delta.source)
    }
}
