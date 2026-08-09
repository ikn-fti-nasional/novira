<script lang="ts">
	import HotspotMap from "$lib/components/novira/hotspot-map.svelte";
	import { MOCK_KAMERA, MOCK_INSIDEN } from "$lib/mock/novira.js";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
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

	<HotspotMap kameraList={MOCK_KAMERA} insidenList={MOCK_INSIDEN} />
</div>
