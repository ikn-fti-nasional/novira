<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import SendIcon from "@lucide/svelte/icons/send";
	import Trash2Icon from "@lucide/svelte/icons/trash-2";
	import LeafIcon from "@lucide/svelte/icons/leaf";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import UsersIcon from "@lucide/svelte/icons/users";
	import ZapIcon from "@lucide/svelte/icons/zap";
</script>

<svelte:head>
	<title>Novira - Lapor Sampah Jalanan</title>
	<meta
		name="description"
		content="Laporkan penumpukan sampah liar di jalanan. Foto, kirim lokasi, dan tim kami tindak lanjuti. Bersama kita jaga kebersihan kota."
	/>
</svelte:head>

<!-- ====== HERO ====== -->
<section class="relative overflow-hidden px-4 pb-20 pt-24 text-center">
	<!-- Cincin dekoratif -->
	<div
		class="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 size-[700px] rounded-full border border-emerald-500/10"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full border border-emerald-500/15"
		aria-hidden="true"
	></div>

	<!-- Badge -->
	<div
		class="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
	>
		<LeafIcon class="size-3.5" />
		Platform Pelaporan Kebersihan Kota #1
	</div>

	<h1 class="mx-auto max-w-3xl text-5xl font-extrabold tracking-tight md:text-6xl lg:text-7xl">
		Jaga Kota Kita
		<span class="relative mt-1 block">
			<span
				class="bg-clip-text text-transparent"
				style="background-image: linear-gradient(135deg, oklch(0.45 0.18 145) 0%, oklch(0.55 0.20 160) 50%, oklch(0.50 0.17 185) 100%);"
			>
				Bersama-sama
			</span>
		</span>
	</h1>

	<p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
		Temukan penumpukan sampah liar di sekitar Anda? <strong class="text-foreground"
			>Foto sekali</strong
		>, kirim lokasi, dan tim kebersihan kota akan menindaklanjutinya. Mudah, cepat, berdampak.
	</p>

	<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
		<Button
			href="/lapor"
			size="lg"
			class="gap-2 rounded-xl px-8 py-6 text-base font-semibold shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:shadow-emerald-500/40"
			style="background: linear-gradient(135deg, oklch(0.50 0.18 145), oklch(0.60 0.17 160)); color: white;"
		>
			<Trash2Icon class="size-5" />
			Lapor Sampah Sekarang
		</Button>
	</div>

	<!-- Statistik kecil -->
	<div class="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-4">
		{#each [{ icon: UsersIcon, value: "2.4K+", label: "Laporan diterima" }, { icon: ZapIcon, value: "< 48 jam", label: "Rata-rata respons" }, { icon: ShieldCheckIcon, value: "98%", label: "Berhasil ditangani" }] as stat}
			{@const StatIcon = stat.icon}
			<div
				class="flex flex-col items-center gap-1 rounded-xl border border-border/60 bg-card/60 px-3 py-4 backdrop-blur-sm"
			>
				<StatIcon class="size-4 text-emerald-600 dark:text-emerald-400" />
				<span class="text-lg font-bold tabular-nums">{stat.value}</span>
				<span class="text-center text-[11px] text-muted-foreground leading-tight">{stat.label}</span
				>
			</div>
		{/each}
	</div>
</section>

<!-- ====== CARA MELAPOR ====== -->
<section class="relative border-t border-border/60 py-20">
	<div
		class="pointer-events-none absolute inset-0 opacity-40"
		style="background: linear-gradient(180deg, transparent, oklch(0.96 0.008 150 / 0.5) 50%, transparent);"
		aria-hidden="true"
	></div>

	<div class="relative mx-auto max-w-5xl px-4">
		<div class="mb-3 flex items-center justify-center gap-2">
			<div class="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/30"></div>
			<span
				class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400"
			>
				Alur Pelaporan
			</span>
			<div class="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/30"></div>
		</div>
		<h2 class="mb-12 text-center text-3xl font-bold md:text-4xl">Cukup 3 Langkah Mudah</h2>

		<div class="grid gap-6 md:grid-cols-3">
			{#each [{ icon: CameraIcon, step: "01", title: "Foto atau Video", desc: "Abadikan kondisi sampah di lokasi kejadian. Pastikan gambar jelas dan lokasi terlihat.", color: "oklch(0.50 0.18 145)" }, { icon: MapPinIcon, step: "02", title: "Kirim Lokasi", desc: "Lokasi GPS terdeteksi otomatis dari ponsel Anda, atau masukkan nama kota secara manual.", color: "oklch(0.55 0.17 165)" }, { icon: SendIcon, step: "03", title: "Kami Tindak Lanjuti", desc: "Laporan masuk ke dashboard tim kebersihan, diverifikasi, dan petugas dikirim ke lokasi.", color: "oklch(0.50 0.17 185)" }] as item}
				{@const StepIcon = item.icon}
				<div
					class="group relative rounded-2xl border border-border/60 bg-card/70 p-7 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/10"
				>
					<!-- Nomor langkah -->
					<div class="mb-5 flex items-start justify-between">
						<div
							class="flex size-12 items-center justify-center rounded-xl shadow-md"
							style="background: linear-gradient(135deg, {item.color}, {item.color} 80%); opacity: 0.9;"
						>
							<StepIcon class="size-5 text-white" />
						</div>
						<span
							class="font-mono text-5xl font-black text-muted-foreground/15 leading-none group-hover:text-emerald-500/20 transition-colors"
						>
							{item.step}
						</span>
					</div>
					<h3 class="mb-2 text-lg font-semibold">{item.title}</h3>
					<p class="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
