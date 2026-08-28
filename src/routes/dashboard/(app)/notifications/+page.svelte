<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { enhance } from "$app/forms";
	import InfoIcon from "@lucide/svelte/icons/info";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
	import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
	import CheckIcon from "@lucide/svelte/icons/check";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import BellIcon from "@lucide/svelte/icons/bell";
	import { toast } from "svelte-sonner";

	let { data, form } = $props();

	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success) toast.success("Berhasil");
	});

	const unreadCount = $derived(data.notifications.filter((n) => !n.read).length);

	function typeIcon(type: string) {
		switch (type) {
			case "warning":
				return AlertTriangleIcon;
			case "error":
				return CircleAlertIcon;
			case "success":
				return CheckCircleIcon;
			default:
				return InfoIcon;
		}
	}

	function typeColor(type: string) {
		switch (type) {
			case "warning":
				return "text-yellow-600 dark:text-yellow-400";
			case "error":
				return "text-red-600 dark:text-red-400";
			case "success":
				return "text-green-600 dark:text-green-400";
			default:
				return "text-blue-600 dark:text-blue-400";
		}
	}

	function formatDate(date: Date | null) {
		if (!date) return "";
		return new Intl.DateTimeFormat("id-ID", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		}).format(new Date(date));
	}
</script>

<svelte:head>
	<title>Notifikasi - Novira</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Notifikasi Sistem"
		eyebrow="Pusat Pemberitahuan"
		description={unreadCount > 0
			? `Anda memiliki ${unreadCount} notifikasi belum dibaca.`
			: "Semua sudah dibaca. Tidak ada notifikasi baru."}
		icon={BellIcon}
	>
		{#snippet badges()}
			{#if unreadCount > 0}
				<Badge variant="destructive" class="text-xs font-semibold">{unreadCount} baru</Badge>
			{/if}
		{/snippet}

		{#snippet actions()}
			{#if unreadCount > 0}
				<form method="POST" action="?/markAllRead" use:enhance>
					<Button variant="outline" size="sm" class="h-9 text-xs font-semibold" type="submit">
						<CheckIcon class="mr-1.5 size-4" />
						Tandai Semua Dibaca
					</Button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.notifications.length === 0}
		<div
			class="bg-muted/30 flex h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed"
		>
			<div class="bg-muted flex size-14 items-center justify-center rounded-2xl">
				<BellIcon class="text-muted-foreground size-7" />
			</div>
			<p class="text-sm font-semibold">Belum ada notifikasi</p>
			<p class="text-muted-foreground max-w-xs text-center text-xs">
				Pemberitahuan insiden baru, pelanggaran SLA, dan aktivitas sistem akan muncul di sini.
			</p>
		</div>
	{:else}
		<div class="space-y-2.5">
			{#each data.notifications as notification (notification.id)}
				{@const Icon = typeIcon(notification.type)}
				<Card.Root class="gap-0 py-4 {!notification.read ? 'border-primary/30 bg-primary/5' : ''}">
					<Card.Content class="flex items-start gap-4">
						<div
							class="bg-muted/70 flex size-10 shrink-0 items-center justify-center rounded-xl {typeColor(
								notification.type
							)}"
						>
							<Icon class="size-5" />
						</div>
						<div class="flex-1 space-y-1">
							<div class="flex items-start justify-between gap-2">
								<div>
									<p class="text-sm leading-none font-medium">
										{notification.title}
										{#if !notification.read}
											<Badge variant="default" class="ml-2 text-[10px]">Baru</Badge>
										{/if}
									</p>
									<p class="text-muted-foreground mt-1 text-sm">{notification.message}</p>
								</div>
								<span class="text-muted-foreground shrink-0 text-xs"
									>{formatDate(notification.createdAt)}</span
								>
							</div>
						</div>
						<div class="flex shrink-0 gap-1">
							{#if !notification.read}
								<form method="POST" action="?/markRead" use:enhance>
									<input type="hidden" name="id" value={notification.id} />
									<Button
										variant="ghost"
										size="icon"
										class="size-8"
										type="submit"
										title="Tandai dibaca"
									>
										<CheckIcon class="size-4" />
									</Button>
								</form>
							{/if}
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={notification.id} />
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive size-8"
									type="submit"
									title="Hapus"
									aria-label="Hapus notifikasi"
								>
									<TrashIcon class="size-4" />
								</Button>
							</form>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>
