// https://stackoverflow.com/a/18639999
// Modified to accept Uint8Array instead of string.

const CRC_TABLE = []

for (let n = 0; n < 256; n++)
{
	let c = n
	for(let k = 0; k < 8; k++)
		c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1))

	CRC_TABLE[n] = c
}

/**
 * 
 * @param {ArrayBuffer|Uint8Array} buf
 */
export function crc32(buf, crc = 0)
{
	crc ^= (-1);
	if (buf instanceof ArrayBuffer)
		buf = new Uint8Array(buf)

	for (let i = 0; i < buf.length; i++)
		crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF]

	return (crc ^ (-1)) >>> 0
}
