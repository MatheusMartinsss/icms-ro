'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'
import { Input } from './input'

/** Converts a decimal string ("1500.50") to Brazilian display format ("1.500,50") */
function toDisplay(value: string): string {
    if (!value) return ''
    const num = parseFloat(value)
    if (isNaN(num)) return ''
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converts raw typed input to a decimal string ("1500.50").
 *  Treats all digits as cents: "150050" → "1500.50" */
function fromInput(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    const cents = parseInt(digits, 10)
    return (cents / 100).toFixed(2)
}

export interface CurrencyInputProps {
    /** Optional label rendered above the input */
    label?: string
    /** Decimal value string, e.g. "1500.50" — stores raw number without symbol */
    value: string
    /** Called with decimal string, e.g. "1500.50" */
    onChange: (v: string) => void
    id?: string
    placeholder?: string
    disabled?: boolean
    /** Applied to the outermost wrapper div */
    className?: string
    /** Applied to the inner <Input> element */
    inputClassName?: string
    /** Validation error message */
    error?: string
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ label, value, onChange, id, placeholder, disabled, className, inputClassName, error }, ref) => {
        return (
            <div className={cn('', className)}>
                {label && (
                    <Label htmlFor={id} className={cn('block mb-1', error && 'text-red-600')}>
                        {label}
                    </Label>
                )}
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 select-none pointer-events-none font-normal">
                        R$
                    </span>
                    <Input
                        ref={ref}
                        id={id}
                        inputMode="numeric"
                        value={toDisplay(value)}
                        onChange={e => onChange(fromInput(e.target.value))}
                        placeholder={placeholder ?? '0,00'}
                        disabled={disabled}
                        className={cn('pl-9 font-mono', error && 'border-red-500 focus-visible:ring-red-500', inputClassName)}
                    />
                </div>
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            </div>
        )
    }
)

CurrencyInput.displayName = 'CurrencyInput'
