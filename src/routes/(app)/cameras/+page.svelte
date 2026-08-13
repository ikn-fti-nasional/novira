<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import TrashIcon from "@lucide/svelte/icons/trash";

	let { data } = $props();
</script>

<svelte:head>
	<title>Manajemen Kamera CCTV - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<div
		class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4"
	>
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<CameraIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				<h1 class="text-3xl font-extrabold tracking-tight">Manajemen Inventaris Kamera CCTV</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Kelola titik umpan kamera CCTV pemerintah daerah yang terhubung ke nodus inferensi AI
				NOVIRA.
			</p>
		</div>

		<Button
			variant="default"
			size="sm"
			class="h-9 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
		>
			<PlusIcon class="mr-1.5 size-4" />
			Tambah Kamera CCTV Baru
		</Button>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head>ID &amp; Nama Kamera</Table.Head>
						<Table.Head>Lokasi &amp; Kelurahan</Table.Head>
						<Table.Head>Kabupaten / Kota</Table.Head>
						<Table.Head>Status Kamera</Table.Head>
						<Table.Head>Deteksi Sampah Aktif</Table.Head>
						<Table.Head>Kecepatan Frame</Table.Head>
						<Table.Head class="text-right">Tindakan Super Admin</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.kameraList as cam (cam.id)}
						<Table.Row class="text-xs">
							<Table.Cell class="font-bold">{cam.id} - {cam.nama}</Table.Cell>
							<Table.Cell>{cam.lokasi} ({cam.kelurahan})</Table.Cell>
							<Table.Cell>{cam.kabupatenKota}, {cam.provinsi}</Table.Cell>
							<Table.Cell>
								<Badge
									variant={cam.status === "ONLINE" ? "default" : "secondary"}
									class="text-[10px]"
								>
									{cam.status}
								</Badge>
							</Table.Cell>
							<Table.Cell class="font-semibold text-emerald-600 dark:text-emerald-400">
								{cam.jumlahObjekTerdeteksi} Objek
							</Table.Cell>
							<Table.Cell class="font-mono text-xs">{cam.fps} FPS</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<Button variant="ghost" size="sm" class="h-7 text-xs" title="Edit Kamera">
										<PencilIcon class="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										class="h-7 text-xs text-red-600 hover:text-red-700"
										title="Hapus Kamera"
									>
										<TrashIcon class="size-3.5" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>
