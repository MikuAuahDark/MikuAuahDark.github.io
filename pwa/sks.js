"use strict"

function hitungInsentif(sks)
{
	return sks < 8 ? -200 : (1600 + (sks - 8) * 100)
}

if (typeof window == "undefined")
{
	// Node.js
	const readline = require("readline")

	let r = readline.createInterface({input: process.stdin, output: process.stdout})

	r.question("Masukkan SKS: ", (n) => {
		let num = Number(n)

		if (num == num) // NaN check
		{
			let insentif = hitungInsentif(num)
		
			console.log((insentif < 0 ? "Bayar denda: $" : "Insentif: $") + insentif)
			r.close()
		}
	})
}
else
{
	// Browser
	while (true)
	{
		let n = prompt("Masukkan SKS")
		let num = Number(n)

		if (num == num) // NaN check
		{
			let insentif = hitungInsentif(num)
		
			alert((insentif < 0 ? "Bayar denda: $" : "Insentif: $") + insentif)
			break
		}
	}
}
