<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import CheckIcon from "@lucide/svelte/icons/check";
	import SearchIcon from "@lucide/svelte/icons/search";
	import CircleIcon from "@lucide/svelte/icons/circle";
	import type { PageData } from "./$types.js";

	let { data }: { data: PageData } = $props();

	const LABEL_STATUS: Record<string, { teks: string; kelas: string }> = {
		MENUNGGU: {
			teks: "Menunggu verifikasi",
			kelas: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
		},
		DIPROSES: {
			teks: "Sedang ditangani",
			kelas: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
		},
		SELESAI: {
			teks: "Selesai",
			kelas: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
		},
		DITOLAK: {
			teks: "Tidak ditindaklanjuti",
			kelas: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
		},
		DUPLIKAT: {
			teks: "Digabungkan",
			kelas: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
		},
	};

	function formatWaktu(iso: string | null): string {
		if (!iso) return "";
		return new Date(iso).toLocaleString("id-ID", {
			dateStyle: "medium",
			timeStyle: "short",
			timeZone: "Asia/Jakarta",
		});
	}
</script>

<svelte:head>
	<title>Lacak Laporan - Novira</title>
	<meta
		name="description"
		content="Pantau perkembangan penanganan laporan sampah Anda dengan kode laporan."
	/>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-16">
	<h1 class="text-3xl font-extrabold tracking-tight">Lacak Laporan</h1>
	<p class="mt-2 text-muted-foreground">
		Masukkan kode laporan yang Anda terima setelah melapor untuk melihat perkembangan penanganannya.
	</p>

	<form method="GET" class="mt-6 flex flex-wrap items-end gap-3">
		<div class="min-w-56 flex-1 space-y-2">
			<Label for="kode">Kode laporan</Label>
			<Input
				id="kode"
				name="kode"
				value={data.kode}
				placeholder="LPR-XXXXXX"
				autocomplete="off"
				class="font-mono uppercase"
			/>
		</div>
		<Button type="submit">
			<SearchIcon class="size-4" />
			Lacak
		</Button>
	</form>

	{#if data.tidakDitemukan}
		<Card.Root class="mt-8 border-amber-300 dark:border-amber-800">
			<Card.Content class="pt-6">
				<p class="font-medium">Kode laporan tidak ditemukan.</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Periksa kembali penulisannya — kode terdiri dari awalan <span class="font-mono">LPR-</span
					>
					diikuti 6 karakter. Kode tidak memakai angka 0, 1, huruf O, I, atau L.
				</p>
			</Card.Content>
		</Card.Root>
	{:else if data.hasil}
		{@const hasil = data.hasil}
		<Card.Root class="mt-8">
			<Card.Header>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<Card.Title class="font-mono text-xl">{hasil.kodeTracking}</Card.Title>
						<Card.Description>
							Dilaporkan {formatWaktu(hasil.dibuatPada)} · {hasil.lokasi}
						</Card.Description>
					</div>
					<Badge class={LABEL_STATUS[hasil.status]?.kelas ?? ""}>
						{LABEL_STATUS[hasil.status]?.teks ?? hasil.status}
					</Badge>
				</div>
			</Card.Header>
			<Card.Content>
				<ol class="relative space-y-6 border-l pl-6">
					{#each hasil.linimasa as langkah (langkah.judul)}
						<li class="relative">
							<span
								class="absolute -left-[31px] flex size-5 items-center justify-center rounded-full border-2 {langkah.selesai
									? 'border-emerald-600 bg-emerald-600 text-white'
									: 'border-muted-foreground/40 bg-background text-muted-foreground'}"
							>
								{#if langkah.selesai}
									<CheckIcon class="size-3" />
								{:else}
									<CircleIcon class="size-2" />
								{/if}
							</span>
							<p class="font-semibold {langkah.selesai ? '' : 'text-muted-foreground'}">
								{langkah.judul}
							</p>
							{#if langkah.waktu}
								<p class="text-xs text-muted-foreground">{formatWaktu(langkah.waktu)}</p>
							{/if}
							<p class="mt-1 text-sm text-muted-foreground">{langkah.keterangan}</p>
						</li>
					{/each}
				</ol>

				{#if hasil.catatanPetugas}
					<div class="mt-6 rounded-lg border bg-muted/40 p-4">
						<p class="text-sm font-medium">Catatan petugas</p>
						<p class="mt-1 text-sm text-muted-foreground">{hasil.catatanPetugas}</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	<p class="mt-8 text-center text-sm text-muted-foreground">
		Belum pernah melapor? <a href="/lapor" class="font-medium underline">Kirim laporan sampah</a>
	</p>
</div>
