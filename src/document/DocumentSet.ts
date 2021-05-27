import { Document } from './Document'

export interface DocumentSet {
    getDocument(uri: string): Document
}
