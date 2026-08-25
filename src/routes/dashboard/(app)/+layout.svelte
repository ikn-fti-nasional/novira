<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { page } from "$app/state";
	import { Toaster } from "$lib/components/ui/sonner/index.js";
	import ThemeToggle from "$lib/components/theme-toggle.svelte";
	import CommandPalette from "$lib/components/command-palette.svelte";
	import NotificationBell from "$lib/components/notification-bell.svelte";

	let { children, data } = $props();

	/** Route slug → display label, matching the wording used in the sidebar and each page's own <h1>. */
	const ROUTE_LABELS: Record<string, string> = {
		eksekutif: "Dashboard Eksekutif",
		monitoring: "Pemantauan Langsung",
		hotspots: "Peta Titik Rawan",
		cameras: "Kamera CCTV",
		incidents: "Insiden & Alert",
		officers: "Petugas Lapangan",
		"laporan-masyarakat": "Laporan Masyarakat",
		"laporan-wilayah": "Laporan Wilayah & Provinsi",
		"area-ranking": "Peringkat Wilayah",
		audit: "Audit & Log Aktivitas",
		notifications: "Notifikasi Sistem",
		settings: "Pengaturan Sistem",
		users: "Manajemen Pengguna",
		roles: "Peran & Hak Akses",
		database: "Basis Data",
	};

	function labelFor(segment: string) {
		return (
			ROUTE_LABELS[segment] ??
			segment
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ")
		);
	}

	function getBreadcrumbs() {
		const segments = page.url.pathname.split("/").filter(Boolean).slice(1);
		if (segments.length === 0) return [{ label: "Beranda Dasbor", href: "/dashboard" }];
		return segments.map((segment, i) => ({
			label: labelFor(segment),
			href: "/dashboard/" + segments.slice(0, i + 1).join("/"),
		}));
	}
</script>

<Sidebar.Provider>
	<AppSidebar
		user={data.user}
		notificationCount={data.unreadNotificationCount}
		incidentCount={data.activeIncidentCount}
	/>
	<Sidebar.Inset class="min-w-0">
		<header
			class="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4"
		>
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 !h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each getBreadcrumbs() as crumb, i (crumb.href)}
						{#if i > 0}
							<Breadcrumb.Separator />
						{/if}
						<Breadcrumb.Item>
							{#if i === getBreadcrumbs().length - 1}
								<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>

			<div class="ml-auto flex items-center gap-1">
				<CommandPalette role={data.user.role} />
				<NotificationBell
					count={data.unreadNotificationCount}
					notifications={data.recentNotifications}
				/>
				<ThemeToggle />
			</div>
		</header>

		<main class="min-w-0 flex-1 p-4 md:p-6">
			{@render children()}
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster />
