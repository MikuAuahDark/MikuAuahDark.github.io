import ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/esm/ort.min.js"
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.1/dist/"

const MAX_CODEPOINT_LEN = 64
const NUMBER_OF_BITS = 21
const DO_SUM = false

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
 * @param {0|1|2} genderid
 * @param {number[]|Float32Array|null} stats
 * @return {[string, number, number]}
 */
function returnStatistics(genderid, stats) {
	if (stats == null) {
		return ["Unknown", 0.0, 0.0]
	} else {
		let genderText = "Unknown"

		if (genderid == 0) {
			genderText = "Male"
		} else if (genderid == 1) {
			genderText = "Female"
		} else if (genderid == 2) {
			genderText = "Unisex"
		}

		if (DO_SUM) {
			const s = stats[1] + stats[0]
			const mr = s > 0 ? (stats[0] / s) : 0
			const fr = s > 0 ? (stats[1] / s) : 0
			return [genderText, mr, fr]
		} else {
			return [genderText, stats[0], stats[1]]
		}
	}
}

export class ClassificationResult {
	/**
	 * @param {0|1|2} genderid
	 * @param {string} gendertext
	 * @param {number} maleness
	 * @param {number} femaleness
	 */
	constructor(genderid, gendertext, maleness, femaleness) {
		this.gender = genderid
		this.genderString = gendertext
		this.maleness = maleness
		this.femaleness = femaleness
	}

	toString() {
		return this.genderString
	}
}

export class TheClassifier {
	constructor(model) {
		this.model = model
	}

	/**
	 * @param  {...string} names 
	 */
	async infer(...names) {
		const inferResult = []

		if (names.length > 0) {
			const floatArray = new Float32Array(MAX_CODEPOINT_LEN * NUMBER_OF_BITS * names.length)

			for (let k = 0; k < names.length; k++) {
				const name = names[k]

				for (let i = 0; i < name.length; i++) {
					const int = name.codePointAt(i)

					if (int !== undefined) {
						for (let j = 0; j < NUMBER_OF_BITS; j++) {
							floatArray[(k * MAX_CODEPOINT_LEN + i) * NUMBER_OF_BITS + j] = (int & (1 << j)) != 0
						}
					}
				}
			}

			const tensor = new ort.Tensor(floatArray, [names.length, MAX_CODEPOINT_LEN, NUMBER_OF_BITS])
			const result = await this.model.run({input: tensor})

			for (let k = 0; k < names.length; k++) {
				console.log(result.output.data)
				const stats = result.output.data.slice(k * 2, k * 2 + 2)
				const genderid = determineGender(stats)
				const [gendertext, maleness, femaleness] = returnStatistics(genderid, stats)
				inferResult.push(new ClassificationResult(genderid, gendertext, maleness, femaleness))
			}
		}

		return inferResult
	}
}

/**
 * @param {ArrayBuffer} model
 * @param {boolean} useWGL
 */
export async function create(model, useWGL) {
	const provider = useWGL ? ["webgl", "wasm"] : ["wasm"]
	const session = await ort.InferenceSession.create(model, {providers: provider})
	return new TheClassifier(session)
}
