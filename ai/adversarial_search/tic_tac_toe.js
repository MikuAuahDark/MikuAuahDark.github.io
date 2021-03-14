// Tic-Tac-Toe
// Player 1 is "X" and tries to maximize, player 2 is "O" and tries to minimize

const POSSIBLE_INDEX = [
	// horizontal
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	// vertical
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	// diagonal
	[0, 4, 8],
	[2, 4, 6]
];

class TicTacToeBoard
{
	/**  @param {TicTacToeBoard} state */
	constructor(state)
	{
		if (state)
		/** @type {Uint8Array} */
			this.state = state.state.slice(0)
		else
			this.state = new Uint8Array(9)
	}

	clone()
	{
		return new TicTacToeBoard(this)
	}

	checkArguments(index, player)
	{
		if (player != null)
			if (player < 1 || player > 2)
				throw "player out of range"
		if (index < 0 || index >= 9)
			throw "index out of range"
	}

	setBoard(index, player)
	{
		this.checkArguments(index, player)

		if (this.state[index] != 0)
			return false
		
		this.state[index] = player
		return true
	}

	getBoard(index)
	{
		this.checkArguments(index, null)
		return this.state[index]
	}

	isBoardFull()
	{
		for (let i = 0; i < 9; i++)
			if (this.state[i] == 0)
				return false

		return true
	}

	resetBoard()
	{
		for (let i = 0; i < 9; i++)
			this.state[i] = 0
	}

	// Returns amount of player 1 possible lines
	// 9 if player1 wins
	// -9 if player2 wins
	utilityValue()
	{
		let player = 0

		for (let i = 0; i < POSSIBLE_INDEX.length; i++)
		{
			let s = POSSIBLE_INDEX[i];
			let s1 = this.state[s[0]], s2 = this.state[s[1]], s3 = this.state[s[2]]
			let hasPlayer1 = s1 == 1 || s2 == 1 || s3 == 1
			let hasPlayer2 = s1 == 2 || s2 == 2 || s3 == 2
			let win = s1 == s2 && s2 == s3

			if (hasPlayer1)
			{
				if (win)
					// player 1 win
					return 9
				else if (!hasPlayer2)
					player++;
			}

			// player 2 win
			if (hasPlayer2 && win)
				return -9
		}

		return player
	}

	/**
	 * 
	 * @param {TicTacToeBoard} board 
	 */
	getSelectedIndex(board)
	{
		for (let i = 0; i < 9; i++)
		{
			if (board.state[i] != this.state[i])
				return i
		}

		return -1
	}
}

// list of <td> elements
/** @type {HTMLElement[]} */
let state = [
	null, null, null,
	null, null, null,
	null, null, null
];
let boardState = new TicTacToeBoard()
let statusInfo = null
let startAIButton = null
let playerNumber = 1
let characterLookup = [null, "X", "O"]
let classLookup = [null, "negative", "positive"]
let winnerDetermined = false

function init()
{
	let tbody = document.getElementById("tictactoe_playarea").children[0]
	let count = 0

	for (let i = 0; i < tbody.children.length; i++)
	{
		let tr = tbody.children[i]

		for (let j = 0; j < tr.children.length; j++)
		{
			let child = tr.children[j]
			let index = count++;

			state[index] = child
			child.children[0].addEventListener("click", () => { selectBoard(index) })
		}
	}

	startAIButton = document.getElementById("ai_button")
	statusInfo = document.getElementById("status")

	document.getElementById("reset_button").addEventListener("click", resetState)
	startAIButton.addEventListener("click", letAIStart)

	resetState();
}

function resetState()
{
	for (let i = 0; i < 9; i++)
	{
		state[i].classList.remove("positive", "negative")
		state[i].children[0].textContent = i + 1
	}

	let minimaxEvaluation = document.getElementById("minimax_evaluation")
	let copyNode = minimaxEvaluation.cloneNode(false)
	minimaxEvaluation.parentNode.replaceChild(copyNode, minimaxEvaluation)

	statusInfo.textContent = ""
	playerNumber = 1
	winnerDetermined = false

	startAIButton.removeAttribute("disabled")
	boardState.resetBoard()
}

function getOpponentNumber()
{
	return 3 - playerNumber
}

function setWinner(player)
{
	winnerDetermined = true

	if (player == 0)
		statusInfo.textContent = "Draw!"
	else if (player == playerNumber)
		statusInfo.textContent = "You Win!"
	else
		statusInfo.textContent = "You Lose!"
}

function selectBoard(index)
{
	if (winnerDetermined)
		return

	if (boardState.setBoard(index, playerNumber))
	{
		let status = boardState.utilityValue()
		let opponent = getOpponentNumber()

		startAIButton.setAttribute("disabled", "")
		state[index].classList.add(classLookup[playerNumber])
		state[index].children[0].textContent = characterLookup[playerNumber]

		if (status == 9)
			setWinner(1)
		else if (status == -9)
			setWinner(2)
		else if (boardState.isBoardFull())
			setWinner(0)

		let value = walkTree(boardState, opponent)
		console.log(...value)
		boardState.setBoard(value[0], opponent)
		state[value[0]].classList.add(classLookup[opponent])
		state[value[0]].children[0].textContent = characterLookup[opponent]
		
		status = boardState.utilityValue()
		if (status == 9)
			setWinner(1)
		else if (status == -9)
			setWinner(2)
		else if (boardState.isBoardFull())
			setWinner(0)
		
		// TODO: Tree evaluation
	}
}

function letAIStart()
{
	let index = (Math.random() * 9 + 0.5) | 0
	playerNumber = 2

	startAIButton.setAttribute("disabled", "")
	boardState.setBoard(index, 1)

	state[index].classList.add(classLookup[1])
	state[index].children[0].textContent = characterLookup[1]
}

/**
 * 
 * @param {TicTacToeBoard} board 
 * @param {number} player 
 */
function successor(board, player)
{
	if (board.isBoardFull())
		return null
	
	/** @type {[number, TicTacToeBoard][]} */
	let action = []

	for (let i = 0; i < 9; i++)
	{
		if (board.getBoard(i) == 0)
		{
			let b = board.clone()
			b.setBoard(i, player)
			action.push([i, b])
		}
	}

	return action
}

/**
 * @param {TicTacToeBoard} board 
 * @param {[number, number]} alphaBeta 
 * @returns {[number, number]}
 */
function minimaxMaxValue(board, alphaBeta)
{
	// Terminal test
	let status = board.utilityValue()
	if (Math.abs(status) == 9 || board.isBoardFull())
		return [-1, status]
	
	let s = successor(board, 1)
	let v = -Infinity
	let index = -1

	for (let i = 0; i < s.length; i++)
	{
		let successorBoard = s[i]
		let result = minimaxMinValue(successorBoard[1], alphaBeta)

		if (result[1] > v)
		{
			v = result[1]
			index = successorBoard[0]
		}
		else if (v >= alphaBeta[1])
			break
		
		alphaBeta[0] = Math.max(alphaBeta[0], v)
	}

	return [index, v]
}

/**
 * @param {TicTacToeBoard} board 
 * @param {[number, number]} alphaBeta 
 * @returns {[number, number]}
 */
function minimaxMinValue(board, alphaBeta)
{
	// Terminal test
	let status = board.utilityValue()
	if (Math.abs(status) == 9 || board.isBoardFull())
		return [-1, status]

	let s = successor(board, 2)
	let v = Infinity
	let index = -1

	for (let i = 0; i < s.length; i++)
	{
		let successorBoard = s[i]
		let result = minimaxMaxValue(successorBoard[1], alphaBeta)

		if (result[1] < v)
		{
			v = result[1]
			index = successorBoard[0]
		}
		else if (v <= alphaBeta[0])
			break
		
		alphaBeta[1] = Math.min(alphaBeta[1], v)
	}

	return [index, v]
}

/**
 * 
 * @param {TicTacToeBoard} board 
 * @param {number} player 
 */
function walkTree(board, player)
{
	let alphaBeta = [-Infinity, Infinity]

	if (player == 2)
		return minimaxMinValue(board, alphaBeta)
	else
		return minimaxMaxValue(board, alphaBeta)
}
