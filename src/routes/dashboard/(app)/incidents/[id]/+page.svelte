<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import ScanIcon from "@lucide/svelte/icons/scan";
	import UserPlusIcon from "@lucide/svelte/icons/user-plus";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import XCircleIcon from "@lucide/svelte/icons/x-circle";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ImageOffIcon from "@lucide/svelte/icons/image-off";
	import type { RiwayatInsidenEntry } from "$lib/types/novira.js";

	let { data } = $props();
	let { insiden, riwayat } = $derived(data);

	function getBadgeStatusClass(status: string) {
		switch (status) {
			case "AKTIF":
				return "bg-red-600 text-white dark:bg-red-600 font-bold";
			case "PERINGATAN":
				return "bg-amber-500 text-slate-950 dark:bg-amber-400 font-semibold";
			case "SELESAI":
				return "bg-emerald-600 text-white dark:bg-emerald-500 font-semibold";
			case "POSITIF_PALSU":
				return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
			default:
				return "bg-slate-500 text-white";
		}
	}

	function formatDurasi(menit: number) {
		const h = Math.floor(menit / 60);
		const m = menit % 60;
		if (h > 0) return `${h}j ${m}m`;
		return `${m}m`;
	}

	function iconForEntry(entry: RiwayatInsidenEntry) {
		if (entry.tindakan.includes("positif palsu")) return XCircleIcon;
		if (entry.tindakan.includes("diselesaikan")) return CheckCircle2Icon;
		if (entry.tindakan.includes("ditugaskan")) return UserPlusIcon;
		if (entry.tipe === "DETEKSI_AI") return ScanIcon;
		return SettingsIcon;
	}
</script>

<svelte:head>
	<title>Detail Insiden {insiden.labelSampah} - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-3 border-b border-border/60 pb-4">
		<Button variant="ghost" size="sm" class="w-fit h-8 text-xs" href="/dashboard/incidents">
			<ArrowLeftIcon class="mr-1.5 size-3.5" />
			Kembali ke Daftar Insiden
		</Button>
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-2xl font-extrabold tracking-tight">{insiden.labelSampah}</h1>
			<Badge class={`text-[10px] ${getBadgeStatusClass(insiden.status)}`}>{insiden.status}</Badge>
			{#if insiden.statusSla === "MELANGGAR_SLA"}
				<Badge variant="destructive" class="gap-1 text-[10px]">
					<ShieldAlertIcon class="size-3" />
					MELANGGAR SLA
				</Badge>
			{/if}
		</div>
		<p class="flex items-center gap-1.5 text-sm text-muted-foreground">
			<MapPinIcon class="size-3.5" />
			{insiden.namaKamera} — {insiden.lokasi}
		</p>
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<Card.Root class="lg:col-span-2">
			<Card.Header>
				<Card.Title class="text-base">Bukti Foto: Sebelum vs Sesudah</Card.Title>
				<Card.Description class="text-xs">
					Foto pertama saat terdeteksi dibandingkan kondisi terkini/terakhir.
				</Card.Description>
			</Card.Header>
			<Card.Content class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-1.5">
					<p class="text-xs font-semibold text-muted-foreground">Pertama Terdeteksi</p>
					{#if insiden.urlSnapshotPertama}
						<img
							src={insiden.urlSnapshotPertama}
							alt="Snapshot pertama terdeteksi"
							class="aspect-video w-full rounded-md border border-border/60 object-cover"
						/>
					{:else}
						<div
							class="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground"
						>
							<ImageOffIcon class="size-6" />
						</div>
					{/if}
				</div>
				<div class="space-y-1.5">
					<p class="text-xs font-semibold text-muted-foreground">
						{insiden.status === "SELESAI" ? "Bukti Penanganan" : "Kondisi Terakhir"}
					</p>
					{#if insiden.status === "SELESAI" && insiden.buktiFotoUrl}
						<img
							src={insiden.buktiFotoUrl}
							alt="Bukti foto penanganan"
							class="aspect-video w-full rounded-md border border-border/60 object-cover"
						/>
					{:else if insiden.urlSnapshot}
						<img
							src={insiden.urlSnapshot}
							alt="Snapshot terakhir"
							class="aspect-video w-full rounded-md border border-border/60 object-cover"
						/>
					{:else}
						<div
							class="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground"
						>
							<ImageOffIcon class="size-6" />
						</div>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Ringkasan</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3 text-xs">
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Jenis Sampah</span>
					<span class="font-semibold">{insiden.jenisSampah.replaceAll("_", " ")}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Kepercayaan AI</span>
					<span class="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
						{Math.round(insiden.tingkatKepercayaan * 100)}%
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Tingkat Keparahan</span>
					<span class="font-semibold">{insiden.keparahan}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Durasi Dibiarkan</span>
					<span class="flex items-center gap-1 font-semibold">
						<ClockIcon class="size-3.5" />
						{formatDurasi(insiden.durasiMenit)}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Status SLA</span>
					<span class="font-semibold">{insiden.statusSla.replaceAll("_", " ")}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">Petugas Ditugaskan</span>
					<span class="font-semibold">{insiden.petugasDitugaskan ?? "Belum ditugaskan"}</span>
				</div>
				{#if insiden.catatanPenyelesaian}
					<div class="border-t border-border/60 pt-3">
						<p class="mb-1 text-muted-foreground">Catatan Hasil Petugas</p>
						<p class="rounded-md bg-muted/50 p-2 text-xs italic">
							"{insiden.catatanPenyelesaian}"
						</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Riwayat &amp; Timeline Insiden</Card.Title>
			<Card.Description class="text-xs">
				Jejak lengkap dari deteksi AI, penugasan, hingga penyelesaian.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<ol class="space-y-4 border-l border-border/60 pl-4">
				{#each riwayat as entry (entry.id)}
					{@const Icon = iconForEntry(entry)}
					<li class="relative">
						<span
							class="absolute -left-[21px] flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white"
						>
							<Icon class="size-2.5" />
						</span>
						<div class="flex flex-wrap items-baseline gap-2">
							<span class="text-sm font-bold">{entry.tindakan}</span>
							<span class="text-[11px] font-mono text-muted-foreground">
								{new Date(entry.waktu).toLocaleString()}
							</span>
						</div>
						<p class="text-xs text-muted-foreground">{entry.rincian}</p>
						<p class="text-[10px] text-muted-foreground/80">
							{entry.pengguna} · {entry.peran}
						</p>
					</li>
				{/each}
			</ol>
		</Card.Content>
	</Card.Root>
</div>
