<script lang="ts">
	import AreaSummary from "$lib/components/novira/area-summary.svelte";
	import { MOCK_SKOR_WILAYAH } from "$lib/mock/novira.js";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
</script>

<svelte:head>
	<title>Peringkat Kebersihan Wilayah - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<TrophyIcon class="size-6 text-amber-500" />
			<h1 class="text-3xl font-extrabold tracking-tight">Peringkat Kebersihan Wilayah</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Skor Adipura real-time berbasis data deteksi otomatis kamera CCTV &amp; respons armada kebersihan.
		</p>
	</div>

	<AreaSummary skorWilayahList={MOCK_SKOR_WILAYAH} />
</div>
