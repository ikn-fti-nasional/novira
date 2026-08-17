<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import ClipboardCheckIcon from "@lucide/svelte/icons/clipboard-check";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import UploadIcon from "@lucide/svelte/icons/upload";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import { invalidateAll } from "$app/navigation";
	import { toast } from "svelte-sonner";
	import type { Insiden } from "$lib/types/novira.js";

	let { data } = $props();

	let dialogTerbuka = $state(false);
	let insidenDipilih = $state<Insiden | null>(null);
	let buktiFile = $state<File | null>(null);
	let catatan = $state("");
	let mengirim = $state(false);

	function bukaDialog(insiden: Insiden) {
		insidenDipilih = insiden;
		buktiFile = null;
		catatan = "";
		dialogTerbuka = true;
	}

	function handlePilihFile(e: Event) {
		const target = e.target as HTMLInputElement;
		buktiFile = target.files?.[0] ?? null;
	}

	async function kirimLaporan() {
		if (!insidenDipilih || !buktiFile) return;
		mengirim = true;
		const formData = new FormData();
		formData.append("insidenId", insidenDipilih.id);
		formData.append("catatan", catatan);
		formData.append("buktiFoto", buktiFile);

		try {
			const response = await fetch("?/laporHasil", { method: "POST", body: formData });
			if (response.ok) {
				toast.success("Laporan hasil terkirim, insiden ditandai selesai");
				dialogTerbuka = false;
				await invalidateAll();
			} else {
				const body = (await response.json().catch(() => null)) as { message?: string } | null;
				toast.error(body?.message ?? "Gagal mengirim laporan, coba lagi");
			}
		} catch {
			toast.error("Gagal mengirim laporan, coba lagi");
		} finally {
			mengirim = false;
		}
	}

	function formatDurasi(menit: number) {
		const h = Math.floor(menit / 60);
		const m = menit % 60;
		if (h > 0) return `${h}j ${m}m`;
		return `${m}m`;
	}
</script>

<svelte:head>
	<title>Tugas Saya - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<ClipboardCheckIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Tugas Saya</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Daftar insiden sampah yang ditugaskan ke Anda. Lapor hasil penanganan begitu selesai.
		</p>
	</div>

	{#if !data.officer}
		<Card.Root class="border-amber-500/40">
			<Card.Content class="flex flex-col items-center gap-2 py-10 text-center">
				<ShieldAlertIcon class="size-8 text-amber-600 dark:text-amber-400" />
				<p class="font-semibold">Akun Anda belum terhubung ke data petugas lapangan.</p>
				<p class="max-w-md text-xs text-muted-foreground">
					Minta admin/operator menghubungkan akun login Anda ke salah satu entri di halaman Petugas
					Lapangan (kolom "Akun Login") agar tugas Anda bisa muncul di sini.
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-3">
			<h2 class="flex items-center gap-2 text-lg font-bold">
				Tugas Aktif
				<Badge variant="destructive" class="text-xs">{data.tugasAktif.length}</Badge>
			</h2>
			{#if data.tugasAktif.length === 0}
				<p class="text-sm text-muted-foreground">Tidak ada tugas aktif saat ini. Kerja bagus!</p>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.tugasAktif as insiden (insiden.id)}
						<Card.Root class="overflow-hidden">
							{#if insiden.urlSnapshot}
								<img
									src={insiden.urlSnapshot}
									alt="Snapshot insiden"
									class="aspect-video w-full object-cover"
								/>
							{/if}
							<Card.Content class="space-y-2 pt-4 text-xs">
								<div class="flex items-center justify-between">
									<span class="font-bold">{insiden.labelSampah}</span>
									<Badge variant="outline" class="text-[10px] uppercase">{insiden.keparahan}</Badge>
								</div>
								<p class="flex items-center gap-1 text-muted-foreground">
									<MapPinIcon class="size-3.5" />
									{insiden.namaKamera} — {insiden.lokasi}
								</p>
								<div class="flex items-center justify-between">
									<span class="flex items-center gap-1 text-muted-foreground">
										<ClockIcon class="size-3.5" />
										{formatDurasi(insiden.durasiMenit)}
									</span>
									{#if insiden.statusSla === "MELANGGAR_SLA"}
										<Badge variant="destructive" class="gap-1 text-[9px]">
											<ShieldAlertIcon class="size-2.5" />
											LANGGAR SLA
										</Badge>
									{/if}
								</div>
								<Button
									size="sm"
									class="mt-1 w-full bg-emerald-600 text-xs text-white hover:bg-emerald-700"
									onclick={() => bukaDialog(insiden)}
								>
									<CheckCircle2Icon class="mr-1.5 size-3.5" />
									Lapor Hasil
								</Button>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-3">
			<h2 class="text-lg font-bold">Riwayat Saya</h2>
			{#if data.riwayat.length === 0}
				<p class="text-sm text-muted-foreground">Belum ada riwayat penanganan.</p>
			{:else}
				<div class="space-y-2">
					{#each data.riwayat as insiden (insiden.id)}
						<Card.Root>
							<Card.Content class="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
								<div>
									<p class="font-bold">{insiden.labelSampah} — {insiden.lokasi}</p>
									{#if insiden.catatanPenyelesaian}
										<p class="italic text-muted-foreground">"{insiden.catatanPenyelesaian}"</p>
									{/if}
								</div>
								<Badge
									class={insiden.status === "SELESAI"
										? "bg-emerald-600 text-white"
										: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}
								>
									{insiden.status === "SELESAI" ? "SELESAI" : "POSITIF PALSU"}
								</Badge>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<Dialog.Root bind:open={dialogTerbuka}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Lapor Hasil Penanganan</Dialog.Title>
			<Dialog.Description>
				{#if insidenDipilih}
					{insidenDipilih.lokasi} — {insidenDipilih.labelSampah}. Upload foto bukti sampah sudah
					diangkut dan jelaskan apa yang dikerjakan.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-2 py-2">
			<Label for="ts-bukti-foto" class="text-xs font-semibold">Foto Bukti Penanganan *</Label>
			<label
				for="ts-bukti-foto"
				class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 p-6 text-center hover:border-emerald-500/50 hover:bg-emerald-500/5"
			>
				<UploadIcon class="size-6 text-muted-foreground" />
				<span class="text-xs text-muted-foreground">
					{buktiFile ? buktiFile.name : "Klik untuk pilih foto (JPG/PNG)"}
				</span>
			</label>
			<input
				id="ts-bukti-foto"
				type="file"
				accept="image/*"
				class="hidden"
				onchange={handlePilihFile}
			/>
		</div>

		<div class="space-y-2 pb-2">
			<Label for="ts-catatan" class="text-xs font-semibold">Catatan Hasil (opsional)</Label>
			<textarea
				id="ts-catatan"
				bind:value={catatan}
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
				disabled={!buktiFile || mengirim}
				onclick={kirimLaporan}
			>
				<CheckCircle2Icon class="mr-1.5 size-3.5" />
				{mengirim ? "Mengirim..." : "Kirim Laporan"}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
