import React, { useState, useCallback, useEffect, useRef, useId } from 'react'
import { Delete, ShieldAlert } from 'lucide-react'
import { cn } from '../lib/utils'

/* -------------------------------------------------------------------------
 * PinDots — the "value" readout above the keypad
 * ---------------------------------------------------------------------- */
function PinDots({ length, filled, error, shake }: {
  length: number
  filled: number
  error: boolean
  shake: boolean
}) {
  return (
    <div
      role="status"
      aria-label={`${filled} of ${length} digits entered`}
      className={cn(
        'flex items-center justify-center gap-3',
        shake && 'animate-[kp-shake_0.4s_ease-in-out]'
      )}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled
        return (
          <span
            key={i}
            className={cn(
              'h-3 w-3 rounded-full border transition-all duration-150',
              error
                ? 'border-red-500/70 bg-red-500/70'
                : isFilled
                ? 'border-amber-500 bg-amber-500 scale-110'
                : 'border-zinc-600 bg-transparent'
            )}
          />
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------
 * KeypadButton — single key. role="button" via native <button>, but we
 * layer on the data-key attribute so keyboard-triggered presses can find
 * and visually "press" the matching key (mirrors a physical keypad).
 * ---------------------------------------------------------------------- */
interface KeypadButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  keyValue: string
  label: React.ReactNode
  sublabel?: string
  onPress: (key: string) => void
  'data-pressed'?: boolean
}

const KeypadButton = React.forwardRef<HTMLButtonElement, KeypadButtonProps>(
  function KeypadButton(
    { keyValue, label, sublabel, onPress, className, ...props },
    ref
  ) {
    return (
      <button
        ref={ref}
        type="button"
        data-key={keyValue}
        onClick={() => onPress(keyValue)}
        className={cn(
          'group relative flex h-16 w-16 select-none flex-col items-center justify-center rounded-2xl',
          'bg-zinc-800/60 text-zinc-100 ring-1 ring-inset ring-zinc-700/60',
          'transition-all duration-100 ease-out',
          'hover:bg-zinc-700/60 active:scale-95 active:bg-amber-500/20 active:ring-amber-500/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
          'disabled:pointer-events-none disabled:opacity-30',
          'data-[pressed=true]:scale-95 data-[pressed=true]:bg-amber-500/20 data-[pressed=true]:ring-amber-500/50',
          className
        )}
        {...props}
      >
        <span className="text-lg font-medium tabular-nums">{label}</span>
        {sublabel && (
          <span className="mt-0.5 text-[9px] font-medium tracking-[0.2em] text-zinc-500">
            {sublabel}
          </span>
        )}
      </button>
    )
  }
)

const KEY_LETTERS: Record<number, string> = {
  2: 'ABC',
  3: 'DEF',
  4: 'GHI',
  5: 'JKL',
  6: 'MNO',
  7: 'PQRS',
  8: 'TUV',
  9: 'WXYZ',
}

/* -------------------------------------------------------------------------
 * PinKeypad — the exported, reusable component
 *
 * Props:
 *  length        number of digits required (default 4)
 *  onComplete    (value: string) => void, fired once length is reached
 *  onChange      (value: string) => void, fired on every change
 *  error         string | boolean — shows the pad in an error state
 *  disabled      disables all keys
 *  showLetters   show the phone-style ABC/DEF letters under each digit
 *  label         accessible group label
 * ---------------------------------------------------------------------- */
interface PinKeypadProps {
  length?: number
  onComplete?: (value: string) => void
  onChange?: (value: string) => void
  error?: boolean | string
  disabled?: boolean
  showLetters?: boolean
  label?: string
  className?: string
}

export function PinKeypad({
  length = 4,
  onComplete,
  onChange,
  error = false,
  disabled = false,
  showLetters = false,
  label = 'PIN entry',
  className,
}: PinKeypadProps) {
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(false)
  const [pressedKey, setPressedKey] = useState<string | null>(null)
  const completedRef = useRef(false)
  const groupId = useId()
  const pressTimer = useRef<number | null>(null)

  // Reset the "already fired onComplete" guard whenever the value shortens
  useEffect(() => {
    if (value.length < length) completedRef.current = false
  }, [value, length])

  // Trigger a brief shake whenever an external `error` turns on
  useEffect(() => {
    if (!error) return
    setShake(true)
    const t = setTimeout(() => setShake(false), 400)
    return () => clearTimeout(t)
  }, [error])

  const commit = useCallback(
    (next: string) => {
      setValue(next)
      onChange?.(next)
      if (next.length === length && !completedRef.current) {
        completedRef.current = true
        onComplete?.(next)
      }
    },
    [length, onChange, onComplete]
  )

  const pressVisual = useCallback((key: string) => {
    setPressedKey(key)
    if (pressTimer.current) window.clearTimeout(pressTimer.current)
    pressTimer.current = window.setTimeout(() => setPressedKey(null), 120)
  }, [])

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled) return
      pressVisual(digit)
      if (value.length >= length) return
      commit(value + digit)
    },
    [disabled, value, length, commit, pressVisual]
  )

  const handleBackspace = useCallback(() => {
    if (disabled) return
    pressVisual('Backspace')
    commit(value.slice(0, -1))
  }, [disabled, value, commit, pressVisual])

  const handleClear = useCallback(() => {
    if (disabled) return
    commit('')
  }, [disabled, commit])

  // Physical keyboard support
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (disabled) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleClear()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [disabled, handleDigit, handleBackspace, handleClear])

  const errorMessage = typeof error === 'string' ? error : null

  return (
    <div
      role="group"
      aria-labelledby={`${groupId}-label`}
      aria-describedby={errorMessage ? `${groupId}-error` : undefined}
      className={cn('flex w-fit flex-col items-center gap-6', className)}
    >
      <span id={`${groupId}-label`} className="sr-only">
        {label}
      </span>

      <PinDots length={length} filled={value.length} error={!!error} shake={shake} />

      {errorMessage && (
        <p
          id={`${groupId}-error`}
          className="-mt-3 flex items-center gap-1.5 text-xs font-medium text-red-400"
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <KeypadButton
            key={n}
            keyValue={String(n)}
            label={n}
            sublabel={showLetters ? KEY_LETTERS[n] : undefined}
            onPress={handleDigit}
            disabled={disabled}
            data-pressed={pressedKey === String(n)}
          />
        ))}

        <KeypadButton
          keyValue="Clear"
          label="Clear"
          onPress={handleClear}
          disabled={disabled || value.length === 0}
          className="text-xs font-medium tracking-wide text-zinc-400"
        />

        <KeypadButton
          keyValue="0"
          label="0"
          onPress={handleDigit}
          disabled={disabled}
          data-pressed={pressedKey === '0'}
        />

        <KeypadButton
          keyValue="Backspace"
          label={<Delete className="h-5 w-5" aria-hidden="true" />}
          onPress={handleBackspace}
          disabled={disabled || value.length === 0}
          data-pressed={pressedKey === 'Backspace'}
          aria-label="Delete last digit"
        />
      </div>

      <style>{`
        @keyframes kp-shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  )
}