// import {StringWithState, Operation} from '../../app/utils/Text'
import * as _ from 'underscore'
import { History } from '../History'
import { expectEqual, JSONStringify } from '../../core/util'
import { DocClient } from '../../service/DocClient'
import { DocServer } from '../../service/DocServer'
import { randomChanges } from '../../__tests__/random'
import { ContentChangeList, ContentChangeListGen } from '../../__tests__/generator/ContentChangeList'
import { Delta } from '../../core/Delta'
import { IDelta } from '../../core/IDelta'
import { contentLength, normalizeOps } from '../../core/primitive'
import { forAll } from 'jsproptest'

describe('History interface', () => {
    it('revision convention', () => {
        const initialContent = 'initial'
        const history = new History('A', initialContent)
        expectEqual(history.getContentAt(0).ops, [{ insert: 'initial' }])
        expectEqual(history.getCurrentRev(), 0)
        expect(() => history.getChangeAt(0)).toThrow()
        expect(() => history.getChangeFor(0)).toThrow()
        const change = new Delta().insert('hello')
        history.append([change])
        expectEqual(history.getChangeAt(0), change)
        expectEqual(history.getChangeFor(1), change)
        expectEqual(history.getCurrentRev(), 1)
        expectEqual(history.getContent(), history.getContentAt(history.getCurrentRev()))
        expect(() => history.getChangeAt(1)).toThrow()
    })

    it('revision convention 2', () => {
        const contentChangeListGen = ContentChangeListGen()
        forAll((contentAndChangeList:ContentChangeList) => {
            const {content, changeList} = contentAndChangeList
            const deltas = changeList.deltas
            const history = new History('A', content)
            // initial state
            expectEqual(history.getContentAt(0).ops, normalizeOps(content.ops))
            expectEqual(history.getCurrentRev(), 0)
            expect(() => history.getChangeAt(0)).toThrow()
            expect(() => history.getChangeFor(0)).toThrow()

            // applied change list
            history.append(deltas)
            const rev = history.getCurrentRev()
            expectEqual(rev, deltas.length)
            expectEqual(history.getContent(), history.getContentAt(history.getCurrentRev()))
            expect(() => history.getChangeAt(rev+1)).toThrow()
            expect(() => history.getChangeFor(rev+1)).toThrow()

            for(let i = 0; i < rev; i++) {
                const delta:IDelta = new Delta(normalizeOps(deltas[i].ops))
                expectEqual(history.getChangeAt(i), delta)
                if(i > 0) {
                    const prevdelta = new Delta(normalizeOps(deltas[i-1].ops))
                    expectEqual(history.getChangeFor(i), prevdelta)
                }
            }
                   
        }, contentChangeListGen)
    })
})

describe('server-client scenarios', () => {
    it('scenario 1', () => {
        const server = new DocServer()
        const client1 = new DocClient()
        const client2 = new DocClient()

        client1.apply([new Delta().insert('client1 text')])
        client2.apply([new Delta().insert('Hello world')])

        // console.log(server.getContent(), "-", client1.getContent(), "-", client2.getContent())

        let req = client1.getSyncRequest()
        let merged = server.merge(req)
        // console.log(client1, req, merged)
        client1.sync(merged)

        // console.log(server.getContent(), "-", client1.getContent(), "-", client2.getContent())

        req = client2.getSyncRequest()
        merged = server.merge(req)
        // console.log(client2, req, merged)
        client2.sync(merged)

        // console.log(server.getContent(), "-", client1.getContent(), "-", client2.getContent())

        req = client1.getSyncRequest()
        merged = server.merge(req)
        // console.log(client1, req, merged)
        client1.sync(merged)
        // console.log(server.getContent(), "-", client1.getContent(), "-", client2.getContent())

        expect(client1.getContent()).toEqual(client2.getContent())
        expect(client1.getContent()).toEqual(server.getContent())

        client1.apply([new Delta().delete(3).insert('replace')])
        client1.sync(server.merge(client1.getSyncRequest()))

        client2.sync(server.merge(client2.getSyncRequest()))

        expect(client1.getContent()).toEqual(client2.getContent())
        expect(client1.getContent()).toEqual(server.getContent())
    })
})

describe('History hand-made scenarios', () => {
    it('scenario 1', () => {
        const initialText = 'initial'
        const serverHistory = new History('server', initialText)
        const clientHistory = new History('client1', initialText)

        const set1 = [new Delta().retain(7).insert(' text'), new Delta().insert('The ')]
        serverHistory.append(set1)
        // console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getContent())

        const set2 = [new Delta().retain(7).insert(' string'), new Delta().insert('An ')]
        clientHistory.append(set2)
        // console.log(clientHistory.name, clientHistory.getCurrentRev(), clientHistory.getContent())

        const set1ForClient = serverHistory.merge({
            rev: 0,
            branch: clientHistory.name,
            changes: set2,
        })
        clientHistory.merge({
            rev: 0,
            branch: serverHistory.name,
            changes: set1ForClient.resChanges,
        })

        expect(clientHistory.getContent()).toEqual(serverHistory.getContent())

        const clientRev = clientHistory.getCurrentRev()
        const serverRev = serverHistory.getCurrentRev()
        const set3 = [new Delta().retain(3).insert('pending'), new Delta().insert('More Pending').delete(3)]
        clientHistory.append(set3)

        const set4 = [
            new Delta()
                .retain(2)
                .delete(2)
                .insert(' rebased'),
            new Delta().insert('More rebased '),
        ]
        serverHistory.append(set4)

        const clientRebased = clientHistory.rebase({ rev: clientRev, branch: serverHistory.name, changes: set4 })
        const serverRebased = serverHistory.rebase({ rev: serverRev, branch: clientHistory.name, changes: set3 })

        expect(clientHistory.getContent()).toEqual(serverHistory.getContent())
    })

    it('scenario 2', () => {
        const initialText = 'initial'
        const serverHistory = new History('server', initialText)
        const c1History = new History('client1', initialText)

        const serverSet = [new Delta().retain(7).insert(' text'), new Delta().insert('The ')]
        serverHistory.append(serverSet)
        // console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getContent())

        const client1Set = [new Delta().retain(7).insert(' string'), new Delta().insert('An ')]
        c1History.append(client1Set)
        // console.log(c1History.name, c1History.getCurrentRev(), c1History.getContent())

        const serverSetForClient1 = serverHistory.merge({
            rev: 0,
            branch: c1History.name,
            changes: client1Set,
        })
        c1History.merge({
            rev: 0,
            branch: serverHistory.name,
            changes: serverSetForClient1.resChanges,
        })

        expect(c1History.getContent()).toEqual(serverHistory.getContent())

        // const c2History = new TextWithHistory("client2", serverHistory.getContent())
        // const server_rev = serverHistory.getCurrentRev()
        // const client2_rev =

        // const client2_set = [new Operation(7, 0, " rainbow"), new Operation(0, 0, "Colored ")]
        // const server_set_for_client2 = serverHistory.merge({branchName: c2History.name, baseRev: c2Rev, operations: client2_set})
        // c2History.merge({branchName: serverHistory.name, baseRev: c2Rev, operations: server_set_for_client2})
    })
})

describe('generated scenarios', () => {
    it('scenario 1', () => {
        for (let i = 0; i < 40; i++) {
            const initialText = 'initial'
            const serverHistory = new History('server', initialText, 5)
            const clientHistory = new History('client', initialText, 125)

            let serverRev = serverHistory.getCurrentRev()
            let clientRev = clientHistory.getCurrentRev()

            // const set1 = randomUserDeltas(initialText.length, 30)
            // serverHistory.apply(set1)

            // const set2 = randomUserDeltas(initialText.length, 30)
            // clientHistory.apply(set2)

            // // apply to both
            // const set1ForClient = serverHistory.apply(set2)
            // clientHistory.apply(set1ForClient)

            expectEqual(clientHistory.getContent(), serverHistory.getContent()) // , "<" + JSONStringify(set1) + " and " + JSONStringify(set2) + " and " + JSONStringify(set1ForClient) + ">")

            const set3 = randomChanges(contentLength(serverHistory.getContent()), 2)
            serverHistory.append(set3)

            const set4 = randomChanges(contentLength(clientHistory.getContent()), 2)
            clientHistory.append(set4)

            const set3ForClient = serverHistory.merge({
                rev: serverRev,
                branch: 'client',
                changes: set4,
            })
            clientHistory.merge({
                rev: clientRev,
                branch: 'server',
                changes: set3ForClient.resChanges,
            })

            expectEqual(
                clientHistory.getContent(),
                serverHistory.getContent(),
                JSONStringify(set3) + ' and ' + JSONStringify(set4) + ' and ' + JSONStringify(set3ForClient),
            )

            serverRev = serverHistory.getCurrentRev()
            clientRev = clientHistory.getCurrentRev()

            const set5 = randomChanges(contentLength(serverHistory.getContent()), 2)
            serverHistory.append(set5)

            const set6 = randomChanges(contentLength(clientHistory.getContent()), 2)
            clientHistory.append(set6)

            const set5ForClient = serverHistory.merge({
                rev: serverRev,
                branch: 'client',
                changes: set6,
            })
            clientHistory.merge({
                rev: clientRev,
                branch: 'server',
                changes: set5ForClient.resChanges,
            })

            expectEqual(
                clientHistory.getContent(),
                serverHistory.getContent(),
                JSONStringify(set5) + ' and ' + JSONStringify(set6) + ' and ' + JSONStringify(set5ForClient),
            )
        }
    })
})
