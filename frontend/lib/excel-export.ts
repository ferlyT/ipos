// @ts-ignore
import ExcelJS from "exceljs";

export interface TaxReportInvoice {
  notransaksi: string;
  tanggal: string;
  kodekantor?: string;
  kodesupel?: string;
  namapelanggan?: string;
  alamat?: string;
  telepon?: string;
  npwp?: string;
  nama_npwp?: string;
  alamat_npwp?: string;
  dpp: number;
  potongan: number;
  biayalain?: number;
  prpajak: number;
  pajak: number;
  totalakhir: number;
  nofp: string;
  carabayar?: string;
  kasir?: string;
  keterangan?: string;
  details?: Array<{
    iddetail?: string;
    notransaksi: string;
    nobaris: number;
    kodeitem: string;
    namaitem: string;
    jumlah: number;
    satuan: string;
    harga: number;
    potongan: number;
    total: number;
  }>;
}

export interface TaxReportSummary {
  totalInvoices: number;
  totalDpp: number;
  totalTax: number;
  totalGrand: number;
}

export async function exportTaxReportToExcel(params: {
  invoices: TaxReportInvoice[];
  summary: TaxReportSummary;
  startDate?: string;
  endDate?: string;
  searchFilter?: string;
  nofpFilter?: string;
  customFilename?: string;
}) {
  const { invoices, summary, startDate, endDate } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "iPos 4 Enterprise";
  workbook.lastModifiedBy = "iPos 4 Enterprise";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Laporan Penjualan Detail", {
    views: [{ showGridLines: true }],
  });

  // Set 8 main columns matching iPos 4 Detail Report layout:
  // Col A: No
  // Col B: No Transaksi / Kd. Item
  // Col C: Tanggal / Nama Item
  // Col D: Dept / Jml
  // Col E: Kode Pel. / Satuan
  // Col F: Nama Pel / Harga
  // Col G: No. FP / NPWP / Pot %
  // Col H: Alamat / Total
  sheet.columns = [
    { key: "col_a", width: 6 }, // A: No
    { key: "col_b", width: 22 }, // B: Kd. Item / No Transaksi
    { key: "col_c", width: 36 }, // C: Nama Item / Tanggal
    { key: "col_d", width: 10 }, // D: Jml / Dept
    { key: "col_e", width: 12 }, // E: Satuan / Kode Pel.
    { key: "col_f", width: 26 }, // F: Harga / Nama Pel
    { key: "col_g", width: 28 }, // G: Pot % / No. FP / NPWP
    { key: "col_h", width: 44 }, // H: Total / Alamat
  ];

  // 1. Report Title & Period Header
  const titleRow = sheet.addRow(["LAPORAN PENJUALAN DETAIL"]);
  titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF000000" } };

  let periodText = "SEMUA PERIODE";
  if (startDate && endDate) {
    const sYear = startDate.slice(0, 4);
    const sMonth = startDate.slice(5, 7);
    const eYear = endDate.slice(0, 4);
    const eMonth = endDate.slice(5, 7);
    const lastDayOfMonth = new Date(Number(sYear), Number(sMonth), 0).getDate();
    if (sYear === eYear && sMonth === eMonth && startDate.endsWith("-01") && endDate.endsWith(`-${lastDayOfMonth}`)) {
      const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
      ];
      periodText = `${monthNames[Number(sMonth) - 1].toUpperCase()} ${sYear}`;
    } else {
      periodText = `${startDate} s/d ${endDate}`;
    }
  } else if (startDate) {
    periodText = `Mulai ${startDate}`;
  } else if (endDate) {
    periodText = `Sampai ${endDate}`;
  }
  const periodRow = sheet.addRow([`PERIODE : ${periodText}`]);
  periodRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };

  sheet.addRow([]); // Blank line (row 3)

  let invoiceIdx = 1;

  for (const inv of invoices) {
    const tgl = inv.tanggal ? inv.tanggal.slice(0, 10) : "";
    const items = inv.details || [];
    let sumQty = 0;
    let sumTotal = 0;

    // #Index Marker Row
    const idxRow = sheet.addRow([`#${invoiceIdx++}`]);
    idxRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E40AF" } };

    // Transaction Header Labels Row (with text wrap)
    const txHeaderRow = sheet.addRow([
      "",
      "No Transaksi",
      "Tanggal",
      "Dept",
      "Kode Pel.",
      "Nama Pel",
      "No. FP / NPWP",
      "Alamat",
    ]);
    txHeaderRow.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF374151" } };
    for (let c = 2; c <= 8; c++) {
      const cell = txHeaderRow.getCell(c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
      cell.alignment = {
        wrapText: true,
        vertical: "middle",
        horizontal: c === 4 || c === 5 ? "center" : "left",
      };
    }

    // Transaction Data Row (with wrapText: true so no overflow!)
    const fpNpwp = [
      inv.nofp ? `FP: ${inv.nofp}` : "",
      inv.npwp ? `NPWP: ${inv.npwp}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const txDataRow = sheet.addRow([
      "",
      inv.notransaksi,
      tgl,
      inv.kodekantor || "UTM",
      inv.kodesupel || "-",
      inv.namapelanggan || "-",
      fpNpwp || "-",
      inv.alamat || "-",
    ]);
    txDataRow.font = { name: "Arial", size: 9, bold: false };

    for (let c = 2; c <= 8; c++) {
      const cell = txDataRow.getCell(c);
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      };
      cell.alignment = {
        wrapText: true,
        vertical: "top",
        horizontal: c === 4 || c === 5 ? "center" : "left",
      };
    }

    sheet.addRow([]); // Blank line

    // Item Detail Table Header
    const itemHeaderRow = sheet.addRow([
      "No",
      "Kd. Item",
      "Nama Item",
      "Jml",
      "Satuan",
      "Harga",
      "Pot %",
      "Total",
    ]);
    itemHeaderRow.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF000000" } };
    for (let c = 1; c <= 8; c++) {
      const cell = itemHeaderRow.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF9CA3AF" } },
        bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      };
      if (c === 1 || c === 4 || c === 5 || c === 7) {
        cell.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
      } else if (c === 6 || c === 8) {
        cell.alignment = { wrapText: true, horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { wrapText: true, horizontal: "left", vertical: "middle" };
      }
    }

    // Item Detail Rows
    if (items.length > 0) {
      for (const item of items) {
        sumQty += Number(item.jumlah || 0);
        sumTotal += Number(item.total || 0);

        const itemRow = sheet.addRow([
          item.nobaris,
          item.kodeitem,
          item.namaitem,
          item.jumlah,
          item.satuan,
          item.harga,
          item.potongan > 0 ? item.potongan : 0,
          item.total,
        ]);
        itemRow.font = { name: "Arial", size: 8.5 };

        // Formatting & Wrap Text
        itemRow.getCell(1).alignment = { vertical: "top", horizontal: "center" };
        itemRow.getCell(2).alignment = { vertical: "top", horizontal: "left" };
        itemRow.getCell(3).alignment = { wrapText: true, vertical: "top", horizontal: "left" };
        itemRow.getCell(4).alignment = { vertical: "top", horizontal: "center" };
        itemRow.getCell(5).alignment = { vertical: "top", horizontal: "center" };
        itemRow.getCell(6).alignment = { vertical: "top", horizontal: "right" };
        itemRow.getCell(7).alignment = { vertical: "top", horizontal: "center" };
        itemRow.getCell(8).alignment = { vertical: "top", horizontal: "right" };

        itemRow.getCell(4).numFmt = "#,##0";
        itemRow.getCell(6).numFmt = "#,##0";
        itemRow.getCell(7).numFmt = "#,##0";
        itemRow.getCell(8).numFmt = "#,##0";
      }
    }

    // Subtotal Row (Total Qty & Total Item Value)
    const subtotalRow = sheet.addRow(["", "", "", sumQty, "", "", "", sumTotal]);
    subtotalRow.font = { name: "Arial", size: 9, bold: true };
    subtotalRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    subtotalRow.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
    subtotalRow.getCell(4).numFmt = "#,##0";
    subtotalRow.getCell(8).numFmt = "#,##0";
    subtotalRow.getCell(4).border = { top: { style: "thin", color: { argb: "FF000000" } } };
    subtotalRow.getCell(8).border = { top: { style: "thin", color: { argb: "FF000000" } } };

    sheet.addRow([]); // Blank line

    // Footer Summary Transaction Row: Pot., Pajak, Biaya, Total Akhir
    const footerSummaryRow = sheet.addRow([
      "",
      `Pot. :`,
      inv.potongan || 0,
      `Pajak :`,
      inv.pajak || 0,
      `Biaya :`,
      inv.biayalain || 0,
      `Total Akhir : ${Number(inv.totalakhir || 0).toLocaleString("id-ID")}`,
    ]);
    footerSummaryRow.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF1F2937" } };

    footerSummaryRow.getCell(2).alignment = { horizontal: "right" };
    footerSummaryRow.getCell(3).alignment = { horizontal: "left" };
    footerSummaryRow.getCell(4).alignment = { horizontal: "right" };
    footerSummaryRow.getCell(5).alignment = { horizontal: "left" };
    footerSummaryRow.getCell(6).alignment = { horizontal: "right" };
    footerSummaryRow.getCell(7).alignment = { horizontal: "left" };
    footerSummaryRow.getCell(8).alignment = { horizontal: "right" };

    footerSummaryRow.getCell(3).numFmt = "#,##0";
    footerSummaryRow.getCell(5).numFmt = "#,##0";
    footerSummaryRow.getCell(7).numFmt = "#,##0";

    sheet.addRow([]); // Blank line
    sheet.addRow([]); // Blank line between transactions
  }

  // Very Bottom Grand Total Block
  sheet.addRow([]);
  sheet.addRow([]);

  const grandTaxRow = sheet.addRow(["", "", "", "", "", "", "Total PPN :", summary.totalTax]);
  grandTaxRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
  grandTaxRow.getCell(7).alignment = { horizontal: "right" };
  grandTaxRow.getCell(8).alignment = { horizontal: "right" };
  grandTaxRow.getCell(8).numFmt = "#,##0";
  grandTaxRow.getCell(7).border = { top: { style: "thin" } };
  grandTaxRow.getCell(8).border = { top: { style: "thin" } };

  const grandCountRow = sheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    "Total Faktur :",
    summary.totalInvoices,
  ]);
  grandCountRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } };
  grandCountRow.getCell(7).alignment = { horizontal: "right" };
  grandCountRow.getCell(8).alignment = { horizontal: "right" };
  grandCountRow.getCell(8).numFmt = "#,##0";
  grandCountRow.getCell(7).border = { bottom: { style: "double" } };
  grandCountRow.getCell(8).border = { bottom: { style: "double" } };

  // Write buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // Format penamaan file dengan menambahkan keterangan periode
  let periodPart = "";
  if (startDate && endDate) {
    if (startDate === endDate) {
      periodPart = `_${startDate}`;
    } else {
      periodPart = `_${startDate}_sd_${endDate}`;
    }
  } else if (startDate) {
    periodPart = `_Mulai_${startDate}`;
  } else if (endDate) {
    periodPart = `_Sampai_${endDate}`;
  } else {
    periodPart = `_Semua_Periode_${dateStr}`;
  }

  const fileName = params.customFilename || `Laporan_Penjualan_Kena_Pajak${periodPart}.xlsx`;

  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}
