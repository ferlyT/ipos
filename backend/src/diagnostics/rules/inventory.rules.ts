import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { AnomalyItem } from "../types";

export async function checkInventoryRules(): Promise<AnomalyItem[]> {
  const anomalies: AnomalyItem[] = [];

  // 1. INV_NEGATIVE_STOCK: Stok fisik di gudang bernilai negatif
  const negativeStock = await db.execute<any>(sql`
    SELECT 
      s.kodeitem, 
      i.namaitem, 
      s.kantor, 
      s.stok::float AS stok
    FROM tbl_itemstok s
    JOIN tbl_item i ON s.kodeitem = i.kodeitem
    WHERE s.stok < 0
    ORDER BY s.stok ASC
    LIMIT 30;
  `);

  for (const r of negativeStock) {
    anomalies.push({
      id: `INV_NEGATIVE_STOCK_${r.kodeitem}_${r.kantor}`,
      code: "INV_NEGATIVE_STOCK",
      category: "INVENTORY",
      severity: "WARNING",
      title: `Stok Negatif: ${r.kodeitem} (${r.namaitem})`,
      description: `Item '${r.namaitem}' di kantor/gudang '${r.kantor}' memiliki stok minus (${r.stok}). Stok minus menyebabkan perhitungan rata-rata HPP menjadi kacau dan nilai persediaan di Neraca tidak akurat.`,
      referenceKey: r.kodeitem,
      detectedValue: r.stok,
      remediation: `Lakukan koreksi stok masuk (Item Masuk) atau lakukan Stok Opname untuk menyesuaikan stok fisik riil di gudang.`,
    });
  }

  // 2. INV_ZERO_HPP: Item yang memiliki transaksi jual tetapi HPP <= 0
  const zeroHpp = await db.execute<any>(sql`
    SELECT 
      i.kodeitem, 
      i.namaitem, 
      i.hargapokok::float AS hargapokok, 
      i.hargajual1::float AS hargajual,
      i.tipe
    FROM tbl_item i
    WHERE i.hargapokok <= 0 
      AND i.tipe != 'J' -- Bukan item bertipe Jasa
      AND EXISTS (SELECT 1 FROM tbl_ikdt dt WHERE dt.kodeitem = i.kodeitem LIMIT 1)
    LIMIT 30;
  `);

  for (const r of zeroHpp) {
    anomalies.push({
      id: `INV_ZERO_HPP_${r.kodeitem}`,
      code: "INV_ZERO_HPP",
      category: "INVENTORY",
      severity: "WARNING",
      title: `Harga Pokok (HPP) Rp 0: ${r.kodeitem} (${r.namaitem})`,
      description: `Item barang '${r.namaitem}' telah terjual tetapi tercatat memiliki Harga Pokok Rp ${r.hargapokok}. Hal ini menyebabkan HPP Penjualan di Laporan Laba Rugi menjadi Rp 0 dan Laba Kotor tercatat 100% (fiktif/terlalu tinggi).`,
      referenceKey: r.kodeitem,
      detectedValue: r.hargapokok,
      remediation: `Buka Master Data Item, perbarui 'Harga Pokok' item ${r.kodeitem} sesuai dengan faktur pembelian atau harga beli modal riil, lalu jalankan menu 'Proses Ulang HPP' di iPos 4.`,
    });
  }

  // 3. INV_LEDGER_DIFF: Selisih akumulasi fisik persediaan vs saldo akun 1-1301 di Buku Besar (Saldo Awal tbl_acc_sa + Mutasi tbl_accjurnal)
  const invPhysical = await db.execute<any>(sql`
    SELECT 
      COALESCE(SUM(s.stok * i.hargapokok), 0)::float AS total_fisik
    FROM tbl_itemstok s
    JOIN tbl_item i ON s.kodeitem = i.kodeitem
    WHERE s.stok > 0 AND i.tipe != 'J';
  `);

  const invLedger = await db.execute<any>(sql`
    SELECT 
      (
        COALESCE((SELECT jumlah::float FROM tbl_acc_sa WHERE kodeacc = '1-1301' AND tanggal = '2022-01-01' LIMIT 1), 0) +
        COALESCE(SUM(debet - kredit), 0)::float
      ) AS total_buku_besar
    FROM tbl_accjurnal
    WHERE kodeacc = '1-1301';
  `);

  const physicalVal = invPhysical[0]?.total_fisik || 0;
  const ledgerVal = invLedger[0]?.total_buku_besar || 0;
  const diff = Math.abs(physicalVal - ledgerVal);

  // Jika selisih fisik vs buku besar melebihi Rp 100 Juta, beri catatan audit
  if (diff > 100_000_000) {
    anomalies.push({
      id: "INV_LEDGER_DIFF",
      code: "INV_LEDGER_DIFF",
      category: "INVENTORY",
      severity: "WARNING",
      title: "Selisih Nilai Fisik Persediaan vs Buku Besar (1-1301)",
      description: `Total nilai fisik stok gudang (Stok x HPP) bernilai Rp ${physicalVal.toLocaleString("id-ID")}, sedangkan saldo akun Persediaan Barang (1-1301) di Buku Besar (Saldo Awal + Mutasi Jurnal) adalah Rp ${ledgerVal.toLocaleString("id-ID")} (Selisih: Rp ${diff.toLocaleString("id-ID")}).`,
      referenceKey: "1-1301",
      detectedValue: { fisik: physicalVal, buku_besar: ledgerVal },
      discrepancy: diff,
      remediation: "Lakukan rekonsiliasi stok opname akhir periode untuk menyesuaikan selisih fisik barang di gudang dengan catatan buku besar.",
    });
  }

  // 4. INV_OUTOFSTOCK_SALES: Penjualan yang terjadi saat stok kosong/minus (alokasi OUTOFSTOCK di tbl_item_ik)
  const oosSummary = await db.execute<any>(sql`
    SELECT 
      COUNT(*)::int AS total_transaksi,
      COUNT(DISTINCT kodeitem)::int AS total_item,
      COALESCE(SUM(jumlahdasar), 0)::float AS total_qty,
      COALESCE(SUM(jumlahdasar * hargadasar), 0)::float AS total_hpp_distorsi
    FROM tbl_item_ik
    WHERE iddetailim = 'OUTOFSTOCK';
  `);

  const oosCount = oosSummary[0]?.total_transaksi || 0;
  if (oosCount > 0) {
    const totalQty = oosSummary[0]?.total_qty || 0;
    const totalDistorsi = oosSummary[0]?.total_hpp_distorsi || 0;
    const distinctItem = oosSummary[0]?.total_item || 0;

    anomalies.push({
      id: "INV_OUTOFSTOCK_SALES_SUMMARY",
      code: "INV_OUTOFSTOCK_SALES",
      category: "INVENTORY",
      severity: "CRITICAL",
      title: `Penjualan Saat Stok Minus (${oosCount} Transaksi / ${distinctItem} Item)`,
      description: `Ditemukan ${oosCount} transaksi penjualan (${totalQty.toLocaleString("id-ID")} unit barang pada ${distinctItem} item berbeda) yang dilakukan saat stok habis/minus (flag: OUTOFSTOCK di tbl_item_ik). Total nilai HPP yang terdistorsi mencapai Rp ${totalDistorsi.toLocaleString("id-ID")}. Penjualan mendahului input faktur pembelian merusak akurasi kartu stok dan perhitungan HPP FIFO.`,
      referenceKey: "OUTOFSTOCK",
      detectedValue: totalDistorsi,
      remediation: "Pastikan seluruh faktur pembelian diinput sesuai tanggal fisik barang diterima sebelum transaksi penjualan dibukukan. Di menu 'Pengaturan > Pengaturan Umum', ubah opsi 'Pengecekan Stok pada Penjualan' menjadi 'Stok habis tidak bisa dijual'. Setelah faktur beli lengkap, jalankan 'Proses Bulanan' dengan opsi 'Perbaikan Stok' dicentang.",
    });
  }

  return anomalies;
}
