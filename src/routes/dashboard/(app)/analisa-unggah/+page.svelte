<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Table from "$lib/components/ui/table/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import ImageIcon from "@lucide/svelte/icons/image";
	import VideoIcon from "@lucide/svelte/icons/video";
	import { enhance } from "$app/forms";
	import type { HasilAnalisaUnggahan } from "$lib/server/novira/analisaUnggahan.js";

	let { data, form } = $props();

	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let modelType = $state(data.defaultModelType);
	let confThres = $state(data.defaultConfThres);
	let menganalisa = $state(false);

	const hasil = $derived(form?.success ? (form.hasil as HasilAnalisaUnggahan) : null);

	const labelModel: Record<string, string> = {
		street: "Street (jalan/trotoar)",
		cctv: "CCTV Apung (sungai/kanal)",
		taco: "TACO (dataset umum)",
	};

	function handlePilihFile(e: Event) {
		const target = e.target as HTMLInputElement;
		const dipilih = target.files?.[0] ?? null;
		file = dipilih;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = dipilih ? URL.createObjectURL(dipilih) : null;
	}

	function formatPersen(skor: number) {
		return `${Math.round(skor * 100)}%`;
	}
</script>

<svelte:head>
	<title>Unggah & Analisa - NOVIRA</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex flex-col gap-1 border-b border-border/60 pb-4">
		<div class="flex items-center gap-2">
			<UploadCloudIcon class="size-6 text-emerald-600 dark:text-emerald-400" />
			<h1 class="text-3xl font-extrabold tracking-tight">Unggah & Analisa</h1>
		</div>
		<p class="text-sm text-muted-foreground">
			Unggah foto atau video dari perangkat Anda untuk langsung dianalisa model deteksi sampah
			pLitter -- tanpa harus melalui kamera CCTV terdaftar. Hasilnya hanya untuk dilihat, tidak
			otomatis tersimpan sebagai insiden.
		</p>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>Unggah Berkas</Card.Title>
			<Card.Description>Foto maks. 5MB (JPEG/PNG/WebP), video maks. 20MB (MP4/WebM/MOV).</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				action="?/analisa"
				enctype="multipart/form-data"
				use:enhance={() => {
					menganalisa = true;
					return async ({ update }) => {
						await update();
						menganalisa = false;
					};
				}}
				class="space-y-6"
			>
				<div class="grid gap-2">
					<Label for="file">Foto / Video</Label>
					<Input
						id="file"
						name="file"
						type="file"
						accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
						onchange={handlePilihFile}
						required
					/>
				</div>

				{#if previewUrl && file}
					<div class="overflow-hidden rounded-lg border max-w-md">
						{#if file.type.startsWith("video/")}
							<video src={previewUrl} controls class="w-full">
								<track kind="captions" />
							</video>
						{:else}
							<img src={previewUrl} alt="Pratinjau unggahan" class="w-full" />
						{/if}
					</div>
				{/if}

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="grid gap-2">
						<Label>Model Deteksi</Label>
						<Select.Root name="modelType" type="single" bind:value={modelType}>
							<Select.Trigger>
								<span>{labelModel[modelType] ?? modelType}</span>
							</Select.Trigger>
							<Select.Content>
								{#each data.modelTypesTersedia as tipe (tipe)}
									<Select.Item value={tipe}>{labelModel[tipe] ?? tipe}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<p class="text-muted-foreground text-xs">
							Default mengikuti pengaturan model CCTV di halaman Pengaturan.
						</p>
					</div>

					<div class="grid gap-2">
						<Label for="confThres">Ambang Kepercayaan</Label>
						<Input
							id="confThres"
							name="confThres"
							type="number"
							min="0.05"
							max="1"
							step="0.05"
							bind:value={confThres}
						/>
					</div>
				</div>

				<Button type="submit" disabled={!file || menganalisa}>
					{#if menganalisa}
						<Loader2Icon class="mr-2 size-4 animate-spin" />
						Menganalisa...
					{:else}
						<UploadCloudIcon class="mr-2 size-4" />
						Analisa Sekarang
					{/if}
				</Button>
			</form>

			{#if form && !form.success}
				<p class="mt-4 text-sm text-red-600 dark:text-red-400">{form.message}</p>
			{/if}
		</Card.Content>
	</Card.Root>

	{#if hasil}
		<Card.Root>
			<Card.Header>
				<div class="flex items-center gap-2">
					{#if hasil.kind === "foto"}
						<ImageIcon class="size-5 text-emerald-600" />
					{:else}
						<VideoIcon class="size-5 text-emerald-600" />
					{/if}
					<Card.Title>Hasil Analisa</Card.Title>
				</div>
				<Card.Description>
					Model <strong>{labelModel[hasil.modelType] ?? hasil.modelType}</strong>, ambang kepercayaan
					{hasil.confThres}
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-6">
				{#if hasil.kind === "foto"}
					<div class="overflow-hidden rounded-lg border max-w-2xl">
						<img src={hasil.annotatedDataUrl} alt="Hasil deteksi" class="w-full" />
					</div>

					{#if hasil.deteksi.length === 0}
						<p class="text-muted-foreground text-sm">Tidak ada sampah terdeteksi pada foto ini.</p>
					{:else}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Label</Table.Head>
									<Table.Head>Kepercayaan</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each hasil.deteksi as d, i (i)}
									<Table.Row>
										<Table.Cell>{d.className}</Table.Cell>
										<Table.Cell><Badge variant="outline">{formatPersen(d.score)}</Badge></Table.Cell
										>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				{:else}
					<div class="grid gap-4 sm:grid-cols-3">
						<div class="rounded-lg border p-4">
							<p class="text-muted-foreground text-xs">Frame Diproses</p>
							<p class="text-2xl font-bold">
								{hasil.framesProcessed}<span class="text-muted-foreground text-sm font-normal"
									>/{hasil.framesTotalInSource}</span
								>
							</p>
						</div>
						<div class="rounded-lg border p-4">
							<p class="text-muted-foreground text-xs">Total Deteksi</p>
							<p class="text-2xl font-bold">{hasil.totalDeteksi}</p>
						</div>
						<div class="rounded-lg border p-4">
							<p class="text-muted-foreground text-xs">FPS Sumber</p>
							<p class="text-2xl font-bold">{hasil.fps.toFixed(1)}</p>
						</div>
					</div>

					{#if hasil.truncated}
						<p class="text-amber-600 dark:text-amber-400 text-xs">
							Video dipotong pada batas jumlah frame demi kecepatan analisa -- bagian akhir video
							belum diperiksa.
						</p>
					{/if}

					{#if hasil.frames.some((f) => f.deteksi.length > 0)}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head>Frame</Table.Head>
									<Table.Head>Waktu</Table.Head>
									<Table.Head>Deteksi</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each hasil.frames.filter((f) => f.deteksi.length > 0) as f (f.frameIndex)}
									<Table.Row>
										<Table.Cell>#{f.frameIndex}</Table.Cell>
										<Table.Cell>{f.timestamp.toFixed(1)}s</Table.Cell>
										<Table.Cell>
											<div class="flex flex-wrap gap-1">
												{#each f.deteksi as d, i (i)}
													<Badge variant="outline">{d.className} {formatPersen(d.score)}</Badge>
												{/each}
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{:else}
						<p class="text-muted-foreground text-sm">Tidak ada sampah terdeteksi pada video ini.</p>
					{/if}
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
