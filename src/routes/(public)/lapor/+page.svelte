<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { enhance } from "$app/forms";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import VideoIcon from "@lucide/svelte/icons/video";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import SendIcon from "@lucide/svelte/icons/send";
	import LeafIcon from "@lucide/svelte/icons/leaf";

	let { form } = $props();

	let latitude = $state("");
	let longitude = $state("");
	let lokasiTerkunci = $state(false);
	let gpsError = $state("");

	const jenisSampahOptions = [
		{ value: "tumpukan_sampah", label: "Tumpukan sampah" },
		{ value: "kantong_plastik", label: "Kantong plastik" },
		{ value: "kardus_kemasan", label: "Kardus/kemasan" },
		{ value: "botol_minuman", label: "Botol minuman" },
		{ value: "pembuangan_liar_besar", label: "Pembuangan liar besar" },
		{ value: "puing_bangunan", label: "Puing bangunan" },
	];

	function ambilLokasi() {
		if (!navigator.geolocation) {
			gpsError = "Browser tidak mendukung GPS — pilih kota secara manual.";
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				latitude = pos.coords.latitude.toFixed(6);
				longitude = pos.coords.longitude.toFixed(6);
				lokasiTerkunci = true;
				gpsError = "";
			},
			() => {
				gpsError = "Gagal mendapat GPS — pilih kota secara manual.";
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}
</script>

<svelte:head>
	<title>Lapor Sampah - Novira</title>
	<meta
		name="description"
		content="Formulir pelaporan sampah liar. Upload foto/video, kirim lokasi GPS, dan laporan akan diproses tim kebersihan kota."
	/>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12 md:py-16">
	<!-- Header halaman -->
	<div class="mb-10 text-center">
		<div class="mb-4 inline-flex size-14 items-center justify-center rounded-2xl shadow-lg"
			style="background: linear-gradient(135deg, oklch(0.50 0.18 145), oklch(0.60 0.17 160));">
			<LeafIcon class="size-7 text-white" />
		</div>
		<h1 class="text-3xl font-extrabold tracking-tight md:text-4xl">
			Lapor Sampah Jalanan
		</h1>
		<p class="mx-auto mt-3 max-w-md text-muted-foreground">
			Foto atau video penumpukan sampah liar, sertakan lokasi, dan kirim. Tim kebersihan kota akan menindaklanjutinya.
		</p>
	</div>

	<!-- Panduan singkat -->
	<div class="mb-8 grid grid-cols-3 gap-3">
		{#each [
			{ icon: CameraIcon, label: "Upload bukti foto/video" },
			{ icon: MapPinIcon, label: "Tambahkan lokasi" },
			{ icon: SendIcon, label: "Kirim laporan" },
		] as tip}
			{@const TipIcon = tip.icon}
			<div class="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
				<TipIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
				<span class="text-[11px] font-medium leading-tight text-muted-foreground">{tip.label}</span>
			</div>
		{/each}
	</div>

	<!-- Card Form -->
	<Card.Root class="rounded-2xl border-border/60 bg-card/80 shadow-xl shadow-emerald-500/5 backdrop-blur-sm">
		<Card.Content class="p-6 md:p-8">
			<form method="POST" enctype="multipart/form-data" use:enhance class="space-y-6">
				<input type="hidden" name="latitude" value={latitude} />
				<input type="hidden" name="longitude" value={longitude} />
				<input type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" />

				<!-- Upload media -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">
						Lampiran
						<span class="ml-1 font-normal text-muted-foreground">(foto atau video — minimal satu)</span>
					</Label.Root>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="group rounded-xl border border-dashed border-border/80 bg-muted/30 p-5 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5">
							<Label.Root
								for="foto"
								class="flex cursor-pointer flex-col items-center gap-2 text-center"
							>
								<div class="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
									<CameraIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
								</div>
								<div>
									<span class="block text-sm font-semibold">Unggah Foto</span>
									<span class="text-xs text-muted-foreground">JPG / PNG / WEBP · maks 5 MB</span>
								</div>
							</Label.Root>
							<input
								id="foto"
								name="foto"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								class="mt-3 w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-700 dark:file:text-emerald-400"
							/>
						</div>
						<div class="group rounded-xl border border-dashed border-border/80 bg-muted/30 p-5 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/5">
							<Label.Root
								for="video"
								class="flex cursor-pointer flex-col items-center gap-2 text-center"
							>
								<div class="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 transition-colors group-hover:bg-emerald-500/20">
									<VideoIcon class="size-5 text-emerald-600 dark:text-emerald-400" />
								</div>
								<div>
									<span class="block text-sm font-semibold">Unggah Video</span>
									<span class="text-xs text-muted-foreground">MP4 / WEBM / MOV · maks 20 MB</span>
								</div>
							</Label.Root>
							<input
								id="video"
								name="video"
								type="file"
								accept="video/mp4,video/webm,video/quicktime"
								class="mt-3 w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-700 dark:file:text-emerald-400"
							/>
						</div>
					</div>
				</div>

				<!-- Divider -->
				<div class="border-t border-dashed border-border/60"></div>

				<!-- Lokasi -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">Lokasi</Label.Root>
					<div class="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={ambilLokasi}
							class="gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10 {lokasiTerkunci ? 'text-emerald-700 dark:text-emerald-400' : ''}"
						>
							{#if lokasiTerkunci}
								<CheckCircle2Icon class="size-4 text-emerald-600" />
								GPS: {latitude}, {longitude}
							{:else}
								<MapPinIcon class="size-4" />
								Deteksi GPS Saya
							{/if}
						</Button>
						{#if gpsError}
							<span class="text-xs text-amber-600 dark:text-amber-400">{gpsError}</span>
						{/if}
					</div>
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
				<div class="border-t border-dashed border-border/60"></div>

				<!-- Jenis sampah -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">Jenis sampah</Label.Root>
					<Select.Root type="single" name="jenisSampah">
						<Select.Trigger class="w-full"><span>Pilih jenis sampah</span></Select.Trigger>
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
						<span class="ml-1 font-normal text-muted-foreground">(opsional)</span>
					</Label.Root>
					<div class="space-y-1.5">
						<Label.Root for="deskripsi" class="text-xs font-medium">Isi deskripsi kondisi</Label.Root>
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
				<div class="border-t border-dashed border-border/60"></div>

				<!-- Identitas pelapor -->
				<div class="space-y-3">
					<Label.Root class="text-sm font-semibold">
						Identitas pelapor
						<span class="ml-1 font-normal text-muted-foreground">(opsional, untuk follow-up)</span>
					</Label.Root>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<Label.Root for="pelaporNama" class="text-xs font-medium">Nama</Label.Root>
							<Input.Root id="pelaporNama" name="pelaporNama" placeholder="Nama Anda" />
						</div>
						<div class="space-y-1.5">
							<Label.Root for="pelaporTelepon" class="text-xs font-medium">Telepon</Label.Root>
							<Input.Root id="pelaporTelepon" name="pelaporTelepon" placeholder="08xx — untuk follow-up" />
						</div>
					</div>
				</div>

				{#if form?.message}
					<div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
						<p class="text-sm font-medium text-red-700 dark:text-red-400">{form.message}</p>
					</div>
				{/if}

				<Button
					type="submit"
					size="lg"
					id="btn-kirim-laporan"
					class="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01] hover:shadow-emerald-500/40"
					style="background: linear-gradient(135deg, oklch(0.50 0.18 145), oklch(0.60 0.17 160)); color: white;"
				>
					<SendIcon class="size-5" />
					Kirim Laporan
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
