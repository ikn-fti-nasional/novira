<script lang="ts">
	import IncidentTable from "$lib/components/novira/incident-table.svelte";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import { Badge } from "$lib/components/ui/badge/index.js";

	let { data } = $props();
</script>

<svelte:head>
	<title>Insiden &amp; Alert Sampah - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<AlertTriangleIcon class="size-6 text-red-600 dark:text-red-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Insiden &amp; Peringatan Sampah Liar</h1>
			<Badge variant="destructive" class="text-xs font-semibold">14 Insiden Aktif</Badge>
		</div>
		<p class="text-sm text-muted-foreground">
			Kelola deteksi penumpukan sampah liar, pemantauan timer SLA (&lt;24 jam), dan penugasan armada kebersihan.
		</p>
	</div>

	<IncidentTable insidenList={data.insidenList} />
</div>
