<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import VideoIcon from "@lucide/svelte/icons/video";
	import EyeIcon from "@lucide/svelte/icons/eye";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import ScanIcon from "@lucide/svelte/icons/scan";
	import type { Kamera } from "$lib/types/novira.js";

	type Props = {
		kameraList: Kamera[];
		kameraIdDipilih?: string;
	};

	// $bindable: kameraIdDipilih dapat di-ubah dua arah — mengalir turun saat
	// induk mengganti kamera, dan bisa di-set lokal lewat <select bind:value>.
	// Default "" (bukan ID kamera contoh): ID kamera asli datang dari DB
	// (generateId() acak), jadi ID hardcode apa pun di sini tidak akan pernah
	// cocok — biarkan fallback `?? kameraList[0]` di bawah yang menentukan.
	let { kameraList, kameraIdDipilih = $bindable("") }: Props = $props();

	let tampilkanOverlayAi = $state(true);
	let mengunduhTangkapan = $state(false);

	let kameraAktif = $derived(kameraList.find((k) => k.id === kameraIdDipilih) ?? kameraList[0]);

	async function tangkapTangkapanLayar() {
		const snapshotUrl = kameraAktif.urlSnapshot;
		if (!snapshotUrl || mengunduhTangkapan) return;
		mengunduhTangkapan = true;
		try {
			const res = await fetch(snapshotUrl);
			if (!res.ok) throw new Error("fetch failed");
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${kameraAktif.id}-snapshot.jpg`;
			a.click();
			URL.revokeObjectURL(url);
		} catch {
			// Cross-origin tanpa CORS — buka snapshot langsung di tab baru.
			window.open(snapshotUrl, "_blank", "noopener");
		} finally {
			mengunduhTangkapan = false;
		}
	}
</script>

{#if !kameraAktif}
	<Card.Root class="border-border/80 overflow-hidden shadow-md">
		<Card.Content
			class="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 text-sm"
		>
			<VideoIcon class="size-8 stroke-1" />
			Belum ada kamera CCTV yang terdaftar.
		</Card.Content>
	</Card.Root>
{:else}
	<Card.Root class="border-border/80 overflow-hidden shadow-md">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<div
						class="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
					>
						<VideoIcon class="size-3.5 text-emerald-600 dark:text-emerald-400" />
						Umpan Pemantauan CCTV Real-time
					</div>
					<Badge
						variant="outline"
						class="border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-400"
					>
						Deteksi YOLOv8 + ByteTrack Aktif
					</Badge>
				</div>
				<Card.Title class="text-xl font-bold tracking-tight">
					{kameraAktif.nama}
				</Card.Title>
				<Card.Description class="text-xs">
					{kameraAktif.lokasi} ({kameraAktif.kelurahan}, {kameraAktif.kabupatenKota})
				</Card.Description>
			</div>

			<!-- Pemilih Kamera CCTV -->
			<div class="flex items-center gap-2">
				<select
					bind:value={kameraIdDipilih}
					class="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-xs font-medium shadow-xs focus-visible:ring-1 focus-visible:outline-hidden"
				>
					{#each kameraList as kam (kam.id)}
						<option value={kam.id}>
							{kam.id} - {kam.nama} ({kam.jumlahObjekTerdeteksi} sampah)
						</option>
					{/each}
				</select>
			</div>
		</Card.Header>

		<Card.Content class="p-0">
			<!-- Tampilan Frame CCTV -->
			<div
				class="relative aspect-video w-full overflow-hidden bg-slate-950 text-white shadow-inner"
			>
				{#if kameraAktif.urlSnapshot}
					<img
						src={kameraAktif.urlSnapshot}
						alt={kameraAktif.nama}
						class="h-full w-full object-cover transition-opacity duration-300"
					/>
				{:else}
					<div class="flex h-full w-full items-center justify-center bg-slate-900 text-slate-500">
						<div class="flex flex-col items-center gap-2">
							<VideoIcon class="size-12 stroke-1" />
							<span class="text-sm">Kamera Terputus / Menghubungkan Ulang...</span>
						</div>
					</div>
				{/if}

				<!-- Bar Atas Frame CCTV -->
				<div
					class="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-transparent p-3 text-xs"
				>
					<div class="flex items-center gap-2">
						{#if kameraAktif.status === "ONLINE"}
							<span
								class="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
							>
								<span class="size-2 animate-ping rounded-full bg-white"></span>
								LANGSUNG
							</span>
							<span class="font-mono text-[11px] text-slate-300">{kameraAktif.fps} FPS</span>
						{:else}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-200"
							>
								OFFLINE / PERBAIKAN
							</span>
						{/if}
						<span class="rounded bg-black/40 px-2 py-0.5 font-mono text-[10px] text-slate-300">
							RTSP Stream #1
						</span>
					</div>

					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							class="h-7 px-2 text-xs text-white hover:bg-white/10"
							onclick={() => (tampilkanOverlayAi = !tampilkanOverlayAi)}
						>
							<ScanIcon class="mr-1 size-3.5 text-emerald-400" />
							{tampilkanOverlayAi ? "Overlay AI AKTIF" : "Overlay AI MATI"}
						</Button>
					</div>
				</div>

				<!-- Bounding Box Simulasi AI (YOLOv8 + ByteTrack) -->
				{#if tampilkanOverlayAi && kameraAktif.jumlahObjekTerdeteksi > 0}
					<div
						class="absolute animate-pulse rounded border-2 border-red-500 bg-red-500/10 shadow-lg transition-all duration-300"
						style="top: 25%; left: 35%; width: 28%; height: 35%;"
					>
						<div
							class="absolute -top-7 left-0 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-md"
						>
							<AlertTriangleIcon class="size-3" />
							<span>pembuangan_liar_besar 94% [TRK-9842]</span>
						</div>
						<div
							class="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-emerald-400"
						>
							Timer SLA: 03j 10m
						</div>
					</div>

					{#if kameraAktif.jumlahObjekTerdeteksi > 1}
						<div
							class="absolute rounded border-2 border-amber-400 bg-amber-400/10 shadow-lg"
							style="top: 55%; left: 15%; width: 16%; height: 22%;"
						>
							<div
								class="absolute -top-6 left-0 rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-950"
							>
								kantong_plastik 89% [TRK-9839]
							</div>
						</div>
					{/if}
				{/if}

				<!-- Bar Bawah Overlay Stats -->
				<div
					class="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent p-3 text-xs"
				>
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-1">
							<EyeIcon class="size-3.5 text-emerald-400" />
							<span class="font-medium text-slate-200">Sampah Terdeteksi:</span>
							<span class="font-bold text-white">{kameraAktif.jumlahObjekTerdeteksi} Objek</span>
						</div>
						<div class="flex items-center gap-1">
							<span class="text-slate-400">Status Deteksi:</span>
							{#if kameraAktif.statusDeteksi === "KRITIS"}
								<span class="font-bold text-red-400">PEMBUANGAN KRITIS</span>
							{:else if kameraAktif.statusDeteksi === "PERINGATAN"}
								<span class="font-bold text-amber-400">PENUMPUKAN SAMPAH</span>
							{:else}
								<span class="font-bold text-emerald-400">WILAYAH BERSIH</span>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</Card.Content>

		<Card.Footer class="bg-muted/30 flex items-center justify-between border-t px-4 py-2.5">
			<div class="text-muted-foreground flex items-center gap-3 text-xs">
				<span class="flex items-center gap-1">
					<span class="size-2 rounded-full bg-emerald-500"></span>
					Batas Objek Stabil ByteTrack: &ge; 10 detik
				</span>
				<span class="hidden items-center gap-1 sm:flex">
					<span class="size-2 rounded-full bg-amber-500"></span>
					Batas Waktu Pengangkutan SLA: &lt; 24 jam
				</span>
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					class="h-7 text-xs"
					onclick={tangkapTangkapanLayar}
					disabled={mengunduhTangkapan || !kameraAktif.urlSnapshot}
				>
					<CameraIcon class="mr-1 size-3.5" />
					{mengunduhTangkapan ? "Mengunduh…" : "Tangkap Tangkapan Layar"}
				</Button>
			</div>
		</Card.Footer>
	</Card.Root>
{/if}
