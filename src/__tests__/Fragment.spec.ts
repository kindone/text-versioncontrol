import { Fragment } from "../Fragment";
import { FragmentIterator } from "../FragmentIterator";


describe("hand-made scenarios", () => {
    it("fragment 1", () => {
        const fragment = Fragment.insert("hello", "me")

        const newFragment = fragment.sliceWithDelete("me", 0)
        console.log(fragment)
        console.log(newFragment)
    })

    it("fragment iterator 1", () => {
        const fragment = Fragment.insert("hello", "me")
        const iter = new FragmentIterator("me", [fragment])
        const fragments = iter.delete(4).fragments
        console.log(fragments)
        console.log(fragments.concat(iter.rest()))
    })

    it("fragment tiebreak 1", () => {
        const fragment = Fragment.insert("hello", "me")
        const iter = new FragmentIterator("you", [fragment])
        // console.log(iter.current().isVisibleTo("you"), iter.current().shouldAdvanceForTiebreak("you"))
        const fragments = iter.insert(" world").fragments
        console.log(fragments)
        console.log(fragments.concat(iter.rest()))
    })

    it("fragment tiebreak 2", () => {
        const fragment = Fragment.insert("hello", "you")
        const iter = new FragmentIterator("me", [fragment])
        // console.log(iter.current().isVisibleTo("me"), iter.current().shouldAdvanceForTiebreak("me"))
        const fragments = iter.insert(" world").fragments
        console.log(fragments)
        console.log(fragments.concat(iter.rest()))
    })
})