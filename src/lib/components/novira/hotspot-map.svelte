<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import NavigationIcon from "@lucide/svelte/icons/navigation";
	import type { Kamera, Insiden } from "$lib/types/novira.js";

	type Props = {
		kameraList: Kamera[];
		insidenList: Insiden[];
	};

	// Data belum dipakai — peta masih placeholder statis. Props dipertahankan
	// sebagai kontrak saat integrasi Leaflet/OSM dirender, ditandai `_` agar
	// tidak kedeteksi sebagai "unused" oleh linter.
	let { kameraList: _kameraList, insidenList: _insidenList }: Props = $props();

	let lapisanAktif = $state<"semua" | "peta_panas" | "kamera">("semua");
</script>

<Card.Root class="border-border/80 shadow-md">
	<Card.Header class="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				<Card.Title class="text-xl font-bold tracking-tight">
					Peta Titik Rawan Sampah (Hotspot)
				</Card.Title>

				<Badge
					variant="outline"
					class="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 text-[10px]"
				>
					Integrasi OpenStreetMap / Leaflet Siap
				</Badge>
			</div>
			<Card.Description class="text-xs">
				Pemetaan spasial sebaran titik pembuangan sampah liar di seluruh wilayah kelurahan.
			</Card.Description>
		</div>

		<div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs">
			<Button
				variant={lapisanAktif === "semua" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2 text-xs font-medium"
				onclick={() => (lapisanAktif = "semua")}
			>
				Semua Penanda
			</Button>
			<Button
				variant={lapisanAktif === "peta_panas" ? "secondary" : "ghost"}
				size="sm"
				class="h-7 px-2 text-xs font-medium"
				onclick={() => (lapisanAktif = "peta_panas")}
			>
				Peta Panas (Heatmap)
			</Button>
		</div>
	</Card.Header>

	<Card.Content class="p-0">
		<!-- Wadah Peta Vektor -->
		<div class="relative h-[320px] w-full overflow-hidden bg-slate-950 text-white shadow-inner">
			<div
				class="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px]"
			></div>

			<svg class="absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M 0 100 Q 150 140 300 120 T 600 180 T 900 150"
					stroke="#10b981"
					stroke-width="4"
					fill="none"
				/>
				<path d="M 120 0 Q 160 160 220 320" stroke="#3b82f6" stroke-width="3" fill="none" />
				<path
					d="M 450 0 Q 400 150 480 320"
					stroke="#f59e0b"
					stroke-width="3"
					fill="none"
					opacity="0.6"
				/>
				<circle cx="260" cy="140" r="70" fill="#ef4444" opacity="0.25" />
				<circle cx="480" cy="190" r="50" fill="#f59e0b" opacity="0.25" />
				<circle cx="150" cy="220" r="40" fill="#10b981" opacity="0.25" />
			</svg>

			<!-- Penanda Peta 1 - Kritis -->
			<div
				class="absolute top-[35%] left-[38%] transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
			>
				<div class="relative flex items-center justify-center">
					<span class="absolute size-8 animate-ping rounded-full bg-red-500/40"></span>
					<div
						class="flex size-7 items-center justify-center rounded-full bg-red-600 shadow-lg text-white font-bold text-xs"
					>
						<MapPinIcon class="size-4" />
					</div>
				</div>
				<div
					class="absolute top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/90 border border-red-500/40 px-2 py-1 text-[10px] text-white shadow-md"
				>
					<p class="font-bold text-red-400">Jl. Ahmad Yani (Malabar)</p>
					<p class="text-[9px] text-slate-300">Durasi: 190m • MELANGGAR SLA</p>
				</div>
			</div>

			<!-- Penanda Peta 2 - Risiko Tinggi -->
			<div
				class="absolute top-[52%] left-[62%] transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
			>
				<div class="relative flex items-center justify-center">
					<div
						class="flex size-6 items-center justify-center rounded-full bg-amber-500 shadow-lg text-slate-950 font-bold text-xs"
					>
						<MapPinIcon class="size-3.5" />
					</div>
				</div>
				<div
					class="absolute top-7 left-1/2 transform -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/90 border border-amber-500/40 px-2 py-1 text-[10px] text-white shadow-md"
				>
					<p class="font-bold text-amber-400">Jl. Pasir Kaliki</p>
					<p class="text-[9px] text-slate-300">Durasi: 95m • Peringatan</p>
				</div>
			</div>

			<!-- Penanda Peta 3 - Zona Bersih -->
			<div
				class="absolute top-[25%] left-[22%] transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
			>
				<div class="relative flex items-center justify-center">
					<div
						class="flex size-5 items-center justify-center rounded-full bg-emerald-600 shadow-lg text-white text-[10px]"
					>
						<NavigationIcon class="size-3" />
					</div>
				</div>
				<div
					class="absolute top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/90 border border-emerald-500/40 px-2 py-1 text-[10px] text-white shadow-md"
				>
					<p class="font-bold text-emerald-400">Taman Cibeunying</p>
					<p class="text-[9px] text-slate-300">Zona Bersih • 0 Insiden</p>
				</div>
			</div>

			<!-- Legenda Peta -->
			<div
				class="absolute bottom-3 left-3 rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 text-[10px] backdrop-blur-xs"
			>
				<p class="mb-1.5 font-bold uppercase tracking-wider text-slate-400">
					Keterangan Tingkat Keparahan
				</p>
				<div class="flex items-center gap-3">
					<span class="flex items-center gap-1">
						<span class="size-2.5 rounded-full bg-red-600"></span>
						&gt; 24 Jam (Melanggar SLA)
					</span>
					<span class="flex items-center gap-1">
						<span class="size-2.5 rounded-full bg-amber-500"></span>
						&lt; 24 Jam (Aktif Peringatan)
					</span>
					<span class="flex items-center gap-1">
						<span class="size-2.5 rounded-full bg-emerald-500"></span>
						Zona Bersih / Terangkut
					</span>
				</div>
			</div>
		</div>
	</Card.Content>
</Card.Root>
