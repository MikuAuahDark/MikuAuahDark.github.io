let dictionary = null
const UINT64_MAX = 2n**64n-1n

function wangHash64(k)
{
	let key = BigInt(k) & UINT64_MAX
	key = (BigInt.asUintN(64, ~key) + ((key << 21n) & UINT64_MAX)) & UINT64_MAX
	key = key ^ (key >> 24n)
	key = (((key + (key << 3n)) & UINT64_MAX) + (key << 8n)) & UINT64_MAX
	key = key ^ (key >> 14n)
	key = (((key + (key << 2n)) & UINT64_MAX) + (key << 4n)) & UINT64_MAX
	key = key ^ (key >> 28n)
	key = (key + (key << 31n)) & UINT64_MAX
	return key
}

function computeSeed64(x, y, f1, f2, f3)
{
	let p1 = f1 ? BigInt(f1) : 65537n
	let p2 = f2 ? BigInt(f2) : 2147483647n
	let p3 = f3 ? BigInt(f3) : 1011001110001111n
	let sx = BigInt.asUintN(64, BigInt(x))
	let sy = BigInt.asUintN(64, BigInt(y))
	let z = BigInt.asUintN(64, (sx << 32n) | (sy & 0xFFFFFFFFn))
	let zx = BigInt.asUintN(64, (sx >> 31n) ^ (sx << 1n))
	let zy = BigInt.asUintN(64, (sy >> 31n) ^ (sy << 1n))
	let temp = BigInt.asUintN(64, p3 * (zx + zy)) ^ BigInt.asUintN(64, zx * zy * p2)
	let temp2 = BigInt.asUintN(64, (temp ^ BigInt.asUintN(64, z * p1 + p2)) + wangHash64(z))
	return wangHash64(BigInt.asUintN(64, p3 * temp2 + temp * p2))
}

class Xorshift
{
	constructor(seed)
	{
		this.arrayBuffer = new ArrayBuffer(8)
		this.f64Array = new Float64Array(this.arrayBuffer)
		this.u64Array = new BigUint64Array(this.arrayBuffer)

		let newSeed = seed != null ? BigInt.asUintN(64, BigInt(seed)) : 0x139408dcbbf7a40n
		do
		{
			newSeed = wangHash64(newSeed)
		} while (newSeed == 0n)

		this.state = newSeed
	}

	next()
	{
		this.state ^= this.state >> 12n
		this.state ^= BigInt.asUintN(64, this.state << 25n)
		this.state ^= this.state >> 27n
		return BigInt.asUintN(64, this.state * 2685821657736338717n)
	}

	random()
	{
		this.u64Array[0] = ((0x3FFn) << 52n) | (this.next() >> 12n)
		return this.f64Array[0] - 1
	}

	range(l, u)
	{
		return Math.floor(this.random() * (u - l + 1)) + l
	}
}

$.getJSON("us_names.json", function(data)
{
	dictionary = data
})

$(document).ready(function()
{
	let changer = function()
	{
		if (dictionary)
		{
			let x = Number($("#x_coord").val())
			let y = Number($("#y_coord").val())

			// NaN-check
			if (x == x && y == y && x >= -999 && y >= -999 && x <= 999 && y <= 999)
			{
				if (x == 0 && y == 0)
					$("#sector_name").text("Sol")
				else
				{
					// Initialize RNG state
					let rng = new Xorshift(computeSeed64(x, y, 2147463847n, 1013n, 337n))
					rng.next()
					rng.next()
					rng = new Xorshift(BigInt.asUintN(64, rng.next() * 214013n + 2531011n))

					let length = 3 + Math.floor(rng.random() ** 0.885 * 10)
					let initialState = dictionary.initialState[rng.range(1, dictionary.initialState.length) - 1]
					let state = [initialState[0], initialState[1], initialState[2]]

					while (state.length < length)
					{
						// Do binary search
						let currentState = state.slice(-3).join("")
						let next = null
						let min = 1
						let max = dictionary.ma.length

						while (min <= max)
						{
							let mid = Math.floor((min + max) / 2)
							let target = dictionary.ma[mid - 1]

							if (currentState > target.name)
								min = mid + 1
							else if (currentState < target.name)
								max = mid - 1
							else
							{
								next = target
								break
							}
						}

						if (next == null)
							break
						
						let list = next.paths
						let nextValue = rng.range(0, list[list.length - 1][1])

						for (const v of list)
						{
							if (nextValue <= v[1])
							{
								state.push(v[0])
								break
							}
						}
					}

					state[0] = state[0].toUpperCase()
					$("#sector_name").text(state.join(""))
				}
			}
			else
				$("#sector_name").text("INVALID")
		}
	}

	$("#x_coord").on("change paste keyup", changer)
	$("#y_coord").on("change paste keyup", changer)
})
