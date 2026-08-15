<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type { Kamera } from "$lib/types/novira.js";
	import type Hls from "hls.js";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import WifiOffIcon from "@lucide/svelte/icons/wifi-off";

	let { kamera, autoplay = true }: { kamera: Kamera; autoplay?: boolean } = $props();

	let videoEl: HTMLVideoElement | undefined = $state();
	let player: Hls | null = null;
	let gagal = $state(false);

	onMount(() => {
		const src = kamera.urlStream ?? "";
		if (!src || !videoEl) return;

		const isHls = src.toLowerCase().includes(".m3u8");

		if (isHls) {
			// Safari/Edge punya HLS native — pakai langsung.
			if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
				videoEl.src = src;
				return;
			}
			// Chrome/Firefox/Android butuh hls.js (code-split, dimuat hanya
			// saat dibutuhkan).
			import("hls.js")
				.then(({ default: Hls }) => {
					if (!Hls.isSupported() || !videoEl) {
						videoEl!.src = src;
						return;
					}
					player = new Hls({
						liveDurationInfinity: true,
						backBufferLength: 30,
					});
					// Error fatal = hls.js sudah habis percobaan pulih otomatis;
					// tanpa ini stream yang mati akan membeku selamanya. Hancurkan
					// player dan tampilkan fallback.
					player.on(Hls.Events.ERROR, (_event, data) => {
						if (data.fatal) {
							player?.destroy();
							player = null;
							gagal = true;
						}
					});
					player.loadSource(src);
					player.attachMedia(videoEl);
				})
				.catch(() => {
					if (videoEl) videoEl.src = src;
				});
		} else {
			videoEl.src = src;
		}
	});

	onDestroy(() => {
		player?.destroy();
		player = null;
	});
</script>

{#if kamera.urlStream && !gagal}
	<video
		bind:this={videoEl}
		controls
		{autoplay}
		muted
		playsinline
		class="h-full w-full object-cover"
		onerror={() => {
			gagal = true;
			player?.destroy();
		}}
	></video>
{:else if kamera.urlSnapshot}
	<img src={kamera.urlSnapshot} alt={kamera.nama} class="h-full w-full object-cover" />
{:else}
	<div class="flex h-full w-full items-center justify-center bg-slate-900 text-slate-500">
		<div class="flex flex-col items-center gap-2">
			{#if kamera.urlStream}
				<WifiOffIcon class="size-10 stroke-1" />
				<span class="text-xs">Stream tidak dapat diputar</span>
			{:else}
				<CameraIcon class="size-10 stroke-1" />
				<span class="text-xs">Belum ada link stream/snapshot</span>
			{/if}
		</div>
	</div>
{/if}
