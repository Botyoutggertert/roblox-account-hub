// Formatting utilities for currency, Robux, numbers, and strings

export function formatRobux(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '— R$';
  }
  return `${new Intl.NumberFormat('en-US').format(amount)} R$`;
}

export function formatUsd(amount: number | null | undefined, isEstimated: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return isEstimated ? `${formatted} est.` : formatted;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercentage(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
}

export function truncateText(text: string, maxLength: number = 30): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function formatUserId(id: number | string | null | undefined): string {
  if (!id) return 'Unknown ID';
  return id.toString();
}
