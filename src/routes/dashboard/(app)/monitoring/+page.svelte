<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import VideoIcon from "@lucide/svelte/icons/video";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import XIcon from "@lucide/svelte/icons/x";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import CctvStream from "$lib/components/novira/cctv-stream.svelte";
	import type { Kamera } from "$lib/types/novira.js";
	import { invalidateAll } from "$app/navigation";
	import { SvelteMap } from "svelte/reactivity";

	let { data } = $props();

	// Data cuma berubah lewat siklus deteksi (cron 12:00 & 15:00 WIB, atau
	// trigger manual di Settings) -- poll ringan supaya status kamera/insiden
	// tidak butuh refresh manual, tanpa perlu infrastruktur push (SSE/WS).
	$effect(() => {
		const interval = setInterval(() => invalidateAll(), 2 * 60 * 1000);
		return () => clearInterval(interval);
	});

	let kotaDipilih = $state<string>("");
	let kameraKotaDipilih = $state<string>("");
	let cctvPopoverOpen = $state(false);
	let cctvSearch = $state("");
	const slotTayang = new SvelteMap<string, Kamera>();

	const MAX_SLOT = 4;

	const kotaList = $derived([...new Set(data.kameraList.map((k) => k.kabupatenKota))].sort());
	const kameraPerKota = $derived(
		kotaDipilih ? data.kameraList.filter((k) => k.kabupatenKota === kotaDipilih) : []
	);
	const kameraTerfilter = $derived(
		cctvSearch.trim()
			? kameraPerKota.filter((k) => k.nama.toLowerCase().includes(cctvSearch.trim().toLowerCase()))
			: kameraPerKota
	);
	const kameraDipilih = $derived(kameraPerKota.find((k) => k.id === kameraKotaDipilih));

	$effect(() => {
		if (kotaDipilih && !kameraPerKota.find((k) => k.id === kameraKotaDipilih)) {
			kameraKotaDipilih = kameraPerKota[0]?.id ?? "";
		}
	});

	function pilihCctv(id: string) {
		kameraKotaDipilih = id;
		cctvSearch = "";
		cctvPopoverOpen = false;
	}

	function tambahKeSlot() {
		const kam = kameraPerKota.find((k) => k.id === kameraKotaDipilih);
		if (!kam || slotTayang.size >= MAX_SLOT || slotTayang.has(kam.id)) return;
		slotTayang.set(kam.id, kam);
	}

	function hapusDariSlot(id: string) {
		slotTayang.delete(id);
	}
</script>

<svelte:head>
	<title>Pemantauan CCTV Langsung - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<VideoIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Pemantauan CCTV Langsung</h1>
			<Badge class="bg-emerald-600 text-white text-xs font-semibold">
				{slotTayang.size} / {MAX_SLOT} Slot
			</Badge>
		</div>
		<p class="text-sm text-muted-foreground">
			Pilih kota, pilih CCTV, dan tampilkan hingga 4 umpan berdampingan.
		</p>
	</div>

	<div class="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
		<div class="space-y-1.5">
			<label for="pilih-kota" class="text-xs font-medium text-muted-foreground">Kota</label>
			<select
				id="pilih-kota"
				bind:value={kotaDipilih}
				class="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
			>
				<option value="">-- Pilih Kota --</option>
				{#each kotaList as kota (kota)}
					<option value={kota}>{kota}</option>
				{/each}
			</select>
		</div>
		<div class="space-y-1.5">
			<span id="pilih-cctv-label" class="text-xs font-medium text-muted-foreground">CCTV</span>
			<Popover.Root bind:open={cctvPopoverOpen}>
				<Popover.Trigger disabled={!kotaDipilih}>
					{#snippet child({ props })}
						<button
							{...props}
							id="pilih-cctv"
							type="button"
							aria-labelledby="pilih-cctv-label"
							disabled={!kotaDipilih}
							class="flex h-9 w-56 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
						>
							<span class="truncate">{kameraDipilih?.nama ?? "-- Pilih CCTV --"}</span>
							<ChevronsUpDownIcon class="size-4 shrink-0 text-muted-foreground" />
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="w-64 p-2" align="start">
					<div class="relative mb-2">
						<SearchIcon
							class="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
						/>
						<Input
							placeholder="Cari CCTV..."
							class="h-8 pl-8 text-sm"
							bind:value={cctvSearch}
							autofocus
						/>
					</div>
					<div class="max-h-56 space-y-0.5 overflow-y-auto">
						{#each kameraTerfilter as kam (kam.id)}
							<button
								type="button"
								onclick={() => pilihCctv(kam.id)}
								class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground {kam.id ===
								kameraKotaDipilih
									? 'bg-accent/60 font-medium'
									: ''}"
							>
								{kam.nama}
							</button>
						{:else}
							<p class="px-2 py-1.5 text-sm text-muted-foreground">Tidak ada CCTV yang cocok.</p>
						{/each}
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
		<Button
			class="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
			onclick={tambahKeSlot}
			disabled={!kameraKotaDipilih || slotTayang.size >= MAX_SLOT}
		>
			<PlusIcon class="mr-1.5 size-4" />
			Tampilkan
		</Button>
		<p class="text-xs text-muted-foreground">
			{slotTayang.size >= MAX_SLOT ? "Slot penuh — hapus salah satu dulu." : ""}
		</p>
	</div>

	{#if slotTayang.size > 0}
		<div class="grid gap-4 md:grid-cols-2">
			{#each [...slotTayang.values()] as kam (kam.id)}
				<Card.Root class="overflow-hidden border-border/80 shadow-md">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
						<div>
							<Card.Title class="text-base font-bold tracking-tight">{kam.nama}</Card.Title>
							<Card.Description class="text-xs">
								{kam.kabupatenKota}{kam.kecamatan ? `, ${kam.kecamatan}` : ""}
							</Card.Description>
						</div>
						<Button
							variant="ghost"
							size="sm"
							class="h-7 text-xs text-red-600 hover:text-red-700"
							onclick={() => hapusDariSlot(kam.id)}
						>
							<XIcon class="size-3.5" />
						</Button>
					</Card.Header>
					<Card.Content class="p-0">
						<div class="relative aspect-video w-full overflow-hidden bg-slate-950 text-white">
							<CctvStream kamera={kam} />
							<div class="absolute top-2 left-2">
								{#if kam.status === "ONLINE"}
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
									>
										<span class="size-2 animate-ping rounded-full bg-white"></span>
										LANGSUNG
									</span>
								{:else}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-200"
									>
										{kam.status}
									</span>
								{/if}
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{:else}
		<div
			class="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground"
		>
			<VideoIcon class="size-10 stroke-1" />
			<p class="text-sm">Pilih kota dan CCTV, lalu klik "Tampilkan" untuk mulai memantau.</p>
		</div>
	{/if}
</div>
