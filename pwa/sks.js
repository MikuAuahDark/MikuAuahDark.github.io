"use strict"

function oddEven(N)
{
	let ret = []

	for (let i = 1; i <= N; i++)
		ret[i - 1] = (i + (i % 2 == 0 ? " Genap" : " Ganjil"))
	
	return ret
}

function sumByArray(A)
{
	let sum = 0

	for (let i = 0; i < A.length; i++)
		sum += A[i]

	return sum
}

function sumByNumber(N)
{
	let sum = 0

	for (let i = 1; i <= N; i++)
		sum += i

	return sum
}

function powerSumN(x, n)
{
	let sum = 0

	for (let i = 0; i <= n; i++)
		sum += Math.pow(-1, i) * Math.pow(x, i)

	return sum
}

function multiplicationTable(N)
{
	let ret = []

	for (let i = 1; i <= 10; i++)
		ret[i - 1] = (i + (i < 10 ? " " : "") + " x " + N + " = " + (i * N))
	
	return ret
}

function fibonacci(n)
{
	let ret = [0, 1]

	for (let i = 0; i < n; i++)
		ret[i + 2] = ret[i] + ret[i + 1]
	
	return ret
}

function incentiveCalc(sks)
{
	return sks < 8 ? -200 : (1600 + (sks - 8) * 100)
}
