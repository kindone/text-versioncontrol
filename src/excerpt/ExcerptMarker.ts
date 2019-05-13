
export interface ExcerptMarker {
    insert: { excerpted: string },
    attributes: { targetUri: string, targetRev: string, targetStart: string, targetEnd: string }
}