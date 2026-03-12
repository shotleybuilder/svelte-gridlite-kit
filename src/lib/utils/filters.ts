/**
 * Filter operator utilities
 *
 * Maps ColumnDataType to available filter operators for UI rendering.
 */

import type { FilterOperator, ColumnDataType } from '../types.js';

export interface OperatorOption {
	value: FilterOperator;
	label: string;
}

const ALL_OPERATORS: OperatorOption[] = [
	{ value: 'equals', label: 'equals' },
	{ value: 'not_equals', label: 'does not equal' },
	{ value: 'contains', label: 'contains' },
	{ value: 'not_contains', label: 'does not contain' },
	{ value: 'starts_with', label: 'starts with' },
	{ value: 'ends_with', label: 'ends with' },
	{ value: 'is_empty', label: 'is empty' },
	{ value: 'is_not_empty', label: 'is not empty' },
	{ value: 'greater_than', label: '>' },
	{ value: 'less_than', label: '<' },
	{ value: 'greater_or_equal', label: '>=' },
	{ value: 'less_or_equal', label: '<=' },
	{ value: 'is_before', label: 'is before' },
	{ value: 'is_after', label: 'is after' }
];

/**
 * Get operators available for a specific data type.
 */
export function getOperatorsForType(dataType: ColumnDataType = 'text'): OperatorOption[] {
	switch (dataType) {
		case 'text':
			return ALL_OPERATORS.filter((op) =>
				[
					'equals', 'not_equals', 'contains', 'not_contains',
					'starts_with', 'ends_with', 'is_empty', 'is_not_empty'
				].includes(op.value)
			);

		case 'number':
			return ALL_OPERATORS.filter((op) =>
				[
					'equals', 'not_equals', 'greater_than', 'less_than',
					'greater_or_equal', 'less_or_equal', 'is_empty', 'is_not_empty'
				].includes(op.value)
			);

		case 'date':
			return ALL_OPERATORS.filter((op) =>
				['equals', 'not_equals', 'is_before', 'is_after', 'is_empty', 'is_not_empty'].includes(
					op.value
				)
			);

		case 'boolean':
			return ALL_OPERATORS.filter((op) =>
				['equals', 'is_empty', 'is_not_empty'].includes(op.value)
			);

		case 'select':
			return ALL_OPERATORS.filter((op) =>
				['equals', 'not_equals', 'is_empty', 'is_not_empty'].includes(op.value)
			);

		default:
			return ALL_OPERATORS.filter((op) =>
				[
					'equals', 'not_equals', 'contains', 'not_contains',
					'starts_with', 'ends_with', 'is_empty', 'is_not_empty'
				].includes(op.value)
			);
	}
}
