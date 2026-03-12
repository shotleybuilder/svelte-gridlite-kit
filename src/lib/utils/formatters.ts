// Cell formatting utilities

/**
 * Format date string to localized format
 */
export function formatDate(dateStr: string | Date, locale = 'en-GB'): string {
	if (!dateStr) return '-';
	const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
	return date.toLocaleDateString(locale, {
		day: '2-digit',
		month: 'short',
		year: 'numeric'
	});
}

/**
 * Format number as currency
 */
export function formatCurrency(
	value: number,
	currency = 'GBP',
	locale = 'en-GB'
): string {
	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency
	}).format(value);
}

/**
 * Format number with locale-specific separators
 */
export function formatNumber(value: number, locale = 'en-GB'): string {
	return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format number as percentage
 */
export function formatPercent(
	value: number,
	decimals = 1,
	locale = 'en-GB'
): string {
	return new Intl.NumberFormat(locale, {
		style: 'percent',
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals
	}).format(value / 100);
}
