import sha1 from "js-sha1";
const base_conv_factory = (base) => ({
  encode(string) {
    let number = "";
    for (var i = 0; i < string.length; i++)
      number += string.charCodeAt(i).toString(base);
    return number;
  },
  decode(number) {
    let string = "";
    for (var i = 0; i < number.length; ) {
      var code = number.slice(i, (i += 2));
      string += String.fromCharCode(parseInt(code, base));
    }
    return string;
  },
});
const base10 = base_conv_factory(10);
const base16 = base_conv_factory(16);

/**
 * Used to hash a string into a 24-bit integer. Takes first three bytes off a
 * SHA-1 checksum. Used as the post ID in IQDB.
 */
export const hash24 = (x) =>
  Number.parseInt(base10.encode(base16.decode(sha1(x)).slice(0, 3)));
