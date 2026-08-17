<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import type { Kamera } from "$lib/types/novira.js";
	import type Hls from "hls.js";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";

	let { kamera, autoplay = true }: { kamera: Kamera; autoplay?: boolean } = $props();

	let videoEl: HTMLVideoElement | undefined = $state();
	let player: Hls | null = null;
	let gagal = $state(false);
	let memuat = $state(true);
	// Guard untuk callback async hls.js: import bisa selesai setelah komponen
	// di-destroy, dan elemen video yang sudah terlepas tidak boleh disentuh.
	let hancur = false;

	function tandaiGagal() {
		if (hancur) return;
		player?.destroy();
		player = null;
		memuat = false;
		gagal = true;
	}

	/** Putar via <video src> bawaan browser (jalur Safari/iOS). */
	function putarNative(src: string) {
		if (hancur || !videoEl) return;
		videoEl.src = src;
		// Safari butuh load() eksplisit setelah src di-set secara imperatif.
		videoEl.load();
	}

	onMount(() => {
		const src = kamera.urlStream ?? "";
		if (!src || !videoEl) return;

		const isHls = src.toLowerCase().includes(".m3u8");
		if (!isHls) {
			putarNative(src);
			return;
		}

		// hls.js DULU, bukan canPlayType dulu.
		//
		// Chrome/Edge mengembalikan "maybe" untuk
		// `canPlayType("application/vnd.apple.mpegurl")` padahal keduanya TIDAK
		// bisa memutar HLS secara native: <video src="...m3u8"> di Chrome berhenti
		// di readyState 0 selamanya — tanpa memicu event `error` sekalipun, jadi
		// fallback pun tidak pernah jalan dan pemutar hanya menampilkan spinner.
		// Itulah kenapa umpan CCTV tampak "tidak muncul" di dashboard.
		//
		// Urutan yang benar: pakai hls.js di mana pun ia didukung (Chrome, Edge,
		// Firefox, Android), dan sisakan jalur native hanya untuk browser yang
		// benar-benar punya HLS bawaan tapi tidak mendukung MSE (Safari/iOS).
		import("hls.js")
			.then(({ default: Hls }) => {
				if (hancur || !videoEl) return;

				if (!Hls.isSupported()) {
					if (videoEl.canPlayType("application/vnd.apple.mpegurl")) putarNative(src);
					else tandaiGagal();
					return;
				}

				player = new Hls({
					liveDurationInfinity: true,
					backBufferLength: 30,
					// Feed ATCS publik sering tersendat; beri hls.js ruang untuk
					// mencoba ulang sebelum kita menyatakan stream mati.
					manifestLoadingMaxRetry: 3,
					levelLoadingMaxRetry: 4,
					fragLoadingMaxRetry: 6,
				});

				// Error fatal = hls.js sudah habis percobaan pulih otomatis; tanpa
				// ini stream yang mati akan membeku selamanya. Error non-fatal
				// (segmen bolong) sengaja dibiarkan — hls.js pulih sendiri.
				player.on(Hls.Events.ERROR, (_event, data) => {
					if (data.fatal) tandaiGagal();
				});
				player.on(Hls.Events.MANIFEST_PARSED, () => {
					if (hancur) return;
					memuat = false;
					if (autoplay) videoEl?.play().catch(() => {});
				});

				player.loadSource(src);
				player.attachMedia(videoEl);
			})
			.catch(() => {
				// Bundle hls.js gagal dimuat — jalur native adalah satu-satunya
				// peluang yang tersisa, dan hanya berarti di Safari.
				if (hancur || !videoEl) return;
				if (videoEl.canPlayType("application/vnd.apple.mpegurl")) putarNative(src);
				else tandaiGagal();
			});
	});

	onDestroy(() => {
		hancur = true;
		player?.destroy();
		player = null;
	});
</script>

{#if kamera.urlStream && !gagal}
	<div class="relative h-full w-full">
		<video
			bind:this={videoEl}
			controls
			{autoplay}
			muted
			playsinline
			class="h-full w-full object-cover"
			onloadeddata={() => (memuat = false)}
			onplaying={() => (memuat = false)}
			onerror={() => {
				// Jalur native saja: kegagalan hls.js sudah ditangani lewat event
				// ERROR fatal-nya, dan menghancurkan player di sini akan mematikan
				// stream yang sebenarnya masih sanggup pulih sendiri.
				if (!player) tandaiGagal();
			}}
		></video>

		{#if memuat}
			<div
				class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/70 text-slate-300"
			>
				<Loader2Icon class="size-7 animate-spin stroke-1" />
				<span class="text-xs">Menghubungkan ke CCTV…</span>
			</div>
		{/if}
	</div>
{:else if kamera.urlSnapshot}
	<div class="relative h-full w-full">
		<img src={kamera.urlSnapshot} alt={kamera.nama} class="h-full w-full object-cover" />
		<span
			class="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200"
		>
			Stream tidak tersedia — cuplikan terakhir
		</span>
	</div>
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
