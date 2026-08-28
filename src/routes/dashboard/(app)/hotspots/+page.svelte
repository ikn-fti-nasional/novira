<script lang="ts">
	import HotspotMap from "$lib/components/novira/hotspot-map.svelte";
	import PageHeader from "$lib/components/novira/page-header.svelte";
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
	<PageHeader
		title="Peta Titik Rawan Pembuangan Liar"
		eyebrow="Analisis Geospasial"
		description="Sebaran lokasi titik pembuangan sampah di seluruh wilayah kabupaten/kota yang terpantau."
		icon={MapPinIcon}
	/>

	<HotspotMap kameraList={data.kameraList} insidenList={data.insidenList} />
</div>
