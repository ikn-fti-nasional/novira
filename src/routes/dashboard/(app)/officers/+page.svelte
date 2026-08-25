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
	import PhoneIcon from "@lucide/svelte/icons/phone";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import { enhance } from "$app/forms";
	import type { PetugasLapangan } from "$lib/types/novira.js";

	let { data, form } = $props();

	let showForm = $state(false);
	let dialogEditTerbuka = $state(false);
	let petugasDiedit = $state<PetugasLapangan | null>(null);

	const statusOptions = [
		{ value: "SIAP_TUGAS", label: "SIAP TUGAS" },
		{ value: "SEDANG_BERTUGAS", label: "SEDANG BERTUGAS" },
		{ value: "OFFLINE", label: "OFFLINE" }
	];

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
	<!-- HEADER HALAMAN -->
	<div
		class="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-emerald-600/10 p-2 dark:bg-emerald-500/20">
					<UserCheckIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				</div>
				<h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">
					Manajemen Petugas Lapangan &amp; Armada DLH
				</h1>
			</div>
			<p class="text-xs text-muted-foreground sm:text-sm">
				Daftar anggota personil Satpol PP dan kru armada pengangkut Dinas Lingkungan Hidup.
			</p>
		</div>

		<Button
			variant="default"
			size="sm"
			class="h-9 bg-emerald-600 text-xs font-semibold text-white shadow-md hover:bg-emerald-700"
			onclick={() => (showForm = !showForm)}
		>
			<PlusIcon class="mr-1.5 size-4" />
			{showForm ? "Tutup Form" : "Tambah Petugas Lapangan Baru"}
		</Button>
	</div>

	<!-- FORM TAMBAH PETUGAS -->
	{#if showForm}
		<Card.Root class="border-emerald-600/40 shadow-md">
			<Card.Header class="bg-emerald-50/80 pb-4 dark:bg-emerald-950/30">
				<Card.Title class="text-base text-emerald-950 dark:text-emerald-100">
					Tambah Petugas Lapangan Baru
				</Card.Title>
				<Card.Description class="text-xs">
					Isi data petugas atau kru armada yang akan ditugaskan ke lapangan.
				</Card.Description>
			</Card.Header>
			<Card.Content class="pt-4">
				<form method="POST" action="?/tambah" use:enhance>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label.Root>Nama Lengkap</Label.Root>
							<Input.Root name="nama" placeholder="Budi Santoso" required />
						</div>
						<div class="space-y-2">
							<Label.Root>Peran / Unit Tugas</Label.Root>
							<Input.Root name="peran" placeholder="Satpol PP / Driver TPS" required />
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
								<Select.Trigger class="w-full">
									<span>{labelStatus(statusBaru)}</span>
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
							<Select.Root type="single" name="userId" bind:value={akunBaru}>
								<Select.Trigger class="w-full">
									<span>{namaAkun(akunBaru) ?? "Tidak dihubungkan"}</span>
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
					</div>
					{#if form?.message}
						<p class="mt-3 text-sm font-medium text-red-600">{form.message}</p>
					{/if}
					<div class="mt-4 flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onclick={() => (showForm = false)}
						>
							Batal
						</Button>
						<Button type="submit" size="sm" class="bg-emerald-600 text-white hover:bg-emerald-700">
							Simpan Petugas
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- TABEL BERWARNA & BERKONTRAST -->
	<Card.Root class="overflow-hidden border-emerald-800/20 shadow-md">
		<Card.Content class="p-0">
			<div class="relative w-full overflow-x-auto">
				<Table.Root class="w-full min-w-[850px] border-collapse text-left">
					<!-- HEADER TABEL BERWARNA EMERALD TEGAS -->
					<Table.Header>
						<Table.Row class="bg-emerald-800 hover:bg-emerald-800 border-none">
							<Table.Head class="w-[90px] py-3.5 pl-4 text-xs font-bold uppercase tracking-wider text-emerald-50">Aksi</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Petugas</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Peran / Unit</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Kontak</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Wilayah</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Status Tugas</Table.Head>
							<Table.Head class="py-3.5 text-center text-xs font-bold uppercase tracking-wider text-emerald-50">Penugasan Aktif</Table.Head>
							<Table.Head class="py-3.5 pr-4 text-xs font-bold uppercase tracking-wider text-emerald-50">Akun Login</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.petugasList as officer, idx (officer.id)}
							<Table.Row class="border-b border-border/50 transition-colors {idx % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-emerald-50/30 dark:bg-emerald-950/10'} hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30">
								<!-- AKSI -->
								<Table.Cell class="py-3 pl-4">
									<div class="flex items-center gap-1.5">
										<!-- TOMBOL EDIT (HIJAU KONTRAS) -->
										<Button
											variant="ghost"
											size="icon"
											class="size-7 rounded-md bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-800"
											title="Edit Petugas"
											onclick={() => bukaEdit(officer)}
										>
											<PencilIcon class="size-3.5" />
										</Button>

										<!-- TOMBOL DELETE (MERAH TEGAS) -->
										<form method="POST" action="?/hapus" use:enhance>
											<input type="hidden" name="id" value={officer.id} />
											<Button
												type="submit"
												variant="ghost"
												size="icon"
												class="size-7 rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900"
												title="Hapus Petugas"
											>
												<TrashIcon class="size-3.5" />
											</Button>
										</form>
									</div>
								</Table.Cell>

								<!-- NAMA PETUGAS (+ AVATAR EMERALD) -->
								<Table.Cell class="py-3">
									<div class="flex items-center gap-2.5">
										<div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shadow-xs">
											{getInisial(officer.nama)}
										</div>
										<span class="font-bold text-foreground text-xs sm:text-sm">{officer.nama}</span>
									</div>
								</Table.Cell>

								<!-- PERAN -->
								<Table.Cell class="py-3 text-xs">
									<span class="inline-block rounded-md bg-emerald-100/70 px-2 py-0.5 font-semibold text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
										{officer.peran}
									</span>
								</Table.Cell>

								<!-- KONTAK -->
								<Table.Cell class="py-3 text-xs">
									<div class="flex items-center gap-1.5 font-mono font-medium text-foreground/80">
										<PhoneIcon class="size-3.5 text-emerald-600 dark:text-emerald-400" />
										<span>{officer.telepon}</span>
									</div>
								</Table.Cell>

								<!-- WILAYAH -->
								<Table.Cell class="py-3 text-xs">
									<div class="flex items-center gap-1 font-semibold text-foreground/90">
										<MapPinIcon class="size-3.5 text-rose-600 dark:text-rose-400" />
										<span>{officer.wilayahTugas}</span>
									</div>
								</Table.Cell>

								<!-- STATUS BADGE -->
								<Table.Cell class="py-3">
									{#if officer.status === "SEDANG_BERTUGAS"}
										<Badge class="border border-amber-300 bg-amber-500/20 text-[10px] font-bold text-amber-800 hover:bg-amber-500/30 dark:bg-amber-500/30 dark:text-amber-200">
											<span class="mr-1.5 size-1.5 animate-pulse rounded-full bg-amber-600"></span>
											SEDANG BERTUGAS
										</Badge>
									{:else if officer.status === "SIAP_TUGAS"}
										<Badge class="border border-emerald-300 bg-emerald-600/20 text-[10px] font-bold text-emerald-800 hover:bg-emerald-600/30 dark:bg-emerald-500/30 dark:text-emerald-200">
											<span class="mr-1.5 size-1.5 rounded-full bg-emerald-600"></span>
											SIAP TUGAS
										</Badge>
									{:else}
										<Badge variant="outline" class="border-slate-300 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
											OFFLINE
										</Badge>
									{/if}
								</Table.Cell>

								<!-- PENUGASAN AKTIF -->
								<Table.Cell class="py-3 text-center">
									{#if officer.jumlahTugasAktif > 0}
										<span class="inline-flex items-center rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-400">
											{officer.jumlahTugasAktif} insiden
										</span>
									{:else}
										<span class="text-xs font-medium text-muted-foreground">0 insiden</span>
									{/if}
								</Table.Cell>

								<!-- AKUN LOGIN -->
								<Table.Cell class="py-3 pr-4">
									{#if officer.userId}
										<Badge variant="outline" class="gap-1 border-emerald-600/40 bg-emerald-100/50 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
											<LinkIcon class="size-2.5" />
											Terhubung
										</Badge>
									{:else}
										<span class="text-xs text-muted-foreground">-</span>
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