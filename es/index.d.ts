declare type JSSerializationReviver = (this: any, key: string, value: any, raw: any, parsed?: {
    type: string;
    value: string;
}) => any;
declare type JSSerializationReplacer = (this: any, key: string, value: any, raw: any, path: string[]) => any;
interface JSSerializationPlugin {
    reviver?: JSSerializationReviver;
    replacer?: JSSerializationReplacer;
}
declare function quote(string: string): string;
declare function toDataURL(type: string, value: string): string;
declare function parseDataURL(text: string): {
    type: string;
    value: string;
};
declare class JSSerialization {
    plugins: JSSerializationPlugin[];
    constructor();
    register(...plugins: JSSerializationPlugin[]): void;
    /**
     * Converts a JavaScript Object Notation (JSON) any into an object.
     * @param text A valid JSON string.
     * @param reviver A function that transforms the results. This function is called for each member of the object.
     * If a member contains nested objects, the nested objects are transformed before the parent object is.
     */
    parse(text: string, reviver?: JSSerializationReviver): any;
    /**
     * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
     * @param value A JavaScript value, usually an object or array, to be converted.
     * @param replacer A function that transforms the results.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    stringify(value: any, replacer?: JSSerializationReplacer, space?: string | number): string;
    /**
     * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
     * @param value A JavaScript value, usually an object or array, to be converted.
     * @param replacer An array of strings and numbers that acts as an approved list for selecting the object properties that will be stringified.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    stringify(value: any, replacer?: (number | string)[] | null, space?: string | number): string;
}
declare const jss: JSSerialization & {
    create(): JSSerialization;
    quote: typeof quote;
    parseDataURL: typeof parseDataURL;
    toDataURL: typeof toDataURL;
};
export default jss;
