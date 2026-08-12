export function downloadCsvReport(
	filename: string,
	headers: string[],
	rows: (string | number)[][]
) {
	const csvLines = [
		headers.join(","),
		...rows.map((row) =>
			row
				.map((cell) => {
					const str = String(cell);
					if (str.includes(",") || str.includes('"') || str.includes("\n")) {
						return `"${str.replace(/"/g, '""')}"`;
					}
					return str;
				})
				.join(",")
		),
	];

	const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvLines.join("\n");
	const encodedUri = encodeURI(csvContent);
	const link = document.createElement("a");
	link.setAttribute("href", encodedUri);
	link.setAttribute("download", `${filename}.csv`);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

export function triggerPdfReportPrint() {
	if (typeof window !== "undefined") {
		window.print();
	}
}
