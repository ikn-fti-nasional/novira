<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import FilterIcon from "@lucide/svelte/icons/filter";
	import PrinterIcon from "@lucide/svelte/icons/printer";
	import { triggerPdfReportPrint } from "$lib/utils/export-report.js";

	let { data } = $props();

	let provinsiFilter = $state("SEMUA");
	let kabupatenFilter = $state("SEMUA");

	// Filter terapan
	let provinsiTerapan = $state("SEMUA");
	let kabupatenTerapan = $state("SEMUA");

	let skorWilayahTersaring = $derived(
		data.skorWilayahList.filter(
			(row) =>
				(provinsiTerapan === "SEMUA" || row.provinsi === provinsiTerapan) &&
				(kabupatenTerapan === "SEMUA" || row.kabupatenKota === kabupatenTerapan)
		)
	);

	function terapkanFilter() {
		provinsiTerapan = provinsiFilter;
		kabupatenTerapan = kabupatenFilter;
	}

	// Tanggal cetak otomatis
	const tanggalCetak = new Date().toLocaleDateString("id-ID", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	function cetakPDF() {
		terapkanFilter();
		const headers = [
			"Provinsi",
			"Kabupaten/Kota",
			"Kecamatan",
			"Kelurahan",
			"Jumlah Insiden",
			"Durasi SLA (jam)",
			"Skor Kebersihan",
		];
		const rows = skorWilayahTersaring.map((r) => [
			r.provinsi,
			r.kabupatenKota,
			r.kecamatan,
			r.kelurahan,
			r.jumlahInsiden,
			r.rataRataDurasiSampahJam,
			`${r.skorKebersihan}/100`,
		]);
		triggerPdfReportPrint("Laporan Wilayah & Audit Kebersihan", "Operator", headers, rows);
	}
</script>

<svelte:head>
	<title>Laporan Wilayah &amp; Provinsi - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- HEADER HALAMAN WEB (Disembunyikan saat dicetak) -->
	<div class="print:hidden">
		<PageHeader
			title="Laporan Wilayah &amp; Audit Bertingkat"
			eyebrow="Tata Kelola"
			description="Laporan agregasi kebersihan wilayah bertingkat dari Provinsi, Kabupaten/Kota, Kecamatan hingga Kelurahan."
			icon={FileSpreadsheetIcon}
		>
			{#snippet badges()}
				<Badge
					variant="outline"
					class="border-emerald-600/40 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
				>
					Tingkat Nasional &amp; Provinsi
				</Badge>
			{/snippet}

			{#snippet actions()}
				<Button size="sm" class="h-9 text-xs font-semibold" onclick={cetakPDF}>
					<PrinterIcon class="mr-1.5 size-3.5" />
					Cetak / Simpan PDF
				</Button>
			{/snippet}
		</PageHeader>
	</div>

	<!-- HEADER DOKUMEN CETAK RESMI & MODERN -->
	<div class="mb-6 hidden print:block">
		<div class="flex items-center justify-between border-b-2 border-emerald-600 pb-4">
			<div class="flex items-center gap-4">
				<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-12 w-auto object-contain" />
				<div class="border-l-2 border-gray-300 pl-4">
					<h2 class="text-base leading-tight font-black tracking-tight text-gray-900 uppercase">
						LAPORAN EVALUASI &amp; AUDIT KEBERSIHAN WILAYAH
					</h2>
					<p class="text-[10px] font-medium text-gray-500">
						Sistem Pengawasan Kebersihan Wilayah Terpadu (NOVIRA)
					</p>
				</div>
			</div>

			<div
				class="rounded border border-gray-200 bg-gray-50 p-2.5 text-right text-[10px] leading-tight text-gray-600"
			>
				<p><span class="font-bold text-gray-700">Provinsi:</span> {provinsiTerapan}</p>
				<p><span class="font-bold text-gray-700">Kabupaten/Kota:</span> {kabupatenTerapan}</p>
				<p><span class="font-bold text-gray-700">Tanggal Cetak:</span> {tanggalCetak}</p>
			</div>
		</div>
	</div>

	<!-- FILTER BERTINGKAT (Disembunyikan saat dicetak) -->
	<Card.Root class="p-4 print:hidden">
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<GlobeIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="text-xs font-bold">Pilih Provinsi:</span>
				<select
					bind:value={provinsiFilter}
					class="bg-background h-9 rounded-md border px-3 py-1 text-xs font-semibold"
				>
					<option value="SEMUA">Semua Provinsi (Nasional)</option>
					{#each data.provinsiList as prov (prov.id)}
						<option value={prov.nama}>{prov.nama}</option>
					{/each}
				</select>
			</div>

			<div class="flex items-center gap-2">
				<FilterIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="text-xs font-bold">Pilih Kabupaten/Kota:</span>
				<select
					bind:value={kabupatenFilter}
					class="bg-background h-9 rounded-md border px-3 py-1 text-xs font-semibold"
				>
					<option value="SEMUA">Semua Kabupaten/Kota</option>
					{#each data.kabupatenKotaList as kab (kab.id)}
						<option value={kab.nama}>{kab.nama}</option>
					{/each}
				</select>
			</div>

			<Button
				size="sm"
				class="h-9 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
				onclick={terapkanFilter}
			>
				<FilterIcon class="mr-1.5 size-3.5" />
				Terapkan Filter
			</Button>
		</div>
	</Card.Root>

	<!-- RINGKASAN STATISTIK (Ringkas & Seimbang Saat Cetak) -->
	<div class="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-3">
		<Card.Root
			class="p-4 print:rounded-lg print:border print:border-gray-300 print:p-3 print:shadow-none"
		>
			<p
				class="text-muted-foreground text-xs font-bold tracking-wider uppercase print:text-[9px] print:text-gray-500"
			>
				Total Wilayah Dipantau
			</p>
			<div class="mt-1 text-2xl font-extrabold print:text-base print:text-gray-900">
				{skorWilayahTersaring.length}
				<span class="text-xs font-normal text-gray-600">Kelurahan</span>
			</div>
			<p
				class="mt-0.5 text-xs font-medium text-emerald-600 print:text-[9px] print:text-emerald-700"
			>
				Umpan Kamera CCTV Terhubung
			</p>
		</Card.Root>

		<Card.Root
			class="p-4 print:rounded-lg print:border print:border-gray-300 print:p-3 print:shadow-none"
		>
			<p
				class="text-muted-foreground text-xs font-bold tracking-wider uppercase print:text-[9px] print:text-gray-500"
			>
				Rata-Rata Kepatuhan SLA
			</p>
			<div
				class="mt-1 text-2xl font-extrabold text-emerald-600 print:text-base print:text-emerald-700"
			>
				94.2% <span class="text-xs font-normal text-gray-600">Tepat Waktu</span>
			</div>
			<p class="text-muted-foreground mt-0.5 text-xs print:text-[9px] print:text-gray-500">
				Pengangkutan &lt; 24 Jam
			</p>
		</Card.Root>

		<Card.Root
			class="p-4 print:rounded-lg print:border print:border-gray-300 print:p-3 print:shadow-none"
		>
			<p
				class="text-muted-foreground text-xs font-bold tracking-wider uppercase print:text-[9px] print:text-gray-500"
			>
				Pencapaian Adipura Wilayah
			</p>
			<div class="mt-1 text-2xl font-extrabold text-amber-500 print:text-base print:text-gray-900">
				82.4 <span class="text-xs font-normal text-gray-600">/ 100</span>
			</div>
			<p class="text-muted-foreground mt-0.5 text-xs print:text-[9px] print:text-gray-500">
				Skor Rata-rata Kebersihan
			</p>
		</Card.Root>
	</div>

	<!-- TABEL RINCIAN WILAYAH (REVISI BERWARNA & BERKONTRAST) -->
	<Card.Root
		class="overflow-hidden border-emerald-800/20 shadow-md print:border-none print:shadow-none"
	>
		<Card.Header
			class="bg-emerald-50/60 !px-4 !py-3 dark:bg-emerald-950/30 print:bg-transparent print:!p-0"
		>
			<!-- JUDUL: Font diperbesar ke text-lg / text-base (Font-extrabold) -->
			<Card.Title
				class="text-base font-extrabold tracking-tight text-emerald-950 sm:text-lg dark:text-emerald-100 print:text-xs print:font-bold print:uppercase"
			>
				Rincian Laporan Kebersihan Per-Kelurahan
			</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			<div class="relative w-full overflow-x-auto">
				<Table.Root
					class="w-full min-w-[700px] border-collapse text-left print:border print:border-gray-300"
				>
					<!-- HEADER EMERALD TEGAS -->
					<Table.Header>
						<Table.Row class="border-none bg-emerald-800 hover:bg-emerald-800 print:bg-gray-100">
							<Table.Head
								class="py-3.5 pl-4 text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Provinsi</Table.Head
							>
							<Table.Head
								class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Kabupaten / Kota</Table.Head
							>
							<Table.Head
								class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Kecamatan</Table.Head
							>
							<Table.Head
								class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Kelurahan</Table.Head
							>
							<Table.Head
								class="py-3.5 text-center text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Jumlah Insiden</Table.Head
							>
							<Table.Head
								class="py-3.5 text-center text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Durasi Rata-rata SLA</Table.Head
							>
							<Table.Head
								class="py-3.5 pr-4 text-center text-xs font-bold tracking-wider text-emerald-50 uppercase print:py-2 print:text-[10px] print:font-bold print:text-black"
								>Skor Kebersihan</Table.Head
							>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each skorWilayahTersaring as row, idx (`${row.provinsi}-${row.kabupatenKota}-${row.kecamatan}-${row.kelurahan}`)}
							<Table.Row
								class="border-border/50 border-b text-xs transition-colors {idx % 2 === 0
									? 'dark:bg-background bg-white'
									: 'bg-emerald-50/30 dark:bg-emerald-950/10'} hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 print:border-b print:border-gray-200 print:bg-white"
							>
								<!-- PROVINSI -->
								<Table.Cell
									class="text-foreground py-3 pl-4 font-bold print:py-1.5 print:text-[10px]"
								>
									{row.provinsi}
								</Table.Cell>

								<!-- KABUPATEN / KOTA -->
								<Table.Cell
									class="text-muted-foreground py-3 print:py-1.5 print:text-[10px] print:text-black"
								>
									{row.kabupatenKota}
								</Table.Cell>

								<!-- KECAMATAN -->
								<Table.Cell
									class="text-muted-foreground py-3 print:py-1.5 print:text-[10px] print:text-black"
								>
									{row.kecamatan}
								</Table.Cell>

								<!-- KELURAHAN (+ BADGE HIJAU SOF) -->
								<Table.Cell class="py-3 print:py-1.5 print:text-[10px]">
									<span
										class="inline-block rounded-md bg-emerald-100/80 px-2 py-0.5 font-extrabold text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 print:bg-transparent print:p-0 print:font-bold print:text-black"
									>
										{row.kelurahan}
									</span>
								</Table.Cell>

								<!-- JUMLAH INSIDEN -->
								<Table.Cell class="py-3 text-center print:py-1.5 print:text-[10px]">
									{#if row.jumlahInsiden > 0}
										<span
											class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300 print:bg-transparent print:p-0 print:text-black"
										>
											{row.jumlahInsiden} Insiden
										</span>
									{:else}
										<span
											class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 print:bg-transparent print:p-0 print:text-black"
										>
											0 Insiden
										</span>
									{/if}
								</Table.Cell>

								<!-- DURASI SLA -->
								<Table.Cell
									class="text-foreground/80 py-3 text-center font-mono font-medium print:py-1.5 print:text-[10px]"
								>
									{row.rataRataDurasiSampahJam} jam
								</Table.Cell>

								<!-- SKOR KEBERSIHAN (INDIKATOR WARNA DINAMIS) -->
								<Table.Cell class="py-3 pr-4 text-center print:py-1.5 print:text-[10px]">
									{#if row.skorKebersihan >= 80}
										<span
											class="inline-block rounded-md bg-emerald-600 px-2 py-0.5 font-black text-white dark:bg-emerald-500/20 dark:text-emerald-300 print:bg-transparent print:p-0 print:font-bold print:text-black"
										>
											{row.skorKebersihan} / 100
										</span>
									{:else if row.skorKebersihan >= 60}
										<span
											class="inline-block rounded-md bg-amber-500 px-2 py-0.5 font-black text-white dark:bg-amber-500/20 dark:text-amber-300 print:bg-transparent print:p-0 print:font-bold print:text-black"
										>
											{row.skorKebersihan} / 100
										</span>
									{:else}
										<span
											class="inline-block rounded-md bg-red-600 px-2 py-0.5 font-black text-white dark:bg-red-500/20 dark:text-red-300 print:bg-transparent print:p-0 print:font-bold print:text-black"
										>
											{row.skorKebersihan} / 100
										</span>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- CSS KHUSUS PRINT DOKUMEN -->
<style>
	@media print {
		@page {
			size: A4 portrait;
			margin: 1cm; /* Memperkecil margin agar muat lebih banyak */
		}

		/* Sembunyikan elemen luar */
		:global(header),
		:global(nav),
		:global(aside) {
			display: none !important;
		}

		:global(body) {
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
			background: white !important;
			color: black !important;
		}

		/* CEGAH PAGE-BREAK BERMASALAH */
		:global(.print\:border-none) {
			break-inside: auto !important;
			page-break-inside: auto !important;
		}

		/* Mencegah judul tabel terpisah sendiri di bawah halaman (Orphan Header) */
		:global(.print-header-title) {
			break-after: avoid !important;
			page-break-after: avoid !important;
		}

		/* Pastikan header tabel (TH) terulang otomatis jika tabel terpotong ke halaman 2 */
		:global(thead) {
			display: table-header-group;
		}

		/* Mencegah baris tabel terpotong di tengah-tengah teks */
		:global(tr) {
			break-inside: avoid !important;
			page-break-inside: avoid !important;
		}
	}
</style>
