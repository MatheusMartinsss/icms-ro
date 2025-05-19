import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const killometersMask = (value: number): string => {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: 'unit',
      unit: 'kilometer',
      unitDisplay: 'short',
      maximumSignificantDigits: 5,
      maximumFractionDigits: 0
    }
  ).format(value)
}

export const pesoMask = (value: number): string => {
  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: 'unit',
      unit: 'kilogram',
      unitDisplay: 'short',
      maximumSignificantDigits: 5,
      maximumFractionDigits: 0
    }
  ).format(value)
}
export const unMaskPeso = (value: string | undefined): number => {
  return typeof value === "number"
    ? value
    : Number(value?.replace(/\D/g, ""));
};

export const moneyMask = (value: number): string => {
  const rawValue = (value / 10000)
  return rawValue.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
};

export const unMaskReais = (value: string | undefined): number => {
  return typeof value === "number"
    ? value
    : Number(value?.replace(/\D/g, "")) * 100;
};
