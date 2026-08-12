<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import UserCheckIcon from "@lucide/svelte/icons/user-check";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import TrashIcon from "@lucide/svelte/icons/trash";

	let { data } = $props();
</script>

<svelte:head>
	<title>Petugas Lapangan - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<UserCheckIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				<h1 class="text-3xl font-extrabold tracking-tight">Manajemen Petugas Lapangan &amp; Armada DLH</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Daftar anggota personil Satpol PP dan kru armada pengangkut Dinas Lingkungan Hidup.
			</p>
		</div>

		<Button variant="default" size="sm" class="h-9 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">
			<PlusIcon class="mr-1.5 size-4" />
			Tambah Petugas Lapangan Baru
		</Button>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head>ID &amp; Nama Petugas</Table.Head>
						<Table.Head>Peran / Unit Tugas</Table.Head>
						<Table.Head>Nomor WhatsApp</Table.Head>
						<Table.Head>Cakupan Wilayah Tugas</Table.Head>
						<Table.Head>Status Tugas</Table.Head>
						<Table.Head>Penugasan Aktif</Table.Head>
						<Table.Head class="text-right">Tindakan Super Admin</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.petugasList as officer (officer.id)}
						<Table.Row class="text-xs">
							<Table.Cell class="font-bold">{officer.id} - {officer.nama}</Table.Cell>
							<Table.Cell>{officer.peran}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{officer.telepon}</Table.Cell>
							<Table.Cell>{officer.wilayahTugas}</Table.Cell>
							<Table.Cell>
								<Badge variant={officer.status === "SEDANG_BERTUGAS" ? "destructive" : "default"} class="text-[10px]">
									{officer.status.replace("_", " ")}
								</Badge>
							</Table.Cell>
							<Table.Cell class="font-bold text-xs">{officer.jumlahTugasAktif} insiden</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<Button variant="ghost" size="sm" class="h-7 text-xs" title="Edit Petugas">
										<PencilIcon class="size-3.5" />
									</Button>
									<Button variant="ghost" size="sm" class="h-7 text-xs text-red-600 hover:text-red-700" title="Hapus Petugas">
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
