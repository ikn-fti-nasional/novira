<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { mode } from "mode-watcher";
	import type { Kamera, Insiden } from "$lib/types/novira.js";
	// `MarkerClusterGroup` datang dari augmentasi modul `leaflet` oleh
	// @types/leaflet.markercluster, bukan sebagai ekspor paket tersendiri.
	import type { Map as LeafletMap, LayerGroup, TileLayer, MarkerClusterGroup } from "leaflet";

	type Props = {
		kameraList: Kamera[];
		insidenList: Insiden[];
	};

	let { kameraList, insidenList }: Props = $props();

	type Lapisan = "semua" | "insiden" | "kamera";
	let lapisanAktif = $state<Lapisan>("semua");

	let wadah = $state<HTMLDivElement | null>(null);
	let peta: LeafletMap | null = null;
	let lapisanUbin: TileLayer | null = null;
	let lapisanKamera: MarkerClusterGroup | null = null;
	let lapisanInsiden: LayerGroup | null = null;
	let siap = $state(false);

	/**
	 * Hanya insiden yang benar-benar punya koordinat yang bisa dipetakan.
	 * Insiden tanpa koordinat TIDAK digambar di titik tebakan mana pun —
	 * penanda di lokasi keliru jauh lebih berbahaya daripada penanda yang
	 * tidak ada, karena petugas akan dikirim ke sana.
	 */
	const insidenTerpetakan = $derived(
		insidenList.filter(
			(i) =>
				i.latitude !== null &&
				i.longitude !== null &&
				(i.status === "AKTIF" || i.status === "PERINGATAN")
		)
	);
	const insidenTanpaKoordinat = $derived(
		insidenList.filter(
			(i) =>
				(i.status === "AKTIF" || i.status === "PERINGATAN") &&
				(i.latitude === null || i.longitude === null)
		).length
	);
	const kameraTerpetakan = $derived(
		kameraList.filter((k) => Number.isFinite(k.latitude) && Number.isFinite(k.longitude) && k.latitude !== 0)
	);

	/** Ubin gelap/terang dari CARTO — dipilih supaya penanda berwarna tetap terbaca di kedua tema. */
	function urlUbin(gelap: boolean): string {
		return gelap
			? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
			: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
	}

	const ATRIBUSI =
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; ubin <a href="https://carto.com/attributions">CARTO</a>';

	function warnaKeparahan(i: Insiden): string {
		if (i.statusSla === "MELANGGAR_SLA") return "#dc2626";
		if (i.keparahan === "KRITIS") return "#dc2626";
		if (i.keparahan === "TINGGI") return "#ea580c";
		if (i.keparahan === "SEDANG") return "#2563eb";
		return "#64748b";
	}

	function warnaKamera(k: Kamera): string {
		if (k.status !== "ONLINE") return "#94a3b8";
		if (k.statusDeteksi === "KRITIS") return "#dc2626";
		if (k.statusDeteksi === "PERINGATAN") return "#f59e0b";
		return "#059669";
	}

	/** Radius penanda insiden mengikuti skor prioritas — mata membaca ukuran lebih cepat daripada warna. */
	function radiusInsiden(skor: number): number {
		return 8 + Math.round((Math.max(0, Math.min(100, skor)) / 100) * 14);
	}

	function esc(t: string): string {
		return t.replace(/[&<>"']/g, (c) =>
			c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
		);
	}

	function durasi(menit: number): string {
		if (menit < 60) return `${menit} menit`;
		const jam = Math.floor(menit / 60);
		if (jam < 24) return `${jam} jam`;
		return `${Math.floor(jam / 24)} hari ${jam % 24} jam`;
	}

	$effect(() => {
		if (!wadah) return;
		let dibatalkan = false;
		let bersihkan: (() => void) | undefined;

		// Leaflet menyentuh `window` saat diimpor, jadi wajib dimuat dinamis di
		// klien — impor statis akan menggagalkan render sisi server.
		(async () => {
			const L = (await import("leaflet")).default;
			await import("leaflet/dist/leaflet.css");
			await import("leaflet.markercluster");
			await import("leaflet.markercluster/dist/MarkerCluster.css");
			await import("leaflet.markercluster/dist/MarkerCluster.Default.css");
			if (dibatalkan || !wadah) return;

			const m = L.map(wadah, { scrollWheelZoom: false, attributionControl: true });
			peta = m;

			// Pane khusus insiden di atas pane penanda. Tanpa ini, cluster kamera
			// (yang tinggal di markerPane) menutupi penanda insiden yang digambar
			// sebagai circleMarker di overlayPane -- justru menyembunyikan
			// informasi terpenting di peta ini di balik informasi latarnya.
			m.createPane("insiden");
			const paneInsiden = m.getPane("insiden");
			if (paneInsiden) paneInsiden.style.zIndex = "650";
			lapisanUbin = L.tileLayer(urlUbin(mode.current === "dark"), {
				attribution: ATRIBUSI,
				maxZoom: 19,
			}).addTo(m);

			// Kamera dikelompokkan: 290 penanda di pusat kota akan saling
			// menimpa sampai tak terbaca kalau digambar satu per satu.
			lapisanKamera = L.markerClusterGroup({
				maxClusterRadius: 45,
				disableClusteringAtZoom: 17,
				chunkedLoading: true,
			});
			lapisanInsiden = L.layerGroup();

			m.addLayer(lapisanKamera);
			m.addLayer(lapisanInsiden);
			gambarUlang(L);

			// Bingkai awal mengikuti sebaran kamera yang ada, bukan koordinat
			// Bandung yang dipatok keras — supaya tetap benar kalau cakupan
			// kamera diperluas ke kota lain.
			const titik = kameraTerpetakan.map((k) => [k.latitude, k.longitude] as [number, number]);
			if (titik.length > 0) m.fitBounds(L.latLngBounds(titik).pad(0.08));
			else m.setView([-6.9175, 107.6191], 13);

			siap = true;
			bersihkan = () => {
				m.remove();
				peta = null;
				lapisanKamera = null;
				lapisanInsiden = null;
				lapisanUbin = null;
				siap = false;
			};
		})();

		return () => {
			dibatalkan = true;
			bersihkan?.();
		};
	});

	async function gambarUlang(Lmod?: typeof import("leaflet")) {
		const L = Lmod ?? (await import("leaflet")).default;
		if (!lapisanKamera || !lapisanInsiden) return;

		lapisanKamera.clearLayers();
		lapisanInsiden.clearLayers();

		for (const k of kameraTerpetakan) {
			const warna = warnaKamera(k);
			L.circleMarker([k.latitude, k.longitude], {
				radius: 5,
				color: warna,
				weight: 1.5,
				fillColor: warna,
				fillOpacity: 0.65,
			})
				.bindPopup(
					`<strong>${esc(k.nama)}</strong><br>` +
						`${esc([k.kelurahan, k.kecamatan].filter(Boolean).join(", "))}<br>` +
						`<span style="opacity:.7">Status: ${esc(k.status)} &middot; ${k.jumlahObjekTerdeteksi} insiden terbuka</span>`
				)
				.addTo(lapisanKamera);
		}

		for (const i of insidenTerpetakan) {
			const warna = warnaKeparahan(i);
			L.circleMarker([i.latitude as number, i.longitude as number], {
				pane: "insiden",
				radius: radiusInsiden(i.skorPrioritas),
				color: warna,
				weight: 2.5,
				fillColor: warna,
				fillOpacity: 0.45,
			})
				.bindPopup(
					`<strong>${esc(i.namaKamera)}</strong><br>` +
						`${esc(i.labelSampah)} &middot; ${esc(i.keparahan)}<br>` +
						`Prioritas <strong>${i.skorPrioritas}/100</strong><br>` +
						`Dibiarkan ${esc(durasi(i.durasiMenit))}<br>` +
						(i.statusSla === "MELANGGAR_SLA"
							? '<span style="color:#dc2626;font-weight:600">Melanggar SLA</span><br>'
							: "") +
						(i.sumber === "LAPORAN_WARGA"
							? `<span style="opacity:.7">Dari laporan warga${i.kodeLaporan ? " " + esc(i.kodeLaporan) : ""}</span><br>`
							: "") +
						`<a href="/dashboard/incidents/${encodeURIComponent(i.id)}">Buka insiden &rarr;</a>`
				)
				.addTo(lapisanInsiden);
		}
	}

	// Ganti ubin saat tema berubah, tanpa membangun ulang seluruh peta.
	$effect(() => {
		const gelap = mode.current === "dark";
		if (!peta || !lapisanUbin) return;
		lapisanUbin.setUrl(urlUbin(gelap));
	});

	// Data ikut berubah tiap invalidateAll() dari halaman induk.
	$effect(() => {
		void kameraTerpetakan;
		void insidenTerpetakan;
		if (siap) void gambarUlang();
	});

	// Tampilkan/sembunyikan lapisan sesuai tombol, tanpa menggambar ulang isinya.
	//
	// `lapisanAktif` dan `siap` WAJIB dibaca sebelum penjagaan di bawahnya.
	// Peta dibangun secara asinkron, jadi pada eksekusi pertama `peta` masih
	// null; kalau efek ini keluar lebih dulu, Svelte tidak pernah mencatat
	// `lapisanAktif` sebagai dependensi dan tombol lapisan menjadi mati
	// seluruhnya. `siap` adalah state reaktif yang memicu efek ini berjalan
	// ulang begitu peta selesai terbentuk.
	$effect(() => {
		const pilihan = lapisanAktif;
		const petaSiap = siap;
		if (!petaSiap || !peta || !lapisanKamera || !lapisanInsiden) return;
		const tampilKamera = pilihan === "semua" || pilihan === "kamera";
		const tampilInsiden = pilihan === "semua" || pilihan === "insiden";
		if (tampilKamera) peta.addLayer(lapisanKamera);
		else peta.removeLayer(lapisanKamera);
		if (tampilInsiden) peta.addLayer(lapisanInsiden);
		else peta.removeLayer(lapisanInsiden);
	});

	const TOMBOL: { nilai: Lapisan; label: string }[] = [
		{ nilai: "semua", label: "Semua" },
		{ nilai: "insiden", label: "Titik rawan" },
		{ nilai: "kamera", label: "Kamera" },
	];
</script>

<Card.Root class="border-border/80 shadow-md">
	<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
		<div class="min-w-0">
			<Card.Title class="text-xl font-bold tracking-tight">Peta Titik Rawan Sampah</Card.Title>
			<Card.Description class="text-xs">
				{kameraTerpetakan.length} kamera terpetakan &middot; {insidenTerpetakan.length} insiden terbuka
				berkoordinat
			</Card.Description>
		</div>

		<div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
			{#each TOMBOL as t (t.nilai)}
				<Button
					variant={lapisanAktif === t.nilai ? "secondary" : "ghost"}
					size="sm"
					class="h-7 px-2 text-xs font-medium"
					onclick={() => (lapisanAktif = t.nilai)}
				>
					{t.label}
				</Button>
			{/each}
		</div>
	</Card.Header>

	<Card.Content class="p-0">
		<div class="relative">
			<div
				bind:this={wadah}
				class="h-[520px] w-full bg-muted lg:h-[620px]"
				role="application"
				aria-label="Peta sebaran kamera CCTV dan titik rawan sampah"
			></div>

			{#if !siap}
				<div
					class="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/70 text-sm text-muted-foreground"
				>
					Memuat peta…
				</div>
			{/if}

			<!-- Legenda -->
			<div
				class="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border bg-background/92 p-2.5 text-[10px] shadow-md backdrop-blur-sm"
			>
				<p class="mb-1.5 font-bold uppercase tracking-wider text-muted-foreground">Keterangan</p>
				<div class="flex flex-col gap-1">
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full" style="background:#dc2626"></span>
						Kritis / melanggar SLA
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full" style="background:#ea580c"></span>
						Keparahan tinggi
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full" style="background:#2563eb"></span>
						Keparahan sedang
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full" style="background:#059669"></span>
						Kamera normal
					</span>
					<span class="mt-1 border-t pt-1 text-muted-foreground">
						Ukuran lingkaran = skor prioritas
					</span>
				</div>
			</div>
		</div>

		{#if insidenTanpaKoordinat > 0}
			<p class="border-t px-4 py-2 text-xs text-muted-foreground">
				{insidenTanpaKoordinat} insiden terbuka tidak ditampilkan karena tidak memiliki koordinat —
				sengaja tidak digambar di titik perkiraan agar petugas tidak dikirim ke lokasi yang keliru.
			</p>
		{:else if siap && insidenTerpetakan.length === 0}
			<p class="border-t px-4 py-2 text-xs text-muted-foreground">
				Belum ada insiden terbuka. Penanda kamera menunjukkan cakupan pemantauan saat ini.
			</p>
		{/if}
	</Card.Content>
</Card.Root>
