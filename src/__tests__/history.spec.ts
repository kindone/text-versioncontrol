// import {StringWithState, Operation} from '../../app/utils/Text'
import jsc = require('jsverify')
import Delta = require('quill-delta')
import * as _ from 'underscore'
import { History } from '../History/History'
import { deltaLength, expectEqual, JSONStringify } from '../primitive/util'
import { DocClient } from '../service/DocClient'
import { DocServer } from '../service/DocServer'
import { randomUserDeltas } from './random'

describe('server-client scenarios', () => {
    it('scenario 1', () => {
        const server = new DocServer()
        const client1 = new DocClient()
        const client2 = new DocClient()

        client1.apply([new Delta().insert('client1 text')])
        client2.apply([new Delta().insert('Hello world')])

        // console.log(server.getText(), "-", client1.getText(), "-", client2.getText())

        let req = client1.getSyncRequest()
        let merged = server.merge(req)
        // console.log(client1, req, merged)
        client1.sync(merged)

        // console.log(server.getText(), "-", client1.getText(), "-", client2.getText())

        req = client2.getSyncRequest()
        merged = server.merge(req)
        // console.log(client2, req, merged)
        client2.sync(merged)

        // console.log(server.getText(), "-", client1.getText(), "-", client2.getText())

        req = client1.getSyncRequest()
        merged = server.merge(req)
        // console.log(client1, req, merged)
        client1.sync(merged)
        // console.log(server.getText(), "-", client1.getText(), "-", client2.getText())

        expect(client1.getText()).toBe(client2.getText())
        expect(client1.getText()).toBe(server.getText())

        client1.apply([new Delta().delete(3).insert('replace')])
        client1.sync(server.merge(client1.getSyncRequest()))

        client2.sync(server.merge(client2.getSyncRequest()))

        expect(client1.getText()).toBe(client2.getText())
        expect(client1.getText()).toBe(server.getText())
    })
})

describe('History hand-made scenarios', () => {
    it('scenario 1', () => {
        const initialText = 'initial'
        const serverHistory = new History('server', initialText)
        const clientHistory = new History('client1', initialText)

        const set1 = [new Delta().retain(7).insert(' text'), new Delta().insert('The ')]
        serverHistory.append(set1)
        // console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getText())

        const set2 = [new Delta().retain(7).insert(' string'), new Delta().insert('An ')]
        clientHistory.append(set2)
        // console.log(clientHistory.name, clientHistory.getCurrentRev(), clientHistory.getText())

        const set1ForClient = serverHistory.merge({
            rev: 0,
            branchName: clientHistory.name,
            deltas: set2,
        })
        clientHistory.merge({
            rev: 0,
            branchName: serverHistory.name,
            deltas: set1ForClient.resDeltas,
        })

        expect(clientHistory.getText()).toBe(serverHistory.getText())

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

        const clientRebased = clientHistory.rebase({ rev: clientRev, branchName: serverHistory.name, deltas: set4 })
        const serverRebased = serverHistory.rebase({ rev: serverRev, branchName: clientHistory.name, deltas: set3 })

        expect(clientHistory.getText()).toBe(serverHistory.getText())
    })

    it('scenario 2', () => {
        const initialText = 'initial'
        const serverHistory = new History('server', initialText)
        const c1History = new History('client1', initialText)

        const serverSet = [new Delta().retain(7).insert(' text'), new Delta().insert('The ')]
        serverHistory.append(serverSet)
        // console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getText())

        const client1Set = [new Delta().retain(7).insert(' string'), new Delta().insert('An ')]
        c1History.append(client1Set)
        // console.log(c1History.name, c1History.getCurrentRev(), c1History.getText())

        const serverSetForClient1 = serverHistory.merge({
            rev: 0,
            branchName: c1History.name,
            deltas: client1Set,
        })
        c1History.merge({
            rev: 0,
            branchName: serverHistory.name,
            deltas: serverSetForClient1.resDeltas,
        })

        expect(c1History.getText()).toBe(serverHistory.getText())

        // const c2History = new TextWithHistory("client2", serverHistory.getText())
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

            const set3 = randomUserDeltas(serverHistory.getText().length, 2)
            serverHistory.append(set3)

            const set4 = randomUserDeltas(clientHistory.getText().length, 2)
            clientHistory.append(set4)

            const set3ForClient = serverHistory.merge({
                rev: serverRev,
                branchName: 'client',
                deltas: set4,
            })
            clientHistory.merge({
                rev: clientRev,
                branchName: 'server',
                deltas: set3ForClient.resDeltas,
            })

            expectEqual(
                clientHistory.getContent(),
                serverHistory.getContent(),
                JSONStringify(set3) + ' and ' + JSONStringify(set4) + ' and ' + JSONStringify(set3ForClient),
            )

            serverRev = serverHistory.getCurrentRev()
            clientRev = clientHistory.getCurrentRev()

            const set5 = randomUserDeltas(deltaLength(serverHistory.getContent()), 2)
            serverHistory.append(set5)

            const set6 = randomUserDeltas(deltaLength(clientHistory.getContent()), 2)
            clientHistory.append(set6)

            const set5ForClient = serverHistory.merge({
                rev: serverRev,
                branchName: 'client',
                deltas: set6,
            })
            clientHistory.merge({
                rev: clientRev,
                branchName: 'server',
                deltas: set5ForClient.resDeltas,
            })

            expectEqual(
                clientHistory.getContent(),
                serverHistory.getContent(),
                JSONStringify(set5) + ' and ' + JSONStringify(set6) + ' and ' + JSONStringify(set5ForClient),
            )
        }
    })
})

describe('sort', () => {
    jsc.property('idempotent', 'array nat', (arr: number[]) => {
        return _.isEqual(arr.sort().sort(), arr.sort())
    })
})
