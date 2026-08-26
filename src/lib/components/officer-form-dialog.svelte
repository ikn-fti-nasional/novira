<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import * as Label from "$lib/components/ui/label/index.js";
	import * as Input from "$lib/components/ui/input/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import type { ActionResult } from "@sveltejs/kit";

	type Akun = { id: string; name: string; username: string };
	type Props = {
		open: boolean;
		akunList: Akun[];
		akunTerpakai: Set<string>;
	};

	let { open = $bindable(false), akunList, akunTerpakai }: Props = $props();

	let statusBaru = $state("SIAP_TUGAS");
	let akunBaru = $state("");
	let sedangMengirim = $state(false);
	const statusOptions = [
		{ value: "SIAP_TUGAS", label: "SIAP TUGAS" },
		{ value: "SEDANG_BERTUGAS", label: "SEDANG BERTUGAS" },
		{ value: "OFFLINE", label: "OFFLINE" },
	];
	function labelStatus(v: string) {
		return statusOptions.find((o) => o.value === v)?.label ?? v;
	}
	const akunTersedia = $derived(akunList.filter((a) => !akunTerpakai.has(a.id)));
	function onResult(result: ActionResult) {
		if (result.type === "failure") {
			const d = result.data as { message?: string } | undefined;
			toast.error(d?.message ?? "Gagal menyimpan petugas");
		} else if (result.type === "success") {
			toast.success("Petugas berhasil disimpan");
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Tambah Petugas Lapangan Baru</Dialog.Title>
			<Dialog.Description>Isi data petugas atau kru armada yang akan ditugaskan.</Dialog.Description
			>
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
					<Label.Root>Nama Lengkap</Label.Root>
					<Input.Root name="nama" placeholder="Budi Santoso" required />
				</div>
				<div class="space-y-2">
					<Label.Root>Peran / Unit Tugas</Label.Root>
					<Input.Root name="peran" placeholder="Satpol PP / Driver TPS" required />
				</div>
				<div class="space-y-2">
					<Label.Root>Nomor WhatsApp</Label.Root>
					<Input.Root name="telepon" placeholder="081234567890" required />
				</div>
				<div class="space-y-2">
					<Label.Root>Wilayah Tugas</Label.Root>
					<Input.Root name="wilayahTugas" placeholder="Kiaracondong" required />
				</div>
				<div class="space-y-2">
					<Label.Root>Status</Label.Root>
					<Select.Root type="single" name="status" bind:value={statusBaru}>
						<Select.Trigger class="w-full"><span>{labelStatus(statusBaru)}</span></Select.Trigger>
						<Select.Content>
							{#each statusOptions as opt}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-2">
					<Label.Root>Akun Login (opsional)</Label.Root>
					<Select.Root type="single" name="userId" bind:value={akunBaru}>
						<Select.Trigger class="w-full"
							><span
								>{akunTersedia.find((a) => a.id === akunBaru)?.name ?? "Tidak dihubungkan"}</span
							></Select.Trigger
						>
						<Select.Content>
							<Select.Item value="" label="Tidak dihubungkan">Tidak dihubungkan</Select.Item>
							{#each akunTersedia as akun (akun.id)}
								<Select.Item value={akun.id} label={akun.name}
									>{akun.name} (@{akun.username})</Select.Item
								>
							{/each}
						</Select.Content>
					</Select.Root>
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
					class="bg-emerald-600 text-white hover:bg-emerald-700"
					disabled={sedangMengirim}>Simpan Petugas</Button
				>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
