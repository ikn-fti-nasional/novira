<script lang="ts" module>
	/** Palet nada KPI. Nilai ditulis penuh (bukan string interpolasi) supaya
	 *  Tailwind memindainya — kelas yang dirakit saat runtime akan hilang dari
	 *  bundel produksi. */
	export const NADA = {
		emerald: {
			chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
			note: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		},
		red: {
			chip: "bg-red-500/10 text-red-700 ring-red-500/20 dark:text-red-400",
			note: "bg-red-500/10 text-red-700 dark:text-red-400",
		},
		amber: {
			chip: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
			note: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
		},
		blue: {
			chip: "bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-400",
			note: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
		},
		slate: {
			chip: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300",
			note: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
		},
	} as const;

	export type NadaStat = keyof typeof NADA;
</script>

<script lang="ts">
	import type { Component } from "svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import AnimatedCounter from "$lib/components/animated-counter.svelte";

	type Props = {
		title: string;
		value: number | string;
		subtitle?: string;
		/** Chip kecil di kanan bawah — konteks tambahan, bukan delta karangan. */
		note?: string;
		icon?: Component<{ class?: string }>;
		tone?: NadaStat;
		/** Nada chip catatan, kalau berbeda dari nada ikon. */
		noteTone?: NadaStat;
		href?: string;
	};

	let {
		title,
		value,
		subtitle,
		note,
		icon: Icon,
		tone = "emerald",
		noteTone,
		href,
	}: Props = $props();

	const gaya = $derived(NADA[tone]);
	const gayaNote = $derived(NADA[noteTone ?? tone]);
</script>

{#snippet isi()}
	<Card.Header class="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
		<Card.Title class="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
			{title}
		</Card.Title>
		{#if Icon}
			<div
				class="flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset {gaya.chip}"
			>
				<Icon class="size-4.5" />
			</div>
		{/if}
	</Card.Header>
	<Card.Content class="pt-0">
		<div class="tabular text-3xl font-extrabold tracking-tight">
			{#if typeof value === "number"}
				<AnimatedCounter {value} />
			{:else}
				{value}
			{/if}
		</div>
		{#if subtitle || note}
			<div class="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
				{#if subtitle}
					<span class="text-muted-foreground text-xs font-medium">{subtitle}</span>
				{/if}
				{#if note}
					<span
						class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold {gayaNote.note}"
					>
						{note}
					</span>
				{/if}
			</div>
		{/if}
	</Card.Content>
{/snippet}

{#if href}
	<a {href} class="block focus-visible:outline-none">
		<Card.Root class="stat-card hover-lift h-full gap-3 py-5">
			{@render isi()}
		</Card.Root>
	</a>
{:else}
	<Card.Root class="stat-card h-full gap-3 py-5">
		{@render isi()}
	</Card.Root>
{/if}
