import Op from 'quill-delta/dist/Op'
import { Change } from './Change'
import { ExDelta } from './ExDelta'
import { SharedString } from './SharedString'
import { normalizeOps, normalizeChanges, contentLength } from './util'

export interface RangedTransforms {
    range: Range
    deltas: Change[]
}

export class Range {
    constructor(public readonly start: number, public readonly end: number) {}

    // immutable
    public applyChanges(changes: Change[], open = false): Range {
        let range: Range = this
        for (const change of changes) {
            range = open ? range.applyChangeOpen(change) : range.applyChange(change)
        }
        return range
    }

    public mapChanges(changes:Change[], open = false): Range[] {
        let range: Range = this
        const ranges:Range[] = []
        for (const change of changes) {
            range = open ? range.applyChangeOpen(change) : range.applyChange(change)
            ranges.push(range)
        }
        return ranges
    }



    // immutable
    public applyChange(change: Change): Range {
        let cursor = 0
        let start = this.start
        let end = this.end

        for (const op of change.ops) {
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

    // immutable
    public applyChangeOpen(change: Change): Range {
        let cursor = 0
        let start = this.start
        let end = this.end

        for (const op of change.ops) {
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

    public cropContent(content: Change): Change {
        const ss = SharedString.fromDelta(content)
        const length = contentLength(content)
        const cropper = new ExDelta([
            { delete: this.start },
            { retain: this.end - this.start },
            { delete: length - this.end },
        ])
        ss.applyChange(cropper, 'any')
        return ss.toDelta()
    }

    public cropChanges(changes: Change[], open: boolean = false): Change[] {
        let range: Range = this
        const newChanges: Change[] = []
        for (const change of changes) {
            const newChange = open ? range.cropChangeOpen(change) : range.cropChange(change)
            range = range.applyChange(change)
            newChanges.push(newChange)
        }

        return newChanges
    }

    public cropChange(change: Change, debug = false): Change {
        let cursor = 0
        let start = this.start
        let end = this.end
        const ops: Op[] = []

        for (const op of change.ops) {
            if (op.retain) {
                const left = Math.max(cursor, start)
                const right = cursor + op.retain
                if (right > left) {
                    ops.push({ retain: right - left })
                }
                cursor += op.retain
            } else if (typeof op.insert === 'string') {
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
                const amount = op.insert.toString().length
                if (cursor <= start) {
                    start += amount
                } else {
                    if(op.attributes)
                        ops.push({ insert: op.insert, attributes: op.attributes })
                    else
                        ops.push({ insert: op.insert })
                }
                end += amount
                cursor += amount
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
            } else if (op.insert) {
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
                if (cursor <= start) {
                    start += 1
                } else {
                    if(op.attributes)
                        ops.push({ insert: op.insert, attributes: op.attributes })
                    else
                        ops.push({ insert: op.insert })
                }
                end += 1
                cursor += 1
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
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
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end, 'left:', left, 'right:', right)
                // }
            }

            if (cursor >= end) break
        }

        if(change.syncs)
            return new ExDelta(normalizeOps(ops), change.syncs)
        else
            return new ExDelta(normalizeOps(ops))
    }

    public cropChangeOpen(change: Change, debug = false): Change {
        let cursor = 0
        let start = this.start
        let end = this.end
        const ops: Op[] = []

        for (const op of change.ops) {
            if (op.retain) {
                const left = Math.max(cursor, start)
                const right = cursor + op.retain
                if (right > left) {
                    ops.push({ retain: right - left })
                }

                cursor += op.retain
            } else if (typeof op.insert === 'string') {
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
                const amount = op.insert.toString().length
                if (cursor < start) {
                    start += amount
                } else {
                    if(op.attributes)
                        ops.push({ insert: op.insert, attributes: op.attributes })
                    else
                        ops.push({ insert: op.insert })
                }
                end += amount
                cursor += amount
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
            } else if (op.insert) {
                if (cursor < start) {
                    start += 1
                } else {
                    if(op.attributes)
                        ops.push({ insert: op.insert, attributes: op.attributes })
                    else
                        ops.push({ insert: op.insert })
                }

                end += 1
                cursor += 1
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end)
                // }
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
                // if (debug) {
                //     console.log('cursor:', cursor, 'start:', start, 'end:', end, 'left:', left, 'right:', right)
                // }
            }

            if (cursor > end) break
        }

        if(change.syncs)
            return new ExDelta(normalizeOps(ops), change.syncs)
        else
            return new ExDelta(normalizeOps(ops))
    }
}
