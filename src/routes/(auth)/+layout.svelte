<script lang="ts">
	let { children } = $props();
</script>

<!-- Kanvas bersama seluruh halaman auth. Latar diletakkan di layout supaya
     login, register, lupa sandi, reset, dan lock memakai permukaan yang sama
     tanpa mengulang markup di lima tempat. -->
<div class="bg-background relative min-h-svh overflow-hidden">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_15%_0%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%),radial-gradient(45%_45%_at_95%_100%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:44px_44px] opacity-[0.035]"
	></div>

	<div class="relative">
		{@render children()}
	</div>
</div>
