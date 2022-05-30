'use strict';

type JSSerializationReviver = (
  this: any,
  key: string,
  value: any,
  raw: any,
  parsed?: { type: string; value: string }
) => any;

type JSSerializationReplacer = (
  this: any,
  key: string,
  value: any,
  raw: any,
  path: string[]
) => any;

interface JSSerializationPlugin {
  reviver?: JSSerializationReviver;
  replacer?: JSSerializationReplacer;
}

const rx_escapable =
  /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
const meta: any = {
  // table of character substitutions
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\',
};
const undefinedSymbol = Symbol('undefined');

let path: string[];
let gap: string;
let indent: string;
let rep: JSSerializationReplacer | (number | string)[] | null | undefined;
let plugins: JSSerializationPlugin[];

function quote(string: string) {
  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

  rx_escapable.lastIndex = 0;
  return rx_escapable.test(string)
    ? '"' +
        string.replace(rx_escapable, function (a) {
          const c = meta[a];
          return typeof c === 'string'
            ? c
            : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) +
        '"'
    : '"' + string + '"';
}

function toDataURL(type: string, value: string) {
  return 'data:' + type + ',' + value;
}

function parseDataURL(text: string): {
  type: string;
  value: string;
} {
  const [type, value] = text.split(',');
  return {
    type: type.split(':')[1],
    value,
  };
}

function str(key: string, holder: any): any {
  path.push(key);
  // Produce a string from holder[key].

  let i; // The loop counter.
  let k; // The member key.
  let v; // The member value.
  let length;
  let mind = gap;
  let partial;
  let value = holder[key];

  const raw = holder[key];

  // If the value has a toJSON method, call it to obtain a replacement value.

  if (
    value &&
    typeof value === 'object' &&
    typeof value.toJSON === 'function' &&
    !(value instanceof Date)
  ) {
    value = value.toJSON(key);
  }

  if (plugins && plugins.length > 0) {
    for (let index = 0; index < plugins.length; index++) {
      const { replacer } = plugins[index];
      if (replacer) {
        value = replacer.call(holder, key, value, raw, path);
      }
    }
  }

  // If we were called with a replacer function, then call the replacer to
  // obtain a replacement value.

  if (typeof rep === 'function') {
    value = rep.call(holder, key, value, raw, path);
  }

  // What happens next depends on the value's type.

  switch (typeof value) {
    case 'undefined':
      return quote(toDataURL('undefined', ''));

    case 'string':
      return quote(value);

    case 'number':
      if (Number.isNaN(value)) {
        return quote(toDataURL('number', 'NaN'));
      } else if (value === Infinity) {
        return quote(toDataURL('number', 'Infinity'));
      } else if (value === -Infinity) {
        return quote(toDataURL('number', '-Infinity'));
      } else {
        return isFinite(value) ? String(value) : 'null';
      }

    case 'bigint':
      return quote(toDataURL('bigint', String(value)));

    case 'boolean':
      // If the value is a boolean or null, convert it to a string. Note:
      // typeof null does not produce "null". The case is included here in
      // the remote chance that this gets fixed someday.

      return String(value);

    // If the type is "object", we might be dealing with an object or an array or
    // null.

    case 'object':
      // Due to a specification blunder in ECMAScript, typeof null is "object",
      // so watch out for that case.

      if (!value) {
        return 'null';
      }

      if (value instanceof Date) {
        return quote(toDataURL('date', String(value.getTime())));
      }

      // Make an array to hold the partial results of stringifying this object value.

      gap += indent;
      partial = [];

      // Is the value an array?
      if (Object.prototype.toString.apply(value) === '[object Array]') {
        // The value is an array. Stringify every element. Use null as a placeholder
        // for non-JSON values.

        length = value.length;
        for (i = 0; i < length; i += 1) {
          partial[i] = str(String(i), value) || 'null';
          path.pop();
        }

        // Join all of the elements together, separated with commas, and wrap them in
        // brackets.

        v =
          partial.length === 0
            ? '[]'
            : gap
            ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
            : '[' + partial.join(',') + ']';
        gap = mind;
        return v;
      }

      // If the replacer is an array, use it to select the members to be stringified.

      if (rep && typeof rep === 'object') {
        length = rep.length;
        for (i = 0; i < length; i += 1) {
          if (typeof rep[i] === 'string') {
            k = rep[i];
            v = str(String(k), value);
            path.pop();
            if (v) {
              partial.push(quote(String(k)) + (gap ? ': ' : ':') + v);
            }
          }
        }
      } else {
        // Otherwise, iterate through all of the keys in the object.

        for (k in value) {
          if (Object.prototype.hasOwnProperty.call(value, k)) {
            v = str(k, value);
            path.pop();
            if (v) {
              partial.push(quote(k) + (gap ? ': ' : ':') + v);
            }
          }
        }
      }

      // Join all of the member texts together, separated with commas,
      // and wrap them in braces.

      v =
        partial.length === 0
          ? '{}'
          : gap
          ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
          : '{' + partial.join(',') + '}';
      gap = mind;
      return v;
  }
}

class JSSerialization {
  plugins: JSSerializationPlugin[];

  constructor() {
    this.plugins = [];
  }

  register(...plugins: JSSerializationPlugin[]): void {
    this.plugins = this.plugins.concat(plugins);
  }

  /**
   * Converts a JavaScript Object Notation (JSON) any into an object.
   * @param text A valid JSON string.
   * @param reviver A function that transforms the results. This function is called for each member of the object.
   * If a member contains nested objects, the nested objects are transformed before the parent object is.
   */
  parse(text: string, reviver?: JSSerializationReviver): any {
    const plugins = this.plugins;
    const json = JSON.parse(text, function (key, value) {
      let result = value;

      let parsedResult: { type: string; value: string } | undefined = undefined;
      if (typeof result === 'string' && /^data:[^,]+,[^,]*$/.test(result)) {
        parsedResult = parseDataURL(result);
        switch (parsedResult.type) {
          case 'undefined': {
            result = undefined;
            break;
          }
          case 'number': {
            switch (parsedResult.value) {
              case 'NaN': {
                result = NaN;
                break;
              }
              case 'Infinity': {
                result = Infinity;
                break;
              }
              case '-Infinity': {
                result = -Infinity;
                break;
              }
            }
            break;
          }
          case 'bigint': {
            result = BigInt(parsedResult.value);
            break;
          }
          case 'date': {
            result = new Date(Number(parsedResult.value));
            break;
          }
        }
      }

      if (reviver) {
        result = reviver(key, result, value, parsedResult);
      }

      if (plugins.length > 0) {
        for (let index = 0; index < plugins.length; index++) {
          const { reviver } = plugins[index];
          if (reviver) {
            result = reviver(key, result, value, parsedResult);
          }
        }
      }

      if (result === undefined) {
        result = undefinedSymbol;
      }

      return result;
    });

    const queue: any[] = [json];
    while (queue.length > 0) {
      const current = queue[0];
      const keys = Object.keys(current);
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        const value = current[key];
        if (value === undefinedSymbol) {
          current[key] = undefined;
        } else if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
      queue.shift();
    }

    return json;
  }

  /**
   * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
   * @param value A JavaScript value, usually an object or array, to be converted.
   * @param replacer A function that transforms the results.
   * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
   */
  stringify(
    value: any,
    replacer?: JSSerializationReplacer,
    space?: string | number
  ): string;
  /**
   * Converts a JavaScript value to a JavaScript Object Notation (JSON) string.
   * @param value A JavaScript value, usually an object or array, to be converted.
   * @param replacer An array of strings and numbers that acts as an approved list for selecting the object properties that will be stringified.
   * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
   */
  stringify(
    value: any,
    replacer?: (number | string)[] | null,
    space?: string | number
  ): string;
  stringify(
    value: any,
    replacer?: JSSerializationReplacer | (number | string)[] | null,
    space?: string | number
  ): string {
    let i: number;
    path = [];
    gap = '';
    indent = '';

    // If the space parameter is a number, make an indent string containing that
    // many spaces.

    if (typeof space === 'number') {
      for (i = 0; i < space; i += 1) {
        indent += ' ';
      }

      // If the space parameter is a string, it will be used as the indent string.
    } else if (typeof space === 'string') {
      indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.

    rep = replacer;
    plugins = this.plugins;
    if (
      replacer &&
      typeof replacer !== 'function' &&
      (typeof replacer !== 'object' || typeof replacer.length !== 'number')
    ) {
      throw new Error('JSON.stringify');
    }

    // Make a fake root object containing our value under the key of "".
    // Return the result of stringifying the value.

    return str('', { '': value });
  }
}

const jss: JSSerialization & {
  create(): JSSerialization;
  quote: typeof quote;
  parseDataURL: typeof parseDataURL;
  toDataURL: typeof toDataURL;
} = new JSSerialization() as unknown as any;

jss.create = function () {
  return new JSSerialization();
};

jss.quote = quote;

jss.parseDataURL = parseDataURL;

jss.toDataURL = toDataURL;

export default jss;
