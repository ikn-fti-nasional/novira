<script lang="ts">
	import AreaSummary from "$lib/components/novira/area-summary.svelte";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import TrophyIcon from "@lucide/svelte/icons/trophy";

	let { data } = $props();
</script>

<svelte:head>
	<title>Peringkat Kebersihan Wilayah - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Peringkat Kebersihan Wilayah"
		eyebrow="Klasemen Adipura"
		description="Skor Adipura real-time berbasis data deteksi otomatis kamera CCTV dan respons armada kebersihan."
		icon={TrophyIcon}
	/>

	<AreaSummary skorWilayahList={data.skorWilayahList} />
</div>
