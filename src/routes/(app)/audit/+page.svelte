<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import DownloadIcon from "@lucide/svelte/icons/download";

	let { data } = $props();
</script>

<svelte:head>
	<title>Log Audit Sistem - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<ShieldCheckIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				<h1 class="text-3xl font-extrabold tracking-tight">Log Audit &amp; Rekam Jejak Sistem</h1>
				<Badge class="bg-emerald-600 text-white text-xs font-semibold">Terenkripsi SHA-256</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				Catatan jejak audit permanen untuk semua deteksi otomatis AI, penetapan tugas petugas, dan perubahan status oleh Super Admin.
			</p>
		</div>

		<Button variant="outline" size="sm" class="h-9 text-xs font-semibold">
			<DownloadIcon class="mr-1.5 size-3.5" />
			Unduh Log Audit (CSV)
		</Button>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head class="w-[110px]">ID Audit</Table.Head>
						<Table.Head class="w-[140px]">Waktu</Table.Head>
						<Table.Head>Pengguna / Peran</Table.Head>
						<Table.Head>Tindakan</Table.Head>
						<Table.Head>Rincian Aktivitas</Table.Head>
						<Table.Head>Cakupan Wilayah</Table.Head>
						<Table.Head class="text-right">Tipe Log</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.auditLogList as log (log.id)}
						<Table.Row class="text-xs">
							<Table.Cell class="font-mono font-bold text-muted-foreground">{log.id}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{new Date(log.waktu).toLocaleString()}</Table.Cell>
							<Table.Cell>
								<div class="flex flex-col">
									<span class="font-bold text-foreground">{log.pengguna}</span>
									<span class="text-[10px] text-muted-foreground">{log.peran}</span>
								</div>
							</Table.Cell>
							<Table.Cell class="font-bold text-emerald-700 dark:text-emerald-400">{log.tindakan}</Table.Cell>
							<Table.Cell class="max-w-[300px] truncate">{log.rincian}</Table.Cell>
							<Table.Cell class="font-semibold text-slate-700 dark:text-slate-300">{log.wilayah}</Table.Cell>
							<Table.Cell class="text-right">
								<Badge variant="outline" class="text-[9px] font-mono">{log.tipe}</Badge>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
