import * as gol from "./modelgol.mjs"

const ONNXMODEL = "modelgol2.onnx"

/**
 * @param {number[]|Float32Array} arr
 */
function determineGender(arr) {
	if (DO_SUM) {
		const s = arr[1] + arr[0]
		if (s > 0 && (Math.abs(arr[1] - arr[0]) / s) < 0.5) {
			return 2
		}
	} else {
		if (Math.abs(arr[1] - arr[0]) < 0.5) {
			return 2
		}
	}

	if (arr[0] > arr[1]) {
		return 0
	} else if (arr[1] > arr[0]) {
		return 1
	} else {
		throw new Error("logic error")
	}
}

/**
 * @param {HTMLSpanElement} gt
 * @param {JQuery} gm
 * @param {JQuery} gf
 * @param {string} genderText
 * @param {number} maleness
 * @param {number} femaleness
 */
function returnStatistics(gt, gm, gf, genderText, maleness, femaleness) {
	gt.textContent = genderText
	gm.progress({percent: maleness * 100})
	gf.progress({percent: femaleness * 100})
	console.log("output", [maleness, femaleness])
}

/**
 * @param {ArrayBuffer} model
 * @param {boolean} useWGL
 */
async function createSession(model, useWGL) {
	const provider = useWGL ? ["webgl"] : ["wasm"]
	const session = await ort.InferenceSession.create(model, {providers: ["wasm"]})
	return session
}

/**
 * @param {gol.TheClassifier} session
 * @param {string} name
 * @param {HTMLSpanElement} gt
 * @param {JQuery} gm
 * @param {JQuery} gf
 */
async function doInference(session, name, gt, gm, gf) {
	if (name.length > 0) {
		const result = (await session.infer(name))[0]
		returnStatistics(gt, gm, gf, result.genderString, result.maleness, result.femaleness)
	} else {
		returnStatistics(gt, gm, gf, "Unknown", 0, 0)
	}
}

async function main() {
	/** @type {HTMLInputElement} */
	const inputElement = document.getElementById("input")
	/** @type {HTMLSpanElement} */
	const genderTextElement = document.getElementById("gender_text")
	/** @type {HTMLInputElement} */
	const useWebGLCheckbox = document.getElementById("use_webgl")
	const genderMaleProgressJQ = $("#gender_male")
	const genderFemaleProgressJQ = $("#gender_female")

	genderMaleProgressJQ.progress({percent: 0})
	genderFemaleProgressJQ.progress({percent: 0})

	const modeldata = await (await fetch(ONNXMODEL)).arrayBuffer()
	let session = await gol.create(modeldata, useWebGLCheckbox.checked)

	inputElement.addEventListener("input", async () => {
		return await doInference(session, inputElement.value, genderTextElement, genderMaleProgressJQ, genderFemaleProgressJQ)
	})
	useWebGLCheckbox.addEventListener("change", async () => {
		console.log("WebGL2 mode", useWebGLCheckbox.checked)
		session = await gol.create(modeldata, useWebGLCheckbox.checked)
		return await doInference(session, inputElement.value, genderTextElement, genderMaleProgressJQ, genderFemaleProgressJQ)
	})

	inputElement.disabled = false
	inputElement.setAttribute("placeholder", "Type away...")
}

if (document.readyState !== "loading") {
	main()
} else {
	document.addEventListener("DOMContentLoaded", main);
}