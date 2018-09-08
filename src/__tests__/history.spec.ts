// import {StringWithState, Operation} from '../../app/utils/Text'
import { TextHistory } from "../TextHistory"
import { randomUserOperations } from "./random"
import { Server } from "../Server"
import { Client } from "../Client"
import { Operation } from "../Operation"

describe("server-client scenarios", () => {
    it("scenario 1", () => {
        const server = new Server()
        const client1 = new Client()
        const client2 = new Client()

        client1.apply([new Operation(0, 0, "client1 text")])
        client2.apply([new Operation(0, 0, "Hello world")])

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

        client1.apply([new Operation(0, 3, "replace")])
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

        const set1 = [new Operation(7, 0, " text"), new Operation(0, 0, "The ")]
        serverHistory.apply(set1)
        console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getText())

        const set2 = [new Operation(7, 0, " string"), new Operation(0, 0, "An ")]
        clientHistory.apply(set2)
        console.log(clientHistory.name, clientHistory.getCurrentRev(), clientHistory.getText())

        const set1_for_client = serverHistory.merge({
            branchName: clientHistory.name,
            baseRev: 0,
            operations: set2
        })
        clientHistory.merge({
            branchName: serverHistory.name,
            baseRev: 0,
            operations: set1_for_client
        })

        expect(clientHistory.getText()).toBe(serverHistory.getText())
    })

    it("scenario 2", () => {
        const initialText = "initial"
        const serverHistory = new TextHistory("server", initialText)
        const c1History = new TextHistory("client1", initialText)

        const server_set = [new Operation(7, 0, " text"), new Operation(0, 0, "The ")]
        serverHistory.apply(server_set)
        console.log(serverHistory.name, serverHistory.getCurrentRev(), serverHistory.getText())

        const client1_set = [new Operation(7, 0, " string"), new Operation(0, 0, "An ")]
        c1History.apply(client1_set)
        console.log(c1History.name, c1History.getCurrentRev(), c1History.getText())

        const server_set_for_client1 = serverHistory.merge({
            branchName: c1History.name,
            baseRev: 0,
            operations: client1_set
        })
        c1History.merge({
            branchName: serverHistory.name,
            baseRev: 0,
            operations: server_set_for_client1
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

        const set1 = randomUserOperations(initialText.length, 30)
        serverHistory.apply(set1)

        const set2 = randomUserOperations(initialText.length, 30)
        clientHistory.apply(set2)

        // apply to both
        const set1_for_client = serverHistory.apply(set2)
        clientHistory.apply(set1_for_client)

        expect(clientHistory.getText() == serverHistory.getText())

        let server_rev = serverHistory.getCurrentRev()
        let client_rev = clientHistory.getCurrentRev()

        const set3 = randomUserOperations(serverHistory.getText().length, 30)
        serverHistory.apply(set3)

        const set4 = randomUserOperations(clientHistory.getText().length, 30)
        clientHistory.apply(set4)

        const set3_for_client = serverHistory.merge({
            branchName: "client",
            baseRev: server_rev,
            operations: set4
        })
        clientHistory.merge({
            branchName: "server",
            baseRev: client_rev,
            operations: set3_for_client
        })

        expect(clientHistory.getText()).toBe(serverHistory.getText())

        server_rev = serverHistory.getCurrentRev()
        client_rev = clientHistory.getCurrentRev()

        const set5 = randomUserOperations(serverHistory.getText().length, 30)
        serverHistory.apply(set5)

        const set6 = randomUserOperations(clientHistory.getText().length, 30)
        clientHistory.apply(set6)

        const set5_for_client = serverHistory.merge({
            branchName: "client",
            baseRev: server_rev,
            operations: set6
        })
        clientHistory.merge({
            branchName: "server",
            baseRev: client_rev,
            operations: set5_for_client
        })

        expect(clientHistory.getText()).toBe(serverHistory.getText())
    })
})
