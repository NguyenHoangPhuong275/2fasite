import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { parseInputToTotp } from "../src/js/otp/totp.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeReference(secret) {
  let bits = "";
  for (const character of secret.replace(/=+$/g, "")) {
    bits += ALPHABET.indexOf(character).toString(2).padStart(5, "0");
  }
  const output = Buffer.alloc(Math.floor(bits.length / 8));
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }
  return output;
}

function encodeReference(bytes) {
  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function generateReference(secret, timestamp, digits = 6, period = 30) {
  const counter = BigInt(Math.floor(timestamp / (period * 1000)));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = crypto.createHmac("sha1", decodeReference(secret)).update(message).digest();
  const offset = digest.at(-1) & 15;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits);
  return String(value).padStart(digits, "0");
}

test("matches RFC 6238 SHA1 vectors", () => {
  const uri = "otpauth://totp/Test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&algorithm=SHA1&digits=8&period=30";
  const totp = parseInputToTotp(uri);
  const vectors = [
    [59000, "94287082"],
    [1111111109000, "07081804"],
    [1111111111000, "14050471"],
    [1234567890000, "89005924"],
    [2000000000000, "69279037"],
    [20000000000000, "65353130"],
  ];
  for (const [timestamp, expected] of vectors) {
    assert.equal(totp.generate({ timestamp }), expected);
  }
});

test("matches an independent implementation", () => {
  const secrets = [
    "NEY6V3333UIFPOUNNJAMYEE6GR5T2MFD",
    "JBSWY3DPEHPK3PXP",
    "MZXW6YTBOI======",
  ];
  const timestamps = [0, 59000, 1111111109000, 1234567890000, 2000000000000];
  for (const secret of secrets) {
    const totp = parseInputToTotp(secret);
    for (const timestamp of timestamps) {
      assert.equal(totp.generate({ timestamp }), generateReference(secret, timestamp));
    }
  }
});

test("matches independent results across cycle boundaries", () => {
  for (let seed = 1; seed <= 32; seed += 1) {
    const bytes = Buffer.alloc(20);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (seed * 37 + index * 19) & 255;
    }
    const secret = encodeReference(bytes);
    const totp = parseInputToTotp(secret);
    const boundary = seed * 30_000;
    for (const timestamp of [boundary - 1, boundary, boundary + 1]) {
      assert.equal(totp.generate({ timestamp }), generateReference(secret, timestamp));
    }
  }
});

test("accepts supported input formats without changing the secret", () => {
  const secret = "NEY6V3333UIFPOUNNJAMYEE6GR5T2MFD";
  const timestamp = 1784652243321;
  const expected = generateReference(secret, timestamp);
  const grouped = secret.match(/.{1,4}/g).join("-");
  const inputs = [
    secret,
    secret.toLowerCase(),
    grouped,
    `secret: ${secret}`,
    `account|secret=${secret}`,
  ];
  for (const input of inputs) {
    assert.equal(parseInputToTotp(input).generate({ timestamp }), expected);
  }
});

test("rejects invalid and ambiguous input", () => {
  assert.throws(() => parseInputToTotp("%%%%"));
  assert.throws(() => parseInputToTotp("ABCD1EFG"), /Ambiguous secret/);
  assert.throws(() => parseInputToTotp("otpauth://hotp/Test?secret=JBSWY3DPEHPK3PXP"), /not a TOTP/i);
});
