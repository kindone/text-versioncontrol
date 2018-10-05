import * as _ from 'underscore'
import { Fragment } from "../Fragment";
import { FragmentIterator } from "../FragmentIterator";
import { expectEqual } from "../JSONStringify";


describe("hand-made scenarios", () => {
    it("fragment 1", () => {
        const fragment = Fragment.insert("hello", "me")

        expectEqual(fragment, {val: 'hello', mod: { insertedBy: 'me', deletedBy: [] } })

        const newFragment = fragment.sliceWithDelete("me", 0)

        expectEqual(newFragment, {val: 'hello', mod: { insertedBy: 'me', deletedBy: ['me'] } })
    })

    it("fragment iterator 1", () => {
        const fragment = Fragment.insert("hello", "me")
        const iter = new FragmentIterator("me", [fragment])
        const fragments = iter.delete(4)
        expectEqual(fragments, [ {val: 'hell', mod:{ insertedBy: 'me', deletedBy: ["me"] } } ])
        expectEqual(fragments.concat(iter.rest()), [ {val: 'hell', mod: { insertedBy: 'me', deletedBy: ["me"] } },
           { val: 'o', mod: { insertedBy: 'me', deletedBy: [] } } ])
    })

    it("fragment tiebreak 1", () => {
        const fragment = Fragment.insert("hello", "me")
        const iter = new FragmentIterator("you", [fragment])
        // console.log(iter.current().isVisibleTo("you"), iter.current().shouldAdvanceForTiebreak("you"))
        const fragments = iter.insert(" world")

        expectEqual(fragments, [ {val: 'hello', mod: { insertedBy: 'me', deletedBy: [] } },
         { val: ' world', mod: { insertedBy: 'you', deletedBy: [] }} ])

        expectEqual(fragments.concat(iter.rest()), [ {val: 'hello', mod: { insertedBy: 'me', deletedBy: [] } },
         { val: ' world', mod: { insertedBy: 'you', deletedBy: [] }} ])
    })

    it("fragment tiebreak 2", () => {
        const fragment = Fragment.insert("hello", "you")
        const iter = new FragmentIterator("me", [fragment])
        // console.log(iter.current().isVisibleTo("me"), iter.current().shouldAdvanceForTiebreak("me"))
        const fragments = iter.insert(" world")
        expectEqual(fragments, [ { val: ' world', mod: { insertedBy: 'me', deletedBy: [] } } ])

        expectEqual(fragments.concat(iter.rest()), [ { val: ' world', mod: { insertedBy: 'me', deletedBy: [] } },
          { val: 'hello', mod: { insertedBy: 'you', deletedBy: [] } } ])
    })

    it("fragment attribute set", () => {
        const fragment = Fragment.initial("hello")
        const iter = new FragmentIterator("me", [fragment])
        expectEqual(iter.retain(1), [{"val":"h","mod":{"deletedBy":[]}}])
        expectEqual(iter.insert("x"), [{"val":"x","mod":{"insertedBy":"me","deletedBy":[]}}])
        expectEqual(iter.attribute(2, {"bold": true}), [{"val":"el","attrs":{mod: {"me":{"bold":true}}},"mod":{"deletedBy":[]}}])
    })

    it("fragment attribute unset", () => {
        const fragment = Fragment.initial("hello", {bold: true})
        const iter = new FragmentIterator("me", [fragment])
        expectEqual(iter.retain(1), [{"val":"h","attrs":{val: {"bold":true}},"mod":{"deletedBy":[]}}])
        expectEqual(iter.insert("x"), [{"val":"x","mod":{"insertedBy":"me","deletedBy":[]}}])
        const fragments = iter.attribute(2, {"bold": null})
        expectEqual(fragments, [{"val":"el","attrs":{"val":{"bold":true},"mod":{"me":{"bold":null}}},"mod":{"deletedBy":[]}}])
        expectEqual(fragments[0].getAttributes(), {})
    })
})