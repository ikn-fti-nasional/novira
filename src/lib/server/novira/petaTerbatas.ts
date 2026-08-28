/**
 * `Promise.allSettled` dengan batas konkurensi — menjaga urutan hasil.
 *
 * Dipakai di `deteksi.ts` (siklus CCTV 290 kamera) & `kesehatanKamera.ts`
 * (probe 290 stream). Sebelumnya duplikat identik di dua file; kalau satu
 * diubah limitnya dan yang lain tidak, satu alur bisa flood server.
 */
export async function petaTerbatas<T, R>(
	items: readonly T[],
	batas: number,
	kerjakan: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
	const hasil = new Array<PromiseSettledResult<R>>(items.length);
	let berikutnya = 0;

	async function pekerja(): Promise<void> {
		for (;;) {
			const i = berikutnya++;
			if (i >= items.length) return;
			try {
				hasil[i] = { status: "fulfilled", value: await kerjakan(items[i]) };
			} catch (reason) {
				hasil[i] = { status: "rejected", reason };
			}
		}
	}

	await Promise.all(Array.from({ length: Math.min(batas, items.length) }, () => pekerja()));
	return hasil;
}
