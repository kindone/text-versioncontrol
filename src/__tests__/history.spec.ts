// import {StringWithState, Operation} from '../../app/utils/Text'
import Delta = require('quill-delta')
import { Client } from "../Client"
import { Server } from "../Server"
import { TextHistory } from "../TextHistory"
import { expectEqual } from './JSONStringify'
import { randomUserDeltas } from "./random"




describe("server-client scenarios", () => {
    it("scenario 1", () => {
        const server = new Server()
        const client1 = new Client()
        const client2 = new Client()

        client1.apply([new Delta().insert("client1 text")])
        client2.apply([new Delta().insert("Hello world")])

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

        client1.apply([new Delta().delete(3).insert("replace")])
        client1.sync(server.merge(client1.getSyncRequest()))

        client2.sync(server.merge(client2.getSyncRequest()))

        expect(client1.getText()).toBe(client2.getText())
        expect(client1.getText()).toBe(server.getText())
    })
})

describe("hand-made scenarios", () => {
    it("scenario 1", () => {
        const initialText = "initial"
        const serverHistory = new TextHistory("server", initialText)
        const clientHistory = new TextHistory("client1", initialText)

        const set1 = [new Delta().retain(7).insert(" text"), new Delta().insert("The ")]
        serverHistory.apply(set1)
        // console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getText())

        const set2 = [new Delta().retain(7).insert(" string"), new Delta().insert("An ")]
        clientHistory.apply(set2)
        // console.log(clientHistory.name, clientHistory.getCurrentRev(), clientHistory.getText())

        const set1ForClient = serverHistory.merge({
            baseRev: 0,
            branchName: clientHistory.name,
            deltas: set2
        })
        clientHistory.merge({
            baseRev: 0,
            branchName: serverHistory.name,
            deltas: set1ForClient
        })

        expect(clientHistory.getText()).toBe(serverHistory.getText())
    })

    it("scenario 2", () => {
        const initialText = "initial"
        const serverHistory = new TextHistory("server", initialText)
        const c1History = new TextHistory("client1", initialText)

        const serverSet = [new Delta().retain(7).insert(" text"), new Delta().insert("The ")]
        serverHistory.apply(serverSet)
        // console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getText())

        const client1Set = [new Delta().retain(7).insert(" string"), new Delta().insert("An ")]
        c1History.apply(client1Set)
        // console.log(c1History.name, c1History.getCurrentRev(), c1History.getText())

        const serverSetForClient1 = serverHistory.merge({
            baseRev: 0,
            branchName: c1History.name,
            deltas: client1Set
        })
        c1History.merge({
            baseRev: 0,
            branchName: serverHistory.name,
            deltas: serverSetForClient1
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

describe("generated scenarios", () => {
    it("scenario 1", () => {
        const initialText = "initial"
        const serverHistory = new TextHistory(initialText)
        const clientHistory = new TextHistory(initialText)

        const set1 = randomUserDeltas(initialText.length, 30)
        serverHistory.apply(set1)

        const set2 = randomUserDeltas(initialText.length, 30)
        clientHistory.apply(set2)

        // apply to both
        const set1ForClient = serverHistory.apply(set2)
        clientHistory.apply(set1ForClient)

        expectEqual(clientHistory.getContent(), serverHistory.getContent())

        let serverRev = serverHistory.getCurrentRev()
        let clientRev = clientHistory.getCurrentRev()

        const set3 = randomUserDeltas(serverHistory.getText().length, 30)
        serverHistory.apply(set3)

        const set4 = randomUserDeltas(clientHistory.getText().length, 30)
        clientHistory.apply(set4)

        const set3ForClient = serverHistory.merge({
            baseRev: serverRev,
            branchName: "client",
            deltas: set4
        })
        clientHistory.merge({
            baseRev: clientRev,
            branchName: "server",
            deltas: set3ForClient
        })

        expectEqual(clientHistory.getContent(), serverHistory.getContent())

        serverRev = serverHistory.getCurrentRev()
        clientRev = clientHistory.getCurrentRev()

        const set5 = randomUserDeltas(serverHistory.getText().length, 30)
        serverHistory.apply(set5)

        const set6 = randomUserDeltas(clientHistory.getText().length, 30)
        clientHistory.apply(set6)

        const set5ForClient = serverHistory.merge({
            baseRev: serverRev,
            branchName: "client",
            deltas: set6
        })
        clientHistory.merge({
            baseRev: clientRev,
            branchName: "server",
            deltas: set5ForClient
        })

        expectEqual(clientHistory.getContent(), serverHistory.getContent())
    })
})
