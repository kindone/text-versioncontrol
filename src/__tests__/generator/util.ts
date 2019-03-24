import fc, { Arbitrary, Shrinkable } from "fast-check";

export abstract class ArbitraryWithShrink<T> extends Arbitrary<T>
{
    protected wrapper(value:T):Shrinkable<T>
    {
        return new Shrinkable(value, () => new fc.Stream(this.shrinkGen(value)))
    }

    public *shrinkGen(value:T):IterableIterator<Shrinkable<T>> {
        throw new Error("ArbitraryWithShrink must implement shrinkGen")
    }
}