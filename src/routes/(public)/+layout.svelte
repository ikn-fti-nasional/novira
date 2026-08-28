<script lang="ts">
	import ThemeToggle from "$lib/components/theme-toggle.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";

	let { children } = $props();
</script>

<!-- Dekoratif blob lingkungan di background -->
<div class="bg-background relative min-h-svh overflow-x-hidden">
	<!-- Blob hijau kiri atas -->
	<div
		class="pointer-events-none fixed -top-32 -left-32 size-[520px] rounded-full opacity-25 blur-3xl"
		style="background: radial-gradient(circle, oklch(0.70 0.20 145), oklch(0.55 0.18 155) 60%, transparent 100%);"
		aria-hidden="true"
	></div>
	<!-- Blob toska kanan bawah -->
	<div
		class="pointer-events-none fixed -right-40 -bottom-40 size-[600px] rounded-full opacity-20 blur-3xl"
		style="background: radial-gradient(circle, oklch(0.72 0.14 195), oklch(0.58 0.17 165) 60%, transparent 100%);"
		aria-hidden="true"
	></div>
	<!-- Pola titik-titik abstrak (dot grid) -->
	<div
		class="pointer-events-none fixed inset-0 opacity-[0.035] dark:opacity-[0.06]"
		style="background-image: radial-gradient(circle, oklch(0.3 0.12 155) 1px, transparent 1px); background-size: 32px 32px;"
		aria-hidden="true"
	></div>

	<header class="border-border/60 bg-background/80 relative z-10 border-b backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-20 sm:px-6">
			<a href="/" class="flex items-center gap-2 font-bold tracking-tight sm:gap-3">
				<div class="flex aspect-square size-8 items-center justify-center sm:size-10">
					<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
				<span class="text-gradient-brand text-lg sm:text-xl">Novira</span>
			</a>
			<div class="flex items-center gap-3 sm:gap-4">
				<span class="text-muted-foreground hidden text-xs sm:inline sm:text-sm">
					Sistem Pemantauan Kebersihan Kota
				</span>
				<Button href="/login" variant="outline" size="sm" class="gap-1.5">
					<LayoutDashboardIcon class="size-4" />
					<span class="hidden sm:inline">Dashboard</span>
				</Button>
				<ThemeToggle />
			</div>
		</div>
	</header>

	<main class="relative z-10">
		{@render children()}
	</main>

	<footer
		class="border-border/60 bg-background/80 relative z-10 border-t py-6 backdrop-blur-md sm:py-8"
	>
		<div class="text-muted-foreground mx-auto max-w-6xl px-4 text-center text-xs sm:text-sm">
			<div class="flex items-center justify-center gap-1.5 sm:gap-2">
				<div class="flex aspect-square size-3.5 items-center justify-center sm:size-4">
					<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
				<span>Novira &mdash; Sistem Pemantauan Kebersihan Kota</span>
			</div>
		</div>
	</footer>
</div>
