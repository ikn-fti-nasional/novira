function escapeHtml(str: string | number | null | undefined): string {
	if (str === null || str === undefined) return "";
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export function triggerPdfReportPrint(
	title: string,
	author: string,
	headers: string[],
	rows: (string | number | null | undefined)[][]
) {
	if (typeof window === "undefined") return;

	const iframe = document.createElement("iframe");
	iframe.style.position = "fixed";
	iframe.style.right = "0";
	iframe.style.bottom = "0";
	iframe.style.width = "0";
	iframe.style.height = "0";
	iframe.style.border = "none";
	document.body.appendChild(iframe);

	const doc = iframe.contentWindow?.document;
	if (!doc) {
		document.body.removeChild(iframe);
		return;
	}

	const dateStr = new Date().toLocaleString("id-ID", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	doc.write(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>${escapeHtml(title.replace(/_/g, " "))}</title>
			<style>
				@page {
					margin: 1.5cm;
					size: landscape;
				}
				body {
					font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
					color: #111;
					margin: 0;
					padding: 0;
					font-size: 11px;
				}
				.print-header {
					border-bottom: 3px solid #111;
					padding-bottom: 15px;
					margin-bottom: 20px;
					display: flex;
					align-items: center;
					gap: 20px;
				}
				.logo-area img {
					height: 70px;
					width: auto;
				}
				.header-text h2 {
					margin: 0;
					font-size: 22px;
					font-weight: 800;
					letter-spacing: -0.5px;
				}
				.header-text h3 {
					margin: 4px 0 0 0;
					font-size: 14px;
					font-weight: 600;
					color: #444;
				}
				.report-meta {
					margin-bottom: 20px;
				}
				.report-meta h1 {
					margin: 0 0 15px 0;
					font-size: 18px;
					text-align: center;
					text-transform: uppercase;
					letter-spacing: 1px;
					border-bottom: 1px dashed #ccc;
					padding-bottom: 10px;
				}
				.report-meta-grid {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 10px;
					font-size: 12px;
				}
				.report-meta-grid p {
					margin: 0;
				}
				table {
					width: 100%;
					border-collapse: collapse;
					margin-bottom: 20px;
				}
				th, td {
					border: 1px solid #111;
					padding: 8px 10px;
					text-align: left;
					vertical-align: top;
					line-height: 1.4;
				}
				th {
					background-color: #f1f5f9 !important;
					-webkit-print-color-adjust: exact;
					print-color-adjust: exact;
					font-weight: bold;
					text-transform: uppercase;
					font-size: 10px;
					color: #334155;
				}
				.footer {
					margin-top: 30px;
					font-size: 10px;
					color: #64748b;
					display: flex;
					justify-content: space-between;
					border-top: 1px solid #e2e8f0;
					padding-top: 10px;
				}
				/* Ensure the footer sticks to bottom if printed across multiple pages */
				@media print {
					thead {
						display: table-header-group;
					}
					tr {
						page-break-inside: avoid;
					}
				}
			</style>
		</head>
		<body>
			<div class="print-header">
				<div class="logo-area">
					<img src="${window.location.origin}/novira-logo.png" alt="Logo NOVIRA" />
				</div>
				<div class="header-text">
					<h2>Sistem Pemantauan Kebersihan Kota (NOVIRA)</h2>
					<h3>Pemerintah Daerah</h3>
				</div>
			</div>
			
			<div class="report-meta">
				<h1>${escapeHtml(title.replace(/_/g, " "))}</h1>
				<div class="report-meta-grid">
					<p><strong>Dicetak oleh:</strong> ${escapeHtml(author)}</p>
					<p style="text-align: right;"><strong>Waktu Cetak:</strong> ${escapeHtml(dateStr)}</p>
				</div>
			</div>

			<table>
				<thead>
					<tr>
						${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}
					</tr>
				</thead>
				<tbody>
					${rows
						.map(
							(row) => `
						<tr>
							${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
						</tr>
					`
						)
						.join("")}
				</tbody>
			</table>

			<div class="footer">
				<span>Dicetak otomatis dari Sistem NOVIRA</span>
				<span>Dokumen Internal</span>
			</div>
		</body>
		</html>
	`);
	doc.close();

	iframe.onload = () => {
		iframe.contentWindow?.focus();
		iframe.contentWindow?.print();

		setTimeout(() => {
			document.body.removeChild(iframe);
		}, 1000);
	};
}
