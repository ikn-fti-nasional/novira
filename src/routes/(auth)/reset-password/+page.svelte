<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Atur Ulang Kata Sandi - NOVIRA Environmental Monitoring</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center p-4 py-10">
	<Card.Root class="shadow-elevate-3 w-full max-w-md">
		<Card.Header class="space-y-2 text-center">
			<div class="flex justify-center">
				<div class="size-20">
					<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
			</div>
			<Card.Title class="text-foreground text-2xl font-extrabold">Atur Ulang Kata Sandi</Card.Title>
			<Card.Description>Masukkan kata sandi baru Anda di bawah ini</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if form?.message}
				<div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
					{form.message}
				</div>
			{/if}
			{#if !data.valid}
				<div class="text-center">
					<p class="text-muted-foreground mb-4 text-sm">
						Tautan reset ini tidak valid atau token tidak ditemukan.
					</p>
					<Button href="/forgot-password" variant="outline">Minta Tautan Baru</Button>
				</div>
			{:else}
				<form method="POST" use:enhance class="space-y-4">
					<input type="hidden" name="token" value={data.token} />
					<div class="space-y-2">
						<Label for="password">Kata Sandi Baru</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="Minimal 6 karakter"
							required
							autocomplete="new-password"
						/>
					</div>
					<div class="space-y-2">
						<Label for="confirmPassword">Konfirmasi Kata Sandi</Label>
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							placeholder="Ulangi kata sandi Anda"
							required
							autocomplete="new-password"
						/>
					</div>
					<Button
						type="submit"
						class="w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
					>
						Atur Ulang Kata Sandi
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
