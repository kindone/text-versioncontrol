export interface Source {
    type: 'excerpt' | 'sync'
    uri: string
    rev: number
    start: number
    end: number
}
