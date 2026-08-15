<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import VideoIcon from "@lucide/svelte/icons/video";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import XIcon from "@lucide/svelte/icons/x";
	import CctvStream from "$lib/components/novira/cctv-stream.svelte";
	import type { Kamera } from "$lib/types/novira.js";

	let { data } = $props();

	let kotaDipilih = $state<string>("");
	let kameraKotaDipilih = $state<string>("");
	const slotTayang = $state<Map<string, Kamera>>(new Map());

	const MAX_SLOT = 2;

	const kotaList = $derived([...new Set(data.kameraList.map((k) => k.kabupatenKota))].sort());
	const kameraPerKota = $derived(
		kotaDipilih ? data.kameraList.filter((k) => k.kabupatenKota === kotaDipilih) : []
	);

	$effect(() => {
		if (kotaDipilih && !kameraPerKota.find((k) => k.id === kameraKotaDipilih)) {
			kameraKotaDipilih = kameraPerKota[0]?.id ?? "";
		}
	});

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
			Pilih kota, pilih CCTV, dan tampilkan hingga 2 umpan berdampingan.
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
			<label for="pilih-cctv" class="text-xs font-medium text-muted-foreground">CCTV</label>
			<select
				id="pilih-cctv"
				bind:value={kameraKotaDipilih}
				class="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
				disabled={!kotaDipilih}
			>
				<option value="">-- Pilih CCTV --</option>
				{#each kameraPerKota as kam (kam.id)}
					<option value={kam.id}>{kam.nama}</option>
				{/each}
			</select>
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
