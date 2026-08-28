<script lang="ts">
	import IncidentTable from "$lib/components/novira/incident-table.svelte";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import PrinterIcon from "@lucide/svelte/icons/printer";
	import PlayIcon from "@lucide/svelte/icons/play";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
	import CircleIcon from "@lucide/svelte/icons/circle";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { invalidateAll } from "$app/navigation";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import { onMount } from "svelte";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";
	import { triggerPdfReportPrint } from "$lib/utils/export-report.js";

	type TemuanManual = {
		key: string;
		cameraId: string;
		cameraNama: string;
		kota: string;
		kecamatan: string | null;
		jenisSampah: string;
		labelSampah: string;
		skor: number;
		bbox: { x: number; y: number; width: number; height: number };
		urlSnapshot: string;
	};

	type AnalisaManualSummary = {
		camerasProcessed: number;
		camerasFailed: number;
		temuan: TemuanManual[];
		errors: { cameraId: string; nama: string; error: string }[];
	};

	type ProgresAnalisaManual = {
		cameraId: string;
		cameraNama: string;
		index: number;
		total: number;
		status: "memproses" | "selesai" | "gagal";
	};

	let { data, form } = $props();

	let manualResult = $state<AnalisaManualSummary | null>(null);
	let analising = $state(false);
	let verifyingKey = $state<string | null>(null);
	let mlOnline = $state<boolean | null>(null); // null = belum dicek
	let progresTotal = $state(0);
	let progresSelesai = $state(0);
	const sedangDiproses = new SvelteMap<string, string>(); // cameraId -> nama
	let previewUrl = $state<string | null>(null);

	let pilihKameraOpen = $state(false);
	let cameraSearch = $state("");
	// svelte-ignore state_referenced_locally
	const selectedCameraIds = new SvelteSet<string>(data.kameraBandung.map((k) => k.id));

	const kameraTerfilter = $derived(
		cameraSearch.trim()
			? data.kameraBandung.filter(
					(k) =>
						k.nama.toLowerCase().includes(cameraSearch.trim().toLowerCase()) ||
						(k.kecamatan ?? "").toLowerCase().includes(cameraSearch.trim().toLowerCase())
				)
			: data.kameraBandung
	);
	const semuaTerpilih = $derived(selectedCameraIds.size === data.kameraBandung.length);

	function toggleKamera(id: string) {
		if (selectedCameraIds.has(id)) selectedCameraIds.delete(id);
		else selectedCameraIds.add(id);
	}

	function toggleSemuaKamera() {
		if (semuaTerpilih) selectedCameraIds.clear();
		else for (const k of data.kameraBandung) selectedCameraIds.add(k.id);
	}

	async function cekStatusMl() {
		try {
			const res = await fetch("/api/ml-status");
			const body = (await res.json()) as { online: boolean };
			mlOnline = body.online;
		} catch {
			mlOnline = false;
		}
	}

	onMount(() => {
		cekStatusMl();
		const interval = setInterval(cekStatusMl, 15_000);
		return () => clearInterval(interval);
	});

	function mulaiAnalisa() {
		if (selectedCameraIds.size === 0) {
			toast.error("Pilih minimal satu CCTV untuk dianalisa.");
			return;
		}
		if (selectedCameraIds.size > 10) {
			toast.error("Maksimal 10 CCTV per analisa. Kurangi pilihan.");
			return;
		}
		// Tetap di dalam modal yang sama — tidak bisa kemana-mana saat analising
		analising = true;
		manualResult = null;
		progresTotal = 0;
		progresSelesai = 0;
		sedangDiproses.clear();

		const cameraParam = semuaTerpilih ? "all" : [...selectedCameraIds].join(",");
		const source = new EventSource(
			`/api/analisa-manual?cameras=${encodeURIComponent(cameraParam)}`
		);

		source.addEventListener("progress", (e) => {
			const p = JSON.parse((e as MessageEvent).data) as ProgresAnalisaManual;
			progresTotal = p.total;
			progresSelesai = p.index;
			if (p.status === "memproses") sedangDiproses.set(p.cameraId, p.cameraNama);
			else sedangDiproses.delete(p.cameraId);
		});

		source.addEventListener("done", (e) => {
			manualResult = JSON.parse((e as MessageEvent).data) as AnalisaManualSummary;
			toast.success(
				`Analisa selesai: ${manualResult.camerasProcessed} kamera diproses (${manualResult.camerasFailed} gagal), ${manualResult.temuan.length} temuan menunggu verifikasi`
			);
			analising = false;
			sedangDiproses.clear();
			source.close();
		});

		source.addEventListener("error", (e) => {
			const body = (e as MessageEvent).data
				? (JSON.parse((e as MessageEvent).data) as { message: string })
				: null;
			toast.error(body?.message ?? "Analisa manual gagal — koneksi terputus, coba lagi.");
			mlOnline = body ? false : mlOnline;
			analising = false;
			sedangDiproses.clear();
			source.close();
		});
	}

	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success && form.action === "verifikasiTemuan" && form.temuanKey) {
			if (manualResult) {
				manualResult = {
					...manualResult,
					temuan: manualResult.temuan.filter((t) => t.key !== form.temuanKey),
				};
			}
			toast.success(
				form.baru ? "Temuan disimpan sebagai insiden baru" : "Insiden terkait berhasil diperbarui"
			);
			invalidateAll();
		}
	});

	function cetakPdf() {
		const headers = [
			"ID",
			"Lokasi",
			"Kamera",
			"Jenis Sampah",
			"Status",
			"Keparahan",
			"Kepercayaan (%)",
			"Status SLA",
			"Petugas Ditugaskan",
			"Pertama Terlihat",
			"Terakhir Terlihat",
		];
		const rows = data.insidenList.map((i) => [
			i.id,
			i.lokasi,
			i.namaKamera,
			i.labelSampah,
			i.status,
			i.keparahan,
			Math.round(i.tingkatKepercayaan * 100),
			i.statusSla,
			i.petugasDitugaskan ?? "Belum ditugaskan",
			new Date(i.pertamaDilihat).toLocaleString(),
			new Date(i.terakhirDilihat).toLocaleString(),
		]);
		triggerPdfReportPrint("Laporan Insiden Sampah", "Administrator", headers, rows);
	}

	async function kirimAksi(
		action: string,
		fields: Record<string, string>,
		buktiFile: File | null,
		pesanSukses: string,
		pesanGagal: string
	) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(fields)) formData.append(key, value);
		if (buktiFile) formData.append("buktiFoto", buktiFile);

		try {
			const response = await fetch(`?/${action}`, { method: "POST", body: formData });

			if (response.ok) {
				toast.success(pesanSukses);
				await invalidateAll();
			} else {
				const body = (await response.json().catch(() => null)) as { message?: string } | null;
				toast.error(body?.message ?? pesanGagal);
			}
		} catch {
			toast.error(pesanGagal);
		}
	}

	function handleSelesaikanTugas(insidenId: string, buktiFile: File, catatan: string) {
		kirimAksi(
			"selesaikanTugas",
			{ insidenId, catatan },
			buktiFile,
			"Insiden ditandai selesai",
			"Gagal menandai insiden selesai, coba lagi"
		);
	}

	function handleTugaskanPetugas(insidenId: string, petugasId: string) {
		kirimAksi(
			"tugaskanPetugas",
			{ insidenId, petugasId },
			null,
			"Petugas berhasil ditugaskan",
			"Gagal menugaskan petugas, coba lagi"
		);
	}

	function handleTandaiPositifPalsu(insidenId: string) {
		kirimAksi(
			"tandaiPositifPalsu",
			{ insidenId },
			null,
			"Insiden ditandai positif palsu",
			"Gagal menandai positif palsu, coba lagi"
		);
	}
</script>

<svelte:head>
	<title>Insiden &amp; Alert Sampah - NOVIRA</title>
</svelte:head>

<div class="space-y-6 print:p-0">
	<PageHeader
		title="Insiden &amp; Peringatan Sampah Liar"
		eyebrow="Operasional Harian"
		description="Kelola deteksi penumpukan sampah liar, pemantauan timer SLA (kurang dari 24 jam), dan penugasan armada kebersihan."
		icon={AlertTriangleIcon}
	>
		{#snippet badges()}
			<Badge variant="destructive" class="text-xs font-semibold">
				{data.insidenList.filter((i) => i.status === "AKTIF").length} Insiden Aktif
			</Badge>
		{/snippet}

		{#snippet actions()}
			<Button size="sm" class="h-9 text-xs font-semibold print:hidden" onclick={cetakPdf}>
				<PrinterIcon class="mr-1.5 size-3.5" />
				Cetak PDF Laporan
			</Button>
		{/snippet}
	</PageHeader>

	<Card.Root class="border-emerald-800/20 shadow-sm print:hidden">
		<Card.Header>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div>
					<Card.Title class="text-base">Analisa Manual CCTV</Card.Title>
					<Card.Description>
						Jalankan siklus deteksi kapan saja (12:00 &amp; 15:00 WIB otomatis) — hasil tidak
						langsung tersimpan.
					</Card.Description>
				</div>
				<div class="flex items-center gap-2">
					<Badge
						variant="outline"
						class={mlOnline === false
							? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
							: mlOnline === true
								? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
								: "text-muted-foreground"}
					>
						<CircleIcon
							class="mr-1.5 size-2 {mlOnline === false
								? 'fill-red-600 text-red-600'
								: mlOnline === true
									? 'fill-emerald-600 text-emerald-600'
									: 'fill-muted-foreground text-muted-foreground'}"
						/>
						Server ML: {mlOnline === false
							? "Offline"
							: mlOnline === true
								? "Online"
								: "Memeriksa..."}
					</Badge>
					<Button
						type="button"
						size="sm"
						disabled={analising || mlOnline === false}
						onclick={() => (pilihKameraOpen = true)}
						class="bg-emerald-600 text-white hover:bg-emerald-700"
					>
						{#if analising}
							<Loader2Icon class="mr-2 size-4 animate-spin" />
							Menganalisa...
						{:else}
							<PlayIcon class="mr-2 size-4" />
							Jalankan Analisa Manual
						{/if}
					</Button>
				</div>
			</div>
		</Card.Header>
		{#if mlOnline === false}
			<Card.Content>
				<p class="text-xs text-red-600">
					Server ML (pLitter) offline — analisa tidak bisa dijalankan.
				</p>
			</Card.Content>
		{/if}
	</Card.Root>

	<IncidentTable
		insidenList={data.insidenList}
		petugasList={data.petugasList}
		onSelesaikanTugas={handleSelesaikanTugas}
		onTugaskanPetugas={handleTugaskanPetugas}
		onTandaiPositifPalsu={handleTandaiPositifPalsu}
	/>
</div>

<Dialog.Root
	open={pilihKameraOpen}
	onOpenChange={(o) => {
		if (analising && !o) {
			toast.error("Analisa sedang berjalan — tunggu selesai");
			return;
		}
		pilihKameraOpen = o;
	}}
>
	<Dialog.Content
		class="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden"
		showCloseButton={!analising}
	>
		{#if analising}
			<Dialog.Header>
				<Dialog.Title>Sedang Menganalisa...</Dialog.Title>
				<Dialog.Description
					>Jangan tutup halaman. Progres {progresSelesai}/{progresTotal || "?"} kamera</Dialog.Description
				>
			</Dialog.Header>
			<div class="flex-1 space-y-3 overflow-y-auto py-2">
				<div class="bg-muted/30 space-y-2 rounded-md border p-3">
					<div class="text-muted-foreground flex items-center justify-between text-xs">
						<span>Progres: {progresSelesai} / {progresTotal || "?"} kamera</span>
						{#if progresTotal > 0}<span>{Math.round((progresSelesai / progresTotal) * 100)}%</span
							>{/if}
					</div>
					{#if progresTotal > 0}
						<div class="bg-muted h-2 w-full overflow-hidden rounded-full">
							<div
								class="h-full rounded-full bg-emerald-600 transition-all"
								style="width: {(progresSelesai / progresTotal) * 100}%"
							></div>
						</div>
					{/if}
					{#if sedangDiproses.size > 0}
						<div class="flex flex-wrap gap-1.5">
							{#each [...sedangDiproses.values()] as nama (nama)}
								<Badge variant="secondary" class="text-xs font-normal"
									><Loader2Icon class="mr-1 size-3 animate-spin" />{nama}</Badge
								>
							{/each}
						</div>
					{/if}
				</div>
				<p class="text-muted-foreground text-center text-xs">
					Modal terkunci sampai analisa selesai.
				</p>
			</div>
		{:else if manualResult}
			<Dialog.Header>
				<Dialog.Title
					>Hasil Analisa — {manualResult.camerasProcessed} kamera, {manualResult.temuan.length} temuan</Dialog.Title
				>
				<Dialog.Description
					>Tinjau temuan, klik foto untuk preview, lalu verifikasi. Maks 10 CCTV per analisa.</Dialog.Description
				>
			</Dialog.Header>
			<div class="flex-1 space-y-3 overflow-y-auto py-1">
				<div class="text-muted-foreground text-xs">
					{manualResult.camerasProcessed} diproses, {manualResult.camerasFailed} gagal.
					{#if manualResult.errors.length > 0}<span class="text-red-600"
							>({manualResult.errors.map((e) => e.nama).join(", ")})</span
						>{/if}
				</div>
				{#if manualResult.temuan.length === 0}
					<div
						class="text-muted-foreground flex items-center gap-2 rounded-md border border-dashed p-4 text-sm"
					>
						<CheckCircleIcon class="size-4 text-emerald-600" />Tidak ada temuan sampah dari analisa
						ini.
					</div>
				{:else}
					<div class="max-h-[45vh] divide-y overflow-y-auto rounded-md border">
						{#each manualResult.temuan as temuan (temuan.key)}
							<div class="flex flex-wrap items-center gap-3 p-3 text-sm">
								{#if temuan.urlSnapshot}
									<button
										type="button"
										onclick={() => (previewUrl = temuan.urlSnapshot)}
										class="shrink-0 cursor-zoom-in overflow-hidden rounded ring-offset-2 transition hover:ring-2 hover:ring-emerald-600"
										title="Lihat foto"
									>
										<img
											src={temuan.urlSnapshot}
											alt="Cuplikan {temuan.cameraNama}"
											class="h-14 w-24 object-cover"
										/>
									</button>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="font-medium">{temuan.cameraNama}</p>
									<p class="text-muted-foreground text-xs">
										{temuan.kota}{temuan.kecamatan ? `, ${temuan.kecamatan}` : ""}
									</p>
								</div>
								<Badge variant="secondary">{temuan.labelSampah}</Badge>
								<span class="text-muted-foreground text-xs"
									>Keyakinan {Math.round(temuan.skor * 100)}%</span
								>
								<form
									method="POST"
									action="?/verifikasiTemuan"
									use:enhance={() => {
										verifyingKey = temuan.key;
										return async ({ update }) => {
											await update();
											verifyingKey = null;
										};
									}}
								>
									<input type="hidden" name="temuan" value={JSON.stringify(temuan)} />
									<Button
										type="submit"
										size="sm"
										disabled={verifyingKey !== null}
										class="bg-emerald-600 text-white hover:bg-emerald-700"
									>
										{#if verifyingKey === temuan.key}<Loader2Icon
												class="mr-1 size-3 animate-spin"
											/>Menyimpan...{:else}Verifikasi{/if}
									</Button>
								</form>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (pilihKameraOpen = false)}>Tutup</Button>
				<Button
					onclick={() => {
						manualResult = null;
					}}
					variant="secondary">Analisa Lagi</Button
				>
			</Dialog.Footer>
		{:else}
			<Dialog.Header>
				<Dialog.Title>Pilih CCTV untuk Dianalisa</Dialog.Title>
				<Dialog.Description>Maks 10 CCTV per analisa. Pilih kamera Bandung.</Dialog.Description>
			</Dialog.Header>
			<div class="space-y-3 py-1">
				<div class="relative">
					<SearchIcon
						class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<Input
						placeholder="Cari nama kamera atau kecamatan..."
						class="pl-9"
						bind:value={cameraSearch}
					/>
				</div>
				<label
					class="bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
				>
					<input
						type="checkbox"
						checked={semuaTerpilih}
						onchange={toggleSemuaKamera}
						class="accent-primary size-4"
					/>
					Pilih Semua ({selectedCameraIds.size} / {data.kameraBandung.length}) {selectedCameraIds.size >
					10
						? "(kelebihan!)"
						: ""}
				</label>
				{#if selectedCameraIds.size > 10}<p class="text-xs text-red-600">
						Maksimal 10 — kurangi pilihan sebelum mulai.
					</p>{/if}
				<div class="max-h-64 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
					{#each kameraTerfilter as kamera (kamera.id)}
						<label class="hover:bg-accent flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
							<input
								type="checkbox"
								checked={selectedCameraIds.has(kamera.id)}
								onchange={() => toggleKamera(kamera.id)}
								class="accent-primary size-4"
							/>
							<span class="min-w-0 flex-1 truncate">{kamera.nama}</span>
							{#if kamera.kecamatan}<span class="text-muted-foreground text-xs"
									>{kamera.kecamatan}</span
								>{/if}
						</label>
					{:else}
						<p class="text-muted-foreground p-2 text-sm">Tidak ada kamera yang cocok.</p>
					{/each}
				</div>
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (pilihKameraOpen = false)}>Batal</Button>
				<Button
					onclick={mulaiAnalisa}
					disabled={selectedCameraIds.size === 0 || selectedCameraIds.size > 10}
					class="bg-emerald-600 text-white hover:bg-emerald-700"
				>
					<PlayIcon class="mr-2 size-4" />Mulai Analisa ({selectedCameraIds.size} kamera)
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={previewUrl !== null} onOpenChange={(open) => !open && (previewUrl = null)}>
	<Dialog.Content class="max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>Foto Hasil Analisa</Dialog.Title>
			<Dialog.Description>Kotak merah menandai objek yang terdeteksi model.</Dialog.Description>
		</Dialog.Header>
		{#if previewUrl}
			<img src={previewUrl} alt="Cuplikan CCTV dengan kotak deteksi" class="w-full rounded-md" />
		{/if}
	</Dialog.Content>
</Dialog.Root>
