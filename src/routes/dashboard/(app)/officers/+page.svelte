<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import * as Table from "$lib/components/ui/table/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import UserCheckIcon from "@lucide/svelte/icons/user-check";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import TrashIcon from "@lucide/svelte/icons/trash";
	import LinkIcon from "@lucide/svelte/icons/link";
	import PhoneIcon from "@lucide/svelte/icons/phone";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import OfficerFormDialog from "$lib/components/officer-form-dialog.svelte";
	import type { PetugasLapangan } from "$lib/types/novira.js";

	let { data, form } = $props();

	let tambahOpen = $state(false);
	let dialogEditTerbuka = $state(false);
	let petugasDiedit = $state<PetugasLapangan | null>(null);

	const statusOptions = [
		{ value: "SIAP_TUGAS", label: "SIAP TUGAS" },
		{ value: "SEDANG_BERTUGAS", label: "SEDANG BERTUGAS" },
		{ value: "OFFLINE", label: "OFFLINE" },
	];

	let hapusOpen = $state(false);
	let hapusId = $state("");
	let hapusNama = $state("");

	let akunTersedia = $derived(
		data.akunPetugas.filter(
			(u) => !data.petugasList.some((p) => p.userId === u.id) || u.id === petugasDiedit?.userId
		)
	);

	function namaAkun(userId: string | undefined) {
		return data.akunPetugas.find((u) => u.id === userId)?.name;
	}

	function getInisial(nama: string) {
		return nama
			.split(" ")
			.map((n) => n[0])
			.slice(0, 2)
			.join("")
			.toUpperCase();
	}

	let statusEdit = $state("SIAP_TUGAS");
	let akunEdit = $state("");

	function labelStatus(v: string) {
		return statusOptions.find((o) => o.value === v)?.label ?? v.replace("_", " ");
	}

	function bukaEdit(officer: PetugasLapangan) {
		petugasDiedit = officer;
		statusEdit = officer.status;
		akunEdit = officer.userId ?? "";
		dialogEditTerbuka = true;
	}
</script>

<svelte:head>
	<title>Petugas Lapangan - NOVIRA Super Admin</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Petugas Lapangan &amp; Armada DLH"
		eyebrow="Sumber Daya Operasional"
		description="Daftar anggota personil Satpol PP dan kru armada pengangkut Dinas Lingkungan Hidup."
		icon={UserCheckIcon}
	>
		{#snippet actions()}
			<Button size="sm" class="h-9 text-xs font-semibold" onclick={() => (tambahOpen = true)}>
				<PlusIcon class="mr-1.5 size-4" />
				Tambah Petugas Baru
			</Button>
		{/snippet}
	</PageHeader>

	<OfficerFormDialog
		bind:open={tambahOpen}
		akunList={data.akunPetugas}
		akunTerpakai={new Set(data.petugasList.map((p) => p.userId).filter(Boolean) as string[])}
	/>

	<Card.Root class="overflow-hidden py-0">
		<Card.Content class="p-0">
			<div class="relative w-full overflow-x-auto">
				<Table.Root class="w-full min-w-[850px] border-collapse text-left">
					<Table.Header>
						<Table.Row class="bg-muted/60 hover:bg-muted/60">
							<Table.Head class="w-[90px] py-3.5 pl-4">Aksi</Table.Head>
							<Table.Head class="py-3.5">Petugas</Table.Head>
							<Table.Head class="py-3.5">Peran / Unit</Table.Head>
							<Table.Head class="py-3.5">Kontak</Table.Head>
							<Table.Head class="py-3.5">Wilayah</Table.Head>
							<Table.Head class="py-3.5">Status Tugas</Table.Head>
							<Table.Head class="py-3.5 text-center">Penugasan Aktif</Table.Head>
							<Table.Head class="py-3.5 pr-4">Akun Login</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.petugasList as officer (officer.id)}
							<Table.Row class="border-border/50 hover:bg-muted/50 border-b">
								<!-- AKSI -->
								<Table.Cell class="py-3 pl-4">
									<div class="flex items-center gap-1.5">
										<Button
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-primary hover:bg-primary/10 size-8"
											title="Edit Petugas"
											onclick={() => bukaEdit(officer)}
										>
											<PencilIcon class="size-3.5" />
										</Button>

										<Button
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8"
											title="Hapus Petugas"
											aria-label={`Hapus petugas ${officer.nama}`}
											onclick={() => {
												hapusId = officer.id;
												hapusNama = officer.nama;
												hapusOpen = true;
											}}
										>
											<TrashIcon class="size-3.5" />
										</Button>
									</div>
								</Table.Cell>

								<!-- NAMA PETUGAS (+ AVATAR EMERALD) -->
								<Table.Cell class="py-3">
									<div class="flex items-center gap-2.5">
										<div
											class="bg-primary/10 text-primary ring-primary/15 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ring-inset"
										>
											{getInisial(officer.nama)}
										</div>
										<span class="text-foreground text-xs font-bold sm:text-sm">{officer.nama}</span>
									</div>
								</Table.Cell>

								<!-- PERAN -->
								<Table.Cell class="py-3 text-xs">
									<span
										class="bg-secondary text-secondary-foreground inline-block rounded-md px-2 py-0.5 font-semibold"
									>
										{officer.peran}
									</span>
								</Table.Cell>

								<!-- KONTAK -->
								<Table.Cell class="py-3 text-xs">
									<div class="text-foreground/80 flex items-center gap-1.5 font-mono font-medium">
										<PhoneIcon class="size-3.5 text-emerald-600 dark:text-emerald-400" />
										<span>{officer.telepon}</span>
									</div>
								</Table.Cell>

								<!-- WILAYAH -->
								<Table.Cell class="py-3 text-xs">
									<div class="text-foreground/90 flex items-center gap-1 font-semibold">
										<MapPinIcon class="size-3.5 text-rose-600 dark:text-rose-400" />
										<span>{officer.wilayahTugas}</span>
									</div>
								</Table.Cell>

								<!-- STATUS BADGE -->
								<Table.Cell class="py-3">
									{#if officer.status === "SEDANG_BERTUGAS"}
										<Badge
											class="border border-amber-300 bg-amber-500/20 text-[10px] font-bold text-amber-800 hover:bg-amber-500/30 dark:bg-amber-500/30 dark:text-amber-200"
										>
											<span class="mr-1.5 size-1.5 animate-pulse rounded-full bg-amber-600"></span>
											SEDANG BERTUGAS
										</Badge>
									{:else if officer.status === "SIAP_TUGAS"}
										<Badge
											class="border border-emerald-300 bg-emerald-600/20 text-[10px] font-bold text-emerald-800 hover:bg-emerald-600/30 dark:bg-emerald-500/30 dark:text-emerald-200"
										>
											<span class="mr-1.5 size-1.5 rounded-full bg-emerald-600"></span>
											SIAP TUGAS
										</Badge>
									{:else}
										<Badge
											variant="outline"
											class="border-slate-300 text-[10px] font-semibold text-slate-600 dark:text-slate-400"
										>
											OFFLINE
										</Badge>
									{/if}
								</Table.Cell>

								<!-- PENUGASAN AKTIF -->
								<Table.Cell class="py-3 text-center">
									{#if officer.jumlahTugasAktif > 0}
										<span
											class="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-400"
										>
											{officer.jumlahTugasAktif} insiden
										</span>
									{:else}
										<span class="text-muted-foreground text-xs font-medium">0 insiden</span>
									{/if}
								</Table.Cell>

								<!-- AKUN LOGIN -->
								<Table.Cell class="py-3 pr-4">
									{#if officer.userId}
										<Badge
											variant="outline"
											class="gap-1 border-emerald-600/40 bg-emerald-100/50 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
										>
											<LinkIcon class="size-2.5" />
											Terhubung
										</Badge>
									{:else}
										<span class="text-muted-foreground text-xs">-</span>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<DeleteConfirmDialog
	bind:open={hapusOpen}
	action="?/hapus"
	id={hapusId}
	itemName={`petugas ${hapusNama}`}
/>

<!-- DIALOG EDIT -->
<Dialog.Root bind:open={dialogEditTerbuka}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Petugas Lapangan</Dialog.Title>
			<Dialog.Description>Perbarui data petugas {petugasDiedit?.nama ?? ""}.</Dialog.Description>
		</Dialog.Header>
		{#if petugasDiedit}
			<form
				method="POST"
				action="?/ubah"
				use:enhance={() => {
					return async ({ update }) => {
						dialogEditTerbuka = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="id" value={petugasDiedit.id} />
				<div class="space-y-2">
					<Label.Root>Nama</Label.Root>
					<Input.Root name="nama" value={petugasDiedit.nama} required />
				</div>
				<div class="space-y-2">
					<Label.Root>Peran / Unit Tugas</Label.Root>
					<Input.Root name="peran" value={petugasDiedit.peran} required />
				</div>
				<div class="space-y-2">
					<Label.Root>Nomor WhatsApp</Label.Root>
					<Input.Root name="telepon" value={petugasDiedit.telepon} required />
				</div>
				<div class="space-y-2">
					<Label.Root>Wilayah Tugas</Label.Root>
					<Input.Root name="wilayahTugas" value={petugasDiedit.wilayahTugas} required />
				</div>
				<div class="space-y-2">
					<Label.Root>Status</Label.Root>
					<Select.Root type="single" name="status" bind:value={statusEdit}>
						<Select.Trigger class="w-full">
							<span>{labelStatus(statusEdit)}</span>
						</Select.Trigger>
						<Select.Content>
							{#each statusOptions as opt}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label.Root>Akun Login (opsional)</Label.Root>
					<Select.Root type="single" name="userId" bind:value={akunEdit}>
						<Select.Trigger class="w-full">
							<span>{namaAkun(akunEdit) ?? "Tidak dihubungkan"}</span>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="" label="Tidak dihubungkan">Tidak dihubungkan</Select.Item>
							{#each akunTersedia as akun (akun.id)}
								<Select.Item value={akun.id} label={akun.name}>
									{akun.name} (@{akun.username})
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				{#if form?.message}
					<p class="text-sm text-red-600">{form.message}</p>
				{/if}
				<Dialog.Footer>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => (dialogEditTerbuka = false)}
					>
						Batal
					</Button>
					<Button type="submit" size="sm" class="bg-emerald-600 text-white hover:bg-emerald-700">
						Simpan Perubahan
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
