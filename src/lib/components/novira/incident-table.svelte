<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import UserPlusIcon from "@lucide/svelte/icons/user-plus";
	import XCircleIcon from "@lucide/svelte/icons/x-circle";
	import UploadIcon from "@lucide/svelte/icons/upload";
	import EyeIcon from "@lucide/svelte/icons/eye";
	import UsersIcon from "@lucide/svelte/icons/users";
	import type { Insiden, PetugasLapangan } from "$lib/types/novira.js";

	type Props = {
		insidenList: Insiden[];
		petugasList?: PetugasLapangan[];
		/**
		 * Jumlah baris maksimum yang digambar. Dipakai di dashboard supaya kartu
		 * ini tidak tumbuh sepanjang seluruh daftar insiden (79 baris membuat
		 * halaman harus digulir jauh sebelum sampai ke kartu berikutnya).
		 * Tanpa nilai = tampilkan semua (perilaku halaman Insiden).
		 */
		batasBaris?: number;
		/** Tautan "lihat semua" yang muncul saat daftar terpotong oleh `batasBaris`. */
		hrefSemua?: string;
		onSelesaikanTugas?: (insidenId: string, buktiFile: File, catatan: string) => void;
		onTugaskanPetugas?: (insidenId: string, petugasId: string) => void;
		onTandaiPositifPalsu?: (insidenId: string) => void;
	};

	let {
		insidenList,
		petugasList = [],
		batasBaris,
		hrefSemua,
		onSelesaikanTugas,
		onTugaskanPetugas,
		onTandaiPositifPalsu,
	}: Props = $props();

	let filterStatus = $state<string>("SEMUA");

	// State untuk dialog "Selesaikan Tugas"
	let dialogTerbuka = $state(false);
	let insidenDipilih = $state<Insiden | null>(null);
	let buktiFile = $state<File | null>(null);
	let catatanPenyelesaian = $state("");

	// State untuk dialog "Tugaskan Petugas"
	let dialogTugaskanTerbuka = $state(false);
	let insidenUntukTugaskan = $state<Insiden | null>(null);
	let petugasDipilih = $state<string>("");

	function bukaDialogTugaskan(insiden: Insiden) {
		insidenUntukTugaskan = insiden;
		petugasDipilih = "";
		dialogTugaskanTerbuka = true;
	}

	function konfirmasiTugaskan() {
		if (!insidenUntukTugaskan || !petugasDipilih) return;
		onTugaskanPetugas?.(insidenUntukTugaskan.id, petugasDipilih);
		dialogTugaskanTerbuka = false;
		insidenUntukTugaskan = null;
		petugasDipilih = "";
	}

	function tandaiPositifPalsu(insiden: Insiden) {
		if (
			!confirm(
				`Tandai insiden di ${insiden.lokasi} (${insiden.labelSampah}) sebagai positif palsu?`
			)
		) {
			return;
		}
		onTandaiPositifPalsu?.(insiden.id);
	}

	let insidenTersaring = $derived(
		filterStatus === "SEMUA"
			? insidenList
			: insidenList.filter(
					(i) =>
						i.status === filterStatus ||
						(filterStatus === "MELANGGAR_SLA" && i.statusSla === "MELANGGAR_SLA")
				)
	);

	// Pemotongan terjadi SETELAH penyaringan, supaya tombol filter tetap
	// bermakna di dashboard: "Melanggar SLA" menampilkan 8 pelanggaran teratas,
	// bukan pelanggaran yang kebetulan ada di 8 baris pertama daftar penuh.
	let insidenTampil = $derived(
		batasBaris === undefined ? insidenTersaring : insidenTersaring.slice(0, batasBaris)
	);
	let jumlahDisembunyikan = $derived(insidenTersaring.length - insidenTampil.length);

	function bukaDialogSelesai(insiden: Insiden) {
		insidenDipilih = insiden;
		buktiFile = null;
		catatanPenyelesaian = "";
		dialogTerbuka = true;
	}

	function handlePilihFile(e: Event) {
		const target = e.target as HTMLInputElement;
		buktiFile = target.files?.[0] ?? null;
	}

	function konfirmasiSelesai() {
		if (!insidenDipilih || !buktiFile) return;
		onSelesaikanTugas?.(insidenDipilih.id, buktiFile, catatanPenyelesaian);
		dialogTerbuka = false;
		insidenDipilih = null;
		buktiFile = null;
		catatanPenyelesaian = "";
	}

	/** Ambangnya sengaja sama dengan pemetaan skor→keparahan di `prioritas.ts`. */
	function warnaPrioritas(skor: number) {
		if (skor >= 75) return "text-red-600 dark:text-red-400";
		if (skor >= 55) return "text-amber-600 dark:text-amber-400";
		if (skor >= 35) return "text-blue-600 dark:text-blue-400";
		return "text-muted-foreground";
	}

	function getBadgeKeparahanClass(keparahan: string) {
		switch (keparahan) {
			case "KRITIS":
				return "bg-red-600/15 text-red-700 border-red-500/30 dark:bg-red-950/50 dark:text-red-400 font-bold";
			case "TINGGI":
				return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-400 font-semibold";
			case "SEDANG":
				return "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:bg-blue-950/50 dark:text-blue-400";
			default:
				return "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-400";
		}
	}

	function getBadgeStatusClass(status: string) {
		switch (status) {
			case "AKTIF":
				return "bg-red-600 text-white dark:bg-red-600 font-bold";
			case "PERINGATAN":
				return "bg-amber-500 text-slate-950 dark:bg-amber-400 font-semibold";
			case "SELESAI":
				return "bg-emerald-600 text-white dark:bg-emerald-500 font-semibold";
			case "POSITIF_PALSU":
				return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
			default:
				return "bg-slate-500 text-white";
		}
	}

	function formatDurasi(menit: number) {
		const h = Math.floor(menit / 60);
		const m = menit % 60;
		if (h > 0) return `${h}j ${m}m`;
		return `${m}m`;
	}

	function formatNamaStatus(status: string) {
		switch (status) {
			case "AKTIF":
				return "AKTIF";
			case "PERINGATAN":
				return "PERINGATAN";
			case "SELESAI":
				return "SELESAI";
			case "POSITIF_PALSU":
				return "POSITIF PALSU";
			default:
				return status;
		}
	}
</script>

<Card.Root class="border-border/80 shadow-md">
	<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<Card.Title class="text-xl font-bold tracking-tight">
					Daftar Peringatan Insiden Sampah
				</Card.Title>
				<Badge variant="destructive" class="px-2 py-0.5 text-xs font-semibold">
					{insidenList.filter((i) => i.status === "AKTIF").length} Insiden Aktif
				</Badge>
			</div>
			<Card.Description class="text-xs">
				Pemantauan waktu nyata penumpukan sampah liar dengan timer SLA pengangkutan (&lt;24 Jam).
			</Card.Description>
		</div>

		<!-- Filter Cepat -->
		<div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
			<Button
				variant={filterStatus === "SEMUA" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs font-medium"
				onclick={() => (filterStatus = "SEMUA")}
			>
				Semua ({insidenList.length})
			</Button>
			<Button
				variant={filterStatus === "AKTIF" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs text-red-600 dark:text-red-400 font-semibold"
				onclick={() => (filterStatus = "AKTIF")}
			>
				Aktif ({insidenList.filter((i) => i.status === "AKTIF").length})
			</Button>
			<Button
				variant={filterStatus === "MELANGGAR_SLA" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs text-amber-600 dark:text-amber-400 font-semibold"
				onclick={() => (filterStatus = "MELANGGAR_SLA")}
			>
				Melanggar SLA ({insidenList.filter((i) => i.statusSla === "MELANGGAR_SLA").length})
			</Button>
			<Button
				variant={filterStatus === "SELESAI" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold"
				onclick={() => (filterStatus = "SELESAI")}
			>
				Riwayat ({insidenList.filter((i) => i.status === "SELESAI").length})
			</Button>
		</div>
	</Card.Header>

	<Card.Content class="p-0">
		<!-- Judul kolom dipendekkan dan min-w diturunkan supaya 9 kolom muat di
		     lebar layar biasa (~1150px area konten) tanpa memotong tombol
		     tindakan; di layar lebih sempit pembungkus Table.Root sudah
		     overflow-x-auto sehingga tabel menggulir, bukan terpotong. -->
		<Table.Root class="min-w-[1040px]">
			<Table.Header>
				<Table.Row class="bg-muted/50 text-xs">
					<Table.Head class="w-[80px]">Prioritas</Table.Head>
					<Table.Head class="w-[100px]">Keparahan</Table.Head>
					<Table.Head class="min-w-[190px]">Lokasi &amp; Kamera</Table.Head>
					<Table.Head class="w-[120px]">Jenis Sampah</Table.Head>
					<Table.Head class="w-[70px]">Yakin</Table.Head>
					<Table.Head class="w-[80px]">Durasi</Table.Head>
					<Table.Head class="w-[100px]">Status</Table.Head>
					<Table.Head class="w-[130px]">Petugas</Table.Head>
					<Table.Head class="w-[190px] text-right">Tindakan</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each insidenTampil as insiden (insiden.id)}
					<Table.Row class="text-xs hover:bg-muted/40 transition-colors">
						<!--
							Skor prioritas + penjelasannya. Angka tanpa alasan tidak
							membantu siapa pun memutuskan, jadi rinciannya tampil di
							tooltip -- operator bisa langsung melihat "kenapa 87".
						-->
						<Table.Cell>
							<Tooltip.Provider>
								<Tooltip.Root>
									<Tooltip.Trigger>
										<div class="flex items-center gap-1.5">
											<span
												class={`font-mono text-sm font-bold ${warnaPrioritas(insiden.skorPrioritas)}`}
											>
												{insiden.skorPrioritas}
											</span>
											{#if insiden.sumber === "LAPORAN_WARGA"}
												<UsersIcon class="size-3 text-blue-600 dark:text-blue-400" />
											{/if}
											{#if insiden.tingkatEskalasi > 0}
												<span
													class="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200"
												>
													E{insiden.tingkatEskalasi}
												</span>
											{/if}
										</div>
									</Tooltip.Trigger>
									<Tooltip.Content class="max-w-xs">
										{#if insiden.rincianPrioritas.length === 0}
											<p class="text-xs">Skor belum dihitung untuk insiden ini.</p>
										{:else}
											<p class="mb-1 text-xs font-semibold">
												Skor prioritas {insiden.skorPrioritas}/100
											</p>
											<ul class="space-y-0.5">
												{#each insiden.rincianPrioritas as f (f.label)}
													<li class="text-[11px]">
														<span class="font-mono">{f.poin > 0 ? "+" : ""}{f.poin}</span>
														{f.label} — {f.keterangan}
													</li>
												{/each}
											</ul>
										{/if}
										{#if insiden.sumber === "LAPORAN_WARGA"}
											<p class="mt-1 border-t pt-1 text-[11px]">
												Dari laporan warga{insiden.kodeLaporan ? ` ${insiden.kodeLaporan}` : ""}
											</p>
										{/if}
									</Tooltip.Content>
								</Tooltip.Root>
							</Tooltip.Provider>
						</Table.Cell>

						<!-- Keparahan -->
						<Table.Cell>
							<div class="flex flex-col gap-1">
								<Badge
									variant="outline"
									class={`w-fit text-[10px] uppercase ${getBadgeKeparahanClass(insiden.keparahan)}`}
								>
									{insiden.keparahan}
								</Badge>
								{#if insiden.statusSla === "MELANGGAR_SLA"}
									<span
										class="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600 dark:text-red-400"
									>
										<ShieldAlertIcon class="size-3" />
										LANGGAR SLA
									</span>
								{/if}
							</div>
						</Table.Cell>

						<!-- Lokasi -->
						<Table.Cell>
							<div class="flex flex-col">
								<span class="font-bold text-foreground">{insiden.lokasi}</span>
								<span class="text-[11px] text-muted-foreground"
									>{insiden.namaKamera}{insiden.kelurahan ? ` (${insiden.kelurahan})` : ""}</span
								>
							</div>
						</Table.Cell>

						<!-- Jenis Sampah -->
						<Table.Cell>
							<div class="flex items-center gap-1.5">
								<div class="size-2 rounded-full bg-emerald-500"></div>
								<span class="font-medium">{insiden.labelSampah}</span>
							</div>
						</Table.Cell>

						<!-- Kepercayaan AI -->
						<Table.Cell>
							<span class="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
								{Math.round(insiden.tingkatKepercayaan * 100)}%
							</span>
						</Table.Cell>

						<!-- Durasi -->
						<Table.Cell>
							<div class="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
								<ClockIcon class="size-3.5 text-muted-foreground" />
								{formatDurasi(insiden.durasiMenit)}
							</div>
						</Table.Cell>

						<!-- Status -->
						<Table.Cell>
							<Badge class={`text-[10px] ${getBadgeStatusClass(insiden.status)}`}>
								{formatNamaStatus(insiden.status)}
							</Badge>
						</Table.Cell>

						<!-- Petugas -->
						<Table.Cell>
							{#if insiden.petugasDitugaskan}
								<span class="text-xs font-medium text-slate-800 dark:text-slate-200">
									{insiden.petugasDitugaskan}
								</span>
							{:else}
								<span class="text-xs italic text-amber-600 dark:text-amber-400 font-medium">
									Belum Ditugaskan
								</span>
							{/if}
						</Table.Cell>

						<!-- Tindakan Super Admin -->
						<Table.Cell class="text-right">
							<div class="flex items-center justify-end gap-1">
								<Button
									variant="ghost"
									size="sm"
									class="h-7 text-[11px] text-slate-500 hover:text-slate-900"
									title="Lihat Detail & Riwayat"
									aria-label="Lihat detail insiden"
									href="/dashboard/incidents/{insiden.id}"
								>
									<EyeIcon class="size-3.5" />
								</Button>
								{#if insiden.status === "AKTIF" || insiden.status === "PERINGATAN"}
									{#if insiden.petugasDitugaskan}
										<Button
											variant="outline"
											size="sm"
											class="h-7 text-[11px] hover:bg-emerald-500/10 hover:text-emerald-700"
											onclick={() => bukaDialogSelesai(insiden)}
										>
											<CheckCircle2Icon class="mr-1 size-3" />
											Selesaikan Tugas
										</Button>
									{:else}
										<Button
											variant="outline"
											size="sm"
											class="h-7 text-[11px] hover:bg-emerald-500/10 hover:text-emerald-700"
											onclick={() => bukaDialogTugaskan(insiden)}
										>
											<UserPlusIcon class="mr-1 size-3" />
											Tugaskan
										</Button>
									{/if}
									<Button
										variant="ghost"
										size="sm"
										class="h-7 text-[11px] text-slate-500 hover:text-slate-900"
										title="Tandai Positif Palsu"
										onclick={() => tandaiPositifPalsu(insiden)}
									>
										<XCircleIcon class="size-3.5" />
									</Button>
								{:else if insiden.status === "SELESAI"}
									<span
										class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
									>
										<CheckCircle2Icon class="size-3.5" />
										Terangkut
									</span>
								{:else}
									<span class="text-[11px] text-muted-foreground font-medium">Diverifikasi</span>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={9} class="text-muted-foreground py-10 text-center text-xs">
							{#if insidenList.length === 0}
								Belum ada insiden sampah tercatat. Jalankan siklus deteksi CCTV untuk mulai mengisi
								daftar ini.
							{:else}
								Tidak ada insiden yang cocok dengan filter ini.
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</Card.Content>

	{#if jumlahDisembunyikan > 0}
		<Card.Footer class="bg-muted/30 flex items-center justify-between border-t px-4 py-2.5">
			<span class="text-muted-foreground text-xs">
				Menampilkan {insidenTampil.length} insiden prioritas tertinggi &middot; {jumlahDisembunyikan}
				lainnya tidak ditampilkan
			</span>
			{#if hrefSemua}
				<Button variant="outline" size="sm" class="h-7 text-xs font-semibold" href={hrefSemua}>
					Lihat semua insiden
				</Button>
			{/if}
		</Card.Footer>
	{/if}
</Card.Root>

<Dialog.Root bind:open={dialogTerbuka}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Selesaikan Tugas Insiden</Dialog.Title>
			<Dialog.Description>
				{#if insidenDipilih}
					{insidenDipilih.lokasi} — {insidenDipilih.labelSampah}. Upload foto bukti sampah sudah
					diangkut sebelum menandai insiden ini selesai.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-2 py-2">
			<Label for="bukti-foto" class="text-xs font-semibold">Foto Bukti Penanganan *</Label>
			<label
				for="bukti-foto"
				class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 p-6 text-center hover:border-emerald-500/50 hover:bg-emerald-500/5"
			>
				<UploadIcon class="size-6 text-muted-foreground" />
				<span class="text-xs text-muted-foreground">
					{buktiFile ? buktiFile.name : "Klik untuk pilih foto (JPG/PNG)"}
				</span>
			</label>
			<input
				id="bukti-foto"
				type="file"
				accept="image/*"
				class="hidden"
				onchange={handlePilihFile}
			/>
		</div>

		<div class="space-y-2 pb-2">
			<Label for="catatan-penyelesaian" class="text-xs font-semibold">
				Catatan Hasil (opsional)
			</Label>
			<textarea
				id="catatan-penyelesaian"
				bind:value={catatanPenyelesaian}
				rows="3"
				placeholder="Contoh: sampah sudah diangkut 2 karung, area dibersihkan."
				class="w-full rounded-md border border-border/60 bg-transparent p-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
			></textarea>
		</div>

		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (dialogTerbuka = false)}>Batal</Button>
			<Button
				size="sm"
				class="bg-emerald-600 text-white hover:bg-emerald-700"
				disabled={!buktiFile}
				onclick={konfirmasiSelesai}
			>
				<CheckCircle2Icon class="mr-1.5 size-3.5" />
				Tandai Selesai
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={dialogTugaskanTerbuka}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Tugaskan Petugas Lapangan</Dialog.Title>
			<Dialog.Description>
				{#if insidenUntukTugaskan}
					{insidenUntukTugaskan.lokasi} — {insidenUntukTugaskan.labelSampah}. Pilih petugas yang
					akan menangani insiden ini.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-2 py-2">
			<Label class="text-xs font-semibold">Petugas Lapangan *</Label>
			{#if petugasList.length === 0}
				<p class="text-xs text-muted-foreground">
					Belum ada petugas terdaftar. Tambahkan lewat halaman Petugas Lapangan.
				</p>
			{:else}
				<Select.Root type="single" bind:value={petugasDipilih}>
					<Select.Trigger>
						<span>
							{petugasDipilih
								? (petugasList.find((p) => p.id === petugasDipilih)?.nama ?? "Pilih petugas")
								: "Pilih petugas"}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each petugasList as petugas (petugas.id)}
							<Select.Item value={petugas.id}>
								{petugas.nama} — {petugas.peran} ({petugas.wilayahTugas})
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (dialogTugaskanTerbuka = false)}
				>Batal</Button
			>
			<Button
				size="sm"
				class="bg-emerald-600 text-white hover:bg-emerald-700"
				disabled={!petugasDipilih}
				onclick={konfirmasiTugaskan}
			>
				<UserPlusIcon class="mr-1.5 size-3.5" />
				Tugaskan
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
