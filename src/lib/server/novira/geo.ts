/**
 * Utilitas geospasial ringan — sengaja tanpa PostGIS.
 *
 * Volume datanya kecil (belasan kamera, ratusan laporan per kota) sehingga
 * menghitung jarak di aplikasi jauh lebih murah secara operasional daripada
 * mewajibkan ekstensi PostGIS terpasang di server pemda / Neon. Kalau suatu
 * saat datanya membesar, ganti `cariTerdekat` dengan query PostGIS —
 * antarmukanya sudah dipisah untuk itu.
 */

const RADIUS_BUMI_METER = 6_371_000;

export interface Titik {
	latitude: number;
	longitude: number;
}

/** Jarak lingkaran besar antara dua koordinat, dalam meter. */
export function jarakMeter(a: Titik, b: Titik): number {
	const dLat = radian(b.latitude - a.latitude);
	const dLon = radian(b.longitude - a.longitude);
	const lat1 = radian(a.latitude);
	const lat2 = radian(b.latitude);

	const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
	return 2 * RADIUS_BUMI_METER * Math.asin(Math.min(1, Math.sqrt(h)));
}

function radian(derajat: number): number {
	return (derajat * Math.PI) / 180;
}

/** Parse sepasang koordinat yang tersimpan sebagai teks; `null` kalau salah satu tidak valid. */
export function parseTitik(
	lat: string | null | undefined,
	lon: string | null | undefined
): Titik | null {
	if (!lat || !lon) return null;
	const latitude = Number(lat);
	const longitude = Number(lon);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
	if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
	return { latitude, longitude };
}

/** Kandidat terdekat dari sebuah titik acuan, dibatasi radius maksimum. */
export function cariTerdekat<T>(
	acuan: Titik,
	kandidat: readonly T[],
	titikDari: (item: T) => Titik | null,
	radiusMaksMeter: number
): { item: T; jarakMeter: number } | null {
	let terbaik: { item: T; jarakMeter: number } | null = null;
	for (const item of kandidat) {
		const titik = titikDari(item);
		if (!titik) continue;
		const jarak = jarakMeter(acuan, titik);
		if (jarak > radiusMaksMeter) continue;
		if (!terbaik || jarak < terbaik.jarakMeter) terbaik = { item, jarakMeter: jarak };
	}
	return terbaik;
}

/**
 * Kunci sel grid ~110 m untuk mengelompokkan insiden yang praktis berada di
 * titik yang sama lintas waktu (dipakai analisa titik kronis). Pembulatan 3
 * desimal ≈ 111 m di garis khatulistiwa — cukup untuk "ruas jalan yang sama"
 * tanpa menyatukan dua sisi blok yang berbeda.
 */
export function selGrid(titik: Titik): string {
	return `${titik.latitude.toFixed(3)},${titik.longitude.toFixed(3)}`;
}

/**
 * Normalisasi nomor telepon Indonesia ke bentuk kanonik `62xxxxxxxxx`.
 *
 * Ini kunci primer tabel `reporter_trust`, jadi harus stabil: "0812-3456-789",
 * "+62 812 3456 789", dan "628123456789" wajib menghasilkan baris reputasi
 * yang sama, kalau tidak seorang pelapor bisa mereset reputasinya cukup
 * dengan mengubah format penulisan nomornya.
 *
 * Mengembalikan `null` untuk input yang tidak masuk akal sebagai nomor
 * (terlalu pendek/panjang) — pemanggil memperlakukannya sebagai anonim.
 */
export function normalisasiTelepon(input: string | null | undefined): string | null {
	if (!input) return null;
	let digit = input.replace(/\D/g, "");
	if (!digit) return null;

	if (digit.startsWith("0")) digit = `62${digit.slice(1)}`;
	else if (digit.startsWith("8")) digit = `62${digit}`;
	else if (!digit.startsWith("62")) return null;

	// Nomor seluler Indonesia: 62 + 9..13 digit.
	if (digit.length < 11 || digit.length > 15) return null;
	return digit;
}
