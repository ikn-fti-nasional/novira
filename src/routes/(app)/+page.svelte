<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import AnimatedCounter from "$lib/components/animated-counter.svelte";
	import { AreaChart } from "layerchart";
	import { scaleBand } from "d3-scale";
	import { mode } from "mode-watcher";

	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import VideoIcon from "@lucide/svelte/icons/video";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
	import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import FilterIcon from "@lucide/svelte/icons/filter";

	import CctvPlayer from "$lib/components/novira/cctv-player.svelte";
	import IncidentTable from "$lib/components/novira/incident-table.svelte";
	import HotspotMap from "$lib/components/novira/hotspot-map.svelte";
	import AreaSummary from "$lib/components/novira/area-summary.svelte";

	let { data } = $props();

	// Sapaan berdasarkan waktu setempat
	const jam = new Date().getHours();
	const sapaan =
		jam < 11
			? "Selamat Pagi"
			: jam < 15
				? "Selamat Siang"
				: jam < 18
					? "Selamat Sore"
					: "Selamat Malam";

	// Scope Filter Super Admin
	let provinsiDipilih = $state<string>("SEMUA");
	let kabupatenDipilih = $state<string>("SEMUA");

	// LayerChart Config Tren Sampah
	const trendChartConfig = {
		insidenAktif: { label: "Insiden Sampah Aktif", color: "var(--chart-3)" },
		insidenSelesai: { label: "Sampah Terangkut / Selesai", color: "var(--chart-1)" },
	} satisfies Chart.ChartConfig;

	const trendData = $derived(
		data.trenSampahList.map((d) => ({
			time: d.jam,
			active: d.insidenAktif,
			resolved: d.insidenSelesai,
			volume: d.volumeSampahKg,
		}))
	);

	const stats = $derived([
		{
			title: "Insiden Aktif",
			value: data.kpi.insidenAktif,
			subtitle: "Perlu Penanganan Petugas",
			icon: AlertTriangleIcon,
			statusColor: "text-red-600 dark:text-red-400",
			badgeBg: "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400",
			trend: "+12%",
			trendUp: true,
			trendLabel: "vs kemarin",
		},
		{
			title: "CCTV Online",
			value: `${data.kpi.cctvOnline}/${data.kpi.totalCctv}`,
			subtitle: `${data.kpi.persentaseUptimeCctv}% Uptime Umpan Kamera`,
			icon: VideoIcon,
			statusColor: "text-emerald-600 dark:text-emerald-400",
			badgeBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
			trend: "Normal",
			trendUp: true,
			trendLabel: "5 dari 6 feed live",
		},
		{
			title: "Sampah Terdeteksi Hari Ini",
			value: `${data.kpi.volumeSampahHariIniKg ?? 142} kg`,
			subtitle: "38 Titik Terlacak AI",
			icon: Trash2Icon,
			statusColor: "text-amber-600 dark:text-amber-400",
			badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
			trend: "-8%",
			trendUp: false,
			trendLabel: "vs minggu lalu",
		},
		{
			title: "Pelanggaran SLA (>24 Jam)",
			value: data.kpi.slaMelanggar,
			subtitle: "Penanganan Belum Selesai",
			icon: ShieldAlertIcon,
			statusColor: "text-red-600 dark:text-red-400",
			badgeBg: "bg-red-600/15 border-red-600/30 text-red-700 dark:text-red-400 font-bold",
			trend: "Eskalasi",
			trendUp: true,
			trendLabel: "2 Wilayah Kritis",
		},
	]);
</script>

<svelte:head>
	<title>NOVIRA - Dashboard Pemantauan Lingkungan Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header Super Admin dengan Pemilih Cakupan Wilayah Nasional / Provinsi / Kota -->
	<div
		class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border/60 pb-4"
	>
		<div>
			{#if data.demoData}
				<div
					class="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
				>
					<AlertTriangleIcon class="mt-0.5 size-3.5 shrink-0" />
					<p>
						Data CCTV, insiden, skor wilayah, petugas, dan tren sampah pada halaman ini adalah
						<strong>data demo/simulasi</strong>, belum terhubung ke sistem EcoVision yang
						sebenarnya.
					</p>
				</div>
			{/if}
			<div class="flex items-center gap-2">
				<h1 class="text-3xl font-extrabold tracking-tight text-foreground">
					{sapaan}, {data.user.name}
				</h1>
				<Badge
					variant="outline"
					class="border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 text-xs"
				>
					<ShieldCheckIcon class="mr-1 size-3.5" />
					{data.user.role === "admin"
						? "Akses Admin"
						: data.user.role === "operator"
							? "Akses Operator"
							: data.user.role === "kepala_seksi"
								? "Akses Kepala Seksi"
								: "Akses Pemantau"}
				</Badge>
			</div>
			<p class="text-muted-foreground text-sm mt-1">
				Pusat komando pengawasan sampah nasional, audit sistem, dan penugasan armada kebersihan.
			</p>
		</div>

		<!-- Selector Wilayah (Tingkat Provinsi & Kabupaten/Kota) -->
		<div class="flex flex-wrap items-center gap-2">
			<div
				class="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-xs"
			>
				<GlobeIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="font-semibold text-muted-foreground">Provinsi:</span>
				<select
					bind:value={provinsiDipilih}
					class="bg-transparent font-bold text-foreground focus:outline-hidden text-xs"
				>
					<option value="SEMUA">Seluruh Indonesia (Nasional)</option>
					{#each data.provinsiList as prov (prov.id)}
						<option value={prov.nama}>{prov.nama}</option>
					{/each}
				</select>
			</div>

			<div
				class="flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-xs"
			>
				<FilterIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="font-semibold text-muted-foreground">Kabupaten/Kota:</span>
				<select
					bind:value={kabupatenDipilih}
					class="bg-transparent font-bold text-foreground focus:outline-hidden text-xs"
				>
					<option value="SEMUA">Semua Kota/Kabupaten</option>
					{#each data.kabupatenKotaList as kab (kab.id)}
						<option value={kab.nama}>{kab.nama}</option>
					{/each}
				</select>
			</div>

			<Button variant="outline" size="sm" class="h-9 text-xs font-semibold">
				<DownloadIcon class="mr-1.5 size-3.5" />
				Unduh Laporan PDF/CSV
			</Button>
		</div>
	</div>

	<!-- Baris 1: Kartu Metrik Utama KPI -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat (stat.title)}
			<Card.Root
				class="relative overflow-hidden border-border/80 shadow-sm transition-all hover:shadow-md"
			>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{stat.title}
					</Card.Title>
					<div class={`flex size-8 items-center justify-center rounded-lg ${stat.badgeBg}`}>
						<stat.icon class="size-4" />
					</div>
				</Card.Header>
				<Card.Content class="pt-1">
					<div class="text-2xl font-extrabold tracking-tight">
						{#if typeof stat.value === "number"}
							<AnimatedCounter value={stat.value} />
						{:else}
							{stat.value}
						{/if}
					</div>
					<div class="mt-2 flex items-center justify-between">
						<span class="text-xs text-muted-foreground font-medium">{stat.subtitle}</span>
						<span
							class={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
								stat.title === "Pelanggaran SLA (>24 Jam)"
									? "bg-red-600/15 text-red-700 dark:text-red-400"
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

	<!-- Baris 2: Pemantauan Umpan CCTV & Tabel Insiden Peringatan -->
	<div class="grid gap-6 lg:grid-cols-12">
		<div class="min-w-0 lg:col-span-6">
			<CctvPlayer kameraList={data.kameraList} kameraIdDipilih="CAM-003" />
		</div>
		<div class="min-w-0 lg:col-span-6">
			<IncidentTable insidenList={data.insidenList} />
		</div>
	</div>

	<!-- Baris 3: Tren Deteksi Sampah LayerChart + Peta Titik Rawan -->
	<div class="grid gap-6 lg:grid-cols-12">
		<Card.Root class="min-w-0 lg:col-span-6 border-border/80 shadow-md">
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<div>
					<div class="flex items-center gap-2">
						<ActivityIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
						<Card.Title class="text-xl font-bold tracking-tight">
							Tren Deteksi &amp; Pengangkutan Sampah
						</Card.Title>
					</div>
					<Card.Description class="text-xs">
						Grafik pemantauan 24 jam deteksi sampah liar vs. kecepatan pengangkutan armada.
					</Card.Description>
				</div>
				<Badge
					variant="outline"
					class="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
				>
					Telemetri Real-time
				</Badge>
			</Card.Header>

			<Card.Content>
				{#key mode.current}
					<Chart.Container config={trendChartConfig} class="h-[280px] w-full">
						<AreaChart
							data={trendData}
							x="time"
							xScale={scaleBand().padding(0.2)}
							series={[
								{
									key: "active",
									label: trendChartConfig.insidenAktif.label,
									color: trendChartConfig.insidenAktif.color,
								},
								{
									key: "resolved",
									label: trendChartConfig.insidenSelesai.label,
									color: trendChartConfig.insidenSelesai.color,
								},
							]}
							props={{
								area: { opacity: 0.25 },
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

		<div class="min-w-0 lg:col-span-6">
			<HotspotMap kameraList={data.kameraList} insidenList={data.insidenList} />
		</div>
	</div>

	<!-- Baris 4: Klasemen Kebersihan Wilayah -->
	<div class="grid gap-6">
		<AreaSummary skorWilayahList={data.skorWilayahList} />
	</div>

	<!-- Baris 5: Log Audit & Rekam Jejak Sistem Super Admin -->
	{#if data.user.role === "admin"}
		<Card.Root class="border-border/80 shadow-md">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
			<div>
				<div class="flex items-center gap-2">
					<ShieldCheckIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
					<Card.Title class="text-xl font-bold tracking-tight">
						Log Audit &amp; Rekam Jejak Aktivitas Sistem
					</Card.Title>
				</div>
				<Card.Description class="text-xs">
					Catatan audit terenkripsi seluruh tindakan deteksi AI, penugasan petugas, dan keputusan
					Super Admin.
				</Card.Description>
			</div>
			<a
				href="/audit"
				class="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
			>
				Lihat Seluruh Log Audit &rarr;
			</a>
		</Card.Header>
		<Card.Content>
			<div class="space-y-3">
				{#each data.auditLogList as log (log.id)}
					<div
						class="flex items-start justify-between rounded-lg border bg-card p-3 text-xs shadow-xs"
					>
						<div class="flex flex-col gap-0.5">
							<div class="flex items-center gap-2">
								<span class="font-bold text-foreground">{log.tindakan}</span>
								<Badge variant="outline" class="text-[9px] font-mono">{log.tipe}</Badge>
							</div>
							<p class="text-muted-foreground">{log.rincian}</p>
							<span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold"
								>{log.wilayah}</span
							>
						</div>
						<div class="text-right">
							<span class="font-bold text-slate-700 dark:text-slate-300">{log.pengguna}</span>
							<p class="text-[10px] text-muted-foreground">
								{new Date(log.waktu).toLocaleTimeString()}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</Card.Content>
		</Card.Root>
	{/if}
</div>
