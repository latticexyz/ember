type CleanStruct = { [key: string]: any };
type Keys<T extends CleanStruct> = keyof T;
type Values<T extends CleanStruct> = T[Keys<T>];
type UncleanStruct<OriginalStruct> = { [key: number]: Values<OriginalStruct> } & CleanStruct;

export function cleanStruct<T extends CleanStruct>(returnedStruct: UncleanStruct<T>): T {
    const struct: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(returnedStruct)) {
        if (Number.isInteger(parseInt(key))) continue;
        struct[key] = value;
    }
    return struct as T;
}

export function cleanStructArray<T extends CleanStruct>(returnedStruct: UncleanStruct<T>[]): T[] {
    return returnedStruct.map((struct) => cleanStruct<T>(struct));
}
