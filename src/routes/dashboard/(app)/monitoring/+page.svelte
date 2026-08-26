<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import VideoIcon from "@lucide/svelte/icons/video";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import XIcon from "@lucide/svelte/icons/x";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import CctvStream from "$lib/components/novira/cctv-stream.svelte";
	import HotspotMap from "$lib/components/novira/hotspot-map.svelte";
	import type { Kamera } from "$lib/types/novira.js";
	import { invalidateAll } from "$app/navigation";
	import { SvelteMap } from "svelte/reactivity";

	let { data } = $props();

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
	<title>Monitoring Terpadu - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<VideoIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Monitoring Real-time & Peta Rawan</h1>
			<Badge class="bg-emerald-600 text-white text-xs font-semibold">
				{slotTayang.size} / {MAX_SLOT} Slot Grid
			</Badge>
		</div>
		<p class="text-sm text-muted-foreground">
			Pemantauan langsung kamera CCTV wilayah bersanding dengan analisis geospasial titik rawan.
		</p>
	</div>

	<!-- TAMPILAN SIDE-BY-SIDE (CCTV & MAPS) -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
		<!-- KOLOM KIRI: PEMANTAUAN CCTV -->
		<div class="flex h-full flex-col space-y-4">
			<!-- FILTER KOTA & CCTV -->
			<div class="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
				<div class="space-y-1.5 flex-1 min-w-[140px]">
					<label for="pilih-kota" class="text-xs font-medium text-muted-foreground">Kota</label>
					<select
						id="pilih-kota"
						bind:value={kotaDipilih}
						class="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
					>
						<option value="">-- Pilih Kota --</option>
						{#each kotaList as kota (kota)}
							<option value={kota}>{kota}</option>
						{/each}
					</select>
				</div>

				<div class="space-y-1.5 flex-1 min-w-[160px]">
					<span id="pilih-cctv-label" class="text-xs font-medium text-muted-foreground">CCTV</span>
					<Popover.Root bind:open={cctvPopoverOpen}>
						<Popover.Trigger disabled={!kotaDipilih} class="w-full">
							{#snippet child({ props })}
								<button
									{...props}
									id="pilih-cctv"
									type="button"
									aria-labelledby="pilih-cctv-label"
									disabled={!kotaDipilih}
									class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
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
									<p class="px-2 py-1.5 text-sm text-muted-foreground">
										Tidak ada CCTV yang cocok.
									</p>
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
			</div>

			<!-- GRID TAMPILAN STREAM -->
			{#if slotTayang.size > 0}
				<div class="grid flex-1 gap-4 grid-cols-1 sm:grid-cols-2 content-start">
					{#each [...slotTayang.values()] as kam (kam.id)}
						<Card.Root class="overflow-hidden border-border/80 shadow-md">
							<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
								<div class="truncate pr-2">
									<Card.Title class="text-sm font-bold tracking-tight truncate"
										>{kam.nama}</Card.Title
									>
									<Card.Description class="text-[11px] truncate">
										{kam.kabupatenKota}{kam.kecamatan ? `, ${kam.kecamatan}` : ""}
									</Card.Description>
								</div>
								<Button
									variant="ghost"
									size="sm"
									class="h-7 w-7 p-0 text-red-600 hover:text-red-700"
									onclick={() => hapusDariSlot(kam.id)}
									aria-label={`Hapus ${kam.nama} dari slot`}
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
					class="flex h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground"
				>
					<VideoIcon class="size-10 stroke-1" />
					<p class="text-sm text-center px-4">
						Pilih kota dan CCTV, lalu klik "Tampilkan" untuk memantau stream.
					</p>
				</div>
			{/if}
		</div>

		<!-- KOLOM KANAN: PETA TITIK RAWAN SAMPAH -->
		<Card.Root class="shadow-sm flex h-full flex-col min-h-[520px] xl:min-h-[600px] 2xl:min-h-[680px]">
			<Card.Header class="pb-3">
				<div class="flex items-center gap-2">
					<MapPinIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
					<div>
						<Card.Title class="text-lg font-bold">Peta Titik Rawan Sampah</Card.Title>
						<Card.Description class="text-xs">
							Analisis geospasial sebaran lokasi pembuangan liar terdeteksi.
						</Card.Description>
					</div>
				</div>
			</Card.Header>

			<Card.Content class="p-0 flex flex-1 min-h-[520px] flex-col rounded-b-xl overflow-hidden">
				<div class="h-full w-full flex-1 min-h-[520px]">
					<!-- MENGGUNAKAN FALLBACK (data.insidenList ?? []) AGAR TIDAK ERROR -->
					<HotspotMap kameraList={data.kameraList} insidenList={data.insidenList ?? []} />
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
