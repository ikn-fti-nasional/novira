<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";

	let { form, data } = $props();

	const providers = $derived(data.enabledProviders ?? []);
</script>

<svelte:head>
	<title>Masuk Sistem - NOVIRA Environmental Monitoring</title>
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center p-4">
	<Card.Root class="w-full max-w-md border-border/80 shadow-lg">
		<Card.Header class="space-y-2 text-center">
			<div class="flex justify-center">
				<div class="size-20 overflow-hidden rounded-2xl border border-emerald-500/30 shadow-md bg-white dark:bg-slate-900 p-1">
					<img src="/novira-logo.jpg" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
			</div>
			<div>
				<Card.Title class="text-2xl font-extrabold text-foreground">NOVIRA</Card.Title>
				<p class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
					Detect Today, Keep Tomorrow
				</p>
			</div>
			<Card.Description class="text-xs">
				Masukkan kredensial Super Admin untuk mengakses Komando Pemantauan Lingkungan
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<div class="bg-emerald-500/10 border border-emerald-500/20 mb-4 rounded-md p-3 text-xs">
				<p class="font-bold text-emerald-800 dark:text-emerald-300">Akses Masuk Super Admin Demo</p>
				<p class="text-muted-foreground mt-1">
					Kredensial sudah terisi otomatis: Nama Pengguna <span class="font-mono font-bold text-foreground">demo</span> /
					Kata Sandi <span class="font-mono font-bold text-foreground">SvelteDemo2026!</span> — klik tombol
					<strong>Masuk Sekarang</strong>.
				</p>
			</div>

			{#if form?.message}
				<div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
					{form.message}
				</div>
			{/if}

			<form method="POST" use:enhance class="space-y-4">
				<div class="space-y-2">
					<Label for="username" class="text-xs font-bold">Nama Pengguna (Username)</Label>
					<Input
						id="username"
						name="username"
						type="text"
						placeholder="Masukkan nama pengguna"
						required
						autocomplete="username"
						value="demo"
					/>
				</div>
				<div class="space-y-2">
					<Label for="password" class="text-xs font-bold">Kata Sandi (Password)</Label>
					<Input
						id="password"
						name="password"
						type="password"
						placeholder="Masukkan kata sandi"
						required
						autocomplete="current-password"
						value="SvelteDemo2026!"
					/>
				</div>
				<Button type="submit" class="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700">
					Masuk Sekarang
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
