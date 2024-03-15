import { Sectorcalc, generateCSV, getRandomInt } from "./sectorcalc.mjs"
import * as gol from "../modelgol.mjs"

const HEADER_DEFAULT = ["Name", "X", "Y"]
const HEADER_GENDER = ["Name", "Gender","Prob. Gender", "X", "Y"]

const TEXT_ENCODER = new TextEncoder()

/**
 * @param {gol.ClassificationResult} stats
 */
function formatProb(stats) {
	return `${Math.round(stats.maleness * 100)}% M, ${Math.round(stats.femaleness * 100)}% F`
}

/**
 * @param {HTMLTableElement} dest
 * @param {string[]} header
 * @param {[string, number, number][]} data
 * @param {gol.ClassificationResult[]|null} genders
 */
function makeTable(dest, data, genders) {
	const thead = document.createElement("thead")
	const tr1 = document.createElement("tr")
	const header = genders == null ? HEADER_DEFAULT : HEADER_GENDER

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
	if (genders != null) {
		for (let i = 0; i < data.length; i++) {
			const data1 = [
				data[i][0],
				genders[i].genderString,
				formatProb(genders[i]),
				data[i][1],
				data[i][2]
			]
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
	} else {
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
	const inferGender = document.getElementById("inference_gender")
	/** @type {HTMLElement} */
	const inferGenderStatus = document.getElementById("infer_gender_status")
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
	/** @type {[string, number, number][]|null} */
	let lastGenerated = null
	/** @type {gol.ClassificationResult[]|null} */
	let lastGeneratedGenders = null
	/** @type {string|null} */
	let lastGeneratedURL = null
	/** @type {gol.TheClassifier|null} */
	let inferGenderSession = null

	function doGenderInference() {
		return inferGender.checked && inferGenderSession != null
	}

	async function recalculateSingleSector() {
		if (singleSectorcalc) {
			let x = Number(coordX.value)
			let y = Number(coordY.value)
			x = x == x ? x : 0
			y = y == y ? y : 0

			const name = singleSectorcalc.get(x, y)
			if (doGenderInference()) {
				const gender = await inferGenderSession.infer(name)
				sectorNameOutput.textContent = `${name} (${gender[0].genderString})`
			} else {
				sectorNameOutput.textContent = name
			}
		}
	}

	/**
	 * @param {string} name
	 */
	function recalculateSingleSectorFor(name) {
		/**
		 * @param {Event} e
		 */
		return (e) => {
			localStorage.setItem(name, e.target.value.toString())
			return recalculateSingleSector()
		}
	}

	async function updateSingleSectorcalc() {
		singleSectorcalc = null

		const response = await fetch(selectedDictSingle.value)
		const data = await response.json()

		singleSectorcalc = new Sectorcalc(data)
		await recalculateSingleSector()
	}

	async function updateMultipleSectorsTable() {
		if (lastGenerated != null) {
			if (doGenderInference()) {
				const namesToInfer = []
				for (const gen of lastGenerated) {
					namesToInfer.push(gen[0])
				}

				lastGeneratedGenders = await inferGenderSession.infer(...namesToInfer)
				console.log(namesToInfer, lastGeneratedGenders)
			} else {
				lastGeneratedGenders = null
			}

			makeTable(multipleSectorsTable, lastGenerated, lastGeneratedGenders)
		}
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

				updateMultipleSectorsTable()
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
	async function downloadCSV(semicolon) {
		if (lastGenerated) {
			let csvData = undefined
			if (doGenderInference()) {
				if (lastGeneratedGenders == null) {
					await updateMultipleSectorsTable()
				}

				const newData = []
				for (let i = 0; i < lastGenerated.length; i++) {
					const data = lastGenerated[i]
					const gender = lastGeneratedGenders[i]
					newData.push([data[0], gender.genderString, formatProb(gender), data[1], data[2]])
				}

				csvData = generateCSV(HEADER_GENDER, newData, semicolon)
			} else {
				csvData = generateCSV(HEADER_DEFAULT, lastGenerated, semicolon)
			}

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

	/**
	 * @param {HTMLElement} elem
	 * @param {string} name
	 */
	function getValueFromLocalStorage(elem, name) {
		const value = localStorage.getItem(name)
		if (value !== null) {
			elem.value = value
		}
	}

	getValueFromLocalStorage(coordX, "xcoord")
	getValueFromLocalStorage(coordY, "ycoord")
	coordX.addEventListener("input", recalculateSingleSectorFor("xcoord"))
	coordY.addEventListener("input", recalculateSingleSectorFor("ycoord"))
	selectedDictSingle.addEventListener("change", updateSingleSectorcalc)
	selectedDictMulti.addEventListener("change", updateMultiSectorcalc)
	registerButtonClickAndKeyboard(document.getElementById("generate_alot"), generateMultipleSectors)
	registerButtonClickAndKeyboard(document.getElementById("save_csv_1"), () => downloadCSV(false))
	registerButtonClickAndKeyboard(document.getElementById("save_csv_2"), () => downloadCSV(true))
	registerButtonClickAndKeyboard(document.getElementById("randomize_single"), async () => {
		if (singleSectorcalc) {
			coordX.value = getRandomInt(-999, 999)
			coordY.value = getRandomInt(-999, 999)
			localStorage.setItem("xcoord", coordX.value.toString())
			localStorage.setItem("ycoord", coordY.value.toString())
			await recalculateSingleSector()
		}
	})
	inferGender.addEventListener("change", async () => {
		if (inferGender.checked) {
			if (inferGenderSession == null) {
				inferGenderStatus.className = "spinner icon"

				try {
					const model = await fetch("../modelgol2.onnx")
					inferGenderSession = await gol.create(await model.arrayBuffer(), true)
					window.inferGenderSession = inferGenderSession
					inferGenderStatus.className = "check icon"
				} catch (e) {
					console.log(e)
					inferGenderStatus.className = "x icon"
					return
				}
			} else {
				inferGenderStatus.className = "check icon"
			}
		} else {
			inferGenderStatus.className = "icon"
		}

		await Promise.all([await recalculateSingleSector(), await updateMultipleSectorsTable()])
	})

	await Promise.all([updateSingleSectorcalc(), updateMultiSectorcalc()])
}
