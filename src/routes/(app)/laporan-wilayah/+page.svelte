<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import FilterIcon from "@lucide/svelte/icons/filter";
	import PrinterIcon from "@lucide/svelte/icons/printer";
	let { data } = $props();

	let provinsiFilter = $state("SEMUA");
	let kabupatenFilter = $state("SEMUA");
</script>

<svelte:head>
	<title>Laporan Wilayah &amp; Provinsi - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<FileSpreadsheetIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				<h1 class="text-3xl font-extrabold tracking-tight">Laporan Wilayah &amp; Audit Bertingkat</h1>
				<Badge class="bg-emerald-600 text-white text-xs font-semibold">Tingkat Nasional &amp; Provinsi</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				Laporan agregasi kebersihan wilayah bertingkat dari Provinsi, Kabupaten/Kota, Kecamatan hingga Kelurahan.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" class="h-9 text-xs">
				<PrinterIcon class="mr-1.5 size-3.5" />
				Cetak Ringkasan Eksekutif
			</Button>
			<Button variant="default" size="sm" class="h-9 bg-emerald-600 text-xs text-white font-semibold hover:bg-emerald-700">
				<DownloadIcon class="mr-1.5 size-3.5" />
				Ekspor CSV / Excel
			</Button>
		</div>
	</div>

	<!-- Filter Bertingkat Super Admin -->
	<Card.Root class="p-4">
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex items-center gap-2">
				<GlobeIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="text-xs font-bold">Pilih Provinsi:</span>
				<select bind:value={provinsiFilter} class="h-9 rounded-md border px-3 py-1 text-xs font-semibold bg-background">
					<option value="SEMUA">Semua Provinsi (Nasional)</option>
					{#each data.provinsiList as prov (prov.id)}
						<option value={prov.nama}>{prov.nama}</option>
					{/each}
				</select>
			</div>

			<div class="flex items-center gap-2">
				<FilterIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="text-xs font-bold">Pilih Kabupaten/Kota:</span>
				<select bind:value={kabupatenFilter} class="h-9 rounded-md border px-3 py-1 text-xs font-semibold bg-background">
					<option value="SEMUA">Semua Kabupaten/Kota</option>
					{#each data.kabupatenKotaList as kab (kab.id)}
						<option value={kab.nama}>{kab.nama}</option>
					{/each}
				</select>
			</div>
		</div>
	</Card.Root>

	<!-- Ringkasan Statistik Laporan -->
	<div class="grid gap-4 md:grid-cols-3">
		<Card.Root class="p-4">
			<p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Wilayah Dipantau</p>
			<div class="mt-2 text-2xl font-extrabold">27 Kelurahan / 5 Kota</div>
			<p class="mt-1 text-xs text-emerald-600 font-medium">Umpan Kamera CCTV Terhubung</p>
		</Card.Root>
		<Card.Root class="p-4">
			<p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rata-Rata Kepatuhan SLA</p>
			<div class="mt-2 text-2xl font-extrabold text-emerald-600">94.2% Tepat Waktu</div>
			<p class="mt-1 text-xs text-muted-foreground">Pengangkutan &lt; 24 Jam</p>
		</Card.Root>
		<Card.Root class="p-4">
			<p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pencapaian Adipura Wilayah</p>
			<div class="mt-2 text-2xl font-extrabold text-amber-500">82.4 / 100</div>
			<p class="mt-1 text-xs text-muted-foreground">Skor Rata-rata Kebersihan</p>
		</Card.Root>
	</div>

	<!-- Tabel Rincian Wilayah -->
	<Card.Root>
		<Card.Header class="pb-3">
			<Card.Title class="text-lg font-bold">Rincian Laporan Kebersihan Per-Kelurahan</Card.Title>
		</Card.Header>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head>Provinsi</Table.Head>
						<Table.Head>Kabupaten / Kota</Table.Head>
						<Table.Head>Kecamatan</Table.Head>
						<Table.Head>Kelurahan</Table.Head>
						<Table.Head class="text-center">Jumlah Insiden</Table.Head>
						<Table.Head class="text-center">Durasi Rata-rata SLA</Table.Head>
						<Table.Head class="text-center">Skor Kebersihan</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.skorWilayahList as row (row.kelurahan)}
						<Table.Row class="text-xs">
							<Table.Cell class="font-bold">{row.provinsi}</Table.Cell>
							<Table.Cell>{row.kabupatenKota}</Table.Cell>
							<Table.Cell>{row.kecamatan}</Table.Cell>
							<Table.Cell class="font-bold text-emerald-700 dark:text-emerald-400">{row.kelurahan}</Table.Cell>
							<Table.Cell class="text-center font-semibold">{row.jumlahInsiden} Insiden</Table.Cell>
							<Table.Cell class="text-center font-mono">{row.rataRataDurasiSampahJam} jam</Table.Cell>
							<Table.Cell class="text-center font-extrabold">{row.skorKebersihan} / 100</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
