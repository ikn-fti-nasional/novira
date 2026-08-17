<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TrashIcon from "@lucide/svelte/icons/trash";
	import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
	import SearchIcon from "@lucide/svelte/icons/search";
	import { enhance } from "$app/forms";

	let { data, form } = $props();

	let showForm = $state(false);
	let search = $state("");
	let pageSize = $state(10);
	let currentPage = $state(1);

	const filtered = $derived(
		data.kameraList.filter(
			(cam) =>
				cam.nama.toLowerCase().includes(search.toLowerCase()) ||
				cam.kota.toLowerCase().includes(search.toLowerCase()) ||
				(cam.kecamatan ?? "").toLowerCase().includes(search.toLowerCase())
		)
	);

	const paginated = $derived(
		filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	$effect(() => {
		search;
		currentPage = 1;
	});

	const statusOptions = [
		{ value: "ONLINE", label: "ONLINE" },
		{ value: "OFFLINE", label: "OFFLINE" },
		{ value: "PERBAIKAN", label: "PERBAIKAN" },
	];

	function statusBadge(status: string): { variant: "default" | "secondary"; class: string } {
		switch (status) {
			case "ONLINE":
				return { variant: "default", class: "bg-emerald-600 text-white" };
			case "PERBAIKAN":
				return { variant: "secondary", class: "bg-amber-500 text-white" };
			default:
				return { variant: "secondary", class: "" };
		}
	}
</script>

<svelte:head>
	<title>Manajemen Kamera CCTV - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div
		class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4"
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
			class="h-9 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
			onclick={() => (showForm = !showForm)}
		>
			<PlusIcon class="mr-1.5 size-4" />
			{showForm ? "Tutup Form" : "Tambah Kamera CCTV"}
		</Button>
	</div>

	{#if showForm}
		<Card.Root class="border-emerald-600/40">
			<Card.Header>
				<Card.Title class="text-base">Tambah Kamera CCTV Baru</Card.Title>
				<Card.Description>
					Isi nama, kota, dan link umpan (HLS/MP4) atau snapshot dari CCTV publik.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/tambah" use:enhance>
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
							<Select.Root type="single" name="status" value="OFFLINE">
								<Select.Trigger class="w-full"><span>OFFLINE</span></Select.Trigger>
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
						<Button type="submit" class="bg-emerald-600 text-white hover:bg-emerald-700">
							Simpan Kamera
						</Button>
					</div>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<div class="relative max-w-sm">
		<SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
		<Input.Root placeholder="Cari nama kamera, kota, atau kecamatan..." class="pl-9" bind:value={search} />
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<Table.Root>
				<Table.Header>
					<Table.Row class="bg-muted/50 text-xs">
						<Table.Head>Nama Kamera</Table.Head>
						<Table.Head>Kota / Kecamatan</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Stream</Table.Head>
						<Table.Head class="text-right">Tindakan</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each paginated as cam (cam.id)}
						<Table.Row class="text-xs">
							<Table.Cell class="font-bold">{cam.nama}</Table.Cell>
							<Table.Cell>{cam.kota}{cam.kecamatan ? `, ${cam.kecamatan}` : ""}</Table.Cell>
							<Table.Cell>
								<Badge
									variant={statusBadge(cam.status).variant}
									class={statusBadge(cam.status).class}
								>
									{cam.status}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if cam.urlStream}
									<a
										href={cam.urlStream}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-1 text-emerald-600 hover:underline"
									>
										Link Stream <ExternalLinkIcon class="size-3" />
									</a>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<form method="POST" action="?/ubahStatus" use:enhance>
										<input type="hidden" name="id" value={cam.id} />
										<select name="status" class="h-7 rounded-md border bg-background px-2 text-xs">
											{#each statusOptions as opt}
												<option value={opt.value} selected={cam.status === opt.value}>
													{opt.label}
												</option>
											{/each}
										</select>
										<Button type="submit" variant="outline" size="sm" class="h-7 text-xs">
											Terapkan
										</Button>
									</form>
									<form method="POST" action="?/hapus" use:enhance>
										<input type="hidden" name="id" value={cam.id} />
										<Button
											variant="ghost"
											size="sm"
											class="h-7 text-xs text-red-600 hover:text-red-700"
											title="Hapus Kamera"
											aria-label="Hapus Kamera"
										>
											<TrashIcon class="size-3.5" />
										</Button>
									</form>
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={5} class="h-24 text-center text-xs text-muted-foreground">
								{search ? "Tidak ada kamera yang cocok dengan pencarian." : "Belum ada kamera CCTV."}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
			<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
		</Card.Content>
	</Card.Root>
</div>
