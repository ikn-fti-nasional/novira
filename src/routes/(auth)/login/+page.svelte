<script lang="ts">
	import { enhance } from "$app/forms";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";

	let masuk = $state(false);

	let { form, data } = $props();

	// Kredensial akun hasil `pnpm db:seed`. Hanya dirender saat demoMode.
	const akunDemo = [
		{
			label: "Operator (demo)",
			username: "demo",
			password: "NoviraDemo2026!",
			keterangan: "Akun demo publik — ruang kontrol & triase laporan",
		},
		{
			label: "Admin",
			username: "admin",
			password: "password123",
			keterangan: "Akses penuh, termasuk pengaturan & reset data demo",
		},
		{
			label: "Wali Kota",
			username: "walikota",
			password: "password123",
			keterangan: "Dashboard eksekutif",
		},
		{
			label: "Kepala Dinas",
			username: "kepala_dinas",
			password: "password123",
			keterangan: "Dashboard eksekutif + eskalasi 48 jam",
		},
		{
			label: "Kepala Seksi",
			username: "kepala_seksi",
			password: "password123",
			keterangan: "Eskalasi 24 jam & penugasan petugas",
		},
		{
			label: "Petugas Lapangan",
			username: "petugas",
			password: "password123",
			keterangan: "Daftar tugas insiden di lapangan",
		},
	];

	let username = $state("");
	let password = $state("");

	$effect(() => {
		if (data.demoMode) {
			username = akunDemo[0].username;
			password = akunDemo[0].password;
		}
	});

	function pakaiAkun(akun: (typeof akunDemo)[number]) {
		username = akun.username;
		password = akun.password;
	}
</script>

<svelte:head>
	<title>Masuk Sistem - NOVIRA Environmental Monitoring</title>
</svelte:head>

<div class="flex min-h-svh items-center justify-center p-4 py-10">
	<Card.Root class="shadow-elevate-3 w-full max-w-md">
		<Card.Header class="space-y-2 text-center">
			<div class="flex justify-center">
				<div
					class="bg-primary/10 ring-primary/15 flex size-20 items-center justify-center rounded-2xl p-3 ring-1 ring-inset"
				>
					<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
				</div>
			</div>
			<div>
				<Card.Title class="text-foreground text-2xl font-extrabold tracking-tight">
					NOVIRA
				</Card.Title>
				<p class="text-primary mt-0.5 text-xs font-semibold tracking-wide">
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

			<form
				method="POST"
				use:enhance={() => {
					masuk = true;
					return async ({ update }) => {
						await update();
						masuk = false;
					};
				}}
				class="space-y-4"
			>
				<div class="space-y-2">
					<Label for="username" class="text-xs font-bold">Nama Pengguna (Username)</Label>
					<Input
						id="username"
						name="username"
						type="text"
						placeholder="Masukkan nama pengguna"
						required
						autocomplete="username"
						bind:value={username}
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
						bind:value={password}
					/>
				</div>
				<Button
					type="submit"
					disabled={masuk}
					class="w-full gap-2 bg-emerald-600 font-bold text-white hover:bg-emerald-700"
				>
					{#if masuk}
						<LoaderCircleIcon class="size-4 animate-spin" />
						Memproses…
					{:else}
						Masuk Sekarang
					{/if}
				</Button>
			</form>

			<div class="border-border/80 mt-6 rounded-md border border-dashed p-3">
				<p class="text-foreground text-xs font-bold">Kredensial demo</p>
				<p class="text-muted-foreground mt-0.5 text-[11px]">
					Klik salah satu peran untuk mengisi formulir di atas.
				</p>
				<ul class="mt-2 space-y-1">
					{#each akunDemo as akun (akun.username)}
						<li>
							<button
								type="button"
								onclick={() => pakaiAkun(akun)}
								class="hover:bg-muted focus-visible:ring-ring w-full rounded px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
								class:bg-muted={username === akun.username}
							>
								<span class="flex items-baseline justify-between gap-2">
									<span class="text-foreground text-xs font-semibold">{akun.label}</span>
									<span class="text-muted-foreground font-mono text-[11px]">
										{akun.username} / {akun.password}
									</span>
								</span>
								<span class="text-muted-foreground block text-[11px]">{akun.keterangan}</span>
							</button>
						</li>
					{/each}
				</ul>
				<p class="text-muted-foreground mt-2 text-[11px]">
					Akun lain hasil seed memakai kata sandi <span class="font-mono">password123</span>.
				</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
