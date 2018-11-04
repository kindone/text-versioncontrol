import jsc = require("jsverify")
import Delta = require("quill-delta")
import * as _ from 'underscore'
import {Document} from '../Document'
import { Excerpt } from "../excerpt/Excerpt";
import { IDelta } from "../primitive/IDelta";
import { Range } from "../primitive/Range"
import {deltaLength, JSONStringify, normalizeOps} from '../util'


describe("Excerpt", () => {
    it('Document excerpt', () => {
      const doc1 = new Document('doc1', 'My Document 1')
      const doc2 = new Document('doc2', 'Here comes the trouble. HAHAHAHA')

      const doc1Changes = [
        new Delta().delete(3).insert('Your '),
        new Delta().retain(5).insert('precious ')
      ]

      const doc2Changes = [
        new Delta().insert('Some introduction here: ')
      ]
      doc1.append(doc1Changes)
      doc2.append(doc2Changes)

      const sourceInfo1 = doc1.takeExcerpt(0, 4) // Your
      console.log(JSONStringify(sourceInfo1))

      const pasted = doc2.pasteExcerpt(5, sourceInfo1)
      console.log(JSONStringify(pasted))

      console.log(JSONStringify(doc2.getContent()))
    })

    it('Document sync', () => {
      const doc1 = new Document('doc1', 'My Document 1')
      const doc2 = new Document('doc2', 'Here comes the trouble. HAHAHAHA')

      const doc1Changes = [
        new Delta().delete(3).insert('Your '),
        new Delta().retain(5).insert('precious ') // Your precious Document 1
      ]

      const doc2Changes = [
        new Delta().insert('Some introduction here: ') // Some introduction here: Here comes the trouble. HAHAHAHA
      ]
      doc1.append(doc1Changes)
      doc2.append(doc2Changes)

      console.log('phases1.doc1: ', JSONStringify(doc1.getContent()))
      console.log('phases1.doc2: ', JSONStringify(doc2.getContent()))

      const sourceInfo1 = doc1.takeExcerpt(5, 9) // 'precious '
      console.log('sourceInfo:', JSONStringify(sourceInfo1))

      const destInfo1 = doc2.pasteExcerpt(5, sourceInfo1) // Some precious introduction here: ...'
      console.log('destInfo:', JSONStringify(destInfo1))

      console.log('phases2.doc2: ', JSONStringify(doc2.getContent()))

      const doc1ChangesAfter = [
        new Delta().insert('No, It\'s ').delete(4).insert('Our'), // +8, No, it's Our
        new Delta().retain(13+8).delete(1).insert(' beautiful '),
        new Delta().retain(13).insert('delicious ')
      ]

      const doc2ChangesAfter = [
        new Delta().delete(4).insert('Actual'),
        new Delta().retain(11).insert('tty').delete(5) // Actual pre|tty|ecious
      ]

      doc1.append(doc1ChangesAfter)
      doc2.append(doc2ChangesAfter)

      console.log('phases3.doc1: ', JSONStringify(doc1.getContent()))
      console.log('phases3.doc2: ', JSONStringify(doc2.getContent()))

      const syncInfo = doc1.syncInfoSinceExcerpted(sourceInfo1)
      doc2.syncExcerpt(syncInfo, destInfo1)

      console.log('phases4.doc2: ', JSONStringify(doc2.getContent()))

    })

    it('Document retain on excerpt', () => {
      const doc1 = new Document('doc1', 'My Document 1')
      console.log('phase1.doc1: ', JSONStringify(doc1.getContent()))

      const sourceInfo1 = doc1.takeExcerpt(3, 8) // Document
      console.log('sourceInfo:', JSONStringify(sourceInfo1))

      const doc1Changes = [
        // new Delta().delete(2).insert('Your'), // My -> Your
        new Delta().retain(3).insert('precious ') // Your precious Document 1
      ]

      doc1.append(doc1Changes)

      {
        const rangeInit = new Range(sourceInfo1.offset, sourceInfo1.offset+sourceInfo1.retain)
        console.log('phase2.changes:', JSONStringify(doc1.changesSince(sourceInfo1.rev)))
        const rangeTransformed = rangeInit.applyChanges(doc1.changesSince(sourceInfo1.rev))
        console.log('phase2.ranges:', rangeInit, rangeTransformed)

        const sourceInfo2 = doc1.takeExcerpt(rangeTransformed.start, rangeTransformed.end - rangeTransformed.start)
        console.log('updated sourceInfo: ', JSONStringify(sourceInfo2))
        console.log('phase2.doc1: ', JSONStringify(doc1.getContent()))
      }

      const sourceInfo3 =  doc1.takeExcerpt(3, 9) // 'precious '
      console.log('sourceInfo:', JSONStringify(sourceInfo3))

      const doc1Changes2 = [
        new Delta().delete(3).insert('Our '), // +8, Our
        new Delta().retain(13+8).delete(1).insert(' beautiful '),
        new Delta().retain(4).insert('delicious '),
        new Delta().retain(17).insert('tty').delete(5) // pretty
      ]

      doc1.append(doc1Changes2)

      {

        const rangeInit = new Range(sourceInfo3.offset, sourceInfo3.offset+sourceInfo3.retain)
        console.log('phase3.changes:', JSONStringify(doc1.changesSince(sourceInfo3.rev)))
        const rangeTransformed = rangeInit.applyChanges(doc1.changesSince(sourceInfo3.rev))
        console.log('phase3.ranges:', rangeInit, rangeTransformed)

        const sourceInfo2 = doc1.takeExcerpt(rangeTransformed.start, rangeTransformed.end - rangeTransformed.start)
        console.log('updated sourceInfo: ', JSONStringify(sourceInfo2))
        console.log('phase3.doc1: ', JSONStringify(doc1.getContent()))

      }
    })



  })
