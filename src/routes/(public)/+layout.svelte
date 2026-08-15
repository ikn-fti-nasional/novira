<script lang="ts">
	import CameraIcon from "@lucide/svelte/icons/camera";

	let { children } = $props();
</script>

<div class="bg-background min-h-screen">
	<header class="border-b">
		<div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<CameraIcon class="size-5 text-emerald-600" />
				Novira
			</a>
		</div>
	</header>
	<main>
		{@render children()}
	</main>
</div>
