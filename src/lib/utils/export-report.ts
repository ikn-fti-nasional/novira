/**
 * Escapes HTML special chars for safe insertion in fallback HTML.
 */
function escapeHtml(str: string | number | null | undefined): string {
	if (str === null || str === undefined) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Generate PDF blob and open in new tab (native viewer with toolbar).
 * Falls back to download if popup blocked.
 */
export function triggerPdfReportPrint(
	title: string,
	author: string,
	headers: string[],
	rows: (string | number | null | undefined)[][]
) {
	if (typeof window === "undefined") return;

	// dynamic import so SSR doesn't pull jspdf
	import("jspdf")
		.then(async ({ default: jsPDF }) => {
			const { default: autoTable } = await import("jspdf-autotable");

			const colCount = headers.length;
			const orientation: "landscape" | "portrait" =
				colCount > 8 ? "landscape" : colCount > 5 ? "landscape" : "portrait";
			const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

			const pageW = doc.internal.pageSize.getWidth();
			const margin = 10;
			const dateStr = new Date().toLocaleString("id-ID", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});

			// Header
			doc.setFillColor(5, 95, 70);
			doc.rect(0, 0, pageW, 18, "F");
			doc.setTextColor(255, 255, 255);
			doc.setFontSize(11);
			doc.setFont("helvetica", "bold");
			doc.text("NOVIRA — Sistem Pemantauan Kebersihan Kota", margin, 8);
			doc.setFontSize(7);
			doc.setFont("helvetica", "normal");
			doc.text("Pemerintah Daerah  •  Dokumen Internal", margin, 13);

			doc.setTextColor(30, 30, 30);
			doc.setFontSize(10);
			doc.setFont("helvetica", "bold");
			doc.text(title.replace(/_/g, " ").toUpperCase(), pageW / 2, 24, { align: "center" });

			doc.setFontSize(7);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(100, 100, 100);
			doc.text(`Dicetak oleh: ${author}`, margin, 30);
			doc.text(`Waktu cetak: ${dateStr}`, pageW - margin, 30, { align: "right" });
			doc.setDrawColor(200, 200, 200);
			doc.line(margin, 32, pageW - margin, 32);

			// Table — per-page fitting via fontSize & cellPadding
			const fontSize = colCount > 10 ? 6 : colCount > 7 ? 7 : 8;
			 
			(autoTable as any)(doc, {
				startY: 34,
				head: [headers],
				body: rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c)))),
				theme: "grid",
				styles: { fontSize, cellPadding: 2, overflow: "linebreak", valign: "middle" },
				headStyles: {
					fillColor: [5, 95, 70],
					textColor: 255,
					fontStyle: "bold",
					fontSize: fontSize,
				},
				alternateRowStyles: { fillColor: [248, 250, 252] },
				margin: { left: margin, right: margin },
				didDrawPage: (data: { pageNumber: number }) => {
					const p = doc.internal.pageSize.getHeight();
					doc.setFontSize(6);
					doc.setTextColor(130, 130, 130);
					doc.text("Dicetak otomatis dari Sistem NOVIRA", margin, p - 6);
					doc.text(`Hal ${data.pageNumber}`, pageW - margin, p - 6, { align: "right" });
				},
			});

			const blob = doc.output("blob");
			const url = URL.createObjectURL(blob);
			const win = window.open(url, "_blank");
			if (!win) {
				// popup blocked → download
				const a = document.createElement("a");
				a.href = url;
				a.download = `${title.replace(/\s+/g, "_")}.pdf`;
				a.click();
				setTimeout(() => URL.revokeObjectURL(url), 60000);
			} else {
				// revoke after viewer loads
				setTimeout(() => URL.revokeObjectURL(url), 60000);
			}
		})
		.catch((err) => {
			console.error("[novira] Gagal membuat PDF:", err);
			alert("Gagal membuat PDF. Silakan coba lagi atau hubungi administrator.");
		});
}

// keep escapeHtml for potential HTML fallback elsewhere
export { escapeHtml };
