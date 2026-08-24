<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { enhance } from "$app/forms";
	import { OPSI_PERAN, labelPeran } from "$lib/peran.js";

	type Props = {
		open: boolean;
		userId: string;
		userName: string;
		currentRole: string;
	};

	let { open = $bindable(false), userId, userName, currentRole }: Props = $props();

	// State lokal: tanpa `bind:value`, label pemicu Select tetap menampilkan
	// peran saat ini walau peran lain sudah dipilih.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let peranBaru = $state(currentRole);
	$effect(() => {
		peranBaru = currentRole;
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[350px]">
		<Dialog.Header>
			<Dialog.Title>Ubah Peran</Dialog.Title>
			<Dialog.Description>
				Ubah peran untuk {userName}. Peran saat ini: {labelPeran(currentRole)}.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/changeRole"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						open = false;
					}
					await update();
				};
			}}
		>
			<input type="hidden" name="userId" value={userId} />
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="newRole">Peran Baru</Label>
					<Select.Root name="newRole" type="single" bind:value={peranBaru}>
						<Select.Trigger>
							<span>{labelPeran(peranBaru)}</span>
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
				<Button type="submit">Perbarui Peran</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
