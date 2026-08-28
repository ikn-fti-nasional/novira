<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { enhance } from "$app/forms";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import SendIcon from "@lucide/svelte/icons/send";
	import LeafIcon from "@lucide/svelte/icons/leaf";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import type { Map as LeafletMap, Marker } from "leaflet";
	import { resizeFoto, analisaFotoLangsung, type DeteksiUnggahan } from "$lib/plitter-client.js";

	let { data, form } = $props();

	const DEFAULT_CENTER: [number, number] = [-6.9175, 107.6191]; // Bandung — dipakai saat GPS ditolak/gagal

	let latitude = $state("");
	let longitude = $state("");
	let lokasiTerkunci = $state(false);
	let gpsError = $state("");
	let mencariLokasi = $state(true);

	let fotoInput = $state<HTMLInputElement | null>(null);
	let mengompres = $state(false);
	let ukuranFotoKb = $state<number | null>(null);
	let mengirim = $state(false);
	/** Hasil pindai pLitter dari browser -- dikirim sebagai JSON lewat field tersembunyi `aiDeteksi`. */
	let aiDeteksiJson = $state("");
	let memindai = $state(false);
	/** Foto beranotasi (kotak deteksi) dari pLitter -- disisipkan ke FormData sebelum form dikirim. */
	let fotoAnalisa: File | null = $state(null);
	let previewUrl = $state("");

	/** State lokal: tanpa `bind:value`, label pemicu Select tidak ikut berubah. */
	let jenisSampah = $state("");

	const jenisSampahOptions = [
		{ value: "tumpukan_sampah", label: "Tumpukan sampah" },
		{ value: "kantong_plastik", label: "Kantong plastik" },
		{ value: "kardus_kemasan", label: "Kardus/kemasan" },
		{ value: "botol_minuman", label: "Botol minuman" },
		{ value: "pembuangan_liar_besar", label: "Pembuangan liar besar" },
		{ value: "puing_bangunan", label: "Puing bangunan" },
	];

	/**
	 * Foto dari kamera ponsel bisa 8-12 MB. Server tidak memaksa batas ukuran
	 * ke pengguna -- setiap foto diresize di browser jadi JPEG beresolusi
	 * wajar (lihat `resizeFoto`), lalu dikirim LANGSUNG ke pLitter dari sini
	 * juga -- server Novira tidak pernah menyentuh isinya untuk dianalisa,
	 * hanya menyimpan hasilnya lewat field tersembunyi `aiDeteksi`.
	 */
	async function tanganiPilihFoto(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			ukuranFotoKb = null;
			aiDeteksiJson = "";
			return;
		}

		mengompres = true;
		aiDeteksiJson = "";
		fotoAnalisa = null;
		let dikirim = file;
		try {
			dikirim = await resizeFoto(file);
			const dt = new DataTransfer();
			dt.items.add(dikirim);
			input.files = dt.files;
			ukuranFotoKb = Math.round(dikirim.size / 1024);

			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(dikirim);
		} catch {
			// Resize gagal (mis. format tidak didukung createImageBitmap) --
			// kirim berkas asli apa adanya daripada memblokir laporan warga.
			ukuranFotoKb = Math.round(file.size / 1024);

			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(file);
		} finally {
			mengompres = false;
		}

		memindai = true;
		try {
			const hasil = await analisaFotoLangsung(dikirim, {
				modelType: data.modelType,
				confThres: data.confThres,
			});
			aiDeteksiJson = JSON.stringify(
				hasil.deteksi.map((d: DeteksiUnggahan) => ({ className: d.className, score: d.score }))
			);
			const annotatedRes = await fetch(hasil.annotatedDataUrl);
			const annotatedBlob = await annotatedRes.blob();
			fotoAnalisa = new File([annotatedBlob], "hasil-analisa.jpg", { type: "image/jpeg" });
		} catch (err) {
			// Pemindaian gagal (pLitter tidak terjangkau, dst) -- laporan tetap
			// bisa dikirim, operator akan menilai manual (lihat GAGAL_PINDAI).
			console.error("[novira] Pindai foto dari browser gagal:", err);
			aiDeteksiJson = "";
		} finally {
			memindai = false;
		}
	}

	function ambilLokasi() {
		if (!navigator.geolocation) {
			gpsError = "Browser tidak mendukung GPS — geser pin pada peta secara manual.";
			mencariLokasi = false;
			return;
		}
		mencariLokasi = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setLokasi(pos.coords.latitude, pos.coords.longitude);
				mencariLokasi = false;
			},
			() => {
				gpsError = "Gagal mendapat GPS — geser pin pada peta ke lokasi sampah.";
				mencariLokasi = false;
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}

	function setLokasi(lat: number, lon: number) {
		latitude = lat.toFixed(6);
		longitude = lon.toFixed(6);
		lokasiTerkunci = true;
		gpsError = "";
		if (peta && penanda) {
			penanda.setLatLng([lat, lon]);
			peta.setView([lat, lon], Math.max(peta.getZoom(), 16));
		}
	}

	let petaWadah = $state<HTMLDivElement | null>(null);
	let peta: LeafletMap | null = null;
	let penanda: Marker | null = null;

	// Peta pemilih lokasi -- default ke GPS pengguna kalau diizinkan, jatuh ke
	// pusat kota kalau tidak. Leaflet menyentuh `window` saat diimpor, jadi
	// wajib dimuat dinamis di klien (lihat pola sama di hotspot-map.svelte).
	$effect(() => {
		if (!petaWadah) return;
		let dibatalkan = false;

		(async () => {
			const L = (await import("leaflet")).default;
			await import("leaflet/dist/leaflet.css");
			if (dibatalkan || !petaWadah) return;

			const m = L.map(petaWadah, { scrollWheelZoom: false, dragging: true }).setView(
				DEFAULT_CENTER,
				13
			);
			// Hint untuk desktop: ctrl+scroll. Mobile tetap drag.
			m.getContainer().addEventListener("wheel", (e: WheelEvent) => {
				if (e.ctrlKey || e.metaKey) {
					e.preventDefault();
					m.scrollWheelZoom.enable();
				} else {
					m.scrollWheelZoom.disable();
				}
			});
			m.on("click", () => m.scrollWheelZoom.enable());
			m.on("mouseout", () => m.scrollWheelZoom.disable());
			peta = m;
			L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &middot; ubin <a href="https://carto.com/attributions">CARTO</a>',
				maxZoom: 19,
			}).addTo(m);

			const p = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(m);
			penanda = p;
			p.on("dragend", () => {
				const { lat, lng } = p.getLatLng();
				setLokasi(lat, lng);
			});
			m.on("click", (ev: any) => {
				setLokasi(ev.latlng.lat, ev.latlng.lng);
			});

			// Coba GPS begitu peta siap -- ini yang membuat peta "default ke GPS"
			// alih-alih pusat kota generik.
			ambilLokasi();
		})();

		return () => {
			dibatalkan = true;
			peta?.remove();
			peta = null;
			penanda = null;
		};
	});
</script>

<svelte:head>
	<title>Lapor Sampah - Novira</title>
	<meta
		name="description"
		content="Formulir pelaporan sampah liar. Upload foto, kirim lokasi GPS, dan laporan akan diproses tim kebersihan kota."
	/>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12 md:py-16">
	<!-- Header halaman -->
	<div class="mb-10 text-center">
		<div
			class="mb-4 inline-flex size-14 items-center justify-center rounded-2xl shadow-lg"
			style="background: linear-gradient(135deg, oklch(0.50 0.18 145), oklch(0.60 0.17 160));"
		>
			<LeafIcon class="size-7 text-white" />
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight md:text-4xl">Lapor Sampah Jalanan</h1>
		<p class="text-muted-foreground mx-auto mt-3 max-w-md">
			Foto penumpukan sampah liar, sertakan lokasi, dan kirim. Tim kebersihan kota akan
			menindaklanjutinya.
		</p>
	</div>

	<!-- Panduan singkat -->
	<div class="mb-8 grid grid-cols-3 gap-3">
		{#each [{ icon: CameraIcon, label: "Upload bukti foto" }, { icon: MapPinIcon, label: "Tandai lokasi" }, { icon: SendIcon, label: "Kirim laporan" }] as tip}
			{@const TipIcon = tip.icon}
			<div
				class="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center"
			>
				<TipIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
				<span class="text-muted-foreground text-[11px] leading-tight font-medium">{tip.label}</span>
			</div>
		{/each}
	</div>

	<!-- Card Form -->
	<Card.Root
		class="border-border/60 bg-card/80 rounded-2xl shadow-xl shadow-emerald-500/5 backdrop-blur-sm"
	>
		<Card.Content class="p-6 md:p-8">
			<form
				method="POST"
				enctype="multipart/form-data"
				use:enhance={({ formData }) => {
					mengirim = true;
					if (fotoAnalisa) formData.set("aiFotoAnalisa", fotoAnalisa);
					return async ({ update }) => {
						await update();
						mengirim = false;
					};
				}}
				class="space-y-6"
			>
				<input type="hidden" name="latitude" value={latitude} />
				<input type="hidden" name="longitude" value={longitude} />
				<input type="hidden" name="aiDeteksi" value={aiDeteksiJson} />
				<input type="hidden" name="aiModelType" value={data.modelType} />
				<input type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" />

				<!-- Upload foto -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">
						Foto bukti
						<span class="text-muted-foreground ml-1 font-normal">(wajib)</span>
					</Label.Root>
					<div
						class="group border-border/80 bg-muted/30 rounded-xl border border-dashed p-5 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5"
					>
						<Label.Root
							for="foto"
							class="flex cursor-pointer flex-col items-center gap-2 text-center"
						>
							{#if previewUrl}
								<div
									class="border-border/80 relative aspect-video w-full overflow-hidden rounded-lg border"
								>
									<img src={previewUrl} alt="Preview Foto" class="h-full w-full object-cover" />
									{#if mengompres || memindai}
										<div
											class="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-sm"
										>
											<LoaderCircleIcon
												class="size-8 animate-spin text-emerald-600 dark:text-emerald-400"
											/>
										</div>
									{/if}
								</div>
								<div>
									<span class="block text-sm font-semibold">Ganti Foto</span>
								</div>
							{:else}
								<div
									class="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20"
								>
									{#if mengompres || memindai}
										<LoaderCircleIcon
											class="size-5 animate-spin text-emerald-600 dark:text-emerald-400"
										/>
									{:else}
										<CameraIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
									{/if}
								</div>
								<div>
									<span class="block text-sm font-semibold">Unggah Foto</span>
									<span class="text-muted-foreground text-xs">
										{#if mengompres}
											Mengompres foto…
										{:else if memindai}
											Memindai foto…
										{:else if ukuranFotoKb !== null}
											Terkompresi otomatis · {ukuranFotoKb} KB
										{:else}
											JPG / PNG / WEBP — dikompresi otomatis, ambil dari kamera langsung
										{/if}
									</span>
								</div>
							{/if}
						</Label.Root>
						<input
							bind:this={fotoInput}
							id="foto"
							name="foto"
							type="file"
							accept="image/jpeg,image/png,image/webp"
							capture="environment"
							onchange={tanganiPilihFoto}
							class="mt-3 w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-700 dark:file:text-emerald-400"
						/>
					</div>
				</div>

				<!-- Divider -->
				<div class="border-border/60 border-t border-dashed"></div>

				<!-- Lokasi -->
				<div class="space-y-3">
					<div class="flex items-center justify-between gap-2">
						<Label.Root class="text-sm font-semibold">Lokasi</Label.Root>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={ambilLokasi}
							class="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 {lokasiTerkunci
								? 'text-emerald-700 dark:text-emerald-400'
								: ''}"
						>
							{#if mencariLokasi}
								<LoaderCircleIcon class="size-4 animate-spin" />
								Mencari GPS…
							{:else if lokasiTerkunci}
								<CheckCircle2Icon class="size-4 text-emerald-600" />
								Pakai GPS Saya
							{:else}
								<MapPinIcon class="size-4" />
								Pakai GPS Saya
							{/if}
						</Button>
					</div>
					<p class="text-muted-foreground text-xs">
						Peta otomatis mengarah ke lokasi GPS Anda. Geser pin atau ketuk peta untuk mengoreksi
						titik sampah.
					</p>
					<div
						bind:this={petaWadah}
						class="border-border/60 bg-muted h-64 w-full rounded-xl border"
						role="application"
						aria-label="Peta pemilih lokasi laporan"
					></div>
					{#if lokasiTerkunci}
						<p class="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
							<CheckCircle2Icon class="size-3.5" />
							Lokasi: {latitude}, {longitude}
						</p>
					{:else if gpsError}
						<p class="text-xs text-amber-600 dark:text-amber-400">{gpsError}</p>
					{/if}
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label.Root for="kota" class="text-xs font-medium">Kota</Label.Root>
							<Input.Root id="kota" name="kota" placeholder="Kota (mis. Bandung)" />
						</div>
						<div class="space-y-1.5">
							<Label.Root for="kecamatan" class="text-xs font-medium">Kecamatan</Label.Root>
							<Input.Root id="kecamatan" name="kecamatan" placeholder="Kecamatan (opsional)" />
						</div>
					</div>
				</div>

				<!-- Divider -->
				<div class="border-border/60 border-t border-dashed"></div>

				<!-- Jenis sampah -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">Jenis sampah</Label.Root>
					<Select.Root type="single" name="jenisSampah" bind:value={jenisSampah}>
						<Select.Trigger class="w-full">
							<span>
								{jenisSampahOptions.find((o) => o.value === jenisSampah)?.label ??
									"Pilih jenis sampah"}
							</span>
						</Select.Trigger>
						<Select.Content>
							{#each jenisSampahOptions as opt}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<!-- Deskripsi -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">
						Deskripsi
						<span class="text-muted-foreground ml-1 font-normal">(opsional)</span>
					</Label.Root>
					<div class="space-y-1.5">
						<Label.Root for="deskripsi" class="text-xs font-medium"
							>Isi deskripsi kondisi</Label.Root
						>
						<Textarea
							id="deskripsi"
							name="deskripsi"
							rows={3}
							placeholder="Contoh: tumpukan sampah sudah 3 hari, dekat lampu merah Jl. Sudirman"
							class="resize-none"
						/>
					</div>
				</div>

				<!-- Divider -->
				<div class="border-border/60 border-t border-dashed"></div>

				<!-- Identitas pelapor -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">
						Identitas pelapor
						<span class="text-muted-foreground ml-1 font-normal">(opsional, untuk follow-up)</span>
					</Label.Root>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label.Root for="pelaporNama" class="text-xs font-medium">Nama</Label.Root>
							<Input.Root id="pelaporNama" name="pelaporNama" placeholder="Nama Anda" />
						</div>
						<div class="space-y-1.5">
							<Label.Root for="pelaporTelepon" class="text-xs font-medium">Telepon</Label.Root>
							<Input.Root
								id="pelaporTelepon"
								name="pelaporTelepon"
								placeholder="08xx — untuk follow-up"
							/>
						</div>
					</div>
				</div>

				{#if form?.message}
					<div
						class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20"
					>
						<p class="text-sm font-medium text-red-700 dark:text-red-400">{form.message}</p>
					</div>
				{/if}

				<Button
					type="submit"
					size="lg"
					id="btn-kirim-laporan"
					disabled={mengompres || memindai || mengirim}
					class="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01] hover:shadow-emerald-500/40"
					style="background: linear-gradient(135deg, oklch(0.50 0.18 145), oklch(0.60 0.17 160)); color: white;"
				>
					{#if mengirim}
						<LoaderCircleIcon class="size-5 animate-spin" />
						Mengirim Laporan…
					{:else}
						<SendIcon class="size-5" />
						Kirim Laporan
					{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
