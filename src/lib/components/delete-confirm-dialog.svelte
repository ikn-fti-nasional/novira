<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";

	type Props = {
		open: boolean;
		action: string;
		id: string;
		itemName?: string;
	};

	let { open = $bindable(false), action, id, itemName = "item" }: Props = $props();
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Apakah Anda yakin?</AlertDialog.Title>
			<AlertDialog.Description>
				Tindakan ini akan menghapus {itemName} secara permanen dan tidak dapat dibatalkan.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Batal</AlertDialog.Cancel>
			<form
				method="POST"
				{action}
				use:enhance={() => {
					return async ({ update, result }) => {
						await update();
						open = false;
						if (result.type === "failure") {
							const data = result.data as { message?: string } | undefined;
							toast.error(data?.message ?? `Gagal menghapus ${itemName}`);
						} else if (result.type === "success") {
							toast.success(`${itemName} berhasil dihapus`);
						}
					};
				}}
			>
				<input type="hidden" name="id" value={id} />
				<AlertDialog.Action
					type="submit"
					class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
				>
					Hapus
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
