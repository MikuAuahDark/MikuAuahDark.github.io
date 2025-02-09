import { crc32 } from "./crc32.mjs"

const PNG_HEADER = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

export class PNGChunk
{
	/**
	 * 
	 * @param {string} chunk 
	 * @param {Uint8Array} data 
	 */
	constructor(chunk, data)
	{
		this.chunk = chunk
		this.data = data
	}
}

/**
 * @param {Uint8Array} png
 * @returns {[PNGChunk[], Uint8Array]}
 */
export function extractPNGChunks(png)
{
	/** @type {PNGChunk[]} */
	const chunks = []

	let cp = 8 // Current position
	while (true)
	{
		const toBeSliced = (png[cp] << 24) | (png[cp + 1] << 16) | (png[cp + 2] << 8) | png[cp + 3];
		cp += 4;

		const fourcc = String.fromCharCode(png[cp], png[cp + 1], png[cp + 2], png[cp + 3]);
		cp += 4;

		const data = png.slice(cp, cp + toBeSliced);
		cp += toBeSliced + 4; // +4 for CRC32, we'll recompute the CRC32 ourself.

		chunks.push(new PNGChunk(fourcc, data))

		if (fourcc == "IEND")
			break
	}

	return [chunks, png.slice(cp)];
}

/**
 * @param {number} num 
 * @param {Uint8Array} out 
 * @param {number} off
 */
function writeUint32ToArray(num, out, off = 0)
{
	out[off] = (num >> 24) & 0xFF;
	out[off + 1] = (num >> 16) & 0xFF;
	out[off + 2] = (num >> 8) & 0xFF;
	out[off + 3] = num & 0xFF;
}

/**
 * @param  {string} str
 */
function stringCharCodeToUint8Array(str)
{
	const result = new Uint8Array(str.length)

	for (let i = 0; i < str.length; i++)
		result[i] = str.charCodeAt(i)

	return result
}

/**
 * @param {PNGChunk[]} chunks
 * @param {Uint8Array|null} extraData
 * @returns {Uint8Array}
 */
export function reassemblePNG(chunks, extraData = null)
{
	let totalLength = PNG_HEADER.length
	for (const chunk of chunks)
		totalLength += 12 + chunk.data.length

	if (extraData)
		totalLength += extraData.length

	const result = new Uint8Array(totalLength)
	let cp = 0

	result.set(PNG_HEADER)
	cp += PNG_HEADER.length

	for (const chunk of chunks)
	{
		writeUint32ToArray(chunk.data.length, result, cp)
		cp += 4

		const chunk8ua = stringCharCodeToUint8Array(chunk.chunk)
		result.set(chunk8ua, cp)
		cp += 4

		result.set(chunk.data, cp)
		cp += chunk.data.length

		let crc = crc32(chunk8ua)
		crc = crc32(chunk.data, crc)
		writeUint32ToArray(crc, result, cp)
		cp += 4
	}

	if (extraData && extraData.length > 0)
		result.set(extraData, cp)

	return result
}

/**
 * @param {Uint8Array} buf 
 */
export function isPNG(buf)
{
	if (buf.length < PNG_HEADER.length)
		return false

	for (let i = 0; i < PNG_HEADER.length; i++)
	{
		if (buf[i] != PNG_HEADER[i])
			return false
	}

	return true
}
