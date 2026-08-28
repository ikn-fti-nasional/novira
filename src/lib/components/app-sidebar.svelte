<script lang="ts">
	import { page } from "$app/stores";
	import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
	import VideoIcon from "@lucide/svelte/icons/video";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
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

	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
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
					badgeTone: "danger" as const,
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
					badgeTone: "neutral" as const,
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
					badgeTone: "neutral" as const,
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
		badgeTone?: "danger" | "neutral";
	};

	type NavGroup = {
		label: string;
		items: NavItem[];
	};
</script>

<Sidebar.Root collapsible="offcanvas" class="text-sidebar-foreground font-sans">
	<!-- BRANDING -->
	<Sidebar.Header class="border-sidebar-border h-16 justify-center border-b px-3 py-0">
		<a
			href="/dashboard"
			onclick={handleNavigate}
			class="hover:bg-sidebar-accent flex items-center gap-3 rounded-lg px-1.5 py-1.5 transition-colors"
		>
			<div
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 p-1.5 ring-1 ring-white/15 ring-inset"
			>
				<img src="/novira-logo.png" alt="Logo NOVIRA" class="size-full object-contain" />
			</div>
			<div class="flex min-w-0 flex-col text-left">
				<span class="text-base leading-none font-extrabold tracking-tight">NOVIRA</span>
				<span class="text-sidebar-label mt-1 truncate text-[10px] leading-tight font-medium">
					Sistem Pengawasan Lingkungan
				</span>
			</div>
		</a>
	</Sidebar.Header>

	<!-- NAVIGASI -->
	<Sidebar.Content class="gap-0 overflow-y-auto px-2.5 py-4">
		{#each navigation as group (group.label)}
			<Sidebar.Group class="p-0 pb-5 last:pb-1">
				<Sidebar.GroupLabel
					class="text-sidebar-label h-auto px-2.5 pb-2 text-[10px] font-bold tracking-[0.12em] uppercase"
				>
					{group.label}
				</Sidebar.GroupLabel>

				<Sidebar.GroupContent>
					<Sidebar.Menu class="gap-1">
						{#each group.items as item (item.title)}
							{@const isActive = $page.url.pathname === item.url}
							<Sidebar.MenuItem>
								<a
									href={item.url}
									onclick={handleNavigate}
									aria-current={isActive ? "page" : undefined}
									class="nav-link group"
								>
									<span class="flex min-w-0 items-center gap-2.5">
										<item.icon
											class="size-4 shrink-0 transition-transform duration-150 group-hover:scale-110"
										/>
										<span class="truncate">{item.title}</span>
									</span>

									{#if item.badge}
										<span
											class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold
											{isActive
												? 'bg-black/15 text-current'
												: item.badgeTone === 'danger'
													? 'bg-red-500 text-white'
													: 'text-sidebar-foreground bg-white/15'}"
										>
											{item.badge}
										</span>
									{/if}
								</a>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>

	<!-- PENGGUNA -->
	<Sidebar.Footer class="border-sidebar-border border-t p-2.5">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="w-full">
						{#snippet child({ props })}
							<button
								{...props}
								class="flex w-full items-center gap-2.5 rounded-lg bg-white/5 p-2 text-left ring-1 ring-white/10 transition-colors ring-inset hover:bg-white/10"
							>
								<Avatar.Root class="size-8 shrink-0 rounded-lg">
									<Avatar.Fallback
										class="bg-sidebar-primary text-sidebar-primary-foreground rounded-lg text-xs font-bold"
									>
										{getInitials(user.name)}
									</Avatar.Fallback>
								</Avatar.Root>

								<div class="flex min-w-0 flex-1 flex-col leading-tight">
									<span class="truncate text-xs font-semibold">{user.name}</span>
									<span class="text-sidebar-label truncate text-[10px] font-medium">
										{getRoleTitle(user.role)}
									</span>
								</div>

								<ChevronsUpDownIcon class="text-sidebar-muted size-4 shrink-0" />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>

					<DropdownMenu.Content class="w-56" align="end" side="top">
						<div class="px-2 py-1.5">
							<p class="truncate text-sm font-semibold">{user.name}</p>
							<p class="text-muted-foreground truncate text-xs">{user.email}</p>
						</div>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a
										{...props}
										href="/dashboard/settings"
										onclick={handleNavigate}
										class="data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
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
											class="text-destructive data-[highlighted]:bg-destructive/10 flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
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
