<script lang="ts">
	import CctvPlayer from "$lib/components/novira/cctv-player.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import VideoIcon from "@lucide/svelte/icons/video";

	let { data } = $props();
</script>

<svelte:head>
	<title>Pemantauan Langsung CCTV - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<VideoIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Pemantauan Umpan CCTV Langsung</h1>
			<Badge class="bg-emerald-600 text-white text-xs font-semibold">5 / 6 Feed Aktif</Badge>
		</div>
		<p class="text-sm text-muted-foreground">
			Umpan video RTSP real-time yang terhubung dengan mesin deteksi objek YOLOv8 dan ByteTrack
			persistence.
		</p>
	</div>

	<CctvPlayer kameraList={data.kameraList} kameraIdDipilih="CAM-003" />

	<!-- Grid Semua Kamera CCTV -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each data.kameraList as cam (cam.id)}
			<Card.Root
				class="overflow-hidden border-border/80 shadow-xs hover:shadow-md transition-shadow"
			>
				<div class="relative aspect-video bg-slate-950">
					{#if cam.urlSnapshot}
						<img src={cam.urlSnapshot} alt={cam.nama} class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full items-center justify-center text-slate-500 text-xs">
							OFFLINE / PERBAIKAN
						</div>
					{/if}
					<div class="absolute top-2 left-2 flex items-center gap-1.5">
						{#if cam.status === "ONLINE"}
							<span class="size-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
							<span class="rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white"
								>LANGSUNG</span
							>
						{:else}
							<span class="size-2.5 rounded-full bg-slate-500"></span>
							<span class="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-300"
								>OFFLINE</span
							>
						{/if}
					</div>
				</div>
				<Card.Content class="p-3">
					<p class="font-bold text-sm">{cam.nama}</p>
					<p class="text-xs text-muted-foreground">{cam.lokasi} ({cam.kelurahan})</p>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
