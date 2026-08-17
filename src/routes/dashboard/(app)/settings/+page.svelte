<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Tabs from "$lib/components/ui/tabs/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { enhance } from "$app/forms";
	import { toast } from "svelte-sonner";
	import { parseUserAgent } from "$lib/utils/user-agent.js";
	import MonitorIcon from "@lucide/svelte/icons/monitor";
	import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
	import TabletIcon from "@lucide/svelte/icons/tablet";
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import BellIcon from "@lucide/svelte/icons/bell";
	import ShieldAlertIcon from "@lucide/svelte/icons/shield-alert";
	import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
	import CalendarIcon from "@lucide/svelte/icons/calendar";
	import WrenchIcon from "@lucide/svelte/icons/wrench";
	import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
	import PlayIcon from "@lucide/svelte/icons/play";
	import ActivityIcon from "@lucide/svelte/icons/activity";

	let { data, form } = $props();

	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success) {
			if (form.action === "jalankanDeteksi" && form.ringkasan) {
				const r = form.ringkasan as {
					camerasProcessed: number;
					camerasFailed: number;
					insidenBaru: number;
					insidenDiperbarui: number;
				};
				toast.success(
					`Siklus deteksi selesai: ${r.camerasProcessed} kamera diproses (${r.camerasFailed} gagal), ${r.insidenBaru} insiden baru, ${r.insidenDiperbarui} diperbarui`
				);
				return;
			}
			if (form.action === "cekKesehatanKamera" && form.ringkasan) {
				const r = form.ringkasan as {
					diperiksa: number;
					online: number;
					offline: number;
					dilewati: number;
				};
				toast.success(
					`Cek kesehatan selesai: ${r.online} online, ${r.offline} offline dari ${r.diperiksa} kamera diperiksa (${r.dilewati} dilewati)`
				);
				return;
			}
			const messages: Record<string, string> = {
				profile: "Profil berhasil disimpan",
				password: "Kata sandi berhasil diubah",
				settings: "Pengaturan berhasil disimpan",
				session: "Sesi berhasil dicabut",
				sessions: "Semua sesi lain berhasil dicabut",
				notifications: "Preferensi notifikasi berhasil disimpan",
				resetDemo: "Data demo berhasil direset",
			};
			toast.success(messages[form.action as string] ?? "Berhasil disimpan");
		}
	});

	function getDeviceIcon(device: string) {
		if (device === "Mobile") return SmartphoneIcon;
		if (device === "Tablet") return TabletIcon;
		return MonitorIcon;
	}

	function timeAgo(date: Date | null): string {
		if (!date) return "Tidak diketahui";
		const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
		if (seconds < 60) return "Baru saja";
		if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
		return `${Math.floor(seconds / 86400)} hari lalu`;
	}

	const notifLabels: Record<string, { label: string; description: string; icon: typeof BellIcon }> =
		{
			notif_security_alert: {
				label: "Peringatan keamanan",
				description: "Notifikasi keamanan penting",
				icon: ShieldAlertIcon,
			},
			notif_system_warning: {
				label: "Peringatan sistem",
				description: "Peringatan kesehatan dan performa sistem",
				icon: AlertTriangleIcon,
			},
			notif_weekly_digest: {
				label: "Ringkasan mingguan",
				description: "Ringkasan mingguan aktivitas dan statistik",
				icon: CalendarIcon,
			},
			notif_maintenance: {
				label: "Pemberitahuan pemeliharaan",
				description: "Notifikasi pemeliharaan terjadwal",
				icon: WrenchIcon,
			},
		};
</script>

<svelte:head>
	<title>Pengaturan - Novira</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Pengaturan</h1>
		<p class="text-muted-foreground">Kelola profil dan preferensi aplikasi Anda.</p>
	</div>

	<Tabs.Root value="profile">
		<Tabs.List>
			<Tabs.Trigger value="profile">Profil</Tabs.Trigger>
			<Tabs.Trigger value="sessions">Sesi</Tabs.Trigger>
			<Tabs.Trigger value="notifications">Notifikasi</Tabs.Trigger>
			{#if data.isAdmin}
				<Tabs.Trigger value="application">Aplikasi</Tabs.Trigger>
			{/if}
			{#if data.isAdmin && data.isDemoMode}
				<Tabs.Trigger value="demo">Demo</Tabs.Trigger>
			{/if}
		</Tabs.List>

		<Tabs.Content value="profile" class="space-y-6 pt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Informasi Profil</Card.Title>
					<Card.Description>Perbarui nama dan alamat email Anda.</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
						<div class="grid gap-2">
							<Label for="name">Nama</Label>
							<Input id="name" name="name" value={data.profile.name} required />
						</div>
						<div class="grid gap-2">
							<Label for="email">Email</Label>
							<Input id="email" name="email" type="email" value={data.profile.email} required />
						</div>
						<div class="grid gap-2">
							<Label>Nama Pengguna</Label>
							<Input value={data.profile.username} disabled />
							<p class="text-muted-foreground text-xs">Nama pengguna tidak dapat diubah.</p>
						</div>
						<Button type="submit">Simpan Profil</Button>
					</form>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Ubah Kata Sandi</Card.Title>
					<Card.Description
						>Perbarui kata sandi Anda. Anda memerlukan kata sandi saat ini.</Card.Description
					>
				</Card.Header>
				<Card.Content>
					<form method="POST" action="?/changePassword" use:enhance class="space-y-4">
						<div class="grid gap-2">
							<Label for="currentPassword">Kata Sandi Saat Ini</Label>
							<Input id="currentPassword" name="currentPassword" type="password" required />
						</div>
						<Separator />
						<div class="grid gap-2">
							<Label for="newPassword">Kata Sandi Baru</Label>
							<Input
								id="newPassword"
								name="newPassword"
								type="password"
								placeholder="Minimal 6 karakter"
								required
							/>
						</div>
						<div class="grid gap-2">
							<Label for="confirmPassword">Konfirmasi Kata Sandi Baru</Label>
							<Input id="confirmPassword" name="confirmPassword" type="password" required />
						</div>
						<Button type="submit">Ubah Kata Sandi</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="sessions" class="space-y-6 pt-4">
			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<div>
							<Card.Title>Sesi Aktif</Card.Title>
							<Card.Description>Kelola sesi aktif Anda di berbagai perangkat.</Card.Description>
						</div>
						{#if data.sessions.length > 1}
							<form method="POST" action="?/revokeAllOtherSessions" use:enhance>
								<Button type="submit" variant="destructive" size="sm">Cabut Semua Sesi Lain</Button>
							</form>
						{/if}
					</div>
				</Card.Header>
				<Card.Content>
					<div class="space-y-4">
						{#each data.sessions as session (session.id)}
							{@const ua = parseUserAgent(session.userAgent)}
							{@const isCurrent = session.id === data.currentSessionId}
							{@const DeviceIcon = getDeviceIcon(ua.device)}
							<div class="flex items-center justify-between rounded-lg border p-4">
								<div class="flex items-center gap-4">
									<div class="bg-muted flex size-10 items-center justify-center rounded-lg">
										<DeviceIcon class="text-muted-foreground size-5" />
									</div>
									<div>
										<div class="flex items-center gap-2">
											<span class="font-medium">{ua.browser} di {ua.os}</span>
											{#if isCurrent}
												<Badge variant="secondary">Perangkat Ini</Badge>
											{/if}
										</div>
										<div class="text-muted-foreground flex items-center gap-2 text-sm">
											<GlobeIcon class="size-3" />
											<span>{session.ipAddress ?? "IP tidak diketahui"}</span>
											<span>·</span>
											<span>{timeAgo(session.createdAt)}</span>
										</div>
									</div>
								</div>
								{#if !isCurrent}
									<form method="POST" action="?/revokeSession" use:enhance>
										<input type="hidden" name="sessionId" value={session.id} />
										<Button type="submit" variant="outline" size="sm">Cabut</Button>
									</form>
								{/if}
							</div>
						{:else}
							<p class="text-muted-foreground text-center text-sm">
								Tidak ada sesi aktif ditemukan.
							</p>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<Tabs.Content value="notifications" class="space-y-6 pt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title>Preferensi Notifikasi</Card.Title>
					<Card.Description>Pilih notifikasi mana yang ingin Anda terima.</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST" action="?/updateNotificationPrefs" use:enhance class="space-y-4">
						{#each Object.entries(notifLabels) as [key, { label, description, icon: Icon }]}
							<div class="flex items-center justify-between rounded-lg border p-4">
								<div class="flex items-center gap-3">
									<Icon class="text-muted-foreground size-5" />
									<div>
										<Label>{label}</Label>
										<p class="text-muted-foreground text-xs">{description}</p>
									</div>
								</div>
								<Switch name={key} checked={data.notificationPrefs[key]} />
							</div>
						{/each}
						<Button type="submit">Simpan Preferensi</Button>
					</form>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		{#if data.isAdmin}
			<Tabs.Content value="application" class="space-y-6 pt-4">
				<Card.Root>
					<Card.Header>
						<Card.Title>Pengaturan Aplikasi</Card.Title>
						<Card.Description
							>Konfigurasi pengaturan aplikasi secara global. Khusus admin.</Card.Description
						>
					</Card.Header>
					<Card.Content>
						<form method="POST" action="?/updateSettings" use:enhance class="space-y-6">
							<div class="grid gap-2">
								<Label for="siteName">Nama Situs</Label>
								<Input id="siteName" name="siteName" value={data.settings.siteName} />
							</div>

							<div class="grid gap-2">
								<Label>Zona Waktu</Label>
								<Select.Root name="timezone" type="single" value={data.settings.timezone}>
									<Select.Trigger>
										<span>{data.settings.timezone}</span>
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="UTC">UTC</Select.Item>
										<Select.Item value="America/New_York">America/New_York</Select.Item>
										<Select.Item value="America/Chicago">America/Chicago</Select.Item>
										<Select.Item value="America/Denver">America/Denver</Select.Item>
										<Select.Item value="America/Los_Angeles">America/Los_Angeles</Select.Item>
										<Select.Item value="Europe/London">Europe/London</Select.Item>
										<Select.Item value="Europe/Berlin">Europe/Berlin</Select.Item>
										<Select.Item value="Asia/Tokyo">Asia/Tokyo</Select.Item>
									</Select.Content>
								</Select.Root>
							</div>

							<div class="grid gap-2">
								<Label>Peran Pengguna Default</Label>
								<Select.Root name="defaultRole" type="single" value={data.settings.defaultRole}>
									<Select.Trigger>
										<span class="capitalize">{data.settings.defaultRole}</span>
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="admin">Admin (IT Sistem)</Select.Item>
										<Select.Item value="operator">Operator DLH</Select.Item>
										<Select.Item value="kepala_seksi">Kepala Seksi</Select.Item>
										<Select.Item value="kepala_dinas">Kepala Dinas Lingkungan Hidup</Select.Item>
										<Select.Item value="walikota">Wali Kota</Select.Item>
										<Select.Item value="petugas_lapangan">Petugas Lapangan</Select.Item>
									</Select.Content>
								</Select.Root>
								<p class="text-muted-foreground text-xs">
									Peran yang diberikan secara default untuk pengguna baru.
								</p>
							</div>

							<div class="flex items-center justify-between rounded-lg border p-4">
								<div class="space-y-0.5">
									<Label>Mode Pemeliharaan</Label>
									<p class="text-muted-foreground text-xs">
										Jika diaktifkan, pengguna non-admin akan melihat halaman pemeliharaan.
									</p>
								</div>
								<Switch name="maintenanceMode" checked={data.settings.maintenanceMode === "true"} />
							</div>

							<Button type="submit">Simpan Pengaturan</Button>
						</form>
					</Card.Content>
				</Card.Root>

				{#if data.pengaturanModel}
					<Card.Root>
						<Card.Header>
							<Card.Title>Model Deteksi AI untuk CCTV</Card.Title>
							<Card.Description>
								Model dan ambang kepercayaan yang dipakai siklus deteksi CCTV (otomatis maupun
								analisa manual). Pilih <strong>Street</strong> untuk kamera yang mengarah ke jalan/
								trotoar, atau <strong>CCTV Apung</strong> untuk kamera yang mengarah ke sungai/kanal
								(sampah mengambang).
							</Card.Description>
						</Card.Header>
						<Card.Content>
							<form method="POST" action="?/updateModelDeteksi" use:enhance class="space-y-6">
								<div class="grid gap-2">
									<Label>Model Deteksi</Label>
									<Select.Root
										name="modelType"
										type="single"
										value={data.pengaturanModel.modelType}
									>
										<Select.Trigger>
											<span>
												{data.pengaturanModel.modelType === "street"
													? "Street (jalan/trotoar)"
													: data.pengaturanModel.modelType === "cctv"
														? "CCTV Apung (sungai/kanal)"
														: "TACO (dataset umum)"}
											</span>
										</Select.Trigger>
										<Select.Content>
											{#each data.modelTypesTersedia as tipe (tipe)}
												<Select.Item value={tipe}>
													{tipe === "street"
														? "Street (jalan/trotoar)"
														: tipe === "cctv"
															? "CCTV Apung (sungai/kanal)"
															: "TACO (dataset umum)"}
												</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>

								<div class="grid gap-2">
									<Label for="confThres">Ambang Kepercayaan</Label>
									<Input
										id="confThres"
										name="confThres"
										type="number"
										min="0.05"
										max="1"
										step="0.05"
										value={data.pengaturanModel.confThres}
									/>
									<p class="text-muted-foreground text-xs">
										Deteksi di bawah ambang ini diabaikan. Semakin rendah, semakin banyak deteksi
										tapi makin banyak kemungkinan salah tangkap (mis. 0.2–0.4).
									</p>
								</div>

								<Button type="submit">Simpan Model Deteksi</Button>
							</form>
						</Card.Content>
					</Card.Root>
				{/if}

				<Card.Root>
					<Card.Header>
						<Card.Title>Deteksi Sampah CCTV Bandung</Card.Title>
						<Card.Description>
							Siklus deteksi otomatis berjalan setiap hari jam 12:00 & 15:00 WIB — ambil satu
							cuplikan per kamera Bandung, deteksi sampah, cocokkan dengan insiden yang masih
							terbuka. Tombol ini menjalankan siklus yang sama secara manual (mis. untuk uji coba
							tanpa menunggu jadwal).
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<form method="POST" action="?/jalankanDeteksi" use:enhance>
							<Button type="submit">
								<PlayIcon class="mr-2 size-4" />
								Jalankan Deteksi Sekarang
							</Button>
						</form>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header>
						<Card.Title>Kesehatan Kamera CCTV</Card.Title>
						<Card.Description>
							Cek otomatis tiap 15 menit apakah setiap kamera (semua kota) benar-benar bisa diputar,
							lalu perbarui status ONLINE/OFFLINE-nya. Kamera berstatus Perbaikan tidak disentuh —
							itu flag manual. Tombol ini menjalankan cek yang sama sekarang.
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<form method="POST" action="?/cekKesehatanKamera" use:enhance>
							<Button type="submit" variant="outline">
								<ActivityIcon class="mr-2 size-4" />
								Cek Kesehatan Kamera Sekarang
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		{/if}

		{#if data.isAdmin && data.isDemoMode}
			<Tabs.Content value="demo" class="space-y-6 pt-4">
				<Card.Root>
					<Card.Header>
						<Card.Title>Reset Data Demo</Card.Title>
						<Card.Description>
							Instans ini berjalan dalam mode demo. Pengunjung dapat mengubah pengguna, halaman, dan
							pengaturan. Mereset akan menghapus semua data dan mengisi ulang konten demo asli.
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-4">
						<div class="bg-muted/50 rounded-lg border p-4 text-sm">
							<p class="font-medium">Apa yang akan direset:</p>
							<ul class="text-muted-foreground mt-2 list-inside list-disc space-y-1">
								<li>Semua pengguna (diganti dengan akun demo bawaan)</li>
								<li>Semua halaman (diganti dengan konten demo bawaan)</li>
								<li>Semua notifikasi, sesi, dan pengaturan aplikasi</li>
							</ul>
							<p class="text-muted-foreground mt-3 text-xs">
								Berjalan otomatis setiap jam pada menit ke-10 (UTC). Anda juga dapat menjalankannya
								secara manual.
							</p>
						</div>
						<form method="POST" action="?/resetDemo" use:enhance>
							<Button type="submit" variant="destructive">
								<RotateCcwIcon class="mr-2 size-4" />
								Reset Data Demo Sekarang
							</Button>
						</form>
					</Card.Content>
				</Card.Root>
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</div>
