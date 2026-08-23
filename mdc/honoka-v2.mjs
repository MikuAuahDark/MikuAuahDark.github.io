// HonokaMiku/libhonoka version 2 file decryption.
// Compatible with DarkEnergyProcessor/libhonoka's honokamiku_decrypt_version2.

const encoder = new TextEncoder();
const JP_PREFIX = "Hello";
const MD5_SHIFTS = [
	7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
	5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
	4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
	6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];
const MD5_CONSTANTS = Array.from(
	{ length: 64 },
	(_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0,
);

/**
 * Return the final component of a path using libhonoka's slash rules.
 *
 * @param {string} name - Filename or path.
 * @returns {string} The filename without its path components.
 * @private
 */
function basename(name) {
	const slash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"));
	return name.slice(slash + 1);
}

/**
 * Rotate a 32-bit integer to the left.
 *
 * @param {number} value - Unsigned 32-bit value.
 * @param {number} count - Number of bits to rotate.
 * @returns {number} The rotated unsigned 32-bit value.
 * @private
 */
function rotateLeft(value, count) {
	return ((value << count) | (value >>> (32 - count))) >>> 0;
}

/**
 * Compute an MD5 digest without requiring a platform crypto API.
 *
 * @param {Uint8Array} bytes - Bytes to hash.
 * @returns {Uint8Array} The 16-byte digest.
 * @private
 */
function md5(bytes) {
	const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
	const padded = new Uint8Array(paddedLength);
	padded.set(bytes);
	padded[bytes.length] = 0x80;

	const view = new DataView(padded.buffer);
	const bitLength = bytes.length * 8;
	view.setUint32(paddedLength - 8, bitLength >>> 0, true);
	view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

	let a0 = 0x67452301;
	let b0 = 0xefcdab89;
	let c0 = 0x98badcfe;
	let d0 = 0x10325476;

	for (let offset = 0; offset < paddedLength; offset += 64) {
		const words = Array.from(
			{ length: 16 },
			(_, i) => view.getUint32(offset + i * 4, true),
		);
		let a = a0;
		let b = b0;
		let c = c0;
		let d = d0;

		for (let i = 0; i < 64; i++) {
			let f;
			let g;
			if (i < 16) {
				f = (b & c) | (~b & d);
				g = i;
			} else if (i < 32) {
				f = (d & b) | (~d & c);
				g = (5 * i + 1) & 15;
			} else if (i < 48) {
				f = b ^ c ^ d;
				g = (3 * i + 5) & 15;
			} else {
				f = c ^ (b | ~d);
				g = (7 * i) & 15;
			}

			const nextD = d;
			d = c;
			c = b;
			const sum = (a + (f >>> 0) + MD5_CONSTANTS[i] + words[g]) >>> 0;
			b = (b + rotateLeft(sum, MD5_SHIFTS[i])) >>> 0;
			a = nextD;
		}

		a0 = (a0 + a) >>> 0;
		b0 = (b0 + b) >>> 0;
		c0 = (c0 + c) >>> 0;
		d0 = (d0 + d) >>> 0;
	}

	const digest = new Uint8Array(16);
	const digestView = new DataView(digest.buffer);
	digestView.setUint32(0, a0, true);
	digestView.setUint32(4, b0, true);
	digestView.setUint32(8, c0, true);
	digestView.setUint32(12, d0, true);
	return digest;
}

/**
 * Derive the version-2 header and initial stream key.
 *
 * @param {string} filename - Logical filename; path components are ignored.
 * @returns {{digest: Uint8Array, initialKey: number}} Derived MD5 digest and key.
 * @throws {TypeError} If `filename` is not a string.
 * @private
 */
function derive(filename) {
	if (typeof filename !== "string") {
		throw new TypeError("filename must be a string");
	}
	const material = encoder.encode(JP_PREFIX + basename(filename));
	const digest = md5(material);
	const initialKey = (
		((digest[0] & 0x7f) << 24) |
		(digest[1] << 16) |
		(digest[2] << 8) |
		digest[3]
	) >>> 0;
	return { digest, initialKey };
}

/**
 * Advance the version-2 pseudo-random key with C-compatible unsigned math.
 *
 * @param {number} key - Current unsigned 32-bit key.
 * @returns {number} The next unsigned 32-bit key.
 * @private
 */
function updateKey(key) {
	const a = key >>> 16;
	let b = ((Math.imul(a, 1101463552) >>> 0) & 0x7fffffff)
		+ (key & 0xffff) * 16807;
	const c = Math.imul(a, 16807) >>> 15;
	b = b > 2147483646 ? b + c - 2147483647 : b + c;
	return b >>> 0;
}

/**
 * Decrypt a complete libhonoka version-2 file.
 *
 * The input must contain its four-byte v2 header. The returned Uint8Array is
 * only the decrypted payload. Strings are encoded as UTF-8 before deriving
 * the key; filename path components are ignored, as in libhonoka. This
 * implementation supports JP files only and always uses the `Hello` prefix.
 * The input is not modified.
 *
 * @param {ArrayBuffer | Uint8Array} input - Complete encrypted file, including
 *   its four-byte version-2 header.
 * @param {string} filename - Logical filename used when the file was encrypted.
 * @returns {Uint8Array} A new array containing the decrypted payload without
 *   the four-byte header.
 * @throws {TypeError} If `filename` is not a string.
 * @throws {RangeError} If `input` is shorter than the four-byte header.
 * @throws {Error} If the header does not match `filename` and `prefix`.
 * @example
 * import { decryptHonokaV2 } from "./honoka-v2.mjs";
 *
 * const response = await fetch("example.asset");
 * const encrypted = await response.arrayBuffer();
 * const plain = decryptHonokaV2(
 *   encrypted,
 *   "example.asset",
 * );
 */
export function decryptHonokaV2(input, filename) {
	const encrypted = input instanceof Uint8Array ? input : new Uint8Array(input);
	if (encrypted.length < 4) {
		throw new RangeError("a Honoka v2 file must contain a four-byte header");
	}

	const { digest, initialKey } = derive(filename);
	for (let i = 0; i < 4; i++) {
		if (encrypted[i] !== digest[i + 4]) {
			throw new Error("invalid Honoka v2 JP header or filename");
		}
	}

	const output = encrypted.slice(4);
	let key = initialKey;
	let xorKey = ((key >>> 23) & 0xff) | ((key >>> 7) & 0xff00);
	for (let i = 0; i < output.length; i++) {
		output[i] ^= i & 1 ? xorKey >>> 8 : xorKey & 0xff;
		if (i & 1) {
			key = updateKey(key);
			xorKey = ((key >>> 23) & 0xff) | ((key >>> 7) & 0xff00);
		}
	}
	return output;
}

export default decryptHonokaV2;
