<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { enhance } from "$app/forms";
	import { OPSI_PERAN, labelPeran } from "$lib/peran.js";

	type UserData = {
		id: string;
		name: string;
		email: string;
		username: string;
		role: string;
	};

	type Props = {
		open: boolean;
		mode: "create" | "edit";
		user?: UserData | null;
	};

	let { open = $bindable(false), mode, user = null }: Props = $props();

	// State lokal: tanpa `bind:value`, label pemicu Select tidak berubah saat
	// peran lain dipilih.
	let peran = $state(user?.role ?? "operator");
	$effect(() => {
		peran = user?.role ?? "operator";
	});

	const title = $derived(mode === "create" ? "Tambah Pengguna" : "Ubah Pengguna");
	const action = $derived(mode === "create" ? "?/create" : "?/update");
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>
				{mode === "create" ? "Buat akun pengguna baru." : "Perbarui detail pengguna."}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			{action}
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						open = false;
					}
					await update();
				};
			}}
		>
			{#if mode === "edit" && user}
				<input type="hidden" name="id" value={user.id} />
			{/if}
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="name">Nama</Label>
					<Input id="name" name="name" value={user?.name ?? ""} required />
				</div>
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<Input id="email" name="email" type="email" value={user?.email ?? ""} required />
				</div>
				{#if mode === "create"}
					<div class="grid gap-2">
						<Label for="username">Nama Pengguna</Label>
						<Input
							id="username"
							name="username"
							placeholder="huruf kecil, 3-31 karakter"
							required
						/>
					</div>
					<div class="grid gap-2">
						<Label for="password">Kata Sandi</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="Minimal 6 karakter"
							required
						/>
					</div>
				{/if}
				<div class="grid gap-2">
					<Label for="role">Peran</Label>
					<Select.Root name="role" type="single" bind:value={peran}>
						<Select.Trigger>
							<span>{labelPeran(peran)}</span>
						</Select.Trigger>
						<Select.Content>
							{#each OPSI_PERAN as opt (opt.value)}
								<Select.Item value={opt.value} label={opt.label}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="submit">{mode === "create" ? "Buat" : "Simpan Perubahan"}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
