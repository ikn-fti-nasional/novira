<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import PageHeader from "$lib/components/novira/page-header.svelte";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import RoleChangeDialog from "$lib/components/role-change-dialog.svelte";
	import ShieldIcon from "@lucide/svelte/icons/shield";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import UsersIcon from "@lucide/svelte/icons/users";
	import CheckIcon from "@lucide/svelte/icons/check";
	import { toast } from "svelte-sonner";

	let { data, form } = $props();

	let roleChangeOpen = $state(false);
	let roleChangeUser = $state({ id: "", name: "", role: "" });

	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success) toast.success("Peran berhasil diperbarui");
	});

	function getInitials(name: string) {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2);
	}

	function openRoleChange(user: { id: string; name: string; role: string }) {
		roleChangeUser = user;
		roleChangeOpen = true;
	}

	function roleIconTone(role: string) {
		switch (role) {
			case "admin":
				return "bg-primary/10 text-primary ring-primary/15";
			case "operator":
				return "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400";
			case "kepala_seksi":
				return "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400";
			default:
				return "bg-muted text-muted-foreground ring-border";
		}
	}

	const permissionLabels: Record<string, string> = {
		"Manage users": "Kelola pengguna",
		"Manage roles": "Kelola peran",
		"Manage settings": "Kelola pengaturan",
		"View database": "Lihat basis data",
		"Manage content": "Kelola konten",
		"Manage cameras & officers": "Kelola kamera & petugas",
		"Verify incidents": "Verifikasi insiden",
		"Export reports": "Ekspor laporan",
		"Manage cameras": "Kelola kamera",
		"Manage officers": "Kelola petugas",
		"Assign petugas": "Tugaskan petugas",
		"View executive dashboard": "Lihat dashboard eksekutif",
		"View area ranking": "Lihat peringkat wilayah",
		"View reports": "Lihat laporan",
		"View live monitoring": "Lihat pemantauan langsung",
		"View incidents": "Lihat insiden",
		"Escalate SLA violations": "Eskalasi pelanggaran SLA",
		"View assigned incidents": "Lihat insiden yang ditugaskan",
		"Update incident status": "Perbarui status insiden",
	};

	function translatePermission(perm: string) {
		return permissionLabels[perm] ?? perm;
	}
</script>

<svelte:head>
	<title>Peran - Novira</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Peran &amp; Hak Akses"
		eyebrow="Administrasi Sistem"
		description="Konfigurasi peran, kebijakan hak akses, dan anggota pada setiap peran."
		icon={ShieldIcon}
	/>

	<div class="grid gap-5 xl:grid-cols-2">
		{#each data.roles as role (role.name)}
			<Card.Root>
				<Card.Header>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex min-w-0 items-center gap-3">
							<div
								class="flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset {roleIconTone(
									role.name
								)}"
							>
								<ShieldIcon class="size-5" />
							</div>
							<div class="min-w-0">
								<Card.Title class="text-base font-bold capitalize">
									{role.name.replace(/_/g, " ")}
								</Card.Title>
								<Card.Description class="text-xs">{role.description}</Card.Description>
							</div>
						</div>
						<Badge variant="secondary" class="shrink-0 gap-1">
							<UsersIcon class="size-3" />
							{role.count} pengguna
						</Badge>
					</div>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div>
						<p class="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
							Hak Akses
						</p>
						<div class="flex flex-wrap gap-2">
							{#each role.permissions as perm}
								<Badge variant="outline" class="gap-1">
									<CheckIcon class="size-3" />
									{translatePermission(perm)}
								</Badge>
							{/each}
						</div>
					</div>

					{#if role.users.length > 0}
						<div>
							<p class="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
								Pengguna
							</p>
							<div class="space-y-2">
								{#each role.users as user (user.id)}
									<div class="flex items-center justify-between rounded-lg border p-3">
										<div class="flex items-center gap-3">
											<Avatar.Root class="size-8">
												<Avatar.Fallback class="text-xs">{getInitials(user.name)}</Avatar.Fallback>
											</Avatar.Root>
											<div>
												<p class="text-sm font-medium">{user.name}</p>
												<p class="text-muted-foreground text-xs">{user.email}</p>
											</div>
										</div>
										<Button
											variant="ghost"
											size="sm"
											onclick={() =>
												openRoleChange({ id: user.id, name: user.name, role: role.name })}
										>
											<PencilIcon class="mr-1 size-3" />
											Ubah
										</Button>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>

<RoleChangeDialog
	bind:open={roleChangeOpen}
	userId={roleChangeUser.id}
	userName={roleChangeUser.name}
	currentRole={roleChangeUser.role}
/>
