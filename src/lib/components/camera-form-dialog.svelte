<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import type { ActionResult } from "@sveltejs/kit";

	type Props = {
		open: boolean;
		kotaList: string[];
	};

	let { open = $bindable(false), kotaList }: Props = $props();

	let statusBaru = $state("OFFLINE");
	let sedangMengirim = $state(false);
	const statusOptions = [
		{ value: "ONLINE", label: "ONLINE" },
		{ value: "OFFLINE", label: "OFFLINE" },
		{ value: "PERBAIKAN", label: "PERBAIKAN" },
	];

	function onResult(result: ActionResult) {
		if (result.type === "failure") {
			const d = result.data as { message?: string } | undefined;
			toast.error(d?.message ?? "Gagal menyimpan kamera");
		} else if (result.type === "success") {
			toast.success("Kamera baru berhasil disimpan");
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Tambah Kamera CCTV Baru</Dialog.Title>
			<Dialog.Description>Isi nama, kota, dan link umpan HLS/MP4 atau snapshot.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/tambah"
			use:enhance={() => {
				sedangMengirim = true;
				return async ({ result, update }) => {
					await update();
					sedangMengirim = false;
					onResult(result);
				};
			}}
			class="space-y-4"
		>
			<div class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<Label.Root>Nama Kamera</Label.Root>
					<Input.Root name="nama" placeholder="CCTV Sudirman 1" required />
				</div>
				<div class="space-y-2">
					<Label.Root>Kota</Label.Root>
					<Input.Root name="kota" placeholder="Bandung" required list="kota-options" />
					<datalist id="kota-options">
						{#each kotaList as kota}
							<option value={kota}></option>
						{/each}
					</datalist>
				</div>
				<div class="space-y-2">
					<Label.Root>Kecamatan / Lokasi</Label.Root>
					<Input.Root name="kecamatan" placeholder="Bandung Wetan" />
				</div>
				<div class="space-y-2">
					<Label.Root>Status</Label.Root>
					<Select.Root type="single" name="status" bind:value={statusBaru}>
						<Select.Trigger class="w-full"><span>{statusBaru}</span></Select.Trigger>
						<Select.Content>
							{#each statusOptions as opt}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2 md:col-span-2">
					<Label.Root>URL Stream (HLS/MP4)</Label.Root>
					<Input.Root name="urlStream" placeholder="https://.../stream.m3u8" />
				</div>
				<div class="space-y-2 md:col-span-2">
					<Label.Root>URL Snapshot (gambar)</Label.Root>
					<Input.Root name="urlSnapshot" placeholder="https://.../snapshot.jpg" />
				</div>
			</div>
			<Dialog.Footer>
				<Button
					type="button"
					variant="outline"
					onclick={() => (open = false)}
					disabled={sedangMengirim}>Batal</Button
				>
				<Button
					type="submit"
					class="bg-emerald-700 text-white hover:bg-emerald-800"
					disabled={sedangMengirim}>Simpan Kamera</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
