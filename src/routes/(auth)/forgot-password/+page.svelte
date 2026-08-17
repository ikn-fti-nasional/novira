<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";

	let { form } = $props();
</script>

<svelte:head>
	<title>Lupa Kata Sandi - NOVIRA Environmental Monitoring</title>
</svelte:head>

<div class="bg-background flex min-h-screen items-center justify-center p-4">
	<Card.Root class="w-full max-w-md border-border/80 shadow-lg">
		<Card.Header class="space-y-2 text-center">
			<div class="flex justify-center">
				<div class="size-20">
					<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
			</div>
			<Card.Title class="text-2xl font-extrabold text-foreground">Lupa Kata Sandi?</Card.Title>
			<Card.Description>Masukkan email Anda dan kami akan mengirimkan tautan reset</Card.Description
			>
		</Card.Header>
		<Card.Content>
			{#if form?.message}
				<div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
					{form.message}
				</div>
			{/if}
			{#if form?.success}
				<div class="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
					Jika akun dengan email tersebut ada, tautan reset telah dikirim. Periksa log konsol saat
					development.
				</div>
			{:else}
				<form method="POST" use:enhance class="space-y-4">
					<div class="space-y-2">
						<Label for="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							placeholder="you@example.com"
							required
							autocomplete="email"
						/>
					</div>
					<Button
						type="submit"
						class="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
					>
						Kirim Tautan Reset
					</Button>
				</form>
			{/if}
		</Card.Content>
		<Card.Footer class="justify-center">
			<p class="text-muted-foreground text-sm">
				Ingat kata sandi Anda?
				<a href="/login" class="text-primary underline-offset-4 hover:underline">Masuk</a>
			</p>
		</Card.Footer>
	</Card.Root>
</div>
