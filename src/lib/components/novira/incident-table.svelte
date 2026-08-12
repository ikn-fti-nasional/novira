<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import UserPlusIcon from "@lucide/svelte/icons/user-plus";
	import XCircleIcon from "@lucide/svelte/icons/x-circle";
	import type { Insiden } from "$lib/types/novira.js";

	type Props = {
		insidenList: Insiden[];
	};

	let { insidenList }: Props = $props();

	let filterStatus = $state<string>("SEMUA");

	let insidenTersaring = $derived(
		filterStatus === "SEMUA"
			? insidenList
			: insidenList.filter((i) => i.status === filterStatus || (filterStatus === "MELANGGAR_SLA" && i.statusSla === "MELANGGAR_SLA"))
	);

	function getBadgeKeparahanClass(keparahan: string) {
		switch (keparahan) {
			case "KRITIS":
				return "bg-red-600/15 text-red-700 border-red-500/30 dark:bg-red-950/50 dark:text-red-400 font-bold";
			case "TINGGI":
				return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-400 font-semibold";
			case "SEDANG":
				return "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:bg-blue-950/50 dark:text-blue-400";
			default:
				return "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400";
		}
	}

	function getBadgeStatusClass(status: string) {
		switch (status) {
			case "AKTIF":
				return "bg-red-600 text-white dark:bg-red-600 font-bold";
			case "PERINGATAN":
				return "bg-amber-500 text-slate-950 dark:bg-amber-400 font-semibold";
			case "SELESAI":
				return "bg-emerald-600 text-white dark:bg-emerald-500 font-semibold";
			case "POSITIF_PALSU":
				return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
			default:
				return "bg-slate-500 text-white";
		}
	}

	function formatDurasi(menit: number) {
		const h = Math.floor(menit / 60);
		const m = menit % 60;
		if (h > 0) return `${h}j ${m}m`;
		return `${m}m`;
	}

	function formatNamaStatus(status: string) {
		switch (status) {
			case "AKTIF": return "AKTIF";
			case "PERINGATAN": return "PERINGATAN";
			case "SELESAI": return "SELESAI";
			case "POSITIF_PALSU": return "POSITIF PALSU";
			default: return status;
		}
	}
</script>

<Card.Root class="border-border/80 shadow-md">
	<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
		<div>
			<div class="flex items-center gap-2">
				<Card.Title class="text-xl font-bold tracking-tight">
					Daftar Peringatan Insiden Sampah
				</Card.Title>
				<Badge variant="destructive" class="px-2 py-0.5 text-xs font-semibold">
					{insidenList.filter((i) => i.status === "AKTIF").length} Insiden Aktif
				</Badge>
			</div>
			<Card.Description class="text-xs">
				Pemantauan waktu nyata penumpukan sampah liar dengan timer SLA pengangkutan (&lt;24 Jam).
			</Card.Description>
		</div>

		<!-- Filter Cepat -->
		<div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
			<Button
				variant={filterStatus === "SEMUA" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs font-medium"
				onclick={() => (filterStatus = "SEMUA")}
			>
				Semua ({insidenList.length})
			</Button>
			<Button
				variant={filterStatus === "AKTIF" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs text-red-600 dark:text-red-400 font-semibold"
				onclick={() => (filterStatus = "AKTIF")}
			>
				Aktif
			</Button>
			<Button
				variant={filterStatus === "MELANGGAR_SLA" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs text-amber-600 dark:text-amber-400 font-semibold"
				onclick={() => (filterStatus = "MELANGGAR_SLA")}
			>
				Melanggar SLA
			</Button>
		</div>
	</Card.Header>

	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row class="bg-muted/50 text-xs">
					<Table.Head class="w-[110px]">Tingkat Keparahan</Table.Head>
					<Table.Head>Lokasi &amp; Kamera</Table.Head>
					<Table.Head>Jenis Sampah</Table.Head>
					<Table.Head class="w-[80px]">Kepercayaan</Table.Head>
					<Table.Head class="w-[100px]">Durasi Dibiarkan</Table.Head>
					<Table.Head class="w-[110px]">Status Insiden</Table.Head>
					<Table.Head>Petugas Lapangan</Table.Head>
					<Table.Head class="text-right">Tindakan Super Admin</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each insidenTersaring as insiden (insiden.id)}
					<Table.Row class="text-xs hover:bg-muted/40 transition-colors">
						<!-- Keparahan -->
						<Table.Cell>
							<div class="flex flex-col gap-1">
								<Badge variant="outline" class={`w-fit text-[10px] uppercase ${getBadgeKeparahanClass(insiden.keparahan)}`}>
									{insiden.keparahan}
								</Badge>
								{#if insiden.statusSla === "MELANGGAR_SLA"}
									<span class="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 dark:text-red-400">
										<ShieldAlertIcon class="size-3" />
										LANGGAR SLA
									</span>
								{/if}
							</div>
						</Table.Cell>

						<!-- Lokasi -->
						<Table.Cell>
							<div class="flex flex-col">
								<span class="font-bold text-foreground">{insiden.lokasi}</span>
								<span class="text-[11px] text-muted-foreground">{insiden.namaKamera} ({insiden.kelurahan})</span>
							</div>
						</Table.Cell>

						<!-- Jenis Sampah -->
						<Table.Cell>
							<div class="flex items-center gap-1.5">
								<div class="size-2 rounded-full bg-emerald-500"></div>
								<span class="font-medium">{insiden.labelSampah}</span>
							</div>
						</Table.Cell>

						<!-- Kepercayaan AI -->
						<Table.Cell>
							<span class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
								{Math.round(insiden.tingkatKepercayaan * 100)}%
							</span>
						</Table.Cell>

						<!-- Durasi -->
						<Table.Cell>
							<div class="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
								<ClockIcon class="size-3.5 text-muted-foreground" />
								{formatDurasi(insiden.durasiMenit)}
							</div>
						</Table.Cell>

						<!-- Status -->
						<Table.Cell>
							<Badge class={`text-[10px] ${getBadgeStatusClass(insiden.status)}`}>
								{formatNamaStatus(insiden.status)}
							</Badge>
						</Table.Cell>

						<!-- Petugas -->
						<Table.Cell>
							{#if insiden.petugasDitugaskan}
								<span class="text-xs font-medium text-slate-800 dark:text-slate-200">
									{insiden.petugasDitugaskan}
								</span>
							{:else}
								<span class="text-xs italic text-amber-600 dark:text-amber-400 font-medium">
									Belum Ditugaskan
								</span>
							{/if}
						</Table.Cell>

						<!-- Tindakan Super Admin -->
						<Table.Cell class="text-right">
							<div class="flex items-center justify-end gap-1">
								{#if insiden.status === "AKTIF"}
									<Button variant="outline" size="sm" class="h-7 text-[11px] hover:bg-emerald-500/10 hover:text-emerald-700">
										<UserPlusIcon class="mr-1 size-3" />
										Tugaskan
									</Button>
									<Button variant="ghost" size="sm" class="h-7 text-[11px] text-slate-500 hover:text-slate-900" title="Tandai Positif Palsu">
										<XCircleIcon class="size-3.5" />
									</Button>
								{:else if insiden.status === "SELESAI"}
									<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
										<CheckCircle2Icon class="size-3.5" />
										Terangkut
									</span>
								{:else}
									<span class="text-[11px] text-muted-foreground font-medium">Diverifikasi</span>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
