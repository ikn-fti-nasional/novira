<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle-2";
</script>

<svelte:head>
	<title>Laporan Terkirim - Novira</title>
</svelte:head>

<div class="mx-auto max-w-xl px-4 py-20 text-center">
	<CheckCircleIcon class="mx-auto size-14 text-emerald-600" />
	<h1 class="mt-4 text-3xl font-extrabold tracking-tight">Laporan Terkirim</h1>
	<p class="mt-3 text-muted-foreground">
		Terima kasih sudah melapor. Tim kebersihan akan memverifikasi dan menindaklanjuti laporan Anda
		sesegera mungkin.
	</p>
	<div class="mt-8 flex justify-center gap-3">
		<Button href="/lapor" variant="outline">Lapor Lagi</Button>
		<Button href="/" variant="ghost">Kembali ke Beranda</Button>
	</div>
</div>
