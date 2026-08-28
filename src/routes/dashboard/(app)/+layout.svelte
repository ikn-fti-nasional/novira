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

	const crumbs = $derived.by(() => {
		const segments = page.url.pathname.split("/").filter(Boolean).slice(1);
		if (segments.length === 0) return [{ label: "Beranda Dasbor", href: "/dashboard" }];
		return [
			{ label: "Beranda Dasbor", href: "/dashboard" },
			...segments.map((segment, i) => ({
				label: labelFor(segment),
				href: "/dashboard/" + segments.slice(0, i + 1).join("/"),
			})),
		];
	});
</script>

<Sidebar.Provider>
	<AppSidebar
		user={data.user}
		notificationCount={data.unreadNotificationCount}
		incidentCount={data.activeIncidentCount}
	/>
	<Sidebar.Inset class="bg-background min-w-0">
		<header class="app-topbar sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 px-4 md:px-6">
			<Sidebar.Trigger class="-ml-1.5 size-9" />
			<Separator orientation="vertical" class="mx-1 !h-5 opacity-60" />
			<Breadcrumb.Root class="min-w-0">
				<Breadcrumb.List class="flex-nowrap">
					{#each crumbs as crumb, i (crumb.href)}
						{#if i > 0}
							<Breadcrumb.Separator class="hidden sm:block" />
						{/if}
						<Breadcrumb.Item class={i < crumbs.length - 1 ? "hidden sm:flex" : "min-w-0"}>
							{#if i === crumbs.length - 1}
								<Breadcrumb.Page class="truncate font-semibold">{crumb.label}</Breadcrumb.Page>
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

		<main class="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
			<div class="mx-auto w-full max-w-[1600px] 2xl:max-w-[1800px]">
				{@render children()}
			</div>
		</main>
	</Sidebar.Inset>
</Sidebar.Provider>

<Toaster position="top-right" richColors expand closeButton />
