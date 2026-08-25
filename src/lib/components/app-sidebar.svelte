<script lang="ts">
	import { page } from "$app/stores";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import VideoIcon from "@lucide/svelte/icons/video";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import ActivityIcon from "@lucide/svelte/icons/activity";
	import ClipboardListIcon from "@lucide/svelte/icons/clipboard-list";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import UploadCloudIcon from "@lucide/svelte/icons/upload-cloud";
	import UserCheckIcon from "@lucide/svelte/icons/user-check";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import BellIcon from "@lucide/svelte/icons/bell";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import UserIcon from "@lucide/svelte/icons/user";
	import BellRingIcon from "@lucide/svelte/icons/bell-ring";

	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { canAccessRole } from "$lib/authorize.js";

	type Props = {
		user: {
			name: string;
			email: string;
			username: string;
			role: string;
		};
		notificationCount?: number;
		incidentCount?: number;
	};

	let { user, notificationCount = 0, incidentCount = 0 }: Props = $props();

	const isExecutive = $derived(user.role === "kepala_dinas" || user.role === "walikota");
	const isAdmin = $derived(user.role === "admin");

	const operationalNavigation: NavGroup[] = $derived([
		{
			label: "Ringkasan Eksekutif",
			items: [
				{ title: "Beranda Dasbor", url: "/dashboard", icon: LayoutDashboardIcon },
				{ title: "Dashboard Eksekutif", url: "/dashboard/eksekutif", icon: TrophyIcon },
				{ title: "Pemantauan Langsung", url: "/dashboard/monitoring", icon: VideoIcon },
			],
		},
		{
			label: "Manajemen Operasional",
			items: [
				{ title: "Kamera CCTV", url: "/dashboard/cameras", icon: CameraIcon },
				{ title: "Unggah & Analisa", url: "/dashboard/analisa-unggah", icon: UploadCloudIcon },
				{
					title: "Insiden & Alert",
					url: "/dashboard/incidents",
					icon: AlertTriangleIcon,
					badge: incidentCount > 0 ? String(incidentCount) : undefined,
					badgeVariant: "destructive" as const,
				},
				{ title: "Petugas Lapangan", url: "/dashboard/officers", icon: UserCheckIcon },
				{
					title: "Laporan Masyarakat",
					url: "/dashboard/laporan-masyarakat",
					icon: ClipboardListIcon,
				},
			],
		},
		{
			label: "Tata Kelola",
			items: [
				{
					title: "Laporan Wilayah & Provinsi",
					url: "/dashboard/laporan-wilayah",
					icon: FileSpreadsheetIcon,
				},
				{ title: "Audit & Log Aktivitas", url: "/dashboard/audit", icon: ShieldCheckIcon },
				{
					title: "Notifikasi Sistem",
					url: "/dashboard/notifications",
					icon: BellIcon,
					badge: notificationCount > 0 ? String(notificationCount) : undefined,
					badgeVariant: "secondary" as const,
				},
				{ title: "Pengaturan Sistem", url: "/dashboard/settings", icon: SettingsIcon },
			],
		},
	]);

	const executiveNavigation: NavGroup[] = $derived([
		{
			label: "Ringkasan Eksekutif",
			items: [
				{ title: "Dashboard Eksekutif", url: "/dashboard/eksekutif", icon: LayoutDashboardIcon },
				{
					title: "Laporan Eksekutif",
					url: "/dashboard/laporan-wilayah",
					icon: FileSpreadsheetIcon,
				},
			],
		},
		{
			label: "Tata Kelola & Alert",
			items: [
				{
					title: "Notifikasi Sistem",
					url: "/dashboard/notifications",
					icon: BellIcon,
					badge: notificationCount > 0 ? String(notificationCount) : undefined,
					badgeVariant: "secondary" as const,
				},
				{ title: "Pengaturan Sistem", url: "/dashboard/settings", icon: SettingsIcon },
			],
		},
	]);

	const navigation: NavGroup[] = $derived(
		isExecutive
			? executiveNavigation
			: operationalNavigation.map((group) => ({
					label: group.label,
					items: group.items.filter((item) => canAccessRole(user.role, item.url)),
				}))
	);

	function getRoleTitle(role: string) {
		switch (role) {
			case "walikota":
				return "Wali Kota (Eksekutif)";
			case "kepala_dinas":
				return "Kepala Dinas LH";
			case "admin":
				return "Admin IT";
			case "operator":
				return "Operator DLH";
			case "kepala_seksi":
				return "Kepala Seksi";
			case "petugas_lapangan":
				return "Petugas Lapangan";
			default:
				return role.toUpperCase();
		}
	}

	const sidebar = Sidebar.useSidebar();

	function handleNavigate() {
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}

	function getInitials(name: string) {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}

	type NavItem = {
		title: string;
		url: string;
		icon: typeof LayoutDashboardIcon;
		badge?: string;
		badgeVariant?: "destructive" | "secondary" | "default";
	};

	type NavGroup = {
		label: string;
		items: NavItem[];
	};
</script>

<Sidebar.Root
	collapsible="offcanvas"
	class="border-r border-sidebar-border bg-sidebar font-sans text-sidebar-foreground"
>
	<!-- HEADER BRANDING: Presisi tinggi h-14/h-16 dan tanpa padding berlebih -->
	<Sidebar.Header
		class="flex h-14 items-center justify-center border-b border-sidebar-border/80 px-3 py-0"
	>
		<Sidebar.Menu class="w-full">
			<Sidebar.MenuItem class="flex items-center justify-center">
				<Sidebar.MenuButton size="lg" class="h-10 w-full rounded-lg p-0 hover:bg-sidebar-accent">
					{#snippet child({ props })}
						<a
							href="/dashboard"
							{...props}
							onclick={handleNavigate}
							class="flex w-full items-center gap-3 px-2"
						>
							<div
								class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 p-1.5"
							>
								<img src="/novira-logo.png" alt="Logo NOVIRA" class="size-full object-contain" />
							</div>

							<div class="flex flex-col text-left">
								<span class="text-sm font-bold tracking-tight leading-none text-sidebar-foreground"
									>NOVIRA</span
								>
								<span
									class="text-[10px] font-medium leading-tight text-emerald-600 dark:text-emerald-400 mt-0.5"
								>
									Sistem Pengawasan Lingkungan
								</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<!-- NAVIGATION MENU -->
	<Sidebar.Content class="px-2 py-3 overflow-y-auto">
		{#each navigation as group (group.label)}
			<Sidebar.Group class="py-1.5">
				<Sidebar.GroupLabel
					class="px-2.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"
				>
					{group.label}
				</Sidebar.GroupLabel>

				<Sidebar.GroupContent class="mt-1">
					<Sidebar.Menu class="space-y-1">
						{#each group.items as item (item.title)}
							{@const isActive = $page.url.pathname === item.url}
							<Sidebar.MenuItem>
								<a
									href={item.url}
									onclick={handleNavigate}
									class="
                                        group relative flex h-9 w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium transition-all duration-150
                                        {isActive
										? '!bg-emerald-600 !text-white font-bold shadow-md'
										: 'text-sidebar-foreground/80 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'}
                                    "
								>
									<div class="flex items-center gap-2.5 min-w-0">
										<item.icon
											class="
                                                size-4.5 shrink-0 transition-transform duration-150
                                                {isActive
												? '!text-white scale-110'
												: 'text-sidebar-foreground/70 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}
                                            "
										/>
										<span class="truncate">{item.title}</span>
									</div>

									{#if item.badge}
										<Badge
											variant={item.badgeVariant || "secondary"}
											class="h-5 rounded-full px-2 text-[10px] font-semibold {isActive
												? 'bg-white/20 text-white'
												: ''}"
										>
											{item.badge}
										</Badge>
									{/if}
								</a>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<!-- USER FOOTER -->
	<Sidebar.Footer class="border-t border-sidebar-border/80 p-2">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="w-full">
						{#snippet child({ props })}
							<Sidebar.MenuButton
								size="lg"
								class="h-11 w-full rounded-lg px-2 transition-colors hover:bg-sidebar-accent"
								{...props}
							>
								<Avatar.Root class="size-7 shrink-0 rounded-lg border border-sidebar-border">
									<Avatar.Fallback
										class="rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-sm"
									>
										{getInitials(user.name)}
									</Avatar.Fallback>
								</Avatar.Root>

								<div class="ml-1 flex flex-col min-w-0 flex-1 text-left leading-tight">
									<span class="truncate text-xs font-semibold text-sidebar-foreground">
										{user.name}
									</span>
									<span
										class="truncate text-[10px] text-emerald-600 dark:text-emerald-400 font-medium"
									>
										{getRoleTitle(user.role)}
									</span>
								</div>

								<ChevronsUpDownIcon class="ml-auto size-4 shrink-0 text-sidebar-foreground/60" />
							</Sidebar.MenuButton>
						{/snippet}
					</DropdownMenu.Trigger>

					<DropdownMenu.Content class="w-56" align="end">
						<DropdownMenu.Group>
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a
										{...props}
										href="/dashboard/settings"
										onclick={handleNavigate}
										class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
									>
										<UserIcon class="size-4" />
										Profil Saya
									</a>
								{/snippet}
							</DropdownMenu.Item>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<form method="POST" action="/logout" class="w-full">
								<DropdownMenu.Item>
									{#snippet child({ props })}
										<button
											type="submit"
											{...props}
											class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent"
										>
											<LogOutIcon class="size-4" />
											Keluar
										</button>
									{/snippet}
								</DropdownMenu.Item>
							</form>
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
