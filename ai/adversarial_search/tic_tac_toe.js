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
const CHARA_LOOKUP = [null, "X", "O"]
const CLASS_LOOKUP = [null, "negative", "positive"]

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

class MinimaxResult
{
	/**
	 * @param {number} index 
	 * @param {number} score 
	 * @param {BoardNode} node 
	 */
	constructor(index, score, node)
	{
		this.index = index
		this.score = score
		this.node = node
	}
}

class BoardNode
{
	/**
	 * @param {TicTacToeBoard} board 
	 * @param {TicTacToeBoard[]} child 
	 */
	constructor(board, child)
	{
		this.board = board

		if (child)
			this.child = [...child]
		else
			this.child = []
	}
}

// list of <td> elements
/** @type {HTMLElement[]} */
let state = [
	null, null, null,
	null, null, null,
	null, null, null
];
let statusInfo = null
let startAIButton = null
let pruningCheck = null

let boardState = new TicTacToeBoard()
let winnerDetermined = false
let playerNumber = 1

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
	pruningCheck = document.getElementById("abpruning")

	document.getElementById("reset_button").addEventListener("click", resetState)
	startAIButton.addEventListener("click", letAIStart)

	if (typeof initHTML === 'function')
		initHTML()

	resetState()
}

function resetState()
{
	for (let i = 0; i < 9; i++)
	{
		state[i].classList.remove("positive", "negative")
		state[i].children[0].textContent = i + 1
	}

	statusInfo.textContent = String.fromCharCode(160)
	playerNumber = 1
	winnerDetermined = false

	startAIButton.removeAttribute("disabled")
	pruningCheck.removeAttribute("disabled")
	boardState.resetBoard()

	if (typeof boardReseted === 'function')
		boardReseted()
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
		pruningCheck.setAttribute("disabled", "")

		state[index].classList.add(CLASS_LOOKUP[playerNumber])
		state[index].children[0].textContent = CHARA_LOOKUP[playerNumber]

		if (status == 9)
			setWinner(1)
		else if (status == -9)
			setWinner(2)
		else if (boardState.isBoardFull())
			setWinner(0)
		else
		{
			let value = walkTree(boardState.clone(), opponent, pruningCheck.checked)

			boardState.setBoard(value.index, opponent)
			state[value.index].classList.add(CLASS_LOOKUP[opponent])
			state[value.index].children[0].textContent = CHARA_LOOKUP[opponent]
			
			status = boardState.utilityValue()
			if (status == 9)
				setWinner(1)
			else if (status == -9)
				setWinner(2)
			else if (boardState.isBoardFull())
				setWinner(0)
			
			// TODO: Tree evaluation
			if (typeof buildHTMLTable === 'function')
				buildHTMLTable(value.node)
		}
	}
}

function letAIStart()
{
	let index = (Math.random() * 9) | 0
	playerNumber = 2

	startAIButton.setAttribute("disabled", "")
	boardState.setBoard(index, 1)

	state[index].classList.add(CLASS_LOOKUP[1])
	state[index].children[0].textContent = CHARA_LOOKUP[1]
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
 * @returns {MinimaxResult}
 */
function minimaxMaxValue(board, alpha, beta)
{
	// Terminal test
	let status = board.utilityValue()
	if (Math.abs(status) == 9 || board.isBoardFull())
		return new MinimaxResult(-1, status, new BoardNode(board, null))
	
	let s = successor(board, 1)
	let v = -Infinity
	let index = -1
	let childs = []

	for (let i = 0; i < s.length; i++)
	{
		let successorBoard = s[i]
		let result = minimaxMinValue(successorBoard[1], alpha, beta)

		if (result.score > v)
		{
			v = result.score
			index = successorBoard[0]
		}

		if (alpha != null && beta != null)
		{
			if (v > beta)
				break
			
			alpha = Math.max(alpha, v)
		}

		childs.push(result.node)
	}

	return new MinimaxResult(index, v, new BoardNode(board, childs))
}

/**
 * @param {TicTacToeBoard} board 
 * @returns {MinimaxResult}
 */
function minimaxMinValue(board, alpha, beta)
{
	// Terminal test
	let status = board.utilityValue()
	if (Math.abs(status) == 9 || board.isBoardFull())
		return new MinimaxResult(-1, status, new BoardNode(board, null))

	let s = successor(board, 2)
	let v = Infinity
	let index = -1
	let childs = []

	for (let i = 0; i < s.length; i++)
	{
		let successorBoard = s[i]
		let result = minimaxMaxValue(successorBoard[1], alpha, beta)

		if (result.score < v)
		{
			v = result.score
			index = successorBoard[0]
		}

		if (alpha != null && beta != null)
		{
			if (v < alpha)
				break
			
			beta = Math.min(beta, v)
		}

		childs.push(result.node)
	}

	return new MinimaxResult(index, v, new BoardNode(board, childs))
}

/**
 * 
 * @param {TicTacToeBoard} board 
 * @param {number} player 
 * @param {boolean} useAlphaBetaPruning
 */
function walkTree(board, player, useAlphaBetaPruning)
{
	let alpha = null, beta = null
	if (useAlphaBetaPruning)
	{
		alpha = -Infinity
		beta = Infinity
	}

	if (player == 2)
		return minimaxMinValue(board, alpha, beta)
	else
		return minimaxMaxValue(board, alpha, beta)
}
