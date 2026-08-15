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
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-12">
	<div class="text-center">
		<h1 class="text-3xl font-extrabold tracking-tight">Lapor Sampah Jalanan</h1>
		<p class="mt-2 text-muted-foreground">
			Foto atau video penumpukan sampah liar, sertakan lokasi, dan kirim. Tim kebersihan akan
			menindaklanjuti.
		</p>
	</div>

	<Card.Root class="mt-8">
		<Card.Content>
			<form method="POST" enctype="multipart/form-data" use:enhance class="space-y-5">
				<input type="hidden" name="latitude" value={latitude} />
				<input type="hidden" name="longitude" value={longitude} />
				<input type="text" name="website" class="hidden" tabindex="-1" autocomplete="off" />

				<div class="space-y-2">
					<Label.Root>Lampiran (foto atau video — minimal satu)</Label.Root>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-lg border border-dashed p-4">
							<Label.Root
								for="foto"
								class="flex cursor-pointer flex-col items-center gap-1 text-center"
							>
								<CameraIcon class="size-6 text-emerald-600" />
								<span class="text-sm font-medium">Foto (JPG/PNG, maks 5 MB)</span>
							</Label.Root>
							<input
								id="foto"
								name="foto"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								class="mt-2 w-full text-xs"
							/>
						</div>
						<div class="rounded-lg border border-dashed p-4">
							<Label.Root
								for="video"
								class="flex cursor-pointer flex-col items-center gap-1 text-center"
							>
								<VideoIcon class="size-6 text-emerald-600" />
								<span class="text-sm font-medium">Video (MP4, maks 20 MB)</span>
							</Label.Root>
							<input
								id="video"
								name="video"
								type="file"
								accept="video/mp4,video/webm,video/quicktime"
								class="mt-2 w-full text-xs"
							/>
						</div>
					</div>
				</div>

				<div class="space-y-2">
					<Label.Root>Lokasi</Label.Root>
					<div class="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onclick={ambilLokasi}>
							<MapPinIcon class="mr-1 size-4" />
							{lokasiTerkunci ? `GPS: ${latitude}, ${longitude}` : "Deteksi GPS Saya"}
						</Button>
						{#if gpsError}
							<span class="text-xs text-amber-600">{gpsError}</span>
						{/if}
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<Input.Root name="kota" placeholder="Kota (mis. Bandung)" />
						</div>
						<div>
							<Input.Root name="kecamatan" placeholder="Kecamatan (opsional)" />
						</div>
					</div>
				</div>

				<div class="space-y-2">
					<Label.Root>Jenis sampah</Label.Root>
					<Select.Root type="single" name="jenisSampah">
						<Select.Trigger class="w-full"><span>Pilih jenis</span></Select.Trigger>
						<Select.Content>
							{#each jenisSampahOptions as opt}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label.Root>Deskripsi (opsional)</Label.Root>
					<Textarea
						name="deskripsi"
						rows={3}
						placeholder="Contoh: tumpukan sampah sudah 3 hari, dekat lampu merah"
					/>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-2">
						<Label.Root>Nama (opsional)</Label.Root>
						<Input.Root name="pelaporNama" placeholder="Nama Anda" />
					</div>
					<div class="space-y-2">
						<Label.Root>Telepon (opsional)</Label.Root>
						<Input.Root name="pelaporTelepon" placeholder="08xx — untuk follow-up" />
					</div>
				</div>

				{#if form?.message}
					<p class="text-sm text-red-600">{form.message}</p>
				{/if}

				<Button
					type="submit"
					size="lg"
					class="w-full bg-emerald-600 text-white hover:bg-emerald-700"
				>
					Kirim Laporan
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
