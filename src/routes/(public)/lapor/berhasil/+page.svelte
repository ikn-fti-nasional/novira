<script lang="ts">
	import { page } from "$app/state";
	import { Button } from "$lib/components/ui/button/index.js";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle-2";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import { toast } from "svelte-sonner";

	const kode = $derived(page.url.searchParams.get("kode") ?? "");

	async function salinKode() {
		try {
			await navigator.clipboard.writeText(kode);
			toast.success("Kode laporan disalin");
		} catch {
			// Clipboard API butuh konteks aman (HTTPS) dan izin — di HTTP lokal
			// atau browser lama ia menolak. Kodenya toh sudah tampil di layar,
			// jadi cukup arahkan pengguna menyalinnya manual.
			toast.error("Gagal menyalin — silakan catat kodenya secara manual");
		}
	}
</script>

<svelte:head>
	<title>Laporan Terkirim - Novira</title>
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-20 text-center">
	<CheckCircleIcon class="mx-auto size-14 text-emerald-600" />
	<h1 class="mt-4 text-3xl font-extrabold tracking-tight">Laporan Terkirim</h1>
	<p class="mt-3 text-muted-foreground">
		Terima kasih sudah melapor. Foto Anda sedang diperiksa otomatis, lalu diverifikasi petugas
		sebelum ditindaklanjuti ke lapangan.
	</p>

	{#if kode}
		<div class="mt-8 rounded-xl border bg-muted/40 p-6">
			<p class="text-sm font-medium text-muted-foreground">Kode laporan Anda</p>
			<p class="mt-2 font-mono text-3xl font-bold tracking-widest">{kode}</p>
			<p class="mt-3 text-sm text-muted-foreground">
				Simpan kode ini untuk memantau perkembangan penanganan. Tidak perlu membuat akun.
			</p>
			<div class="mt-4 flex flex-wrap justify-center gap-2">
				<Button variant="outline" size="sm" onclick={salinKode}>
					<CopyIcon class="size-4" />
					Salin kode
				</Button>
				<Button href="/lacak?kode={kode}" size="sm">Lacak laporan</Button>
			</div>
		</div>
	{/if}

	<div class="mt-8 flex justify-center gap-3">
		<Button href="/lapor" variant="outline">Lapor Lagi</Button>
		<Button href="/" variant="ghost">Kembali ke Beranda</Button>
	</div>
</div>
