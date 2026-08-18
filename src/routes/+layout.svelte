<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { ModeWatcher } from "mode-watcher";
	import { MetaTags } from "svelte-meta-tags";
	import { onNavigate } from "$app/navigation";
	import { navigating } from "$app/state";
	import "../app.css";

	let { children } = $props();

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			// A fresh navigation (e.g. tapping a sidebar link on mobile) can interrupt
			// an in-flight transition, rejecting these with InvalidStateError. The
			// navigation still completes, so swallow the rejection instead of letting
			// it surface as an uncaught promise error.
			transition.ready.catch(() => {});
			transition.finished.catch(() => {});
			transition.updateCallbackDone.catch(() => {});
		});
	});
</script>

<MetaTags
	title="Novira"
	titleTemplate="%s | Novira"
	description="A full-featured admin dashboard built with SvelteKit 2, Svelte 5, Tailwind CSS 4, Drizzle ORM, and session-based auth."
	openGraph={{
		type: "website",
		url: "https://novira.id",
		title: "Novira",
		description:
			"A full-featured admin dashboard built with SvelteKit 2, Svelte 5, Tailwind CSS 4, Drizzle ORM, and session-based auth.",
		siteName: "Novira",
	}}
	twitter={{
		cardType: "summary",
		title: "Novira",
		description:
			"A full-featured admin dashboard built with SvelteKit 2, Svelte 5, Tailwind CSS 4, Drizzle ORM, and session-based auth.",
	}}
/>

<ModeWatcher />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-emerald-500/20">
		<div class="h-full w-1/3 animate-[nav-progress_1.1s_ease-in-out_infinite] bg-emerald-500"></div>
	</div>
{/if}

{@render children()}

<style>
	@keyframes nav-progress {
		0% {
			transform: translateX(-100%);
		}
		50% {
			transform: translateX(150%);
		}
		100% {
			transform: translateX(150%);
		}
	}
</style>
