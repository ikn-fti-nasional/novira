<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import StatCard from "$lib/components/novira/stat-card.svelte";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import DatabaseIcon from "@lucide/svelte/icons/database";
	import HardDriveIcon from "@lucide/svelte/icons/hard-drive";
	import TableIcon from "@lucide/svelte/icons/table-2";
	import RowsIcon from "@lucide/svelte/icons/rows-3";

	let { data } = $props();

	function formatBytes(bytes: number) {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}
</script>

<svelte:head>
	<title>Basis Data - Novira</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Basis Data"
		eyebrow="Administrasi Sistem"
		description="Pantau ukuran basis data Postgres, tingkat write-ahead log, dan statistik per tabel."
		icon={DatabaseIcon}
	/>

	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<StatCard
			title="Ukuran Basis Data"
			value={formatBytes(data.dbSize)}
			subtitle="Postgres"
			icon={HardDriveIcon}
			tone="emerald"
		/>
		<StatCard
			title="WAL Level"
			value={data.walLevel.toUpperCase()}
			subtitle="Write-ahead log"
			icon={DatabaseIcon}
			tone="blue"
		/>
		<StatCard
			title="Jumlah Tabel"
			value={data.tables.length}
			subtitle="Tabel aktif"
			icon={TableIcon}
			tone="slate"
		/>
		<StatCard
			title="Total Baris"
			value={data.totalRows}
			subtitle="Di seluruh tabel"
			icon={RowsIcon}
			tone="amber"
		/>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Daftar Tabel</Card.Title>
			<Card.Description>Jumlah baris tiap tabel dalam basis data.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Table.Root>
				<Table.Header>
					<Table.Row class="hover:bg-transparent">
						<Table.Head>Nama Tabel</Table.Head>
						<Table.Head class="text-right">Baris</Table.Head>
						<Table.Head class="text-right">% dari Total</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.tables as table (table.name)}
						<Table.Row>
							<Table.Cell class="font-mono text-sm">{table.name}</Table.Cell>
							<Table.Cell class="text-right">{table.rows.toLocaleString()}</Table.Cell>
							<Table.Cell class="text-right">
								<Badge variant="outline">
									{data.totalRows > 0 ? Math.round((table.rows / data.totalRows) * 100) : 0}%
								</Badge>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
