<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import VideoIcon from "@lucide/svelte/icons/video";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import SparklesIcon from "@lucide/svelte/icons/sparkles";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import CopyCheckIcon from "@lucide/svelte/icons/copy-check";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import { MODEL_TYPES_UI } from "$lib/model-deteksi.js";
	import type { ActionData, PageData } from "./$types.js";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let verifikasiPending = $state<Record<string, boolean>>({});
	let pindaiPending = $state<Record<string, boolean>>({});

	// Pilihan dropdown per laporan. Tanpa state lokal + `bind:value`, label pada
	// pemicu Select tetap menampilkan nilai dari server walau operator sudah
	// memilih item lain.
	let pilihanJenis = $state<Record<string, string>>({});
	let pilihanModel = $state<Record<string, string>>({});
	$effect(() => {
		for (const rep of data.reports) {
			pilihanJenis[rep.id] ??= rep.jenisSampah ?? "";
			pilihanModel[rep.id] ??= rep.aiModelType ?? "street";
		}
	});

	const statusBadge: Record<string, { label: string; class: string }> = {
		MENUNGGU: { label: "Menunggu", class: "bg-amber-500 text-white" },
		DIPROSES: { label: "Diproses", class: "bg-blue-500 text-white" },
		SELESAI: { label: "Selesai", class: "bg-emerald-600 text-white" },
		DITOLAK: { label: "Ditolak", class: "bg-slate-500 text-white" },
		DUPLIKAT: { label: "Duplikat", class: "bg-slate-400 text-white" },
	};

	/**
	 * Warna rekomendasi sengaja tidak memakai hijau/merah "benar/salah":
	 * rekomendasi ini SARAN untuk mengurutkan perhatian operator, bukan vonis.
	 * Operator tetap wajib melihat fotonya sebelum memutuskan.
	 */
	const rekomendasiBadge: Record<string, { label: string; class: string }> = {
		SANGAT_MUNGKIN_VALID: {
			label: "Kemungkinan besar valid",
			class: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
		},
		PERLU_TINJAUAN: {
			label: "Perlu tinjauan",
			class: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
		},
		KEMUNGKINAN_SPAM: {
			label: "Kemungkinan spam",
			class: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
		},
		GAGAL_PINDAI: {
			label: "Gagal dianalisis",
			class: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
		},
	};

	const MODEL_TYPES = MODEL_TYPES_UI;
	// Ruangnya sempit (dropdown selebar 9.5rem di samping tombol), jadi
	// dipakai label pendek, bukan `LABEL_MODEL` yang panjang.
	const modelLabel: Record<string, string> = {
		street: "Street (default)",
		cctv: "CCTV/kanal",
		taco: "TACO",
		novira: "Novira Vision",
	};

	const jenisSampahOptions = [
		{ value: "tumpukan_sampah", label: "Tumpukan sampah" },
		{ value: "kantong_plastik", label: "Kantong plastik" },
		{ value: "kardus_kemasan", label: "Kardus/kemasan" },
		{ value: "botol_minuman", label: "Botol minuman" },
		{ value: "pembuangan_liar_besar", label: "Pembuangan liar besar" },
		{ value: "puing_bangunan", label: "Puing bangunan" },
	];

	function labelJenis(v: string | null): string {
		return jenisSampahOptions.find((o) => o.value === v)?.label ?? "Pilih jenis sampah";
	}

	function tanggal(t: string | Date | null) {
		if (!t) return "-";
		return new Date(t).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
	}

	$effect(() => {
		if (form?.success && "message" in form) toast.success(String(form.message));
		else if (form && "message" in form && form.message) toast.error(String(form.message));
	});
</script>

<svelte:head>
	<title>Triase Laporan Masyarakat - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<ClipboardListIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Triase Laporan Masyarakat</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Laporan warga dipindai AI sebagai bahan pertimbangan, lalu <strong>Anda</strong> yang memutuskan.
			Laporan yang diverifikasi langsung menjadi insiden resmi dengan timer SLA berjalan.
		</p>
	</div>

	<!-- Ringkasan triase -->
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		{#each [{ label: "Menunggu triase", nilai: data.ringkasan.menunggu, warna: "text-amber-600" }, { label: "Jadi insiden", nilai: data.ringkasan.diproses + data.ringkasan.selesai, warna: "text-emerald-600" }, { label: "Ditolak", nilai: data.ringkasan.ditolak, warna: "text-rose-600" }, { label: "Akurasi laporan warga", nilai: `${data.ringkasan.persenValid}%`, warna: "text-blue-600" }] as kartu (kartu.label)}
			<Card.Root>
				<Card.Content class="pt-6">
					<p class="text-xs font-medium text-muted-foreground">{kartu.label}</p>
					<p class="mt-1 text-2xl font-bold {kartu.warna}">{kartu.nilai}</p>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<div class="flex flex-wrap gap-2">
		{#each data.statuses as s (s)}
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
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-mono text-xs text-muted-foreground">{rep.kodeTracking}</span>
							<h2 class="font-bold">{labelJenis(rep.jenisSampah)}</h2>
							<Badge class={statusBadge[rep.status].class}>{statusBadge[rep.status].label}</Badge>
							{#if rep.aiRekomendasi}
								<Badge class={rekomendasiBadge[rep.aiRekomendasi].class}>
									<SparklesIcon class="mr-1 size-3" />
									{rekomendasiBadge[rep.aiRekomendasi].label}
								</Badge>
							{:else if !rep.aiDipindaiPada}
								<Badge variant="outline" class="text-slate-500 dark:text-slate-400">
									<SparklesIcon class="mr-1 size-3" />
									Belum dipindai
								</Badge>
							{/if}
							{#if rep.reputasiPelapor !== null}
								<Badge variant="outline" class="gap-1">
									<ShieldCheckIcon class="size-3" />
									Reputasi pelapor {rep.reputasiPelapor}/100
								</Badge>
							{/if}
						</div>
						<p class="mt-1 text-xs text-muted-foreground">
							{rep.pelaporNama ?? "Anonim"}{rep.pelaporTelepon ? ` · ${rep.pelaporTelepon}` : ""} ·
							{tanggal(rep.createdAt)}
						</p>
					</div>
					{#if rep.latitude && rep.longitude}
						<a
							href={`https://www.google.com/maps?q=${rep.latitude},${rep.longitude}`}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400 group"
							title="Buka di Google Maps"
						>
							<div class="flex flex-col items-end text-right">
								<span class="flex items-center gap-1 font-medium">
									<MapPinIcon class="size-3.5" />
									{rep.kota ?? "Lokasi GPS"}
									<ExternalLinkIcon class="size-3" />
								</span>
								<span class="text-[10px] text-muted-foreground"
									>({rep.latitude}, {rep.longitude})</span
								>
							</div>
						</a>
					{:else}
						<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<MapPinIcon class="size-3.5" />
							{rep.kota ?? "Lokasi GPS"}
						</div>
					{/if}
				</div>

				{#if rep.deskripsi}
					<p class="text-sm">{rep.deskripsi}</p>
				{/if}

				{#if rep.urlFoto || rep.aiAnnotatedUrl}
					<div class="grid gap-3 sm:grid-cols-2">
						{#if rep.urlFoto}
							<a
								href={rep.urlFoto}
								target="_blank"
								rel="noopener noreferrer"
								class="group overflow-hidden rounded-lg border border-border/60"
							>
								<img
									src={rep.urlFoto}
									alt="Foto asli laporan"
									class="aspect-video w-full object-cover"
								/>
								<span
									class="flex items-center gap-1 border-t border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground group-hover:text-emerald-600"
								>
									<CameraIcon class="size-3" /> Foto asli <ExternalLinkIcon class="size-2.5" />
								</span>
							</a>
						{/if}
						{#if rep.aiAnnotatedUrl}
							<a
								href={rep.aiAnnotatedUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="group overflow-hidden rounded-lg border border-border/60"
							>
								<img
									src={rep.aiAnnotatedUrl}
									alt="Foto hasil analisa AI"
									class="aspect-video w-full object-cover"
								/>
								<span
									class="flex items-center gap-1 border-t border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground group-hover:text-emerald-600"
								>
									<SparklesIcon class="size-3" /> Hasil analisa AI · model {modelLabel[
										rep.aiModelType ?? "street"
									] ?? rep.aiModelType}
									<ExternalLinkIcon class="size-2.5" />
								</span>
							</a>
						{/if}
					</div>
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

				<!-- Penjelasan rekomendasi AI, faktor per faktor -->
				{#if rep.faktorAi.length > 0}
					<div class="rounded-lg border bg-muted/40 p-3">
						<p class="flex items-center gap-1.5 text-xs font-semibold">
							<SparklesIcon class="size-3.5" />
							Dasar rekomendasi
						</p>
						<ul class="mt-2 space-y-1">
							{#each rep.faktorAi as f (f.label)}
								<li class="flex items-start justify-between gap-3 text-xs">
									<span class="text-muted-foreground">
										<span class="font-medium text-foreground">{f.label}</span> — {f.keterangan}
									</span>
									<span
										class="shrink-0 font-mono {f.poin > 0
											? 'text-emerald-600'
											: f.poin < 0
												? 'text-rose-600'
												: 'text-muted-foreground'}"
									>
										{f.poin > 0 ? "+" : ""}{f.poin}
									</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<!-- Kandidat duplikat -->
				{#if rep.duplikat.length > 0}
					<div
						class="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40"
					>
						<p class="flex items-center gap-1.5 text-xs font-semibold">
							<CopyCheckIcon class="size-3.5" />
							{rep.duplikat.length} laporan lain di lokasi yang sama (≤150 m, 48 jam terakhir)
						</p>
						<div class="mt-2 space-y-1.5">
							{#each rep.duplikat as d (d.laporanId)}
								<form
									method="POST"
									action="?/gabungkan"
									use:enhance
									class="flex flex-wrap items-center gap-2 text-xs"
								>
									<input type="hidden" name="id" value={rep.id} />
									<input type="hidden" name="indukId" value={d.laporanId} />
									<span class="font-mono">{d.kodeTracking}</span>
									<span class="text-muted-foreground">
										{d.jarakMeter} m · {tanggal(d.createdAt)} · {d.status}
									</span>
									<Button type="submit" size="sm" variant="outline" class="h-6 px-2 text-xs">
										Gabungkan ke sini
									</Button>
								</form>
							{/each}
						</div>
					</div>
				{/if}

				{#if rep.catatanPetugas}
					<p class="rounded-md bg-muted px-3 py-2 text-xs">Catatan: {rep.catatanPetugas}</p>
				{/if}

				{#if rep.insidenId}
					<div
						class="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/40"
					>
						<ShieldCheckIcon class="size-4 text-emerald-600" />
						<span>Sudah diverifikasi menjadi insiden.</span>
						<a href="/dashboard/incidents/{rep.insidenId}" class="font-medium underline">
							Buka insiden
						</a>
					</div>
				{:else}
					<div class="grid gap-4 border-t pt-4 lg:grid-cols-2">
						<!-- Verifikasi — dipisah dari pindai, masing-masing ada loading -->
						<form
							method="POST"
							action="?/verifikasi"
							use:enhance={() => {
								verifikasiPending[rep.id] = true;
								return async ({ update }) => {
									await update();
									verifikasiPending[rep.id] = false;
								};
							}}
							class="space-y-3"
						>
							<input type="hidden" name="id" value={rep.id} />
							<div class="space-y-1.5">
								<Label.Root class="text-xs">Jenis sampah (koreksi bila perlu)</Label.Root>
								<Select.Root type="single" name="jenisSampah" bind:value={pilihanJenis[rep.id]}>
									<Select.Trigger class="w-full">
										<span>{labelJenis(pilihanJenis[rep.id])}</span>
									</Select.Trigger>
									<Select.Content>
										{#each jenisSampahOptions as opt (opt.value)}
											<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<div class="space-y-1.5">
								<Label.Root class="text-xs">Catatan verifikasi (opsional)</Label.Root>
								<Textarea
									name="catatan"
									rows={2}
									placeholder="Mis. konfirmasi lokasi dengan pelapor…"
								/>
							</div>
							<Button
								type="submit"
								size="sm"
								disabled={!!verifikasiPending[rep.id] || !!pindaiPending[rep.id]}
								class="bg-emerald-600 text-white hover:bg-emerald-700"
							>
								{#if verifikasiPending[rep.id]}<Loader2Icon class="mr-1 size-3 animate-spin" />Memverifikasi...{:else}Verifikasi → jadikan insiden{/if}
							</Button>
						</form>

						<!-- Pindai ulang — form terpisah biar tidak double-submit -->
						<form
							method="POST"
							action="?/pindaiUlang"
							use:enhance={() => {
								pindaiPending[rep.id] = true;
								return async ({ update }) => {
									await update();
									pindaiPending[rep.id] = false;
								};
							}}
							class="space-y-3"
						>
							<input type="hidden" name="id" value={rep.id} />
							<div class="space-y-1.5">
								<Label.Root class="text-xs">Model untuk pindai ulang</Label.Root>
								<Select.Root type="single" name="modelType" bind:value={pilihanModel[rep.id]}>
									<Select.Trigger class="w-full text-xs">
										<span>{modelLabel[pilihanModel[rep.id]] ?? pilihanModel[rep.id]}</span>
									</Select.Trigger>
									<Select.Content>
										{#each MODEL_TYPES as m (m)}
											<Select.Item value={m} label={modelLabel[m]}>{modelLabel[m]}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							<Button
								type="submit"
								size="sm"
								variant="outline"
								disabled={!!pindaiPending[rep.id] || !!verifikasiPending[rep.id]}
								title="Pindai ulang foto dengan model yang dipilih"
							>
								{#if pindaiPending[rep.id]}<Loader2Icon class="mr-1 size-3 animate-spin" />Memindai...{:else}<RefreshCwIcon class="mr-1 size-3.5" />Pindai ulang{/if}
							</Button>
						</form>

						<!-- Penolakan -->
						<form
							method="POST"
							action="?/tolak"
							use:enhance={() => {
								verifikasiPending[rep.id] = true;
								return async ({ update }) => {
									await update();
									verifikasiPending[rep.id] = false;
								};
							}}
							class="space-y-3"
						>
							<input type="hidden" name="id" value={rep.id} />
							<div class="space-y-1.5">
								<Label.Root class="text-xs">Alasan penolakan (wajib)</Label.Root>
								<Textarea
									name="alasan"
									rows={2}
									placeholder="Mis. foto bukan sampah / lokasi di luar wilayah kerja…"
								/>
								<p class="text-[11px] text-muted-foreground">
									Alasan ini ditampilkan ke pelapor di halaman pelacakan dan menurunkan reputasinya.
								</p>
							</div>
							<Button type="submit" size="sm" variant="destructive">Tolak laporan</Button>
						</form>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/each}
</div>
