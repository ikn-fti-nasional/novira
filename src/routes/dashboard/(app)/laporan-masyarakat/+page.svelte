<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { enhance } from "$app/forms";
	import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import VideoIcon from "@lucide/svelte/icons/video";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";

	let { data } = $props();

	const statusBadge: Record<string, { label: string; class: string }> = {
		MENUNGGU: { label: "Menunggu", class: "bg-amber-500 text-white" },
		DIPROSES: { label: "Diproses", class: "bg-blue-500 text-white" },
		SELESAI: { label: "Selesai", class: "bg-emerald-600 text-white" },
		DITOLAK: { label: "Ditolak", class: "bg-slate-500 text-white" },
	};

	function tanggal(t: string | Date | null) {
		if (!t) return "-";
		return new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
	}
</script>

<svelte:head>
	<title>Laporan Masyarakat - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<ClipboardListIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Laporan Masyarakat</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Laporan sampah dari masyarakat — verifikasi dan proses menjadi tindakan lapangan.
		</p>
	</div>

	<div class="flex gap-2">
		{#each data.statuses as s}
			<a
				href="/dashboard/laporan-masyarakat?status={s}"
				class="rounded-full border px-3 py-1 text-xs font-medium {s === data.statusAktif
					? 'border-emerald-600 bg-emerald-600 text-white'
					: 'bg-background hover:bg-muted'}"
			>
				{statusBadge[s].label}
			</a>
		{/each}
	</div>

	{#if data.reports.length === 0}
		<div
			class="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground"
		>
			<p class="text-sm">Tidak ada laporan dengan status ini.</p>
		</div>
	{/if}

	{#each data.reports as rep (rep.id)}
		<Card.Root>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div class="flex items-center gap-2">
							<h2 class="font-bold">
								{rep.jenisSampah ?? "Laporan sampah"}
							</h2>
							<Badge class={statusBadge[rep.status].class}>{statusBadge[rep.status].label}</Badge>
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{rep.pelaporNama ?? "Anonim"}{rep.pelaporTelepon ? ` · ${rep.pelaporTelepon}` : ""} ·
							{tanggal(rep.createdAt)}
						</p>
					</div>
					<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
						<MapPinIcon class="size-3.5" />
						{rep.kota ?? "Lokasi GPS"}
						{rep.latitude && rep.longitude ? ` (${rep.latitude}, ${rep.longitude})` : ""}
					</div>
				</div>

				{#if rep.deskripsi}
					<p class="text-sm">{rep.deskripsi}</p>
				{/if}

				<div class="flex flex-wrap gap-3">
					{#if rep.urlFoto}
						<a
							href={rep.urlFoto}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
						>
							<CameraIcon class="size-3.5" /> Lihat foto <ExternalLinkIcon class="size-3" />
						</a>
					{/if}
					{#if rep.urlVideo}
						<a
							href={rep.urlVideo}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
						>
							<VideoIcon class="size-3.5" /> Lihat video <ExternalLinkIcon class="size-3" />
						</a>
					{/if}
				</div>

				{#if rep.catatanPetugas}
					<p class="rounded-md bg-muted px-3 py-2 text-xs">
						Catatan: {rep.catatanPetugas}
					</p>
				{/if}

				<form
					method="POST"
					action="?/proses"
					use:enhance
					class="flex flex-wrap items-end gap-3 border-t pt-4"
				>
					<input type="hidden" name="id" value={rep.id} />
					<div class="space-y-1.5">
						<Label.Root class="text-xs">Status</Label.Root>
						<Select.Root type="single" name="status" value={rep.status}>
							<Select.Trigger class="w-40"
								><span>{statusBadge[rep.status].label}</span></Select.Trigger
							>
							<Select.Content>
								{#each data.statuses as s}
									<Select.Item value={s} label={statusBadge[s].label}
										>{statusBadge[s].label}</Select.Item
									>
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
					<div class="min-w-48 flex-1 space-y-1.5">
						<Label.Root class="text-xs">Catatan petugas</Label.Root>
						<Textarea name="catatan" rows={1} placeholder="Catatan penindakan…" />
					</div>
					<Button type="submit" size="sm" class="bg-emerald-600 text-white hover:bg-emerald-700">
						Simpan
					</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
