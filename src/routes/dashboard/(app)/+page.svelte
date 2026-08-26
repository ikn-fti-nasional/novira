<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import AnimatedCounter from "$lib/components/animated-counter.svelte";
	import { AreaChart } from "layerchart";
	import { scaleBand } from "d3-scale";
	import { mode } from "mode-watcher";
	import { invalidateAll } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import { triggerPdfReportPrint } from "$lib/utils/export-report.js";

	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import VideoIcon from "@lucide/svelte/icons/video";
	import ScanSearchIcon from "@lucide/svelte/icons/scan-search";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import PrinterIcon from "@lucide/svelte/icons/printer";
	import FilterIcon from "@lucide/svelte/icons/filter";

	import CctvPlayer from "$lib/components/novira/cctv-player.svelte";
	import IncidentTable from "$lib/components/novira/incident-table.svelte";
	import HotspotMap from "$lib/components/novira/hotspot-map.svelte";
	import AreaSummary from "$lib/components/novira/area-summary.svelte";

	let { data } = $props();

	/** Jumlah baris insiden & log audit yang digambar di dashboard. */
	const BATAS_INSIDEN = 10;
	const BATAS_AUDIT = 6;

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

	// --- Filter cakupan wilayah ---------------------------------------------
	// Filter ini menyaring data yang sudah ada di klien (kamera, insiden, skor
	// wilayah) — bukan hanya hiasan header. Sebelumnya kedua <select> tidak
	// terhubung ke apa pun, jadi mengubahnya tidak berpengaruh sama sekali.
	let provinsiDipilih = $state<string>("SEMUA");
	let kabupatenDipilih = $state<string>("SEMUA");

	// Kota yang ditawarkan menyempit mengikuti provinsi terpilih, dan pilihan
	// kota yang jadi tidak valid direset supaya tidak ada kombinasi yang
	// menghasilkan nol data tanpa penjelasan.
	const kabupatenTersedia = $derived(
		provinsiDipilih === "SEMUA"
			? data.kabupatenKotaList
			: data.kabupatenKotaList.filter((k) => k.provinsi === provinsiDipilih)
	);

	$effect(() => {
		if (
			kabupatenDipilih !== "SEMUA" &&
			!kabupatenTersedia.some((k) => k.nama === kabupatenDipilih)
		) {
			kabupatenDipilih = "SEMUA";
		}
	});

	function cocokWilayah(item: { provinsi: string; kabupatenKota: string }): boolean {
		if (provinsiDipilih !== "SEMUA" && item.provinsi !== provinsiDipilih) return false;
		if (kabupatenDipilih !== "SEMUA" && item.kabupatenKota !== kabupatenDipilih) return false;
		return true;
	}

	const adaFilter = $derived(provinsiDipilih !== "SEMUA" || kabupatenDipilih !== "SEMUA");

	const kameraTersaring = $derived(data.kameraList.filter(cocokWilayah));
	const insidenTersaring = $derived(data.insidenList.filter(cocokWilayah));
	const skorWilayahTersaring = $derived(
		adaFilter ? data.skorWilayahList.filter(cocokWilayah) : data.skorWilayahList
	);

	// --- Data poll -----------------------------------------------------------
	// Insiden hanya berubah lewat siklus deteksi (cron 12:00 & 15:00 WIB) atau
	// tindakan operator; poll ringan supaya dashboard tidak perlu refresh
	// manual, tanpa infrastruktur push.
	$effect(() => {
		const interval = setInterval(() => invalidateAll(), 2 * 60 * 1000);
		return () => clearInterval(interval);
	});

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
		}))
	);

	// --- KPI ----------------------------------------------------------------
	// Setiap angka dan setiap label di bawah ini diturunkan dari data nyata.
	// Versi sebelumnya menempelkan delta karangan ("+12% vs kemarin", "38 titik
	// terlacak AI", "2 wilayah kritis") ke angka yang benar — di laporan resmi
	// itu jauh lebih berbahaya daripada tidak menampilkan delta sama sekali.
	// Delta harian baru bisa dihitung setelah ada arsip `areaSnapshots`.
	const kameraOnlineTersaring = $derived(
		kameraTersaring.filter((k) => k.status === "ONLINE").length
	);
	const insidenAktifTersaring = $derived(
		insidenTersaring.filter((i) => i.status === "AKTIF").length
	);
	const slaTersaring = $derived(
		insidenTersaring.filter((i) => i.statusSla === "MELANGGAR_SLA").length
	);
	const titikTerdampak = $derived(
		new Set(
			insidenTersaring
				.filter((i) => i.status === "AKTIF" || i.status === "PERINGATAN")
				.map((i) => i.kameraId)
				.filter(Boolean)
		).size
	);
	const kecamatanKritis = $derived(
		new Set(
			insidenTersaring
				.filter(
					(i) =>
						(i.status === "AKTIF" || i.status === "PERINGATAN") &&
						(i.keparahan === "KRITIS" || i.statusSla === "MELANGGAR_SLA")
				)
				.map((i) => i.kecamatan)
				.filter(Boolean)
		).size
	);
	const insidenBaruHariIni = $derived(
		adaFilter
			? insidenTersaring.filter(
					(i) => new Date(i.pertamaDilihat).toDateString() === new Date().toDateString()
				).length
			: data.kpi.insidenBaruHariIni
	);
	const persenUptime = $derived(
		kameraTersaring.length === 0
			? 0
			: Math.round((kameraOnlineTersaring / kameraTersaring.length) * 100)
	);

	const stats = $derived([
		{
			title: "Insiden Aktif",
			value: insidenAktifTersaring,
			subtitle: "Perlu penanganan petugas",
			icon: AlertTriangleIcon,
			badgeBg: "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400",
			catatan: `${titikTerdampak} titik pantau terdampak`,
			catatanBg: "bg-red-600/10 text-red-700 dark:text-red-400",
		},
		{
			title: "CCTV Online",
			value: `${kameraOnlineTersaring}/${kameraTersaring.length}`,
			subtitle: `${persenUptime}% umpan kamera dapat diakses`,
			icon: VideoIcon,
			badgeBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
			catatan: persenUptime >= 80 ? "Cakupan baik" : "Cakupan menurun",
			catatanBg:
				persenUptime >= 80
					? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
					: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
		},
		{
			title: "Terdeteksi Hari Ini",
			value: insidenBaruHariIni,
			subtitle: "Insiden baru dari siklus deteksi CCTV",
			icon: ScanSearchIcon,
			badgeBg: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
			catatan: `${data.kpi.insidenSelesaiHariIni} selesai hari ini`,
			catatanBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		},
		{
			title: "Pelanggaran SLA (>24 Jam)",
			value: slaTersaring,
			subtitle: "Penanganan melewati batas waktu",
			icon: ShieldAlertIcon,
			badgeBg: "bg-red-600/15 border-red-600/30 text-red-700 dark:text-red-400",
			catatan:
				kecamatanKritis === 0 ? "Tidak ada kecamatan kritis" : `${kecamatanKritis} kecamatan kritis`,
			catatanBg:
				kecamatanKritis === 0
					? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
					: "bg-red-600/15 text-red-700 dark:text-red-400",
		},
	]);

	// --- Tindakan pada tabel insiden ----------------------------------------
	// Dashboard memakai action milik halaman Insiden lewat path absolut, supaya
	// tombol "Tugaskan"/"Selesaikan" di sini benar-benar bekerja. Sebelumnya
	// tabel dirender tanpa satu pun handler: dialognya terbuka, tombolnya bisa
	// ditekan, dan tidak ada apa pun yang tersimpan.
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
			const response = await fetch(`/dashboard/incidents?/${action}`, {
				method: "POST",
				body: formData,
			});
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

	// --- Cetak ringkasan ----------------------------------------------------
	function cetakRingkasan() {
		if (insidenTersaring.length === 0) {
			toast.error("Tidak ada insiden pada cakupan wilayah ini untuk dicetak.");
			return;
		}
		const headers = [
			"Prioritas",
			"Keparahan",
			"Lokasi",
			"Kamera",
			"Kecamatan",
			"Kota",
			"Jenis Sampah",
			"Kepercayaan (%)",
			"Durasi (menit)",
			"Status",
			"Status SLA",
			"Petugas",
			"Pertama Terlihat",
		];
		const rows = insidenTersaring.map((i) => [
			i.skorPrioritas,
			i.keparahan,
			i.lokasi,
			i.namaKamera,
			i.kecamatan,
			i.kabupatenKota,
			i.labelSampah,
			Math.round(i.tingkatKepercayaan * 100),
			i.durasiMenit,
			i.status,
			i.statusSla,
			i.petugasDitugaskan ?? "Belum ditugaskan",
			new Date(i.pertamaDilihat).toLocaleString("id-ID"),
		]);
		const cakupan =
			kabupatenDipilih !== "SEMUA"
				? kabupatenDipilih
				: provinsiDipilih !== "SEMUA"
					? provinsiDipilih
					: "Nasional";
		
		const title = `Ringkasan Pemantauan Sampah ${cakupan}`;
		triggerPdfReportPrint(title, data.user.name, headers, rows);
	}
</script>

<svelte:head>
	<title>Dashboard Pemantauan Sampah - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header dengan pemilih cakupan wilayah -->
	<div
		class="border-border/60 flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div>
			{#if data.demoData}
				<div
					class="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
				>
					<AlertTriangleIcon class="mt-0.5 size-3.5 shrink-0" />
					<p>
						Instans ini berjalan dalam <strong>mode demo</strong> — data insiden, petugas, dan skor
						wilayah adalah data contoh yang direset berkala.
					</p>
				</div>
			{/if}
			<div class="flex flex-wrap items-center gap-2">
				<h1 class="text-foreground text-3xl font-extrabold tracking-tight">
					{sapaan}, {data.user.name}
				</h1>
				<Badge
					variant="outline"
					class="border-emerald-600/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
				>
					<ShieldCheckIcon class="mr-1 size-3.5" />
					{data.user.role === "admin"
						? "Akses Admin"
						: data.user.role === "operator"
							? "Akses Operator"
							: data.user.role === "kepala_seksi"
								? "Akses Kepala Seksi"
								: data.user.role === "kepala_dinas"
									? "Akses Kepala Dinas"
									: data.user.role === "walikota"
										? "Akses Wali Kota"
										: data.user.role === "petugas_lapangan"
											? "Akses Petugas Lapangan"
											: "Akses Pemantau"}
				</Badge>
			</div>
			<p class="text-muted-foreground mt-1 text-sm">
				Pemantauan sampah liar lewat CCTV, penugasan armada kebersihan, dan rekam jejak sistem.
			</p>
		</div>

		<!-- Selector wilayah (provinsi & kabupaten/kota) -->
		<div class="flex flex-wrap items-center gap-2">
			<div
				class="bg-card flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xs"
			>
				<GlobeIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<label for="filter-provinsi" class="text-muted-foreground font-semibold">Provinsi:</label>
				<select
					id="filter-provinsi"
					bind:value={provinsiDipilih}
					class="text-foreground bg-transparent text-xs font-bold focus:outline-hidden"
				>
					<option value="SEMUA">Seluruh Indonesia</option>
					{#each data.provinsiList as prov (prov.id)}
						<option value={prov.nama}>{prov.nama}</option>
					{/each}
				</select>
			</div>

			<div
				class="bg-card flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xs"
			>
				<FilterIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<label for="filter-kota" class="text-muted-foreground font-semibold">Kota:</label>
				<select
					id="filter-kota"
					bind:value={kabupatenDipilih}
					class="text-foreground bg-transparent text-xs font-bold focus:outline-hidden"
				>
					<option value="SEMUA">Semua Kota/Kabupaten</option>
					{#each kabupatenTersedia as kab (kab.id)}
						<option value={kab.nama}>{kab.nama}</option>
					{/each}
				</select>
			</div>

			<Button
				variant="default"
				size="sm"
				class="h-9 text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800"
				onclick={cetakRingkasan}
			>
				<PrinterIcon class="mr-1.5 size-3.5" />
				Cetak Laporan PDF
			</Button>
		</div>
	</div>

	{#if adaFilter && kameraTersaring.length === 0}
		<div
			class="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm"
		>
			<AlertTriangleIcon class="size-4 shrink-0" />
			Belum ada kamera CCTV terpasang pada cakupan wilayah ini — cakupan pemantauan saat ini hanya
			Kota Bandung.
		</div>
	{/if}

	<!-- Baris 1: Kartu metrik utama -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat (stat.title)}
			<Card.Root
				class="border-border/80 relative overflow-hidden shadow-sm transition-all hover:shadow-md"
			>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
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
					<div class="mt-2 flex flex-wrap items-center justify-between gap-1">
						<span class="text-muted-foreground text-xs font-medium">{stat.subtitle}</span>
						<span
							class={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${stat.catatanBg}`}
						>
							{stat.catatan}
						</span>
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<!-- Baris 2: Tayangan CCTV langsung + tren deteksi -->
	<div class="grid items-stretch gap-6 lg:grid-cols-12">
		<div class="min-w-0 lg:col-span-5 h-full flex flex-col">
			<CctvPlayer kameraList={kameraTersaring} />
		</div>

		<Card.Root class="border-border/80 min-w-0 shadow-md lg:col-span-7 h-full flex flex-col">
			<Card.Header class="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<ActivityIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
						<Card.Title class="text-xl font-bold tracking-tight">
							Tren Deteksi &amp; Pengangkutan Sampah
						</Card.Title>
					</div>
					<Card.Description class="text-xs">
						Sebaran per jam insiden yang terdeteksi hari ini dibanding yang sudah terangkut.
					</Card.Description>
				</div>
			</Card.Header>

			<Card.Content class="flex-1 flex flex-col justify-center">
				<!-- Satu titik data tidak membentuk garis: AreaChart hanya menggambar
				     satu dot di kanvas kosong, yang terbaca seperti grafik rusak.
				     Di bawah 2 titik, tampilkan angkanya langsung. -->
				{#if trendData.length < 2}
					<div
						class="flex h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed"
					>
						<ActivityIcon class="text-muted-foreground size-8 stroke-1" />
						{#if trendData.length === 0}
							<p class="text-muted-foreground text-sm">Belum ada insiden yang terdeteksi hari ini.</p>
							<p class="text-muted-foreground max-w-sm text-center text-xs">
								Grafik ini terisi setelah siklus deteksi CCTV berjalan (otomatis 12:00 &amp; 15:00
								WIB).
							</p>
						{:else}
							<div class="flex items-center gap-8">
								<div class="text-center">
									<p class="text-2xl font-extrabold">{trendData[0].active}</p>
									<p class="text-muted-foreground text-xs">Insiden aktif</p>
								</div>
								<div class="text-center">
									<p class="text-2xl font-extrabold">{trendData[0].resolved}</p>
									<p class="text-muted-foreground text-xs">Sudah terangkut</p>
								</div>
							</div>
							<p class="text-muted-foreground text-xs">
								Seluruh deteksi hari ini jatuh pada satu jam ({trendData[0].time}) — grafik per jam
								tampil setelah ada minimal dua jam berbeda.
							</p>
						{/if}
					</div>
				{:else}
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
				{/if}
				{#if insidenTersaring.length > 0}
					<div class="border-t px-4 py-3 space-y-2">
						<p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">10 Alert Terbaru (prioritas tertinggi)</p>
						<div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
							{#each insidenTersaring.slice(0, 10) as ins (ins.id)}
								<a href="/dashboard/incidents/{ins.id}" class="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/60 transition">
									<span class="flex items-center gap-2 min-w-0">
										<span class="size-2 rounded-full shrink-0 {ins.keparahan==='KRITIS' ? 'bg-red-600' : ins.keparahan==='TINGGI' ? 'bg-amber-500' : 'bg-blue-500'}"></span>
										<span class="font-semibold truncate">{ins.lokasi}</span>
										<span class="text-muted-foreground truncate hidden sm:inline">· {ins.labelSampah}</span>
									</span>
									<span class="flex items-center gap-2 shrink-0">
										<span class="font-mono font-bold {ins.skorPrioritas>=75 ? 'text-red-600' : ins.skorPrioritas>=55 ? 'text-amber-600' : 'text-muted-foreground'}">{ins.skorPrioritas}</span>
										<Badge variant="outline" class="text-[10px] px-1 py-0">{ins.statusSla === 'MELANGGAR_SLA' ? 'SLA' : ins.keparahan}</Badge>
									</span>
								</a>
							{/each}
						</div>
						<a href="/dashboard/incidents" class="text-xs font-semibold text-emerald-600 hover:underline">Lihat semua insiden →</a>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Baris 3: Peta titik rawan (butuh lebar penuh agar sebaran terbaca) -->
	<HotspotMap kameraList={kameraTersaring} insidenList={insidenTersaring} />

	<!-- Baris 4: Daftar peringatan insiden — dibatasi, daftar penuh di /incidents -->
	<IncidentTable
		insidenList={insidenTersaring}
		petugasList={data.petugasList}
		batasBaris={BATAS_INSIDEN}
		hrefSemua="/dashboard/incidents"
		onSelesaikanTugas={handleSelesaikanTugas}
		onTugaskanPetugas={handleTugaskanPetugas}
		onTandaiPositifPalsu={handleTandaiPositifPalsu}
	/>

	<!-- Baris 5: Klasemen kebersihan wilayah -->
	<AreaSummary
		skorWilayahList={skorWilayahTersaring}
		batasBaris={10}
		hrefSemua="/dashboard/area-ranking"
	/>

	<!-- Baris 6: Log audit & rekam jejak sistem (khusus admin) -->
	{#if data.user.role === "admin"}
		<Card.Root class="border-border/80 shadow-md">
			<Card.Header class="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-3">
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<ShieldCheckIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
						<Card.Title class="text-xl font-bold tracking-tight">
							Log Audit &amp; Rekam Jejak Aktivitas Sistem
						</Card.Title>
					</div>
					<Card.Description class="text-xs">
						{BATAS_AUDIT} aktivitas terbaru — deteksi AI, penugasan petugas, dan keputusan operator.
					</Card.Description>
				</div>
				<a
					href="/dashboard/audit"
					class="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
				>
					Lihat seluruh log audit &rarr;
				</a>
			</Card.Header>
			<Card.Content>
				<div class="space-y-2.5">
					{#each data.auditLogList.slice(0, BATAS_AUDIT) as log (log.id)}
						<div
							class="bg-card flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-xs shadow-xs"
						>
							<div class="flex min-w-0 flex-col gap-0.5">
								<div class="flex flex-wrap items-center gap-2">
									<span class="text-foreground font-bold">{log.tindakan}</span>
									<Badge variant="outline" class="font-mono text-[9px]">{log.tipe}</Badge>
								</div>
								<p class="text-muted-foreground">{log.rincian}</p>
								<span class="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
									{log.wilayah}
								</span>
							</div>
							<div class="shrink-0 text-right">
								<span class="font-bold text-slate-700 dark:text-slate-300">{log.pengguna}</span>
								<p class="text-muted-foreground text-[10px]">
									{new Date(log.waktu).toLocaleString("id-ID", {
										day: "2-digit",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</p>
							</div>
						</div>
					{:else}
						<p class="text-muted-foreground py-6 text-center text-xs">
							Belum ada aktivitas tercatat.
						</p>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
