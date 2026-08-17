<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import VideoIcon from "@lucide/svelte/icons/video";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import CctvStream from "$lib/components/novira/cctv-stream.svelte";
	import type { Kamera } from "$lib/types/novira.js";

	type Props = {
		kameraList: Kamera[];
		kameraIdDipilih?: string;
	};

	// $bindable: kameraIdDipilih dapat di-ubah dua arah — mengalir turun saat
	// induk mengganti kamera, dan bisa di-set lokal lewat pemilih di header.
	// Default "" (bukan ID kamera contoh): ID kamera asli datang dari DB
	// (generateId() acak), jadi ID hardcode apa pun di sini tidak akan pernah
	// cocok — biarkan fallback `?? kameraList[0]` di bawah yang menentukan.
	let { kameraList, kameraIdDipilih = $bindable("") }: Props = $props();

	// Kamera ONLINE didahulukan sebagai tayangan awal: kamera pertama menurut
	// abjad bisa saja OFFLINE, dan kartu ini akan langsung terlihat kosong
	// padahal 159 kamera lain bisa diputar.
	let kameraAktif = $derived(
		kameraList.find((k) => k.id === kameraIdDipilih) ??
			kameraList.find((k) => k.status === "ONLINE") ??
			kameraList[0]
	);

	let pemilihTerbuka = $state(false);
	let pencarian = $state("");

	const kameraTerfilter = $derived.by(() => {
		const q = pencarian.trim().toLowerCase();
		if (!q) return kameraList;
		return kameraList.filter(
			(k) =>
				k.nama.toLowerCase().includes(q) ||
				k.kecamatan.toLowerCase().includes(q) ||
				k.kelurahan.toLowerCase().includes(q)
		);
	});

	function pilihKamera(id: string) {
		kameraIdDipilih = id;
		pencarian = "";
		pemilihTerbuka = false;
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
	<Card.Root class="border-border/80 flex flex-col overflow-hidden shadow-md">
		<Card.Header class="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
			<div class="min-w-0 space-y-1">
				<div
					class="flex w-fit items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
				>
					<VideoIcon class="size-3.5" />
					Pemantauan CCTV Real-time
				</div>
				<Card.Title class="truncate text-xl font-bold tracking-tight">
					{kameraAktif.nama}
				</Card.Title>
				<Card.Description class="text-xs">
					{[kameraAktif.kelurahan, kameraAktif.kecamatan, kameraAktif.kabupatenKota]
						.filter(Boolean)
						.join(", ")}
				</Card.Description>
			</div>

			<!-- Pemilih Kamera CCTV — 290 kamera, jadi wajib bisa dicari -->
			<div class="flex shrink-0 items-center gap-1.5">
				<Popover.Root bind:open={pemilihTerbuka}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								aria-label="Pilih kamera CCTV"
								class="border-input bg-background focus-visible:ring-ring flex h-9 w-48 items-center justify-between gap-2 rounded-md border px-3 py-1 text-xs font-medium shadow-xs focus-visible:ring-1 focus-visible:outline-hidden"
							>
								<span class="truncate">{kameraAktif.nama}</span>
								<ChevronsUpDownIcon class="text-muted-foreground size-3.5 shrink-0" />
							</button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-72 p-2" align="end">
						<div class="relative mb-2">
							<SearchIcon
								class="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
							/>
							<Input
								placeholder="Cari kamera atau kecamatan..."
								class="h-8 pl-8 text-sm"
								bind:value={pencarian}
							/>
						</div>
						<div class="max-h-64 space-y-0.5 overflow-y-auto">
							{#each kameraTerfilter as kam (kam.id)}
								<button
									type="button"
									onclick={() => pilihKamera(kam.id)}
									class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm {kam.id ===
									kameraAktif.id
										? 'bg-accent/60 font-medium'
										: ''}"
								>
									<span
										class="size-1.5 shrink-0 rounded-full {kam.status === 'ONLINE'
											? 'bg-emerald-500'
											: 'bg-slate-400'}"
									></span>
									<span class="min-w-0 flex-1 truncate">{kam.nama}</span>
									{#if kam.kecamatan}
										<span class="text-muted-foreground shrink-0 text-[10px]">{kam.kecamatan}</span>
									{/if}
								</button>
							{:else}
								<p class="text-muted-foreground px-2 py-1.5 text-sm">Tidak ada kamera yang cocok.</p>
							{/each}
						</div>
					</Popover.Content>
				</Popover.Root>

				<Button
					variant="outline"
					size="sm"
					class="h-9 shrink-0 text-xs"
					href="/dashboard/monitoring"
					title="Buka pemantauan multi-CCTV"
				>
					<ExternalLinkIcon class="size-3.5" />
				</Button>
			</div>
		</Card.Header>

		<Card.Content class="p-0">
			<!-- Tayangan langsung CCTV — apa adanya, tanpa lapisan deteksi.
			     Hasil deteksi sampah punya tempatnya sendiri (tabel insiden dan
			     halaman Analisa Manual), jadi frame di sini tidak diberi anotasi. -->
			<div class="relative aspect-video w-full overflow-hidden bg-slate-950 text-white shadow-inner">
				{#key kameraAktif.id}
					<CctvStream kamera={kameraAktif} />
				{/key}

				<div class="pointer-events-none absolute top-2.5 left-2.5">
					{#if kameraAktif.status === "ONLINE"}
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
							{kameraAktif.status === "PERBAIKAN" ? "DALAM PERBAIKAN" : "OFFLINE"}
						</span>
					{/if}
				</div>
			</div>
		</Card.Content>

		<Card.Footer class="bg-muted/30 mt-auto flex items-center justify-between border-t px-4 py-2.5">
			<span class="text-muted-foreground text-xs">
				Sumber: feed ATCS Kota Bandung &middot; {kameraList.filter((k) => k.status === "ONLINE")
					.length} dari {kameraList.length} kamera online
			</span>
			{#if kameraAktif.jumlahObjekTerdeteksi > 0}
				<Badge
					variant="outline"
					class="border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-400"
				>
					{kameraAktif.jumlahObjekTerdeteksi} insiden terbuka di titik ini
				</Badge>
			{/if}
		</Card.Footer>
	</Card.Root>
{/if}
