<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import { triggerPdfReportPrint } from "$lib/utils/export-report.js";
	import PrinterIcon from "@lucide/svelte/icons/printer";

	let { data } = $props();

	// Helper untuk merapikan ID Audit (Misal: hccyx4iayfhhqnsc -> AUD-HCCYX4IA)
	function formatAuditId(id: string) {
		if (!id) return "AUD-0000";
		// Jika ID sudah pendek/berformat angka, kembalikan langsung
		if (id.length <= 8) return `AUD-${id.toUpperCase()}`;
		// Jika ID hash panjang, ambil 8 karakter pertama
		return `AUD-${id.slice(0, 8).toUpperCase()}`;
	}

	function cetakPdf() {
		const headers = [
			"ID Audit",
			"Waktu",
			"Pengguna",
			"Peran",
			"Tindakan",
			"Rincian",
			"Wilayah",
			"Tipe",
		];
		const rows = data.auditLogList.map((log) => [
			formatAuditId(log.id),
			new Date(log.waktu).toLocaleString("id-ID"),
			log.pengguna,
			log.peran,
			log.tindakan,
			log.rincian,
			log.wilayah,
			log.tipe,
		]);
		triggerPdfReportPrint("Log Audit Sistem", data.user?.name ?? "Admin", headers, rows);
	}
</script>

<svelte:head>
	<title>Log Audit Sistem - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Log Audit &amp; Rekam Jejak Sistem"
		eyebrow="Tata Kelola"
		description="Catatan jejak audit permanen untuk semua deteksi otomatis AI, penetapan tugas petugas, dan perubahan status oleh Super Admin."
		icon={ShieldCheckIcon}
	>
		{#snippet badges()}
			<Badge
				variant="outline"
				class="border-emerald-600/40 bg-emerald-500/10 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
			>
				Di-hash SHA-256
			</Badge>
		{/snippet}

		{#snippet actions()}
			<Button size="sm" class="h-9 text-xs font-semibold" onclick={cetakPdf}>
				<PrinterIcon class="mr-1.5 size-3.5" />
				Cetak Log Audit (PDF)
			</Button>
		{/snippet}
	</PageHeader>

	<!-- CARD CONTAINER LOG AUDIT -->
	<Card.Root class="overflow-hidden border-emerald-800/20 shadow-md">
		<!-- CARD HEADER -->
		<Card.Header class="bg-emerald-50/60 !px-4 !py-3 dark:bg-emerald-950/30">
			<Card.Title
				class="text-base font-extrabold tracking-tight text-emerald-950 sm:text-lg dark:text-emerald-100"
			>
				Rekam Jejak &amp; Aktivitas Pengguna
			</Card.Title>
		</Card.Header>

		<Card.Content class="!p-0">
			<div class="relative w-full overflow-x-auto">
				<Table.Root class="w-full min-w-[800px] border-collapse text-left">
					<!-- HEADER EMERALD TEGAS -->
					<Table.Header>
						<Table.Row class="border-none bg-emerald-800 hover:bg-emerald-800">
							<Table.Head
								class="w-[130px] py-3.5 pl-4 text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>ID Audit</Table.Head
							>
							<Table.Head
								class="w-[150px] py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>Waktu</Table.Head
							>
							<Table.Head class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>Pengguna / Peran</Table.Head
							>
							<Table.Head class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>Tindakan</Table.Head
							>
							<Table.Head class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>Rincian Aktivitas</Table.Head
							>
							<Table.Head class="py-3.5 text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>Cakupan Wilayah</Table.Head
							>
							<Table.Head
								class="py-3.5 pr-4 text-right text-xs font-bold tracking-wider text-emerald-50 uppercase"
								>Tipe Log</Table.Head
							>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{#each data.auditLogList as log, idx (log.id)}
							<Table.Row
								class="border-border/50 border-b text-xs transition-colors {idx % 2 === 0
									? 'dark:bg-background bg-white'
									: 'bg-emerald-50/30 dark:bg-emerald-950/10'} hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30"
							>
								<!-- ID AUDIT (DAPAT FORMAT RAPI: AUD-XXXXXX) -->
								<Table.Cell
									class="py-3 pl-4 font-mono font-bold whitespace-nowrap text-emerald-800 dark:text-emerald-300"
								>
									{formatAuditId(log.id)}
								</Table.Cell>

								<!-- WAKTU -->
								<Table.Cell
									class="text-muted-foreground py-3 font-mono text-[11px] whitespace-nowrap"
								>
									{new Date(log.waktu).toLocaleString("id-ID")}
								</Table.Cell>

								<!-- PENGGUNA / PERAN (PENGECEKAN SUPAYA TIDAK DOUBLE) -->
								<Table.Cell class="py-3">
									<div class="flex flex-col items-start gap-1">
										<span class="text-foreground font-bold capitalize">{log.pengguna}</span>

										<!-- Tampilkan badge peran HANYA jika nilainya berbeda dari pengguna (strikethrough duplicate) -->
										{#if log.peran && log.peran.toLowerCase() !== log.pengguna.toLowerCase()}
											<span
												class="inline-block rounded bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
											>
												{log.peran}
											</span>
										{/if}
									</div>
								</Table.Cell>

								<!-- TINDAKAN -->
								<Table.Cell class="py-3 font-bold text-emerald-700 dark:text-emerald-400">
									{log.tindakan}
								</Table.Cell>

								<!-- RINCIAN AKTIVITAS -->
								<Table.Cell
									class="text-muted-foreground max-w-[280px] truncate py-3"
									title={log.rincian}
								>
									{log.rincian}
								</Table.Cell>

								<!-- CAKUPAN WILAYAH -->
								<Table.Cell
									class="py-3 font-semibold whitespace-nowrap text-slate-700 dark:text-slate-300"
								>
									{log.wilayah}
								</Table.Cell>

								<!-- TIPE LOG BADGE -->
								<Table.Cell class="py-3 pr-4 text-right whitespace-nowrap">
									<Badge
										variant="outline"
										class="border-emerald-300 bg-emerald-50/50 font-mono text-[10px] font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
									>
										{log.tipe}
									</Badge>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</Card.Content>
	</Card.Root>
</div>
