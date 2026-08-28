<script lang="ts">
	import type { Component, Snippet } from "svelte";

	type Props = {
		/** Judul halaman — satu-satunya <h1> di halaman. */
		title: string;
		/** Kalimat penjelas singkat di bawah judul. */
		description?: string;
		/** Ikon Lucide opsional yang ditampilkan dalam kotak aksen. */
		icon?: Component<{ class?: string }>;
		/** Label kecil di atas judul (mis. nama modul). */
		eyebrow?: string;
		/** Badge status yang berdiri sebaris dengan judul. */
		badges?: Snippet;
		/** Tombol aksi di sisi kanan (desktop) / bawah (mobile). */
		actions?: Snippet;
		/** Konten tambahan di bawah header, mis. bar filter. */
		children?: Snippet;
	};

	let { title, description, icon: Icon, eyebrow, badges, actions, children }: Props = $props();
</script>

<div class="surface-brand shadow-elevate-1 rounded-2xl border p-5 md:p-6">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div class="flex min-w-0 gap-4">
			{#if Icon}
				<div
					class="bg-primary/10 text-primary ring-primary/15 hidden size-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset sm:flex"
				>
					<Icon class="size-6" />
				</div>
			{/if}

			<div class="min-w-0">
				{#if eyebrow}
					<p class="text-primary mb-1 text-[11px] font-bold tracking-[0.12em] uppercase">
						{eyebrow}
					</p>
				{/if}

				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<h1 class="text-gradient-brand text-2xl font-extrabold tracking-tight md:text-3xl">
						{title}
					</h1>
					{@render badges?.()}
				</div>

				{#if description}
					<p class="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed">
						{description}
					</p>
				{/if}
			</div>
		</div>

		{#if actions}
			<div class="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
				{@render actions()}
			</div>
		{/if}
	</div>

	{#if children}
		<div class="mt-5 border-t pt-4">
			{@render children()}
		</div>
	{/if}
</div>
