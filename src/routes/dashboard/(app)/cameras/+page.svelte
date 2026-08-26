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
	import ListFilterIcon from "@lucide/svelte/icons/list-filter";
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

	const statusFilterOptions = [
		{ value: "SEMUA", label: "Semua Status" },
		{ value: "ONLINE", label: "Online" },
		{ value: "OFFLINE", label: "Offline" },
		{ value: "PERBAIKAN", label: "Perbaikan" }
	];

	const statusCounts = $derived({
		semua: data.kameraList.length,
		online: data.kameraList.filter((c) => c.status === "ONLINE").length,
		offline: data.kameraList.filter((c) => c.status === "OFFLINE").length,
		perbaikan: data.kameraList.filter((c) => c.status === "PERBAIKAN").length
	});

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
			onclick={() => (tambahOpen = true)}
		>
			<PlusIcon class="mr-1.5 size-4" />
			Tambah Kamera CCTV
		</Button>
	</div>

	<CameraFormDialog bind:open={tambahOpen} kotaList={data.kotaList} />

	<!-- FILTER & PENCARIAN -->
	<div class="flex flex-col gap-3">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="relative w-full max-w-sm">
				<SearchIcon class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input.Root
					placeholder="Cari nama kamera, kota, atau kecamatan..."
					class="pl-9"
					bind:value={search}
				/>
			</div>

			<div class="flex items-center gap-2">
				<div class="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1">
					<ListFilterIcon class="ml-1.5 size-3.5 text-muted-foreground" />
					<select
						bind:value={statusFilter}
						aria-label="Filter status kamera"
						class="h-7 rounded-md border border-input bg-background px-2 pr-6 text-xs font-medium focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
					>
						{#each statusFilterOptions as opt (opt.value)}
							<option value={opt.value}>
								{opt.label}{opt.value === "SEMUA"
									? ` (${statusCounts.semua})`
									: opt.value === "ONLINE"
										? ` (${statusCounts.online})`
										: opt.value === "OFFLINE"
											? ` (${statusCounts.offline})`
											: ` (${statusCounts.perbaikan})`}
							</option>
						{/each}
					</select>
				</div>

				{#if statusFilter !== "SEMUA" || search.trim()}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 px-2 text-xs"
						onclick={() => {
							search = "";
							statusFilter = "SEMUA";
						}}
					>
						Reset
					</Button>
				{/if}
			</div>
		</div>

		<!-- PILL FILTER STATUS -->
		<div class="flex flex-wrap items-center gap-1.5">
			<button
				type="button"
				onclick={() => (statusFilter = "SEMUA")}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors {statusFilter ===
				'SEMUA'
					? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
					: 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}"
			>
				Semua
				<span class="rounded-full px-1.5 py-0 text-[10px] leading-none {statusFilter === 'SEMUA' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'}">{statusCounts.semua}</span>
			</button>
			<button
				type="button"
				onclick={() => (statusFilter = "ONLINE")}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors {statusFilter ===
				'ONLINE'
					? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
					: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'}"
			>
				<span class="size-2 rounded-full {statusFilter === 'ONLINE' ? 'bg-white' : 'bg-emerald-500'}"></span>
				Online
				<span class="rounded-full px-1.5 py-0 text-[10px] leading-none {statusFilter === 'ONLINE' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'}">{statusCounts.online}</span>
			</button>
			<button
				type="button"
				onclick={() => (statusFilter = "OFFLINE")}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors {statusFilter ===
				'OFFLINE'
					? 'border-slate-700 bg-slate-700 text-white shadow-sm'
					: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300'}"
			>
				<span class="size-2 rounded-full {statusFilter === 'OFFLINE' ? 'bg-white' : 'bg-slate-400'}"></span>
				Offline
				<span class="rounded-full px-1.5 py-0 text-[10px] leading-none {statusFilter === 'OFFLINE' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}">{statusCounts.offline}</span>
			</button>
			<button
				type="button"
				onclick={() => (statusFilter = "PERBAIKAN")}
				class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors {statusFilter ===
				'PERBAIKAN'
					? 'border-amber-600 bg-amber-500 text-white shadow-sm'
					: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'}"
			>
				<span class="size-2 rounded-full {statusFilter === 'PERBAIKAN' ? 'bg-white' : 'bg-amber-500'}"></span>
				Perbaikan
				<span class="rounded-full px-1.5 py-0 text-[10px] leading-none {statusFilter === 'PERBAIKAN' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'}">{statusCounts.perbaikan}</span>
			</button>
			<span class="ml-2 text-xs text-muted-foreground">
				{filtered.length} dari {statusCounts.semua} kamera
				{#if statusFilter !== "SEMUA"}• filter: {statusFilter}{/if}
			</span>
		</div>
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