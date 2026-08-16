<script lang="ts">
	import IncidentTable from "$lib/components/novira/incident-table.svelte";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { invalidateAll } from "$app/navigation";
	import { toast } from "svelte-sonner";

	let { data } = $props();

	async function handleSelesaikanTugas(insidenId: string, buktiFile: File) {
		const formData = new FormData();
		formData.append("insidenId", insidenId);
		formData.append("buktiFoto", buktiFile);

		const response = await fetch("?/selesaikanTugas", {
			method: "POST",
			body: formData,
		});

		if (response.ok) {
			toast.success("Insiden ditandai selesai");
			await invalidateAll();
		} else {
			const body = (await response.json().catch(() => null)) as { message?: string } | null;
			toast.error(body?.message ?? "Gagal menandai insiden selesai, coba lagi");
		}
	}
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
			Kelola deteksi penumpukan sampah liar, pemantauan timer SLA (&lt;24 jam), dan penugasan armada
			kebersihan.
		</p>
	</div>

	<IncidentTable insidenList={data.insidenList} onSelesaikanTugas={handleSelesaikanTugas} />
</div>
