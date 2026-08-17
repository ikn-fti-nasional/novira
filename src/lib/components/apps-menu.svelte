<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import UsersIcon from "@lucide/svelte/icons/users";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import BellIcon from "@lucide/svelte/icons/bell";
	import DatabaseIcon from "@lucide/svelte/icons/database";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import { canAccessRole } from "$lib/authorize.js";

	type Props = {
		role: string;
	};

	let { role }: Props = $props();

	const allApps = [
		{ label: "Dasbor", href: "/dashboard", icon: LayoutDashboardIcon },
		{ label: "Pengguna", href: "/dashboard/users", icon: UsersIcon },
		{ label: "Peran", href: "/dashboard/roles", icon: ShieldIcon },
		{ label: "Notifikasi", href: "/dashboard/notifications", icon: BellIcon },
		{ label: "Basis Data", href: "/dashboard/database", icon: DatabaseIcon },
		{ label: "Pengaturan", href: "/dashboard/settings", icon: SettingsIcon },
	];

	const apps = $derived(allApps.filter((app) => canAccessRole(role, app.href)));

	let open = $state(false);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" {...props}>
				<LayoutGridIcon class="size-4" />
				<span class="sr-only">Menu aplikasi</span>
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-64 p-2" align="end">
		<div class="grid grid-cols-3 gap-1">
			{#each apps as app (app.href)}
				{@const Icon = app.icon}
				<a
					href={app.href}
					class="hover:bg-muted flex flex-col items-center gap-1.5 rounded-md px-2 py-3 text-center transition-colors"
					onclick={() => {
						open = false;
					}}
				>
					<div class="bg-muted flex size-9 items-center justify-center rounded-lg">
						<Icon class="text-foreground size-4" />
					</div>
					<span class="text-[11px] font-medium">{app.label}</span>
				</a>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
