
export interface ExcerptMarker {
    insert: { excerpted: string },
    attributes: { targetUri: string, targetRev: number, length: number }
}