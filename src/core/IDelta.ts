import Op from 'quill-delta/dist/Op'
import { DeltaContext } from './DeltaContext'

export interface IDelta {
    ops: Op[]
    context?: DeltaContext
}
