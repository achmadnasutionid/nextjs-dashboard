"use client"

import * as React from "react"
import { Calculator, X } from "lucide-react"
import { Button } from "./button"
import { cn } from "@/lib/utils"

export function FloatingCalculator() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [display, setDisplay] = React.useState("0")
  const [previousValue, setPreviousValue] = React.useState<string | null>(null)
  const [operation, setOperation] = React.useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = React.useState(false)

  // Handle keyboard input
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keyboard events if user is typing in an input, textarea, or contenteditable element
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Prevent default for calculator keys
      if (/^[0-9+\-*/.=]$/.test(e.key) || e.key === "Enter" || e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault()
      }

      if (e.key === "Escape") {
        handleClear()
      } else if (e.key === "Backspace") {
        handleBackspace()
      } else if (/^[0-9]$/.test(e.key)) {
        handleNumber(e.key)
      } else if (e.key === ".") {
        handleDecimal()
      } else if (["+", "-", "*", "/"].includes(e.key)) {
        handleOperation(e.key)
      } else if (e.key === "Enter" || e.key === "=") {
        handleEquals()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, display, previousValue, operation, waitingForOperand])

  const handleNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const handleDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.")
      setWaitingForOperand(false)
    } else if (display.indexOf(".") === -1) {
      setDisplay(display + ".")
    }
  }

  const handleOperation = (nextOperation: string) => {
    const inputValue = parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(String(inputValue))
    } else if (operation) {
      const currentValue = parseFloat(previousValue)
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(String(newValue))
    }

    setWaitingForOperand(true)
    setOperation(nextOperation)
  }

  const calculate = (firstValue: number, secondValue: number, operation: string): number => {
    switch (operation) {
      case "+":
        return firstValue + secondValue
      case "-":
        return firstValue - secondValue
      case "*":
        return firstValue * secondValue
      case "/":
        return firstValue / secondValue
      default:
        return secondValue
    }
  }

  const handleEquals = () => {
    const inputValue = parseFloat(display)

    if (previousValue !== null && operation) {
      const currentValue = parseFloat(previousValue)
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(null)
      setOperation(null)
      setWaitingForOperand(true)
    }
  }

  const handleClear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperation(null)
    setWaitingForOperand(false)
  }

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1))
    } else {
      setDisplay("0")
    }
  }

  const handlePercentage = () => {
    const value = parseFloat(display)
    setDisplay(String(value / 100))
  }

  const handleToggleSign = () => {
    const value = parseFloat(display)
    setDisplay(String(value * -1))
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "h-14 w-14 rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "hover:bg-primary/90 transition-all duration-200",
          "flex items-center justify-center",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "scale-95"
        )}
        aria-label="Toggle Calculator"
      >
        <Calculator className="h-6 w-6" />
      </button>

      {/* Calculator Modal */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50",
            "w-[calc(100vw-3rem)] max-w-[320px] rounded-lg shadow-2xl",
            "bg-card border border-border",
            "animate-in slide-in-from-bottom-5 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-lg">Calculator</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-accent transition-colors"
              aria-label="Close Calculator"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Calculator Body */}
          <div className="p-4 space-y-4">
            {/* Display */}
            <div className="bg-muted rounded-lg p-4 min-h-[60px] flex items-center justify-end">
              <div className="text-right">
                {operation && previousValue && (
                  <div className="text-sm text-muted-foreground">
                    {previousValue} {operation}
                  </div>
                )}
                <div className="text-3xl font-semibold break-all">
                  {display}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {/* Row 1 */}
              <Button
                variant="secondary"
                className="h-14 text-lg"
                onClick={handleClear}
              >
                AC
              </Button>
              <Button
                variant="secondary"
                className="h-14 text-lg"
                onClick={handleToggleSign}
              >
                +/-
              </Button>
              <Button
                variant="secondary"
                className="h-14 text-lg"
                onClick={handlePercentage}
              >
                %
              </Button>
              <Button
                variant="default"
                className="h-14 text-lg"
                onClick={() => handleOperation("/")}
              >
                ÷
              </Button>

              {/* Row 2 */}
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("7")}
              >
                7
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("8")}
              >
                8
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("9")}
              >
                9
              </Button>
              <Button
                variant="default"
                className="h-14 text-lg"
                onClick={() => handleOperation("*")}
              >
                ×
              </Button>

              {/* Row 3 */}
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("4")}
              >
                4
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("5")}
              >
                5
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("6")}
              >
                6
              </Button>
              <Button
                variant="default"
                className="h-14 text-lg"
                onClick={() => handleOperation("-")}
              >
                -
              </Button>

              {/* Row 4 */}
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("1")}
              >
                1
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("2")}
              >
                2
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={() => handleNumber("3")}
              >
                3
              </Button>
              <Button
                variant="default"
                className="h-14 text-lg"
                onClick={() => handleOperation("+")}
              >
                +
              </Button>

              {/* Row 5 */}
              <Button
                variant="outline"
                className="h-14 text-lg col-span-2"
                onClick={() => handleNumber("0")}
              >
                0
              </Button>
              <Button
                variant="outline"
                className="h-14 text-lg"
                onClick={handleDecimal}
              >
                .
              </Button>
              <Button
                variant="success"
                className="h-14 text-lg"
                onClick={handleEquals}
              >
                =
              </Button>
            </div>

            {/* Keyboard Hint */}
            <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
              Keyboard: Numbers, +, -, *, /, Enter/=, Esc, Backspace
            </div>
          </div>
        </div>
      )}
    </>
  )
}
