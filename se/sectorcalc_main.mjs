import { Sectorcalc, generateCSV, getRandomInt } from "./sectorcalc.mjs"

const HEADER_DEFAULT = ["Name", "X", "Y"]
const HEADER_GENDER = ["Name", "Gender", "Prob", "X", "Y"]

const TEXT_ENCODER = new TextEncoder()

/**
 * @param {HTMLTableElement} dest
 * @param {any[]} header
 * @param {any[][]} data
 */
function makeTable(dest, header, data) {
	const thead = document.createElement("thead")
	const tr1 = document.createElement("tr")

	const ths = []
	for (const hdr of header) {
		const th = document.createElement("th")
		th.textContent = hdr.toString()
		ths.push(th)
	}
	tr1.replaceChildren(...ths)
	thead.replaceChildren(tr1)

	const tbody = document.createElement("tbody")
	const trs = []
	for (const data1 of data) {
		const tr2 = document.createElement("tr")
		const tds = []

		for (const data2 of data1) {
			const td = document.createElement("td")
			td.textContent = data2.toString()
			tds.push(td)
		}

		tr2.replaceChildren(...tds)
		trs.push(tr2)
	}
	tbody.replaceChildren(...trs)

	dest.replaceChildren(thead, tbody)
}

export async function main() {
	/** @type {HTMLInputElement} */
	const coordX = document.getElementById("x_coord")
	/** @type {HTMLInputElement} */
	const coordY = document.getElementById("y_coord")
	/** @type {HTMLSpanElement} */
	const sectorNameOutput = document.getElementById("sector_name")
	/** @type {HTMLSelectElement} */
	const selectedDictSingle = document.getElementById("dictionary")
	/** @type {HTMLInputElement} */
	const multiAmount = document.getElementById("multiple_amount")
	/** @type {HTMLSelectElement} */
	const selectedDictMulti = document.getElementById("dictionary_multiple")
	/** @type {HTMLInputElement} */
	const multiCoordXMin = document.getElementById("x_min_range")
	/** @type {HTMLInputElement} */
	const multiCoordYMin = document.getElementById("y_min_range")
	/** @type {HTMLInputElement} */
	const multiCoordXMax = document.getElementById("x_max_range")
	/** @type {HTMLInputElement} */
	const multiCoordYMax = document.getElementById("y_max_range")
	/** @type {HTMLTableElement} */
	const multipleSectorsTable = document.getElementById("multiple_sectors")
	/** @type {HTMLAnchorElement} */
	const dummyAnchor = document.getElementById("dummy")

	/** @type {Sectorcalc|null} */
	let singleSectorcalc = null
	/** @type {Sectorcalc|null} */
	let multiSectorcalc = null
	/** @type {string[][]|null} */
	let lastGenerated = null
	/** @type {string|null} */
	let lastGeneratedURL = null

	function recalculateSingleSector() {
		if (singleSectorcalc) {
			let x = Number(coordX.value)
			let y = Number(coordY.value)
			x = x == x ? x : 0
			y = y == y ? y : 0

			sectorNameOutput.textContent = singleSectorcalc.get(x, y)
		}
	}

	async function updateSingleSectorcalc() {
		singleSectorcalc = null

		const response = await fetch(selectedDictSingle.value)
		const data = await response.json()

		singleSectorcalc = new Sectorcalc(data)
		recalculateSingleSector()
	}

	function generateMultipleSectors() {
		if (multiSectorcalc) {
			let amount = Number(multiAmount.value)
			let minX = Number(multiCoordXMin.value)
			let minY = Number(multiCoordYMin.value)
			let maxX = Number(multiCoordXMax.value)
			let maxY = Number(multiCoordYMax.value)
			
			if (
				amount == amount &&
				minX == minX &&
				minY == minY &&
				maxX == maxX &&
				maxY == maxY &&
				minX <= maxX &&
				minY <= minY
			) {
				lastGenerated = []

				for (let i = 0; i < amount; i++) {
					const x = getRandomInt(minX, maxX)
					const y = getRandomInt(minY, maxY)
					const name = multiSectorcalc.get(x, y)
					lastGenerated.push([name, x.toString(), y.toString()])
				}

				makeTable(multipleSectorsTable, HEADER_DEFAULT, lastGenerated)
			}
		}
	}

	async function updateMultiSectorcalc() {
		multiSectorcalc = null

		const response = await fetch(selectedDictSingle.value)
		const data = await response.json()

		multiSectorcalc = new Sectorcalc(data)
	}

	/**
	 * @param {boolean} semicolon
	 */
	function downloadCSV(semicolon) {
		if (lastGenerated) {
			const csvData = generateCSV(HEADER_DEFAULT, lastGenerated, semicolon)
			const name = "sectorcalc_" + Math.trunc(+new Date() / 1000) + ".csv"
			const link = URL.createObjectURL(new Blob([TEXT_ENCODER.encode(csvData)], {"type": "text/csv"}))

			dummyAnchor.setAttribute("download", name)
			dummyAnchor.setAttribute("href", link)
			dummyAnchor.click()

			if (lastGeneratedURL) {
				URL.revokeObjectURL(lastGeneratedURL)
			}
			lastGeneratedURL = link
		}
	}

	/**
	 * @param {HTMLElement} elem
	 * @param {() => void} cb
	 */
	function registerButtonClickAndKeyboard(elem, cb) {
		elem.addEventListener("click", cb)
		elem.addEventListener("keyup", (ev) => {
			if (ev.key == "Enter") cb()
		})
	}

	coordX.addEventListener("input", recalculateSingleSector)
	coordY.addEventListener("input", recalculateSingleSector)
	selectedDictSingle.addEventListener("change", updateSingleSectorcalc)
	selectedDictMulti.addEventListener("change", updateMultiSectorcalc)
	registerButtonClickAndKeyboard(document.getElementById("generate_alot"), generateMultipleSectors)
	registerButtonClickAndKeyboard(document.getElementById("save_csv_1"), () => downloadCSV(false))
	registerButtonClickAndKeyboard(document.getElementById("save_csv_2"), () => downloadCSV(true))
	registerButtonClickAndKeyboard(document.getElementById("randomize_single"), () => {
		if (singleSectorcalc) {
			coordX.value = getRandomInt(-999, 999)
			coordY.value = getRandomInt(-999, 999)
			recalculateSingleSector()
		}
	})

	await Promise.all([updateSingleSectorcalc(), updateMultiSectorcalc()])
}
