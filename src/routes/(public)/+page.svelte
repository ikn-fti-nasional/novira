<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import SendIcon from "@lucide/svelte/icons/send";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
</script>

<svelte:head>
	<title>Novira - Lapor Sampah Jalanan</title>
	<meta
		name="description"
		content="Laporkan penumpukan sampah liar di jalanan. Foto, kirim lokasi, dan tim kami tindak lanjuti."
	/>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-16 text-center">
	<h1 class="text-4xl font-extrabold tracking-tight md:text-5xl">
		Lapor Sampah Jalanan, <span class="text-emerald-600">Sekali Foto</span>
	</h1>
	<p class="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
		Temukan penumpukan sampah liar di sekitar Anda? Abadikan dengan kamera, kirim bersama lokasi,
		dan tim kebersihan kota akan menindaklanjutinya.
	</p>
	<div class="mt-8">
		<Button href="/lapor" size="lg">
			<Trash2Icon class="size-5" />
			Lapor Sampah Sekarang
		</Button>
	</div>
</section>

<section class="border-t bg-muted/40 py-14">
	<div class="mx-auto max-w-6xl px-4">
		<h2 class="text-center text-2xl font-bold">Cara Melapor</h2>
		<div class="mt-8 grid gap-6 md:grid-cols-3">
			<div class="rounded-xl border bg-background p-6 text-center">
				<CameraIcon class="mx-auto size-8 text-emerald-600" />
				<h3 class="mt-3 font-semibold">1. Foto atau Video</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					Abadikan kondisi sampah di lokasi kejadian.
				</p>
			</div>
			<div class="rounded-xl border bg-background p-6 text-center">
				<MapPinIcon class="mx-auto size-8 text-emerald-600" />
				<h3 class="mt-3 font-semibold">2. Kirim Lokasi</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					Lokasi GPS terdeteksi otomatis, atau pilih dari peta.
				</p>
			</div>
			<div class="rounded-xl border bg-background p-6 text-center">
				<SendIcon class="mx-auto size-8 text-emerald-600" />
				<h3 class="mt-3 font-semibold">3. Kami Tindak Lanjuti</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					Laporan diterima tim kebersihan dan diverifikasi petugas.
				</p>
			</div>
		</div>
	</div>
</section>

<footer class="border-t py-8">
	<div class="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
		Novira &mdash; Sistem Pemantauan Kebersihan Kota
	</div>
</footer>
