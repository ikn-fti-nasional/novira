<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import ClockIcon from "@lucide/svelte/icons/clock";
	import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
	import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
	import MinusIcon from "@lucide/svelte/icons/minus";
	import type { ActionData, PageData } from "./$types.js";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const LABEL_INTERVENSI: Record<string, { teks: string; kelas: string }> = {
		TAMBAH_TPS: {
			teks: "Usul: tambah TPS",
			kelas: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
		},
		PENJADWALAN_ULANG: {
			teks: "Usul: ubah jadwal angkut",
			kelas: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
		},
		PENGAWASAN_CCTV: {
			teks: "Usul: pengawasan & penindakan",
			kelas: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
		},
		SOSIALISASI_WARGA: {
			teks: "Usul: sosialisasi warga",
			kelas: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
		},
	};

	// Skala bar jam rawan dinormalisasi ke jam tersibuk supaya polanya terbaca
	// walau jumlah absolutnya masih kecil di awal pemakaian.
	const puncakJam = $derived(Math.max(1, ...data.jamRawan.map((j) => j.jumlah)));

	function jam(n: number): string {
		return `${String(n).padStart(2, "0")}:00`;
	}

	$effect(() => {
		if (form?.success && "message" in form) toast.success(String(form.message));
	});
</script>

<svelte:head>
	<title>Analitik Lanjutan - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<ActivityIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Analitik Lanjutan</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Pola kekambuhan, jam rawan, dan status eskalasi — diturunkan dari riwayat insiden, bukan dari
			model tambahan.
		</p>
	</div>

	<!-- Status eskalasi & sumber insiden -->
	<div class="grid gap-4 md:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base">
					<AlertTriangleIcon class="size-4 text-amber-600" />
					Status eskalasi SLA
				</Card.Title>
				<Card.Description
					>Insiden terbuka menurut jenjang eskalasi yang sudah dilewati.</Card.Description
				>
			</Card.Header>
			<Card.Content class="grid grid-cols-3 gap-3">
				{#each [{ label: "Diingatkan (12 j)", nilai: data.eskalasi.diingatkan, warna: "text-amber-600" }, { label: "Kepala Seksi (24 j)", nilai: data.eskalasi.kepalaSeksi, warna: "text-orange-600" }, { label: "Kepala Dinas (48 j)", nilai: data.eskalasi.kepalaDinas, warna: "text-rose-600" }] as e (e.label)}
					<div class="rounded-lg border p-3 text-center">
						<p class="text-2xl font-bold {e.warna}">{e.nilai}</p>
						<p class="mt-1 text-[11px] leading-tight text-muted-foreground">{e.label}</p>
					</div>
				{/each}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Sumber insiden</Card.Title>
				<Card.Description>Seberapa besar kontribusi warga dibanding kamera.</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.sumber.total === 0}
					<p class="text-sm text-muted-foreground">Belum ada insiden tercatat.</p>
				{:else}
					{@const persenWarga = Math.round((data.sumber.warga / data.sumber.total) * 100)}
					<div class="flex h-3 overflow-hidden rounded-full bg-muted">
						<div class="bg-blue-500" style="width: {100 - persenWarga}%"></div>
						<div class="bg-emerald-500" style="width: {persenWarga}%"></div>
					</div>
					<div class="mt-3 flex justify-between text-sm">
						<span><span class="font-bold">{data.sumber.cctv}</span> dari CCTV</span>
						<span><span class="font-bold">{data.sumber.warga}</span> dari laporan warga</span>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Tren skor -->
	<Card.Root>
		<Card.Header>
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<Card.Title class="text-base">Tren skor kebersihan</Card.Title>
					<Card.Description>
						Perbandingan dengan 7 hari lalu, dihitung dari arsip skor harian.
					</Card.Description>
				</div>
				{#if data.delta}
					<Badge
						class={data.delta.arah === "naik"
							? "bg-emerald-600 text-white"
							: data.delta.arah === "turun"
								? "bg-rose-600 text-white"
								: "bg-slate-500 text-white"}
					>
						{data.delta.persen > 0 ? "+" : ""}{data.delta.persen}% (7 hari)
					</Badge>
				{/if}
			</div>
		</Card.Header>
		<Card.Content>
			{#if !data.adaHistori}
				<!--
					Kejujuran data: tanpa minimal dua hari arsip, angka tren apa pun
					yang ditampilkan di sini akan mengarang. Lebih baik menyatakan
					datanya belum ada.
				-->
				<div class="rounded-lg border border-dashed p-6 text-center">
					<p class="text-sm font-medium">Arsip skor harian belum cukup</p>
					<p class="mt-1 text-sm text-muted-foreground">
						Tren baru bisa dihitung setelah minimal dua hari arsip terkumpul (cron berjalan 23:50
						WIB). Angka tren tidak ditampilkan daripada menebak.
					</p>
					{#if data.bolehIsiArsip}
						<form method="POST" action="?/isiArsip" use:enhance class="mt-4">
							<Button type="submit" size="sm" variant="outline">
								Isi arsip dari riwayat insiden yang ada
							</Button>
						</form>
					{/if}
				</div>
			{:else}
				<div class="space-y-2">
					{#each data.tren as t (t.kecamatan + t.kota)}
						<div class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
							<div>
								<p class="text-sm font-medium">{t.kecamatan}</p>
								<p class="text-xs text-muted-foreground">{t.kota}</p>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-lg font-bold">{t.skorSekarang}</span>
								{#if t.skorSebelumnya === null}
									<span class="text-xs text-muted-foreground">belum ada pembanding</span>
								{:else}
									<span
										class="flex items-center gap-1 text-xs font-medium {t.tren === 'naik'
											? 'text-emerald-600'
											: t.tren === 'turun'
												? 'text-rose-600'
												: 'text-muted-foreground'}"
									>
										{#if t.tren === "naik"}
											<TrendingUpIcon class="size-3.5" />
										{:else if t.tren === "turun"}
											<TrendingDownIcon class="size-3.5" />
										{:else}
											<MinusIcon class="size-3.5" />
										{/if}
										{t.delta > 0 ? "+" : ""}{t.delta}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Titik kronis -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-base">Titik kronis</Card.Title>
			<Card.Description>
				Lokasi yang berulang kali dibersihkan lalu kotor lagi — indikasi masalah struktural, bukan
				insidentil. Tiap titik disertai usulan intervensi beserta alasannya.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.titikKronis.length === 0}
				<p class="text-sm text-muted-foreground">
					Belum ada titik yang memenuhi ambang kronis (minimal 3× dibersihkan).
				</p>
			{:else}
				<div class="space-y-3">
					{#each data.titikKronis as t (t.kunci)}
						<div class="rounded-lg border p-3">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div>
									<p class="font-semibold">{t.nama}</p>
									<p class="text-xs text-muted-foreground">
										{[t.kecamatan, t.kota].filter(Boolean).join(", ")}
									</p>
								</div>
								<Badge class={LABEL_INTERVENSI[t.rekomendasi].kelas}>
									{LABEL_INTERVENSI[t.rekomendasi].teks}
								</Badge>
							</div>
							<div class="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
								<span
									><strong class="text-foreground">{t.jumlahDibersihkan}×</strong> dibersihkan</span
								>
								<span
									><strong class="text-foreground">{t.terbukaSekarang}</strong> terbuka sekarang</span
								>
								{#if t.rataRataJedaJam > 0}
									<span>
										kotor lagi tiap ±<strong class="text-foreground">
											{t.rataRataJedaJam < 48
												? `${Math.round(t.rataRataJedaJam)} jam`
												: `${Math.round(t.rataRataJedaJam / 24)} hari`}
										</strong>
									</span>
								{/if}
							</div>
							<p class="mt-2 text-xs italic text-muted-foreground">
								Dasar usulan: {t.alasanRekomendasi}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Jam rawan & usulan patroli -->
	<div class="grid gap-4 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2 text-base">
					<ClockIcon class="size-4" />
					Jam rawan
				</Card.Title>
				<Card.Description>
					Distribusi jam munculnya laporan warga. Insiden CCTV sengaja tidak dihitung di sini —
					siklus deteksi hanya berjalan 12:00 &amp; 15:00 WIB, sehingga jamnya mencerminkan jadwal
					pemindaian, bukan jam sampah dibuang.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-1">
					{#each data.jamRawan as j (j.jam)}
						<div class="flex items-center gap-2">
							<span class="w-10 shrink-0 font-mono text-[11px] text-muted-foreground"
								>{j.label}</span
							>
							<div class="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
								<div
									class="h-full rounded-sm bg-emerald-500"
									style="width: {(j.jumlah / puncakJam) * 100}%"
								></div>
							</div>
							<span class="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
								{j.jumlah}
							</span>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">Usulan jadwal patroli</Card.Title>
				<Card.Description>
					Jendela 3 jam dengan kemunculan tertinggi per kecamatan. Kecamatan dengan kurang dari 5
					laporan tidak diusulkan — polanya belum bisa dibedakan dari kebetulan.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				{#if data.patroli.length === 0}
					<p class="text-sm text-muted-foreground">
						Belum cukup laporan warga untuk menyusun usulan jadwal.
					</p>
				{:else}
					<div class="space-y-2">
						{#each data.patroli as p (p.kecamatan)}
							<div class="rounded-lg border p-3">
								<div class="flex items-center justify-between gap-3">
									<p class="font-medium">{p.kecamatan}</p>
									<Badge variant="outline" class="font-mono">
										{jam(p.jamMulai)}–{jam(p.jamSelesai)}
									</Badge>
								</div>
								<p class="mt-1 text-xs text-muted-foreground">{p.alasan}</p>
							</div>
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
