<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";

	let { form, data } = $props();
</script>

<svelte:head>
	<title>Masuk Sistem - NOVIRA Environmental Monitoring</title>
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center p-4">
	<Card.Root class="w-full max-w-md border-border/80 shadow-lg">
		<Card.Header class="space-y-2 text-center">
			<div class="flex justify-center">
				<div class="size-20">
					<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
			</div>
			<div>
				<Card.Title class="text-2xl font-extrabold text-foreground">NOVIRA</Card.Title>
				<p class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
					Detect Today, Keep Tomorrow
				</p>
			</div>
			<Card.Description class="text-xs">
				Masukkan kredensial untuk mengakses Komando Pemantauan Lingkungan
			</Card.Description>
		</Card.Header>

		<Card.Content>
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
						value={data.demoMode ? "demo" : ""}
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
						value={data.demoMode ? "NoviraDemo2026!" : ""}
					/>
				</div>
				<Button
					type="submit"
					class="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
				>
					Masuk Sekarang
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
