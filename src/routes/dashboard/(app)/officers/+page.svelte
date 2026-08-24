<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
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
	import { enhance } from "$app/forms";
	import type { PetugasLapangan } from "$lib/types/novira.js";

	let { data, form } = $props();

	let showForm = $state(false);
	let dialogEditTerbuka = $state(false);
	let petugasDiedit = $state<PetugasLapangan | null>(null);

	const statusOptions = [
		{ value: "SIAP_TUGAS", label: "SIAP TUGAS" },
		{ value: "SEDANG_BERTUGAS", label: "SEDANG BERTUGAS" },
		{ value: "OFFLINE", label: "OFFLINE" },
	];

	// Akun login (role petugas_lapangan) yang belum dihubungkan ke petugas
	// manapun -- plus, saat mengedit, akun yang sedang dipakai petugas ini
	// sendiri (supaya tidak hilang dari daftar pilihan).
	let akunTersedia = $derived(
		data.akunPetugas.filter(
			(u) => !data.petugasList.some((p) => p.userId === u.id) || u.id === petugasDiedit?.userId
		)
	);

	function namaAkun(userId: string | undefined) {
		return data.akunPetugas.find((u) => u.id === userId)?.name;
	}

	// State lokal untuk tiap Select. Tanpa `bind:value`, label pada pemicu Select
	// tidak ikut berubah saat item lain dipilih.
	let statusBaru = $state("SIAP_TUGAS");
	let akunBaru = $state("");
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
	<div
		class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4"
	>
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<UserCheckIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				<h1 class="text-3xl font-extrabold tracking-tight">
					Manajemen Petugas Lapangan &amp; Armada DLH
				</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Daftar anggota personil Satpol PP dan kru armada pengangkut Dinas Lingkungan Hidup.
			</p>
		</div>

		<Button
			variant="default"
			size="sm"
			class="h-9 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
			onclick={() => (showForm = !showForm)}
		>
			<PlusIcon class="mr-1.5 size-4" />
			{showForm ? "Tutup Form" : "Tambah Petugas Lapangan Baru"}
		</Button>
	</div>

	{#if showForm}
		<Card.Root class="border-emerald-600/40">
			<Card.Header>
				<Card.Title class="text-base">Tambah Petugas Lapangan Baru</Card.Title>
				<Card.Description>Isi data petugas atau kru armada yang akan ditugaskan.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/tambah" use:enhance>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label.Root>Nama</Label.Root>
							<Input.Root name="nama" placeholder="Budi Santoso" required />
						</div>
						<div class="space-y-2">
							<Label.Root>Peran / Unit Tugas</Label.Root>
							<Input.Root name="peran" placeholder="Satpol PP" required />
						</div>
						<div class="space-y-2">
							<Label.Root>Nomor WhatsApp</Label.Root>
							<Input.Root name="telepon" placeholder="081234567890" required />
						</div>
						<div class="space-y-2">
							<Label.Root>Wilayah Tugas</Label.Root>
							<Input.Root name="wilayahTugas" placeholder="Kiaracondong" required />
						</div>
						<div class="space-y-2">
							<Label.Root>Status</Label.Root>
							<Select.Root type="single" name="status" bind:value={statusBaru}>
								<Select.Trigger class="w-full"
									><span>{labelStatus(statusBaru)}</span></Select.Trigger
								>
								<Select.Content>
									{#each statusOptions as opt}
										<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2">
							<Label.Root>Akun Login (opsional)</Label.Root>
							<Select.Root type="single" name="userId" bind:value={akunBaru}>
								<Select.Trigger class="w-full"
									><span>{namaAkun(akunBaru) ?? "Tidak dihubungkan"}</span></Select.Trigger
								>
								<Select.Content>
									<Select.Item value="" label="Tidak dihubungkan">Tidak dihubungkan</Select.Item>
									{#each akunTersedia as akun (akun.id)}
										<Select.Item value={akun.id} label={akun.name}>
											{akun.name} (@{akun.username})
										</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
							<p class="text-[10px] text-muted-foreground">
								Hubungkan ke akun login supaya petugas bisa melihat tugasnya di halaman "Tugas
								Saya".
							</p>
						</div>
					</div>
					{#if form?.message}
						<p class="mt-3 text-sm text-red-600">{form.message}</p>
					{/if}
					<div class="mt-4">
						<Button type="submit" class="bg-emerald-600 text-white hover:bg-emerald-700">
							Simpan Petugas
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head>Nama Petugas</Table.Head>
						<Table.Head>Peran / Unit Tugas</Table.Head>
						<Table.Head>Nomor WhatsApp</Table.Head>
						<Table.Head>Cakupan Wilayah Tugas</Table.Head>
						<Table.Head>Status Tugas</Table.Head>
						<Table.Head>Penugasan Aktif</Table.Head>
						<Table.Head>Akun Login</Table.Head>
						<Table.Head class="text-right">Tindakan Super Admin</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.petugasList as officer (officer.id)}
						<Table.Row class="text-xs">
							<Table.Cell class="font-bold">{officer.nama}</Table.Cell>
							<Table.Cell>{officer.peran}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{officer.telepon}</Table.Cell>
							<Table.Cell>{officer.wilayahTugas}</Table.Cell>
							<Table.Cell>
								<Badge
									variant={officer.status === "SEDANG_BERTUGAS" ? "destructive" : "default"}
									class="text-[10px]"
								>
									{officer.status.replace("_", " ")}
								</Badge>
							</Table.Cell>
							<Table.Cell class="font-bold text-xs">{officer.jumlahTugasAktif} insiden</Table.Cell>
							<Table.Cell>
								{#if officer.userId}
									<Badge
										variant="outline"
										class="gap-1 text-[9px] text-emerald-700 dark:text-emerald-400"
									>
										<LinkIcon class="size-2.5" />
										Terhubung
									</Badge>
								{:else}
									<span class="text-[10px] text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<Button
										variant="ghost"
										size="sm"
										class="h-7 text-xs"
										title="Edit Petugas"
										aria-label="Edit petugas"
										onclick={() => bukaEdit(officer)}
									>
										<PencilIcon class="size-3.5" />
									</Button>
									<form method="POST" action="?/hapus" use:enhance>
										<input type="hidden" name="id" value={officer.id} />
										<Button
											type="submit"
											variant="ghost"
											size="sm"
											class="h-7 text-xs text-red-600 hover:text-red-700"
											title="Hapus Petugas"
											aria-label="Hapus petugas"
										>
											<TrashIcon class="size-3.5" />
										</Button>
									</form>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Content>
	</Card.Root>
</div>

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
