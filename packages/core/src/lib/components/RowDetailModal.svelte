<script lang="ts">
	/**
	 * RowDetailModal — Centered modal overlay for row detail view.
	 *
	 * Prev/next row navigation via arrow keys or buttons.
	 * Content provided via named slot.
	 * Uses onMount lifecycle instead of isBrowser checks.
	 */

	import { onMount, onDestroy } from 'svelte';

	export let isOpen: boolean = false;
	export let hasPrev: boolean = false;
	export let hasNext: boolean = false;

	export let onClose: () => void;
	export let onPrev: (() => void) | undefined = undefined;
	export let onNext: (() => void) | undefined = undefined;

	let modalElement: HTMLElement | null = null;
	let previouslyFocused: HTMLElement | null = null;
	let mounted = false;

	function handleClose() {
		onClose();
	}

	function handlePrev() {
		if (hasPrev && onPrev) onPrev();
	}

	function handleNext() {
		if (hasNext && onNext) onNext();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (hasPrev && onPrev) onPrev();
		} else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			if (hasNext && onNext) onNext();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	$: if (mounted) {
		if (isOpen) {
			previouslyFocused = document.activeElement as HTMLElement;
			document.addEventListener('keydown', handleKeydown);
			document.body.style.overflow = 'hidden';
			requestAnimationFrame(() => {
				modalElement?.focus();
			});
		} else {
			document.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = '';
			if (previouslyFocused) {
				previouslyFocused.focus();
				previouslyFocused = null;
			}
		}
	}

	onMount(() => {
		mounted = true;
	});

	onDestroy(() => {
		if (mounted) {
			document.removeEventListener('keydown', handleKeydown);
			document.body.style.overflow = '';
		}
	});
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="row-detail-backdrop" on:click={handleBackdropClick}>
		<div
			class="row-detail-modal"
			bind:this={modalElement}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<div class="row-detail-header">
				<div class="row-detail-nav">
					<button
						class="nav-btn"
						disabled={!hasPrev}
						on:click={handlePrev}
						aria-label="Previous row"
						title="Previous row"
					>
						<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<button
						class="nav-btn"
						disabled={!hasNext}
						on:click={handleNext}
						aria-label="Next row"
						title="Next row"
					>
						<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				</div>
				<button class="close-btn" on:click={handleClose} aria-label="Close" title="Close">
					<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="row-detail-body">
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	.row-detail-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.row-detail-modal {
		position: relative;
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		max-width: 48rem;
		width: calc(100% - 2rem);
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		outline: none;
	}

	.row-detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e5e7eb;
		flex-shrink: 0;
	}

	.row-detail-nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.nav-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		cursor: pointer;
		color: #374151;
		transition: background 0.15s;
	}

	.nav-btn:hover:not(:disabled) {
		background: #f9fafb;
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem;
		background: none;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		color: #6b7280;
		transition: all 0.15s;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.row-detail-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}
</style>
