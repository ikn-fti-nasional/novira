<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
	import { enhance } from "$app/forms";

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
					return async ({ update }) => {
						await update();
						open = false;
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
