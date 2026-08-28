<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import PageHeader from "$lib/components/novira/page-header.svelte";
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
	import CameraFormDialog from "$lib/components/camera-form-dialog.svelte";

	let { data, form } = $props();

	let tambahOpen = $state(false);
	let search = $state("");
	let statusFilter = $state("SEMUA");
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

	const statusCounts = $derived({
		semua: data.kameraList.length,
		online: data.kameraList.filter((c) => c.status === "ONLINE").length,
		offline: data.kameraList.filter((c) => c.status === "OFFLINE").length,
		perbaikan: data.kameraList.filter((c) => c.status === "PERBAIKAN").length,
	});

	/** Pill filter status. `dot` diberi kelas penuh (bukan rakitan runtime)
	 *  supaya Tailwind ikut memindainya. */
	const statusFilterOptions = $derived([
		{ value: "SEMUA", label: "Semua", jumlah: statusCounts.semua, dot: "bg-muted-foreground" },
		{ value: "ONLINE", label: "Online", jumlah: statusCounts.online, dot: "bg-emerald-500" },
		{ value: "OFFLINE", label: "Offline", jumlah: statusCounts.offline, dot: "bg-slate-400" },
		{
			value: "PERBAIKAN",
			label: "Perbaikan",
			jumlah: statusCounts.perbaikan,
			dot: "bg-amber-500",
		},
	]);

	const filtered = $derived(
		data.kameraList.filter((cam) => {
			const q = search.trim().toLowerCase();
			const matchSearch =
				!q ||
				cam.nama.toLowerCase().includes(q) ||
				cam.kota.toLowerCase().includes(q) ||
				(cam.kecamatan ?? "").toLowerCase().includes(q);
			const matchStatus = statusFilter === "SEMUA" || cam.status === statusFilter;
			return matchSearch && matchStatus;
		})
	);

	const paginated = $derived(filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize));

	$effect(() => {
		search;
		statusFilter;
		currentPage = 1;
	});

	const statusOptions = [
		{ value: "ONLINE", label: "ONLINE" },
		{ value: "OFFLINE", label: "OFFLINE" },
		{ value: "PERBAIKAN", label: "PERBAIKAN" },
	];

	// State lokal supaya label pemicu Select ikut berubah saat item dipilih.
	let statusBaru = $state("OFFLINE");

	/** Badge status kamera — nada lembut yang sama dipakai di seluruh dasbor,
	 *  bukan blok warna solid yang menenggelamkan isi tabel. */
	function statusBadge(status: string): { variant: "outline"; class: string } {
		switch (status) {
			case "ONLINE":
				return {
					variant: "outline",
					class: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
				};
			case "PERBAIKAN":
				return {
					variant: "outline",
					class: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
				};
			default:
				return {
					variant: "outline",
					class: "border-slate-400/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
				};
		}
	}
</script>

<svelte:head>
	<title>Manajemen Kamera CCTV - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Manajemen Kamera CCTV"
		eyebrow="Infrastruktur Pemantauan"
		description="Kelola umpan CCTV publik dari berbagai kota — tambah link stream, pantau status, dan atur wilayah."
		icon={CameraIcon}
	>
		{#snippet actions()}
			<Button size="sm" class="h-9 text-xs font-semibold" onclick={() => (tambahOpen = true)}>
				<PlusIcon class="mr-1.5 size-4" />
				Tambah Kamera CCTV
			</Button>
		{/snippet}
	</PageHeader>

	<CameraFormDialog bind:open={tambahOpen} kotaList={data.kotaList} />

	<!-- FILTER & PENCARIAN -->
	<div class="bg-card flex flex-col gap-3 rounded-xl border p-3 sm:p-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="relative w-full sm:max-w-sm">
				<SearchIcon
					class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
				/>
				<Input.Root
					placeholder="Cari nama kamera, kota, atau kecamatan..."
					class="h-9 pl-9"
					bind:value={search}
				/>
			</div>

			<div class="text-muted-foreground flex items-center gap-3 text-xs">
				<span class="font-medium">
					Menampilkan <strong class="text-foreground">{filtered.length}</strong> dari
					{statusCounts.semua} kamera
				</span>
				{#if statusFilter !== "SEMUA" || search.trim()}
					<Button
						variant="ghost"
						size="sm"
						class="h-8 px-2 text-xs"
						onclick={() => {
							search = "";
							statusFilter = "SEMUA";
						}}
					>
						Reset filter
					</Button>
				{/if}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status kamera">
			{#each statusFilterOptions as opt (opt.value)}
				{@const aktif = statusFilter === opt.value}
				<button
					type="button"
					aria-pressed={aktif}
					onclick={() => (statusFilter = opt.value)}
					class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors {aktif
						? 'border-primary bg-primary text-primary-foreground shadow-sm'
						: 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
				>
					<span class="size-2 rounded-full {aktif ? 'bg-current opacity-70' : opt.dot}"></span>
					{opt.label}
					<span
						class="rounded-full px-1.5 text-[10px] leading-4 {aktif
							? 'bg-black/15'
							: 'bg-muted text-muted-foreground'}"
					>
						{opt.jumlah}
					</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- TABEL MANAJEMEN KAMERA -->
	<Card.Root class="overflow-hidden py-0">
		<Card.Content class="!p-0">
			<div class="relative w-full overflow-x-auto">
				<Table.Root class="w-full min-w-[750px] border-collapse text-left">
					<Table.Header>
						<Table.Row class="bg-muted/60 hover:bg-muted/60">
							<Table.Head class="py-3.5 pl-4">Tindakan</Table.Head>
							<Table.Head class="py-3.5">Nama Kamera</Table.Head>
							<Table.Head class="py-3.5">Kota / Kecamatan</Table.Head>
							<Table.Head class="py-3.5">Status</Table.Head>
							<Table.Head class="py-3.5 pr-4">Stream</Table.Head>
						</Table.Row>
					</Table.Header>

					<Table.Body>
						{#each paginated as cam (cam.id)}
							<Table.Row class="border-border/50 hover:bg-muted/50 border-b text-xs">
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
												class="border-input bg-background h-8 rounded-md border px-2 text-[11px] font-medium"
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
								<Table.Cell class="text-foreground py-3 font-bold">
									{cam.nama}
								</Table.Cell>

								<!-- KOTA / KECAMATAN -->
								<Table.Cell class="text-muted-foreground py-3">
									{cam.kota}{cam.kecamatan ? `, ${cam.kecamatan}` : ""}
								</Table.Cell>

								<!-- STATUS BADGE -->
								<Table.Cell class="py-3">
									<Badge
										variant={statusBadge(cam.status).variant}
										class="{statusBadge(cam.status).class} text-[10px] font-semibold"
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
								<Table.Cell colspan={5} class="text-muted-foreground h-24 text-center text-xs">
									{#if data.kameraList.length === 0}
										Belum ada kamera CCTV.
									{:else if search.trim() && statusFilter !== "SEMUA"}
										Tidak ada kamera "{statusFilter}" yang cocok dengan "{search}".
									{:else if search.trim()}
										Tidak ada kamera yang cocok dengan pencarian "{search}".
									{:else if statusFilter !== "SEMUA"}
										Tidak ada kamera dengan status {statusFilter}.
									{:else}
										Tidak ada kamera yang cocok.
									{/if}
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
