const UINT64_MAX = 2n**64n-1n


let singleNameDictionary = null
let singleDictionaryElem = null
let sectorNameElement = null
let xCoordElem = null
let yCoordElem = null

let multiNameDictionary = null
let multiDictionaryElem = null
let multiNameQueued = false
let multiNamesCountElem = null
let multiNamesTbody = null
let multiNamesTdataTemplate = null
let minXRangeElem = null
let minYRangeElem = null
let maxXRangeElem = null
let maxYRangeElem = null
let lastGenerated = null

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

function updateDictionaryVersion(data)
{
	let version = data.version ?? 0

	if (version == 0)
	{
		data.size = 3

		for (let i = 0; i < data.initialState.length; i++)
		data.initialState[i] = data.initialState[i].split("")

		version = 1
	}
}

function changeSingleNameDictionary()
{
	singleNameDictionary = null
	$.getJSON(singleDictionaryElem.value, function(data)
	{
		singleNameDictionary = data
		updateDictionaryVersion(data)
		updateSectorName()
	})
}

function changeMultiNameDictionary()
{
	multiNameDictionary = null
	$.getJSON(multiDictionaryElem.value, function(data)
	{
		multiNameDictionary = data
		updateDictionaryVersion(data)

		if (multiNameQueued)
			generateLotsOfNames()
	})
}

function updateSectorName()
{
	let x = Number(xCoordElem.value)
	let y = Number(yCoordElem.value)
	sectorNameElement.textContent = calculateSectorName(singleNameDictionary, x, y) ?? "INVALID!"
}

function isCoordInRange(coord)
{
	return coord == coord && coord >= -32767 && coord <= 32767
}

function calculateSectorName(dict, x, y)
{
	let size = dict.size

	// NaN-check
	if (isCoordInRange(x) && isCoordInRange(y))
	{
		if (x == 0 && y == 0)
			return "Sol"
		else
		{
			// Initialize RNG state
			let rng = new Xorshift(computeSeed64(x, y, 2147463847n, 1013n, 337n))
			rng.next()
			rng.next()
			rng = new Xorshift(BigInt.asUintN(64, rng.next() * 214013n + 2531011n))

			let length = size + Math.floor(rng.random() ** 0.885 * 10)
			let state = [...dict.initialState[rng.range(1, dict.initialState.length) - 1]]

			while (state.length < length)
			{
				// Do binary search
				let currentState = state.slice(-size).join("")
				let next = null
				let min = 1
				let max = dict.ma.length

				while (min <= max)
				{
					let mid = Math.floor((min + max) / 2)
					let target = dict.ma[mid - 1]

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

			let finalText = state.join("")
			return finalText[0].toUpperCase() + finalText.substr(1)
		}
	}
	else
		return null
}

// https://stackoverflow.com/a/1527820
function getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateLotsOfNames()
{
	if (multiNameDictionary == null)
	{
		multiNameQueued = true
		return
	}

	multiNameQueued = false

	let amount = Number(multiNamesCountElem.value)
	let minX = Number(minXRangeElem.value)
	let minY = Number(minYRangeElem.value)
	let maxX = Number(maxXRangeElem.value)
	let maxY = Number(maxYRangeElem.value)

	if (
		amount == amount &&
		amount >= 2 &&
		isCoordInRange(minX) &&
		isCoordInRange(maxX) &&
		isCoordInRange(minY) &&
		isCoordInRange(maxY) &&
		minX <= maxX &&
		minY <= minY
	)
	{
		let fragment = document.createDocumentFragment()
		lastGenerated = []

		for (let i = 0; i < amount; i++)
		{
			/** @type HTMLTableRowElement */
			let tableData = multiNamesTdataTemplate.cloneNode(true)
			let x = getRandomInt(minX, maxX)
			let y = getRandomInt(minY, maxY)
			let name = calculateSectorName(multiNameDictionary, x, y) ?? "INVALID!"

			tableData.childNodes[0].textContent = name
			tableData.childNodes[1].textContent = x
			tableData.childNodes[2].textContent = y
			fragment.appendChild(tableData)
			lastGenerated[i] = [name, x, y]
		}

		multiNamesTbody.innerHTML = ""
		multiNamesTbody.appendChild(fragment)
	}
}

function saveToCSV(semicolon)
{
	if (lastGenerated == null)
		return

	let delim = semicolon ? ";" : ","
	let each = [["Name", "X", "Y"].join(delim)]

	for (let i = 0; i < lastGenerated.length; i++)
		each[i + 1] = lastGenerated[i].join(delim)

	let a = document.createElement("a")
	let link = URL.createObjectURL(new Blob([each.join("\n")], {"type": "text/csv"}))
	a.setAttribute("download", "sectorcalc_" + Math.trunc(+new Date() / 1000) + ".csv")
	a.setAttribute("href", link)
	a.click()
}

function registerCoordChange(elem, func)
{
	elem.addEventListener("change", func)
	elem.addEventListener("paste", func)
	elem.addEventListener("keyup", func)
}

$(document).ready(function()
{
	$(".ui.dropdown").dropdown()

	// Get elements
	sectorNameElement = document.getElementById("sector_name")
	xCoordElem = document.getElementById("x_coord")
	yCoordElem = document.getElementById("y_coord")
	singleDictionaryElem = document.getElementById("dictionary")
	minXRangeElem = document.getElementById("x_min_range")
	minYRangeElem = document.getElementById("y_min_range")
	maxXRangeElem = document.getElementById("x_max_range")
	maxYRangeElem = document.getElementById("y_max_range")
	multiNamesCountElem = document.getElementById("multiple_amount")
	multiDictionaryElem = document.getElementById("dictionary_multiple")
	multiNamesTbody = document.getElementById("multiple_sectors")

	// Build template
	multiNamesTdataTemplate = document.createElement("tr")
	let td = document.createElement("td")
	multiNamesTdataTemplate.appendChild(td)
	multiNamesTdataTemplate.appendChild(td.cloneNode())
	multiNamesTdataTemplate.appendChild(td.cloneNode())

	// Register events
	registerCoordChange(xCoordElem, updateSectorName)
	registerCoordChange(yCoordElem, updateSectorName)
	singleDictionaryElem.addEventListener("change", changeSingleNameDictionary)
	multiDictionaryElem.addEventListener("change", changeMultiNameDictionary)

	changeSingleNameDictionary()
	changeMultiNameDictionary()
})
