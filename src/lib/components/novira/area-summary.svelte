<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
	import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
	import MinusIcon from "@lucide/svelte/icons/minus";
	import type { SkorKebersihanWilayah } from "$lib/types/novira.js";

	type Props = {
		skorWilayahList: SkorKebersihanWilayah[];
	};

	let { skorWilayahList }: Props = $props();

	function getBadgeSkorClass(skor: number) {
		if (skor >= 85)
			return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
		if (skor >= 70) return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
		if (skor >= 60) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
		return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
	}
</script>

<Card.Root class="border-border/80 shadow-md">
	<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-3">
		<div>
			<div class="flex items-center gap-2">
				<TrophyIcon class="size-5 text-amber-500" />
				<Card.Title class="text-xl font-bold tracking-tight">
					Peringkat Kebersihan Wilayah (Kelurahan)
				</Card.Title>
			</div>
			<Card.Description class="text-xs">
				Skor Adipura real-time yang dihitung dari jumlah insiden &amp; kecepatan pengangkutan sampah
				SLA.
			</Card.Description>
		</div>

		<Badge
			variant="outline"
			class="border-amber-500/40 text-amber-700 dark:text-amber-400 text-[10px]"
		>
			Klasemen Mingguan
		</Badge>
	</Card.Header>

	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row class="bg-muted/50 text-xs">
					<Table.Head class="w-[70px] text-center">Peringkat</Table.Head>
					<Table.Head>Kelurahan (Kecamatan)</Table.Head>
					<Table.Head class="text-center">Skor Kebersihan</Table.Head>
					<Table.Head class="text-center">Insiden Aktif</Table.Head>
					<Table.Head class="text-center">Rata-rata Durasi SLA</Table.Head>
					<Table.Head class="text-right">Tren Mingguan</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each skorWilayahList as area (area.kecamatan + "|" + area.kabupatenKota)}
					<Table.Row class="text-xs hover:bg-muted/40 transition-colors">
						<Table.Cell class="text-center font-bold">
							<span
								class={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
									area.peringkat === 1
										? "bg-amber-400 text-slate-950 font-bold"
										: area.peringkat === 2
											? "bg-slate-300 text-slate-900 font-bold"
											: area.peringkat === 3
												? "bg-amber-700/40 text-amber-200 font-bold"
												: "bg-muted text-muted-foreground"
								}`}
							>
								#{area.peringkat}
							</span>
						</Table.Cell>

						<Table.Cell>
							<div class="flex flex-col">
								<span class="font-bold text-foreground text-sm">{area.kelurahan}</span>
								<span class="text-[11px] text-muted-foreground"
									>{area.kecamatan}, {area.kabupatenKota}</span
								>
							</div>
						</Table.Cell>

						<Table.Cell class="text-center">
							<Badge
								variant="outline"
								class={`text-xs font-extrabold ${getBadgeSkorClass(area.skorKebersihan)}`}
							>
								{area.skorKebersihan} / 100
							</Badge>
						</Table.Cell>

						<Table.Cell class="text-center font-semibold">
							{area.jumlahInsiden} Insiden
						</Table.Cell>

						<Table.Cell class="text-center font-mono text-xs">
							{area.rataRataDurasiSampahJam} jam
						</Table.Cell>

						<Table.Cell class="text-right">
							{#if area.tren === "membaik"}
								<span
									class="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
								>
									<TrendingUpIcon class="size-3.5" />
									+{area.persentaseTren}%
								</span>
							{:else if area.tren === "menurun"}
								<span
									class="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600 dark:text-red-400"
								>
									<TrendingDownIcon class="size-3.5" />
									{area.persentaseTren}%
								</span>
							{:else}
								<span
									class="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground"
								>
									<MinusIcon class="size-3.5" />
									Stabil
								</span>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>
</Card.Root>
