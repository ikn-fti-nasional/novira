<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import AnimatedCounter from "$lib/components/animated-counter.svelte";
	import { AreaChart } from "layerchart";
	import { scaleBand } from "d3-scale";
	import { mode } from "mode-watcher";

	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
	import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import FilterIcon from "@lucide/svelte/icons/filter";
	import CalendarIcon from "@lucide/svelte/icons/calendar";
	import SearchIcon from "@lucide/svelte/icons/search";
	import Building2Icon from "@lucide/svelte/icons/building-2";
	import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import MinusIcon from "@lucide/svelte/icons/minus";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";

	import { downloadCsvReport, triggerPdfReportPrint } from "$lib/utils/export-report.js";

	let { data } = $props();

	// Controls State
	let periodeDipilih = $state<string>("30_hari");
	let kecamatanDipilih = $state<string>("SEMUA");
	let searchQuery = $state<string>("");
	let chartMode = $state<"mingguan" | "bulanan">("mingguan");

	// LayerChart Config
	const trendChartConfig = {
		rataRataKota: { label: "Rata-rata Kota Bandung", color: "var(--chart-1)" },
		bandungWetan: { label: "Kec. Bandung Wetan", color: "var(--chart-2)" },
		coblong: { label: "Kec. Coblong", color: "var(--chart-4)" },
		lengkong: { label: "Kec. Lengkong", color: "var(--chart-3)" },
	} satisfies Chart.ChartConfig;

	const activeTrendData = $derived(
		chartMode === "mingguan" ? data.trenMingguan : data.trenBulanan
	);

	const trendSeriesData = $derived(
		activeTrendData.map((d) => ({
			time: d.label,
			rataRataKota: d.rataRataKota,
			bandungWetan: d.bandungWetan,
			coblong: d.coblong,
			lengkong: d.lengkong,
		}))
	);

	// Leaderboard Filtered
	const filteredLeaderboard = $derived(
		data.leaderboard.filter((item) => {
			const matchKecamatan =
				kecamatanDipilih === "SEMUA" || item.kecamatan === kecamatanDipilih;
			const matchSearch =
				searchQuery === "" ||
				item.kelurahan.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.kecamatan.toLowerCase().includes(searchQuery.toLowerCase());
			return matchKecamatan && matchSearch;
		})
	);

	const kpiStats = $derived([
		{
			title: "Skor Kebersihan Kota",
			value: data.kpi.skorRataRata,
			unit: "/ 100",
			subtitle: "Target Adipura Kota (Min 80)",
			icon: TrophyIcon,
			statusColor: "text-emerald-600 dark:text-emerald-400",
			badgeBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
			trend: data.kpi.trenSkor,
			trendUp: true,
			trendLabel: "vs bulan lalu",
		},
		{
			title: "Insiden Sampah Aktif",
			value: data.kpi.insidenAktif,
			unit: "Lokasi",
			subtitle: "Dalam Penanganan Armada DLH",
			icon: AlertTriangleIcon,
			statusColor: "text-amber-600 dark:text-amber-400",
			badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
			trend: data.kpi.trenInsiden,
			trendUp: false,
			trendLabel: "vs minggu lalu",
		},
		{
			title: "Pelanggaran SLA Penanganan",
			value: `${data.kpi.persentaseSlaMelanggar}%`,
			subtitle: "Batas Toleransi Target SLA < 5%",
			icon: ShieldAlertIcon,
			statusColor: "text-emerald-600 dark:text-emerald-400",
			badgeBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
			trend: data.kpi.trenSla,
			trendUp: false,
			trendLabel: "Membaik (SLA Respon)",
		},
		{
			title: "Indeks Tren Respon",
			value: data.kpi.indeksTrenMingguan,
			subtitle: "Peningkatan Kecepatan Armada",
			icon: ActivityIcon,
			statusColor: "text-blue-600 dark:text-blue-400",
			badgeBg: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
			trend: "Membaik",
			trendUp: true,
			trendLabel: "Performa Armada",
		},
	]);

	function getBadgeSkorClass(skor: number) {
		if (skor >= 85) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-extrabold";
		if (skor >= 70) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-bold";
		if (skor >= 60) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold";
		return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-bold";
	}

	function handleExportCsv() {
		const headers = [
			"Peringkat",
			"Kelurahan",
			"Kecamatan",
			"Skor Kebersihan",
			"Jumlah Insiden",
			"Rata-rata Durasi SLA (Jam)",
			"Tren Mingguan (%)",
		];
		const rows = filteredLeaderboard.map((item) => [
			item.peringkat,
			item.kelurahan,
			item.kecamatan,
			item.skorKebersihan,
			item.jumlahInsiden,
			item.rataRataDurasiSampahJam,
			item.persentaseTren,
		]);
		downloadCsvReport(`Laporan_Eksekutif_Kebersihan_${periodeDipilih}`, headers, rows);
	}
</script>

<svelte:head>
	<title>NOVIRA - Dashboard Eksekutif Kebersihan (Kepala Dinas &amp; Wali Kota)</title>
</svelte:head>

<div class="space-y-6 print:p-0">
	<!-- Header Eksekutif + Controls Bar -->
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/60 pb-4">
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-3xl font-extrabold tracking-tight text-foreground">
					Dashboard Eksekutif Kebersihan Lingkungan
				</h1>
				<Badge
					variant="outline"
					class="border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold px-2.5 py-1 text-xs"
				>
					<ShieldCheckIcon class="mr-1 size-3.5" />
					Akses Executive (Read-Only)
				</Badge>
			</div>
			<p class="text-muted-foreground text-sm mt-1">
				Pemantauan skor kebersihan wilayah, evaluasi SLA armada, dan peringkat kelurahan Kota Bandung untuk Kepala Dinas &amp; Wali Kota.
			</p>
		</div>

		<!-- Context Controls (Periode, Kecamatan Filter, Unduh PDF/CSV) -->
		<div class="flex flex-wrap items-center gap-2 print:hidden">
			<div class="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-xs">
				<CalendarIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="font-semibold text-muted-foreground">Periode:</span>
				<select
					bind:value={periodeDipilih}
					class="bg-transparent font-bold text-foreground focus:outline-hidden text-xs cursor-pointer"
				>
					<option value="hari_ini">Hari Ini</option>
					<option value="7_hari">7 Hari Terakhir</option>
					<option value="30_hari">30 Hari Terakhir</option>
					<option value="bulan_ini">Bulan Ini</option>
					<option value="tahun_ini">Tahun 2026</option>
				</select>
			</div>

			<div class="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-xs">
				<FilterIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="font-semibold text-muted-foreground">Kecamatan:</span>
				<select
					bind:value={kecamatanDipilih}
					class="bg-transparent font-bold text-foreground focus:outline-hidden text-xs cursor-pointer"
				>
					<option value="SEMUA">Seluruh Kecamatan (Kota Bandung)</option>
					{#each data.kecamatanList as kec}
						<option value={kec}>{kec}</option>
					{/each}
				</select>
			</div>

			<Button variant="outline" size="sm" class="h-9 text-xs font-semibold" onclick={handleExportCsv}>
				<FileSpreadsheetIcon class="mr-1.5 size-3.5 text-emerald-600 dark:text-emerald-400" />
				Unduh CSV
			</Button>

			<Button variant="default" size="sm" class="h-9 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" onclick={triggerPdfReportPrint}>
				<DownloadIcon class="mr-1.5 size-3.5" />
				Cetak PDF Laporan
			</Button>
		</div>
	</div>

	<!-- Baris 1: Kartu Metrik Utama KPI Eksekutif -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each kpiStats as stat (stat.title)}
			<Card.Root class="relative overflow-hidden border-border/80 shadow-sm transition-all hover:shadow-md">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{stat.title}
					</Card.Title>
					<div class={`flex size-8 items-center justify-center rounded-lg ${stat.badgeBg}`}>
						<stat.icon class="size-4" />
					</div>
				</Card.Header>
				<Card.Content class="pt-1">
					<div class="flex items-baseline gap-1 text-2xl font-extrabold tracking-tight">
						{#if typeof stat.value === "number"}
							<AnimatedCounter value={stat.value} />
						{:else}
							{stat.value}
						{/if}
						{#if stat.unit}
							<span class="text-xs font-semibold text-muted-foreground">{stat.unit}</span>
						{/if}
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span class="text-xs text-muted-foreground font-medium">{stat.subtitle}</span>
						<span
							class={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
								stat.title === "Insiden Sampah Aktif"
									? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
									: stat.trendUp
										? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
										: "bg-amber-500/10 text-amber-700 dark:text-amber-400"
							}`}
						>
							{#if stat.trendUp}
								<TrendingUpIcon class="size-3" />
							{:else}
								<TrendingDownIcon class="size-3" />
							{/if}
							{stat.trend}
						</span>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<!-- Baris 2: Grafik Tren Skor Kebersihan per Kecamatan (LayerChart) -->
	<Card.Root class="border-border/80 shadow-md">
		<Card.Header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
			<div>
				<div class="flex items-center gap-2">
					<ActivityIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
					<Card.Title class="text-xl font-bold tracking-tight">
						Tren Skor Kebersihan per Kecamatan
					</Card.Title>
				</div>
				<Card.Description class="text-xs mt-0.5">
					Komparasi tren nilai kebersihan rata-rata Kota Bandung vs sampel kecamatan unggulan.
				</Card.Description>
			</div>

			<div class="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
				<button
					onclick={() => (chartMode = "mingguan")}
					class={`rounded-md px-3 py-1 font-semibold transition-all ${
						chartMode === "mingguan"
							? "bg-card text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					Mingguan (7 Hari)
				</button>
				<button
					onclick={() => (chartMode = "bulanan")}
					class={`rounded-md px-3 py-1 font-semibold transition-all ${
						chartMode === "bulanan"
							? "bg-card text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					Bulanan (6 Bulan)
				</button>
			</div>
		</Card.Header>

		<Card.Content>
			{#key `${chartMode}-${mode.current}`}
				<Chart.Container config={trendChartConfig} class="h-[300px] w-full">
					<AreaChart
						data={trendSeriesData}
						x="time"
						xScale={scaleBand().padding(0.2)}
						series={[
							{
								key: "rataRataKota",
								label: trendChartConfig.rataRataKota.label,
								color: trendChartConfig.rataRataKota.color,
							},
							{
								key: "bandungWetan",
								label: trendChartConfig.bandungWetan.label,
								color: trendChartConfig.bandungWetan.color,
							},
							{
								key: "coblong",
								label: trendChartConfig.coblong.label,
								color: trendChartConfig.coblong.color,
							},
							{
								key: "lengkong",
								label: trendChartConfig.lengkong.label,
								color: trendChartConfig.lengkong.color,
							},
						]}
						props={{
							area: { opacity: 0.2 },
							line: { class: "stroke-2" },
						}}
						points
					>
						{#snippet tooltip()}
							<Chart.Tooltip indicator="line" />
						{/snippet}
					</AreaChart>
				</Chart.Container>
			{/key}
		</Card.Content>
	</Card.Root>

	<!-- Baris 3: Leaderboard / Klasemen Kebersihan Kelurahan -->
	<Card.Root class="border-border/80 shadow-md">
		<Card.Header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-3">
			<div>
				<div class="flex items-center gap-2">
					<TrophyIcon class="size-5 text-amber-500" />
					<Card.Title class="text-xl font-bold tracking-tight">
						Leaderboard &amp; Ranking Kebersihan Kelurahan
					</Card.Title>
				</div>
				<Card.Description class="text-xs mt-0.5">
					Peringkat kebersihan kelurahan berdasarkan evaluasi durasi penanganan armada &amp; akumulasi insiden.
				</Card.Description>
			</div>

			<!-- Live Filter & Search input -->
			<div class="flex flex-wrap items-center gap-2 print:hidden">
				<div class="relative min-w-[200px]">
					<SearchIcon class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
					<input
						type="text"
						placeholder="Cari kelurahan/kecamatan..."
						bind:value={searchQuery}
						class="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
					/>
				</div>

				<div class="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
					<Building2Icon class="size-3.5 text-emerald-600 dark:text-emerald-400" />
					<select
						bind:value={kecamatanDipilih}
						class="bg-transparent font-semibold text-foreground text-xs focus:outline-hidden cursor-pointer"
					>
						<option value="SEMUA">Semua Kecamatan</option>
						{#each data.kecamatanList as kec}
							<option value={kec}>{kec}</option>
						{/each}
					</select>
				</div>
			</div>
		</Card.Header>

		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head class="w-[70px] text-center">Peringkat</Table.Head>
						<Table.Head>Kelurahan &amp; Kecamatan</Table.Head>
						<Table.Head class="text-center">Skor Kebersihan</Table.Head>
						<Table.Head class="text-center">Insiden Aktif</Table.Head>
						<Table.Head class="text-center">Respon Durasi SLA</Table.Head>
						<Table.Head class="text-right">Tren Kebersihan</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#if filteredLeaderboard.length === 0}
						<Table.Row>
							<Table.Cell colspan={6} class="text-center py-6 text-xs text-muted-foreground">
								Tidak ada data kelurahan yang sesuai dengan filter pencarian.
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each filteredLeaderboard as item (item.kelurahan)}
							<Table.Row class="text-xs hover:bg-muted/40 transition-colors">
								<Table.Cell class="text-center font-bold">
									<span
										class={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
											item.peringkat === 1
												? "bg-amber-400 text-slate-950 font-extrabold"
												: item.peringkat === 2
													? "bg-slate-300 text-slate-900 font-bold"
													: item.peringkat === 3
														? "bg-amber-700/40 text-amber-200 font-bold"
														: "bg-muted text-muted-foreground"
										}`}
									>
										#{item.peringkat}
									</span>
								</Table.Cell>

								<Table.Cell>
									<div class="flex flex-col">
										<span class="font-bold text-foreground text-sm">{item.kelurahan}</span>
										<span class="text-[11px] text-muted-foreground">
											Kec. {item.kecamatan}, {item.kabupatenKota}
										</span>
									</div>
								</Table.Cell>

								<Table.Cell class="text-center">
									<div class="flex flex-col items-center gap-1">
										<Badge variant="outline" class={`text-xs ${getBadgeSkorClass(item.skorKebersihan)}`}>
											{item.skorKebersihan} / 100
										</Badge>
										<div class="w-24 bg-muted h-1.5 rounded-full overflow-hidden">
											<div
												class={`h-full ${
													item.skorKebersihan >= 85
														? "bg-emerald-500"
														: item.skorKebersihan >= 70
															? "bg-blue-500"
															: item.skorKebersihan >= 60
																? "bg-amber-500"
																: "bg-red-500"
												}`}
												style={`width: ${item.skorKebersihan}%`}
											></div>
										</div>
									</div>
								</Table.Cell>

								<Table.Cell class="text-center font-semibold">
									<span class={item.jumlahInsiden > 15 ? "text-red-600 dark:text-red-400 font-extrabold" : ""}>
										{item.jumlahInsiden} Insiden
									</span>
								</Table.Cell>

								<Table.Cell class="text-center font-mono text-xs">
									{item.rataRataDurasiSampahJam} Jam
								</Table.Cell>

								<Table.Cell class="text-right">
									{#if item.tren === "membaik"}
										<span class="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
											<TrendingUpIcon class="size-3.5" />
											+{item.persentaseTren}%
										</span>
									{:else if item.tren === "menurun"}
										<span class="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
											<TrendingDownIcon class="size-3.5" />
											{item.persentaseTren}%
										</span>
									{:else}
										<span class="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
											<MinusIcon class="size-3.5" />
											Stabil
										</span>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>

	<!-- Baris 4: Evaluasi Ringkasan & Rekomendasi Kebijakan Eksekutif -->
	<div class="grid gap-6 md:grid-cols-3">
		<Card.Root class="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
			<Card.Header class="pb-2">
				<div class="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
					<CheckCircle2Icon class="size-5" />
					<Card.Title class="text-base font-bold">Wilayah Performa Terbaik</Card.Title>
				</div>
			</Card.Header>
			<Card.Content class="text-xs space-y-1.5">
				<p class="font-semibold text-foreground text-sm">Kelurahan Cihapit (Kec. Bandung Wetan)</p>
				<p class="text-muted-foreground">
					Skor kebersihan tertinggi <strong class="text-emerald-700 dark:text-emerald-400">94/100</strong> dengan durasi respon SLA rata-rata hanya <strong>0.6 Jam</strong>.
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-red-500/30 bg-red-500/5 shadow-xs">
			<Card.Header class="pb-2">
				<div class="flex items-center gap-2 text-red-700 dark:text-red-400">
					<AlertTriangleIcon class="size-5" />
					<Card.Title class="text-base font-bold">Wilayah Perlu Perhatian</Card.Title>
				</div>
			</Card.Header>
			<Card.Content class="text-xs space-y-1.5">
				<p class="font-semibold text-foreground text-sm">Kelurahan Malabar (Kec. Lengkong)</p>
				<p class="text-muted-foreground">
					Skor terendah <strong class="text-red-600 dark:text-red-400">52/100</strong> dengan <strong>23 insiden</strong> aktif dan durasi pengangkutan <strong>4.2 Jam</strong>.
				</p>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-blue-500/30 bg-blue-500/5 shadow-xs">
			<Card.Header class="pb-2">
				<div class="flex items-center gap-2 text-blue-700 dark:text-blue-400">
					<FileSpreadsheetIcon class="size-5" />
					<Card.Title class="text-base font-bold">Rekomendasi Kebijakan DLH</Card.Title>
				</div>
			</Card.Header>
			<Card.Content class="text-xs space-y-1.5">
				<p class="font-semibold text-foreground text-sm">Optimasi Penambahan Armada</p>
				<p class="text-muted-foreground">
					Disarankan menambah <strong>2 unit truk pengangkut kontainer</strong> ke Kecamatan Lengkong pada jam 06:00 - 09:00 WIB untuk menekan durasi pembuangan liar.
				</p>
			</Card.Content>
		</Card.Root>
	</div>
</div>
