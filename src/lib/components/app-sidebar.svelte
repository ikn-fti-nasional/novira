<script lang="ts">
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import VideoIcon from "@lucide/svelte/icons/video";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import MapPinIcon from "@lucide/svelte/icons/map-pin";
	import BarChart3Icon from "@lucide/svelte/icons/bar-chart-3";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import UserCheckIcon from "@lucide/svelte/icons/user-check";
	import TrophyIcon from "@lucide/svelte/icons/trophy";
	import BellIcon from "@lucide/svelte/icons/bell";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
	import FileSpreadsheetIcon from "@lucide/svelte/icons/file-spreadsheet";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import UserIcon from "@lucide/svelte/icons/user";
	import BellRingIcon from "@lucide/svelte/icons/bell-ring";

	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";

	type Props = {
		user: {
			name: string;
			email: string;
			username: string;
			role: string;
		};
		notificationCount?: number;
	};

	let { user, notificationCount = 0 }: Props = $props();

	const isExecutive = $derived(user.role === "kepala_dinas" || user.role === "walikota");

	function getRoleTitle(role: string) {
		switch (role) {
			case "walikota":
				return "Wali Kota Bandung (Eksekutif)";
			case "kepala_dinas":
				return "Kepala Dinas LH (Eksekutif)";
			case "admin_dlh":
			case "admin":
				return "Super Admin (Nasional)";
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
	};

	type NavGroup = {
		label: string;
		items: NavItem[];
	};

	const navigation: NavGroup[] = $derived(
		isExecutive
			? [
					{
						label: "Ringkasan Eksekutif",
						items: [
							{ title: "Dashboard Eksekutif", url: "/eksekutif", icon: LayoutDashboardIcon },
							{ title: "Peringkat Wilayah", url: "/area-ranking", icon: TrophyIcon },
							{ title: "Laporan Eksekutif", url: "/laporan-wilayah", icon: FileSpreadsheetIcon },
							{ title: "Analitik Kebersihan", url: "/analytics", icon: BarChart3Icon },
						],
					},
					{
						label: "Tata Kelola & Alert",
						items: [
							{
								title: "Notifikasi Sistem",
								url: "/notifications",
								icon: BellIcon,
								badge: notificationCount > 0 ? String(notificationCount) : undefined,
							},
						],
					},
				]
			: [
					{
						label: "Ringkasan Eksekutif",
						items: [
							{ title: "Beranda Dasbor", url: "/", icon: LayoutDashboardIcon },
							{ title: "Dashboard Eksekutif", url: "/eksekutif", icon: TrophyIcon },
							{ title: "Pemantauan Langsung", url: "/monitoring", icon: VideoIcon },
							{ title: "Insiden & Alert", url: "/incidents", icon: AlertTriangleIcon, badge: "14" },
							{ title: "Peta Titik Rawan", url: "/hotspots", icon: MapPinIcon },
							{ title: "Analitik Kebersihan", url: "/analytics", icon: BarChart3Icon },
						],
					},
					{
						label: "Manajemen Operasional",
						items: [
							{ title: "Kamera CCTV", url: "/cameras", icon: CameraIcon },
							{ title: "Petugas Lapangan", url: "/officers", icon: UserCheckIcon },
							{ title: "Peringkat Wilayah", url: "/area-ranking", icon: TrophyIcon },
						],
					},
					{
						label: "Super Admin & Tata Kelola",
						items: [
							{ title: "Laporan Wilayah & Provinsi", url: "/laporan-wilayah", icon: FileSpreadsheetIcon },
							{ title: "Audit & Log Aktivitas", url: "/audit", icon: ShieldCheckIcon },
							{
								title: "Notifikasi Sistem",
								url: "/notifications",
								icon: BellIcon,
								badge: notificationCount > 0 ? String(notificationCount) : undefined,
							},
							{ title: "Pengaturan Sistem", url: "/settings", icon: SettingsIcon },
						],
					},
				]
	);
</script>

<Sidebar.Root>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/" {...props} onclick={handleNavigate} class="flex items-center gap-3">
							<div class="flex aspect-square size-10 items-center justify-center">
								<img src="/novira-logo.png" alt="Logo NOVIRA" class="h-full w-full object-contain" />
							</div>
							<div class="flex flex-col gap-0.5 leading-none">
								<span class="font-extrabold tracking-tight text-emerald-950 dark:text-emerald-50 text-base">NOVIRA</span>
								<span class="text-[10px] text-muted-foreground font-semibold">Sistem Pengawasan Lingkungan</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>

	<Sidebar.Content>
		{#each navigation as group (group.label)}
			<Sidebar.Group>
				<Sidebar.GroupLabel class="text-xs uppercase tracking-wider font-semibold text-muted-foreground/80">{group.label}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each group.items as item (item.title)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton>
									{#snippet child({ props })}
										<a href={item.url} {...props} onclick={handleNavigate}>
											<item.icon class="size-4" />
											<span>{item.title}</span>
										</a>
									{/snippet}
								</Sidebar.MenuButton>
								{#if item.badge}
									<Sidebar.MenuBadge class={item.title === 'Insiden & Alert' ? 'bg-red-500/15 text-red-700 dark:text-red-400 font-semibold' : ''}>{item.badge}</Sidebar.MenuBadge>
								{/if}
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Sidebar.MenuButton
								size="lg"
								class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								{...props}
							>
								<Avatar.Root class="size-8 rounded-lg">
									<Avatar.Fallback class="rounded-lg bg-emerald-600 text-white font-bold">{getInitials(user.name)}</Avatar.Fallback>
								</Avatar.Root>
								<div class="grid flex-1 text-left text-sm leading-tight">
									<span class="truncate font-bold">{user.name}</span>
									<span class="text-muted-foreground truncate text-xs">{getRoleTitle(user.role)}</span>
								</div>
								<ChevronDownIcon class="ml-auto size-4" />
							</Sidebar.MenuButton>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="w-56" align="end" side="top">
						<DropdownMenu.Label class="flex items-center gap-2">
							Akun Pengguna
							<Badge variant="outline" class="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">{getRoleTitle(user.role)}</Badge>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item onclick={handleNavigate}>
							{#snippet child({ props })}
								<a href="/settings" {...props}>
									<UserIcon class="mr-2 size-4" />
									Profil Saya
								</a>
							{/snippet}
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={handleNavigate}>
							{#snippet child({ props })}
								<a href="/notifications" {...props}>
									<BellRingIcon class="mr-2 size-4" />
									Notifikasi &amp; Alert
								</a>
							{/snippet}
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={handleNavigate}>
							{#snippet child({ props })}
								<a href="/audit" {...props}>
									<ShieldCheckIcon class="mr-2 size-4" />
									Log Audit Sistem
								</a>
							{/snippet}
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							variant="destructive"
							onclick={() => {
								const form = document.getElementById("logout-form");
								if (form instanceof HTMLFormElement) form.requestSubmit();
							}}
						>
							<LogOutIcon class="mr-2 size-4" />
							Keluar Sistem
						</DropdownMenu.Item>
					</DropdownMenu.Content>
					<form id="logout-form" method="POST" action="/logout" class="hidden"></form>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>
