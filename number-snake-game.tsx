"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Position = { x: number; y: number }
type SequenceType = "fibonacci" | "primes"
type GameState = "menu" | "ready" | "playing" | "gameOver"

const GRID_SIZE = 20
const INITIAL_SNAKE = [{ x: 10, y: 10 }]
const GAME_SPEED = 200

// Generate Fibonacci sequence
function generateFibonacci(n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [1]
  if (n === 2) return [1, 1]

  const fib = [1, 1]
  for (let i = 2; i < n; i++) {
    fib.push(fib[i - 1] + fib[i - 2])
  }
  return fib
}

// Generate prime numbers
function generatePrimes(n: number): number[] {
  const primes: number[] = []
  let num = 2

  while (primes.length < n) {
    let isPrime = true
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) {
        isPrime = false
        break
      }
    }
    if (isPrime) primes.push(num)
    num++
  }
  return primes
}

// Generate wrong numbers for distractors
function generateWrongNumbers(correctNumber: number, count: number): number[] {
  const wrong: number[] = []
  const used = new Set([correctNumber])

  while (wrong.length < count) {
    // Generate numbers around the correct number
    const offset = Math.floor(Math.random() * 20) - 10
    const candidate = Math.max(1, correctNumber + offset)

    if (!used.has(candidate)) {
      wrong.push(candidate)
      used.add(candidate)
    }
  }
  return wrong
}

// Generate a random position that's not on the snake or in the snake's moving direction
function getRandomEmptyPosition(snake: Position[], direction: Position, existingPositions: Position[] = []): Position {
  const occupiedPositions = new Set<string>()

  // Mark snake positions as occupied
  snake.forEach((pos) => {
    occupiedPositions.add(`${pos.x},${pos.y}`)
  })

  // Mark existing food positions as occupied
  existingPositions.forEach((pos) => {
    occupiedPositions.add(`${pos.x},${pos.y}`)
  })

  // Get snake head position
  const head = snake[0]

  // Find an empty position that's not in the snake's moving direction
  let position: Position
  do {
    position = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    }

    // Check if position is occupied
    const isOccupied = occupiedPositions.has(`${position.x},${position.y}`)

    // Check if position is in the snake's moving direction
    const isInMovingDirection =
      (direction.x !== 0 && position.y === head.y) || // Moving horizontally, avoid same row
      (direction.y !== 0 && position.x === head.x) // Moving vertically, avoid same column
  } while (
    occupiedPositions.has(`${position.x},${position.y}`) ||
    (direction.x !== 0 && position.y === head.y) ||
    (direction.y !== 0 && position.x === head.x)
  )

  return position
}

export default function NumberSnakeGame() {
  const [gameState, setGameState] = useState<GameState>("menu")
  const [sequenceType, setSequenceType] = useState<SequenceType>("fibonacci")
  const [expertMode, setExpertMode] = useState(false)
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE)
  const [collectedNumbers, setCollectedNumbers] = useState<number[]>([])
  const [direction, setDirection] = useState<Position>({ x: 1, y: 0 })
  const directionRef = useRef<Position>({ x: 1, y: 0 })
  const [sequence, setSequence] = useState<number[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [food, setFood] = useState<Array<{ pos: Position; value: number; isCorrect: boolean }>>([])
  const [score, setScore] = useState(0)
  const gameLoopRef = useRef<NodeJS.Timeout>()
  const [gameReady, setGameReady] = useState(false)

  const updateDirection = (newDirection: Position) => {
    setDirection(newDirection)
    directionRef.current = newDirection
  }

  const initializeGame = useCallback((seqType: SequenceType, isExpertMode: boolean) => {
    const initialSequence = seqType === "fibonacci" ? generateFibonacci(20) : generatePrimes(20)

    setSequence(initialSequence)
    setCurrentIndex(0)
    setCollectedNumbers([])
    setSnake([{ x: 10, y: 10 }])
    updateDirection({ x: 1, y: 0 })
    setScore(0)
    setExpertMode(isExpertMode)
    setGameReady(true)
    setGameState("ready") // Set state to ready instead of keeping it as menu

    // Generate initial food
    generateFood(initialSequence, 0, [{ x: 10, y: 10 }], { x: 1, y: 0 })
  }, [])

  const startGame = () => {
    setGameState("playing")
    setGameReady(false)
  }

  const generateFood = useCallback(
    (
      seq: number[],
      index: number,
      currentSnake: Position[] = snake,
      currentDirection: Position = directionRef.current,
    ) => {
      if (index >= seq.length) return

      const correctNumber = seq[index]
      const wrongNumbers = generateWrongNumbers(correctNumber, Math.floor(Math.random() * 6) + 4)
      const allNumbers = [correctNumber, ...wrongNumbers]

      const newFood: Array<{ pos: Position; value: number; isCorrect: boolean }> = []
      const existingPositions: Position[] = []

      // Generate food positions ensuring none are on the snake or in moving direction
      allNumbers.forEach((value) => {
        const pos = getRandomEmptyPosition(currentSnake, currentDirection, existingPositions)
        existingPositions.push(pos)

        newFood.push({
          pos,
          value,
          isCorrect: value === correctNumber,
        })
      })

      setFood(newFood)
    },
    [snake],
  )

  const moveSnake = useCallback(() => {
    if (gameState !== "playing") return

    setSnake((currentSnake) => {
      const newSnake = [...currentSnake]
      const head = { ...newSnake[0] }

      // Use the ref to get current direction
      head.x += directionRef.current.x
      head.y += directionRef.current.y

      // Check boundaries
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameState("gameOver")
        return currentSnake
      }

      // Check self collision
      if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        setGameState("gameOver")
        return currentSnake
      }

      newSnake.unshift(head)

      // Check food collision
      const eatenFood = food.find((f) => f.pos.x === head.x && f.pos.y === head.y)
      if (eatenFood) {
        if (eatenFood.isCorrect) {
          // Correct number eaten - add to head of snake
          const newNumber = sequence[currentIndex]
          setCollectedNumbers((prev) => [newNumber, ...prev]) // Add to front
          setScore((s) => s + 10)
          setCurrentIndex((i) => i + 1)

          // Snake grows - don't remove tail this time
          // Generate new food for next number
          setTimeout(() => {
            generateFood(sequence, currentIndex + 1, [...newSnake], directionRef.current)
          }, 100)
        } else {
          // Wrong number eaten - game over
          setGameState("gameOver")
          return currentSnake
        }
      } else {
        // No food eaten - remove tail
        newSnake.pop()
      }

      return newSnake
    })
  }, [food, gameState, sequence, currentIndex, generateFood])

  // Game loop
  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = setInterval(moveSnake, GAME_SPEED)
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState, moveSnake])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === "playing") {
        e.preventDefault()

        switch (e.key) {
          case "ArrowUp":
            if (directionRef.current.y === 0) updateDirection({ x: 0, y: -1 })
            break
          case "ArrowDown":
            if (directionRef.current.y === 0) updateDirection({ x: 0, y: 1 })
            break
          case "ArrowLeft":
            if (directionRef.current.x === 0) updateDirection({ x: -1, y: 0 })
            break
          case "ArrowRight":
            if (directionRef.current.x === 0) updateDirection({ x: 1, y: 0 })
            break
        }
      } else if (gameReady && e.key === " ") {
        e.preventDefault()
        startGame()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [gameState, gameReady])

  const resetGame = () => {
    setGameState("menu")
    setGameReady(false)
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }
  }

  if (gameState === "menu") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100">
        <div className="max-w-4xl w-full px-4">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold mb-2 text-purple-600">Number Snake</h1>
            <p className="text-xl text-purple-500">Learn math patterns while having fun!</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-4 border-yellow-400 shadow-xl bg-white overflow-hidden">
              <div className="bg-yellow-400 p-4">
                <CardTitle className="text-center text-2xl font-bold text-white">How To Play</CardTitle>
              </div>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-yellow-400 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    1
                  </div>
                  <p className="text-gray-600">
                    Use <span className="font-bold">arrow keys</span> to move your snake
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-yellow-400 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    2
                  </div>
                  <p className="text-gray-600">
                    Collect the <span className="font-bold text-blue-500">blue numbers</span> that come next in the
                    sequence
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-yellow-400 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    3
                  </div>
                  <p className="text-gray-600">
                    Avoid the <span className="font-bold text-pink-500">pink numbers</span> - they're wrong!
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="bg-yellow-400 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                    4
                  </div>
                  <p className="text-gray-600">Grow your snake and see how high you can score!</p>
                </div>
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                      N
                    </div>
                    <p className="text-gray-600">
                      <span className="font-bold">Normal Mode:</span> Shows the next number you need to collect
                    </p>
                  </div>
                  <div className="flex items-start space-x-3 mt-3">
                    <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold shrink-0">
                      E
                    </div>
                    <p className="text-gray-600">
                      <span className="font-bold">Expert Mode:</span> Figure out the pattern yourself - no hints!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col space-y-6">
              <Card className="border-4 border-purple-400 shadow-xl bg-white overflow-hidden">
                <div className="bg-purple-400 p-4">
                  <CardTitle className="text-center text-2xl font-bold text-white">Choose Your Sequence</CardTitle>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer ${
                        sequenceType === "fibonacci"
                          ? "bg-purple-500 text-white border-purple-600"
                          : "bg-white text-gray-600 border-purple-300 hover:border-purple-400"
                      }`}
                      onClick={() => setSequenceType("fibonacci")}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-5 h-5 rounded-full mr-2 ${
                            sequenceType === "fibonacci" ? "bg-white" : "bg-purple-500"
                          }`}
                        >
                          {sequenceType === "fibonacci" && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-purple-500"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                        <h3 className="font-bold text-lg">Fibonacci</h3>
                      </div>
                      <div className="mt-2 ml-7">
                        <p className="text-sm">1, 1, 2, 3, 5, 8, 13, 21...</p>
                        <p className="text-xs mt-1 opacity-80">Each number is the sum of the two before it</p>
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer ${
                        sequenceType === "primes"
                          ? "bg-purple-500 text-white border-purple-600"
                          : "bg-white text-gray-600 border-purple-300 hover:border-purple-400"
                      }`}
                      onClick={() => setSequenceType("primes")}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-5 h-5 rounded-full mr-2 ${
                            sequenceType === "primes" ? "bg-white" : "bg-purple-500"
                          }`}
                        >
                          {sequenceType === "primes" && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-purple-500"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                        <h3 className="font-bold text-lg">Prime Numbers</h3>
                      </div>
                      <div className="mt-2 ml-7">
                        <p className="text-sm">2, 3, 5, 7, 11, 13, 17, 19...</p>
                        <p className="text-xs mt-1 opacity-80">Numbers that can only be divided by 1 and themselves</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-4 border-orange-400 shadow-xl bg-white overflow-hidden">
                <div className="bg-orange-400 p-4">
                  <CardTitle className="text-center text-2xl font-bold text-white">Difficulty</CardTitle>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer ${
                        !expertMode
                          ? "bg-green-500 text-white border-green-600"
                          : "bg-white text-gray-600 border-green-300 hover:border-green-400"
                      }`}
                      onClick={() => setExpertMode(false)}
                    >
                      <div className="flex items-center">
                        <div className={`w-5 h-5 rounded-full mr-2 ${!expertMode ? "bg-white" : "bg-green-500"}`}>
                          {!expertMode && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-green-500"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                        <h3 className="font-bold text-lg">Normal Mode</h3>
                      </div>
                      <div className="mt-2 ml-7">
                        <p className="text-xs opacity-80">Shows the next number to collect</p>
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer ${
                        expertMode
                          ? "bg-red-500 text-white border-red-600"
                          : "bg-white text-gray-600 border-red-300 hover:border-red-400"
                      }`}
                      onClick={() => setExpertMode(true)}
                    >
                      <div className="flex items-center">
                        <div className={`w-5 h-5 rounded-full mr-2 ${expertMode ? "bg-white" : "bg-red-500"}`}>
                          {expertMode && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="text-red-500"
                            >
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </div>
                        <h3 className="font-bold text-lg">Expert Mode</h3>
                      </div>
                      <div className="mt-2 ml-7">
                        <p className="text-xs opacity-80">Figure out the pattern yourself!</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => initializeGame(sequenceType, expertMode)}
                className="w-full h-16 text-xl font-bold bg-green-500 hover:bg-green-600 shadow-lg"
              >
                Start Game!
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "ready") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 p-4">
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-bold mb-2 text-purple-600">Get Ready!</h1>
        </div>

        <div className="relative">
          <div
            className="grid bg-white border-4 border-purple-300 rounded-xl p-2 shadow-xl"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              gap: "1px",
              width: "600px",
              height: "600px",
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
              const x = index % GRID_SIZE
              const y = Math.floor(index / GRID_SIZE)

              const snakeSegmentIndex = snake.findIndex((segment) => segment.x === x && segment.y === y)
              const isSnake = snakeSegmentIndex !== -1
              const isHead = snakeSegmentIndex === 0
              const foodItem = food.find((f) => f.pos.x === x && f.pos.y === y)

              return (
                <div
                  key={index}
                  className={`
flex items-center justify-center text-xs font-bold rounded aspect-square transition-all duration-200
${isSnake ? (isHead ? "bg-gradient-to-br from-teal-400 to-teal-600" : "bg-gradient-to-br from-green-400 to-green-500") : ""}
${isSnake ? "border border-teal-300 shadow-lg transform" : ""}
${
  foodItem
    ? expertMode
      ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white border border-orange-300 shadow-lg transform hover:scale-105"
      : foodItem.isCorrect
        ? "bg-gradient-to-br from-blue-400 to-blue-500 text-white border border-blue-300 shadow-lg transform hover:scale-105"
        : "bg-gradient-to-br from-pink-400 to-pink-500 text-white border border-pink-300 shadow-lg transform hover:scale-105"
    : ""
}
${!isSnake && !foodItem ? "bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 shadow-sm" : ""}
`}
                  style={{
                    width: "100%",
                    height: "100%",
                    maxWidth: "28px",
                    maxHeight: "28px",
                    boxShadow: isSnake
                      ? isHead
                        ? "0 2px 4px rgba(13, 148, 136, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                        : "0 2px 4px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                      : foodItem
                        ? expertMode
                          ? "0 2px 4px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                          : foodItem.isCorrect
                            ? "0 2px 4px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                            : "0 2px 4px rgba(236, 72, 153, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                        : "0 1px 2px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
                    animation: foodItem?.isCorrect && !expertMode ? "slowPulse 3s infinite" : "none",
                    color: isSnake || foodItem ? "#ffffff !important" : "inherit",
                  }}
                >
                  <span style={{ color: isSnake || foodItem ? "#ffffff" : "inherit" }}>
                    {isSnake && collectedNumbers[snakeSegmentIndex]}
                    {foodItem && foodItem.value}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Centered overlay message */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/95 backdrop-blur-sm p-8 rounded-xl shadow-2xl border-4 border-yellow-300">
              <p className="text-3xl font-bold mb-4 animate-pulse text-center text-purple-600">Press SPACE to Start!</p>
              <div className="text-sm text-purple-500 space-y-1 text-center">
                <p>• Use arrow keys to move</p>
                <p>• Collect blue numbers (correct sequence)</p>
                <p>• Avoid pink numbers (wrong numbers)</p>
                {expertMode && <p className="text-red-600 font-bold">• Expert Mode: No hints!</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-yellow-100 p-4">
      <div className="mb-4 flex gap-4 items-center flex-wrap justify-center">
        <div className="text-lg font-bold bg-purple-500 text-white px-4 py-2 rounded-full">Score: {score}</div>
        {!expertMode && (
          <div className="text-lg bg-yellow-400 text-white px-4 py-2 rounded-full">
            Next:{" "}
            <span className="font-bold">{currentIndex < sequence.length ? sequence[currentIndex] : "Complete!"}</span>
          </div>
        )}
        {expertMode && <div className="text-lg bg-red-500 text-white px-4 py-2 rounded-full">Expert Mode</div>}
      </div>

      <div
        className="grid bg-white border-4 border-purple-300 rounded-xl p-2 shadow-xl"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: "1px",
          width: "600px",
          height: "600px",
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
          const x = index % GRID_SIZE
          const y = Math.floor(index / GRID_SIZE)

          const snakeSegmentIndex = snake.findIndex((segment) => segment.x === x && segment.y === y)
          const isSnake = snakeSegmentIndex !== -1
          const isHead = snakeSegmentIndex === 0
          const foodItem = food.find((f) => f.pos.x === x && f.pos.y === y)

          return (
            <div
              key={index}
              className={`
flex items-center justify-center text-xs font-bold rounded aspect-square transition-all duration-200
${isSnake ? (isHead ? "bg-gradient-to-br from-teal-400 to-teal-600" : "bg-gradient-to-br from-green-400 to-green-500") : ""}
${isSnake ? "border border-teal-300 shadow-lg transform" : ""}
${
  foodItem
    ? expertMode
      ? "bg-gradient-to-br from-orange-400 to-orange-500 text-white border border-orange-300 shadow-lg transform hover:scale-105"
      : foodItem.isCorrect
        ? "bg-gradient-to-br from-blue-400 to-blue-500 text-white border border-blue-300 shadow-lg transform hover:scale-105"
        : "bg-gradient-to-br from-pink-400 to-pink-500 text-white border border-pink-300 shadow-lg transform hover:scale-105"
    : ""
}
${!isSnake && !foodItem ? "bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 shadow-sm" : ""}
`}
              style={{
                width: "100%",
                height: "100%",
                maxWidth: "28px",
                maxHeight: "28px",
                boxShadow: isSnake
                  ? isHead
                    ? "0 2px 4px rgba(13, 148, 136, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                    : "0 2px 4px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                  : foodItem
                    ? expertMode
                      ? "0 2px 4px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                      : foodItem.isCorrect
                        ? "0 2px 4px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                        : "0 2px 4px rgba(236, 72, 153, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                    : "0 1px 2px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
                animation: foodItem?.isCorrect && !expertMode ? "slowPulse 3s infinite" : "none",
                color: isSnake || foodItem ? "#ffffff !important" : "inherit",
              }}
            >
              <span style={{ color: isSnake || foodItem ? "#ffffff" : "inherit" }}>
                {isSnake && collectedNumbers[snakeSegmentIndex]}
                {foodItem && foodItem.value}
              </span>
            </div>
          )
        })}
      </div>

      <Dialog open={gameState === "gameOver"} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-4 border-yellow-300">
          <DialogHeader className="bg-purple-500 -mx-6 -mt-6 px-6 py-3 rounded-t-lg">
            <DialogTitle className="text-center text-2xl font-bold text-white">Game Over!</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="text-2xl font-semibold text-purple-600">Final Score: {score}</div>
            <div className="text-md text-purple-500 text-center">
              You collected: {collectedNumbers.length > 0 ? collectedNumbers.join(", ") : "No numbers"}
            </div>

            {/* Show the correct number they should have collected */}
            {currentIndex < sequence.length && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                <p className="text-sm text-blue-600 mb-1">The correct number was:</p>
                <p className="text-3xl font-bold text-blue-700">{sequence[currentIndex]}</p>
                <p className="text-xs text-blue-500 mt-1">
                  {sequenceType === "fibonacci" ? "Fibonacci" : "Prime"} sequence
                </p>
              </div>
            )}

            {expertMode && (
              <div className="text-sm text-red-600 text-center font-bold">
                Expert Mode - Great job figuring out the pattern!
              </div>
            )}
            <div className="flex gap-3 w-full">
              <Button
                onClick={() => initializeGame(sequenceType, expertMode)}
                className="flex-1 bg-green-500 hover:bg-green-600"
                size="lg"
              >
                Play Again
              </Button>
              <Button
                onClick={resetGame}
                variant="outline"
                className="flex-1 border-purple-300 text-purple-600 hover:bg-purple-50"
                size="lg"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-4 text-sm text-purple-600 bg-white px-4 py-2 rounded-full shadow">
        Use arrow keys to move • Collect blue numbers • Avoid pink numbers!
      </div>

      <style jsx global>{`
        @keyframes slowPulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
