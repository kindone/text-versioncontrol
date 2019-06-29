import fc, { Arbitrary, Shrinkable } from "fast-check";

export abstract class ArbitraryWithShrink<T> extends Arbitrary<T>
{
    /*
    constructor(options...) {
        super()
        // initialize privates
    }

    public generate(mrng:Random):Shrinkable<Array<ArraySplit>> {
        const value = generate_value_somehow_with_mrng
        return this.wrapper(value)
    }
    */
    protected wrapper(value:T):Shrinkable<T>
    {
        return new Shrinkable(value, () => new fc.Stream(this.shrinkGen(value)))
    }

    public *shrinkGen(value:T):IterableIterator<Shrinkable<T>> {
        throw new Error("ArbitraryWithShrink must implement shrinkGen")
    }
}