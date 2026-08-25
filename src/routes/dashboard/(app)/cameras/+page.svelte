<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TrashIcon from "@lucide/svelte/icons/trash";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import type { ActionResult } from "@sveltejs/kit";

	let { data, form } = $props();

	let showForm = $state(false);
	let search = $state("");
	let pageSize = $state(10);
	let currentPage = $state(1);

	// Kamera yang menunggu konfirmasi hapus.
	let hapusOpen = $state(false);
	let hapusId = $state("");
	let hapusNama = $state("");

	function toastHasilAksi(result: ActionResult, namaSukses: string, pesanGagalDefault: string) {
		if (result.type === "failure") {
			const data = result.data as { message?: string } | undefined;
			toast.error(data?.message ?? pesanGagalDefault);
		} else if (result.type === "success") {
			toast.success(namaSukses);
		}
	}

	const filtered = $derived(
		data.kameraList.filter(
			(cam) =>
				cam.nama.toLowerCase().includes(search.toLowerCase()) ||
				cam.kota.toLowerCase().includes(search.toLowerCase()) ||
				(cam.kecamatan ?? "").toLowerCase().includes(search.toLowerCase())
		)
	);

	const paginated = $derived(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize));

	$effect(() => {
		search;
		currentPage = 1;
	});

	const statusOptions = [
		{ value: "ONLINE", label: "ONLINE" },
		{ value: "OFFLINE", label: "OFFLINE" },
		{ value: "PERBAIKAN", label: "PERBAIKAN" }
	];

	// State lokal supaya label pemicu Select ikut berubah saat item dipilih.
	let statusBaru = $state("OFFLINE");

	function statusBadge(status: string): { variant: "default" | "secondary"; class: string } {
		switch (status) {
			case "ONLINE":
				return { variant: "default", class: "bg-emerald-600 text-white border-none" };
			case "PERBAIKAN":
				return { variant: "secondary", class: "bg-amber-500 text-white border-none" };
			default:
				return { variant: "secondary", class: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200" };
		}
	}
</script>

<svelte:head>
	<title>Manajemen Kamera CCTV - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<!-- HEADER HALAMAN -->
	<div
		class="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex flex-col gap-1">
			<div class="flex items-center gap-2">
				<CameraIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
				<h1 class="text-3xl font-extrabold tracking-tight">Manajemen Kamera CCTV</h1>
			</div>
			<p class="text-sm text-muted-foreground">
				Kelola umpan CCTV publik dari berbagai kota — tambah link stream, pantau status, dan atur
				wilayah.
			</p>
		</div>

		<Button
			variant="default"
			size="sm"
			class="h-9 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-800"
			onclick={() => (showForm = !showForm)}
		>
			<PlusIcon class="mr-1.5 size-4" />
			{showForm ? "Tutup Form" : "Tambah Kamera CCTV"}
		</Button>
	</div>

	<!-- FORM TAMBAH KAMERA -->
	{#if showForm}
		<Card.Root class="border-emerald-800/20 shadow-md">
			<Card.Header class="bg-emerald-50/60 dark:bg-emerald-950/30">
				<Card.Title class="text-base font-bold text-emerald-950 dark:text-emerald-100">
					Tambah Kamera CCTV Baru
				</Card.Title>
				<Card.Description>
					Isi nama, kota, dan link umpan (HLS/MP4) atau snapshot dari CCTV publik.
				</Card.Description>
			</Card.Header>
			<Card.Content class="pt-4">
				<form
						method="POST"
						action="?/tambah"
						use:enhance={() => {
							return async ({ update, result }) => {
								await update();
								toastHasilAksi(result, "Kamera baru berhasil disimpan", "Gagal menyimpan kamera");
							};
						}}
					>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label.Root>Nama Kamera</Label.Root>
							<Input.Root name="nama" placeholder="CCTV Sudirman 1" required />
						</div>
						<div class="space-y-2">
							<Label.Root>Kota</Label.Root>
							<Input.Root name="kota" placeholder="Bandung" required list="kota-options" />
							<datalist id="kota-options">
								{#each data.kotaList as kota}
									<option value={kota}></option>
								{/each}
							</datalist>
						</div>
						<div class="space-y-2">
							<Label.Root>Kecamatan / Lokasi</Label.Root>
							<Input.Root name="kecamatan" placeholder="Bandung Wetan" />
						</div>
						<div class="space-y-2">
							<Label.Root>Status</Label.Root>
							<Select.Root type="single" name="status" bind:value={statusBaru}>
								<Select.Trigger class="w-full"><span>{statusBaru}</span></Select.Trigger>
								<Select.Content>
									{#each statusOptions as opt}
										<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
									{/each}
								</Select.Content>
							</Select.Root>
						</div>
						<div class="space-y-2 md:col-span-2">
							<Label.Root>URL Stream (HLS/MP4)</Label.Root>
							<Input.Root name="urlStream" placeholder="https://.../stream.m3u8" />
						</div>
						<div class="space-y-2 md:col-span-2">
							<Label.Root>URL Snapshot (gambar)</Label.Root>
							<Input.Root name="urlSnapshot" placeholder="https://.../snapshot.jpg" />
						</div>
					</div>
					{#if form?.message}
						<p class="mt-3 text-sm text-red-600">{form.message}</p>
					{/if}
					<div class="mt-4">
						<Button type="submit" class="bg-emerald-700 text-white hover:bg-emerald-800">
							Simpan Kamera
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- FITUR PENCARIAN -->
	<div class="relative max-w-sm">
		<SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
		<Input.Root
			placeholder="Cari nama kamera, kota, atau kecamatan..."
			class="pl-9"
			bind:value={search}
		/>
	</div>

	<!-- TABEL MANAJEMEN KAMERA -->
	<Card.Root class="overflow-hidden border-emerald-800/20 shadow-md">
		<Card.Content class="!p-0">
			<div class="relative w-full overflow-x-auto">
				<Table.Root class="w-full min-w-[750px] border-collapse text-left">
					<!-- HEADER TEGAS EMERALD -->
					<Table.Header>
						<Table.Row class="border-none bg-emerald-800 hover:bg-emerald-800">
							<Table.Head class="py-3.5 pl-4 text-xs font-bold uppercase tracking-wider text-emerald-50">Tindakan</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Nama Kamera</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Kota / Kecamatan</Table.Head>
							<Table.Head class="py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-50">Status</Table.Head>
							<Table.Head class="py-3.5 pr-4 text-xs font-bold uppercase tracking-wider text-emerald-50">Stream</Table.Head>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{#each paginated as cam, idx (cam.id)}
							<Table.Row
								class="border-b border-border/50 text-xs transition-colors {idx % 2 === 0
									? 'bg-white dark:bg-background'
									: 'bg-emerald-50/30 dark:bg-emerald-950/10'} hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30"
							>
								<!-- TINDAKAN (KEMBALI DI SEBELAH KIRI) -->
								<Table.Cell class="py-3 pl-4 whitespace-nowrap">
									<div class="flex items-center gap-1.5">
										<!-- Form ubah status otomatis kirim saat select berganti -->
										<form
											method="POST"
											action="?/ubahStatus"
											use:enhance={() => {
												return async ({ update, result }) => {
													await update();
													toastHasilAksi(
														result,
														`Status ${cam.nama} diperbarui`,
														`Gagal mengubah status ${cam.nama}`
													);
												};
											}}
										>
											<input type="hidden" name="id" value={cam.id} />
											<select
												name="status"
												class="h-7 rounded border border-input bg-background px-2 text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-600"
												onchange={(e) => e.currentTarget.form?.requestSubmit()}
											>
												{#each statusOptions as opt}
													<option value={opt.value} selected={cam.status === opt.value}>
														{opt.label}
													</option>
												{/each}
											</select>
										</form>

										<!-- Hapus kamera: wajib lewat dialog konfirmasi dulu -->
										<Button
											variant="ghost"
											size="sm"
											class="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50"
											title="Hapus Kamera"
											aria-label={`Hapus kamera ${cam.nama}`}
											onclick={() => {
												hapusId = cam.id;
												hapusNama = cam.nama;
												hapusOpen = true;
											}}
										>
											<TrashIcon class="size-3.5" />
										</Button>
									</div>
								</Table.Cell>

								<!-- NAMA KAMERA -->
								<Table.Cell class="py-3 font-bold text-foreground">
									{cam.nama}
								</Table.Cell>

								<!-- KOTA / KECAMATAN -->
								<Table.Cell class="py-3 text-muted-foreground">
									{cam.kota}{cam.kecamatan ? `, ${cam.kecamatan}` : ""}
								</Table.Cell>

								<!-- STATUS BADGE -->
								<Table.Cell class="py-3">
									<Badge
										variant={statusBadge(cam.status).variant}
										class="{statusBadge(cam.status).class} font-semibold text-[10px]"
									>
										{cam.status}
									</Badge>
								</Table.Cell>

								<!-- LINK STREAM -->
								<Table.Cell class="py-3 pr-4 whitespace-nowrap">
									{#if cam.urlStream}
										<a
											href={cam.urlStream}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
										>
											Link Stream <ExternalLinkIcon class="size-3" />
										</a>
									{:else}
										<span class="text-muted-foreground">-</span>
									{/if}
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={5} class="h-24 text-center text-xs text-muted-foreground">
									{search
										? "Tidak ada kamera yang cocok dengan pencarian."
										: "Belum ada kamera CCTV."}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
			<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
		</Card.Content>
	</Card.Root>

	<DeleteConfirmDialog
		bind:open={hapusOpen}
		action="?/hapus"
		id={hapusId}
		itemName={`kamera ${hapusNama}`}
	/>
</div>