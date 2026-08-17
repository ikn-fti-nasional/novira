<script lang="ts">
	import HotspotMap from "$lib/components/novira/hotspot-map.svelte";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import { invalidateAll } from "$app/navigation";

	let { data } = $props();

	// Sama seperti monitoring/+page.svelte: data hanya berubah lewat siklus
	// deteksi cron, jadi poll ringan cukup -- lihat komentar di sana.
	$effect(() => {
		const interval = setInterval(() => invalidateAll(), 2 * 60 * 1000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Peta Titik Rawan Sampah - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<MapPinIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Peta Titik Rawan Pembuangan Liar</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Analisis geospasial sebaran lokasi titik pembuangan sampah di seluruh wilayah kabupaten/kota.
		</p>
	</div>

	<HotspotMap kameraList={data.kameraList} insidenList={data.insidenList} />
</div>
