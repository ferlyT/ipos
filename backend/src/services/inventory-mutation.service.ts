import { client } from "../db/index";

export interface MutationSummaryQuery {
  startDate: string;
  endDate: string;
  office?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StockCardQuery {
  kodeitem: string;
  startDate: string;
  endDate: string;
  office?: string;
}

export class InventoryMutationService {
  /**
   * 1. REKAPITULASI MUTASI SEMUA ITEM (SUMMARY)
   */
  static async getMutationSummary(params: MutationSummaryQuery) {
    const {
      startDate,
      endDate,
      office = "UTM",
      search = "",
      page = 1,
      limit = 25,
    } = params;

    const isPaginated = limit > 0;
    const offset = isPaginated ? (Math.max(1, page) - 1) * limit : 0;
    const paginationClause = isPaginated ? client`LIMIT ${limit} OFFSET ${offset}` : client``;
    const startIso = `${startDate} 00:00:00`;
    const endIso = `${endDate} 23:59:59`;

    // Filter pencarian item
    const searchFilter = search.trim()
      ? client`AND (i.kodeitem ILIKE ${'%' + search.trim() + '%'} OR i.namaitem ILIKE ${'%' + search.trim() + '%'})`
      : client``;

    // Ambil tahun dan bulan dari startDate untuk referensi tbl_item_rekap
    const startYear = parseInt(startDate.slice(0, 4), 10);
    const startMonth = parseInt(startDate.slice(5, 7), 10);
    const firstDayOfMonthIso = `${startDate.slice(0, 7)}-01 00:00:00`;

    // 1. Dapatkan total count item
    const countRes = await client`
      SELECT COUNT(*)::int as total
      FROM tbl_item i
      WHERE (i.statushapus IS NULL OR i.statushapus = '0')
        ${searchFilter}
    `;
    const totalItems = Number(countRes[0]?.total || 0);

    // 2. Query data item beserta mutasi masuk, keluar, dan saldo awal
    // Menggunakan subquery agregasi per item yang terindeks
    const rows = await client`
      WITH item_page AS (
        SELECT 
          i.kodeitem,
          i.namaitem,
          i.satuan,
          COALESCE(i.rak, '-') as rak,
          COALESCE(i.hargapokok, 0)::numeric as hargapokok
        FROM tbl_item i
        WHERE (i.statushapus IS NULL OR i.statushapus = '0')
          ${searchFilter}
        ORDER BY i.kodeitem ASC
        ${paginationClause}
      ),
      -- Mutasi Masuk dalam Periode
      mut_masuk AS (
        SELECT 
          d.kodeitem,
          SUM(d.jumlah)::numeric as qty_masuk,
          SUM(d.total)::numeric as val_masuk,
          COUNT(DISTINCT h.notransaksi)::int as tx_masuk
        FROM tbl_imdt d
        JOIN tbl_imhd h ON d.notransaksi = h.notransaksi
        WHERE h.kodekantor = ${office}
          AND h.tanggal >= ${startIso}
          AND h.tanggal <= ${endIso}
          AND d.kodeitem IN (SELECT kodeitem FROM item_page)
        GROUP BY d.kodeitem
      ),
      -- Mutasi Keluar dalam Periode
      mut_keluar AS (
        SELECT 
          d.kodeitem,
          SUM(d.jumlah)::numeric as qty_keluar,
          SUM(d.total)::numeric as val_keluar,
          COUNT(DISTINCT h.notransaksi)::int as tx_keluar
        FROM tbl_ikdt d
        JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
        WHERE h.kodekantor = ${office}
          AND h.tanggal >= ${startIso}
          AND h.tanggal <= ${endIso}
          AND d.kodeitem IN (SELECT kodeitem FROM item_page)
        GROUP BY d.kodeitem
      ),
      -- Rekap Saldo Terakhir pada atau sebelum periode
      latest_rekap AS (
        SELECT DISTINCT ON (r.kodeitem)
          r.kodeitem,
          r.tahun,
          r.bulan,
          CASE 
            WHEN r.tahun = ${startYear} AND r.bulan = ${startMonth} THEN COALESCE(r.awal, 0)::numeric
            ELSE COALESCE(r.akhir, 0)::numeric
          END as base_qty,
          CASE 
            WHEN r.tahun = ${startYear} AND r.bulan = ${startMonth} 
              THEN (r.tahun || '-' || LPAD(r.bulan::text, 2, '0') || '-01 00:00:00')::timestamp
            WHEN r.bulan = 12
              THEN ((r.tahun + 1) || '-01-01 00:00:00')::timestamp
            ELSE 
              (r.tahun || '-' || LPAD((r.bulan + 1)::text, 2, '0') || '-01 00:00:00')::timestamp
          END as base_date
        FROM tbl_item_rekap r
        WHERE r.kodekantor = ${office}
          AND (r.tahun < ${startYear} OR (r.tahun = ${startYear} AND r.bulan <= ${startMonth}))
          AND r.kodeitem IN (SELECT kodeitem FROM item_page)
        ORDER BY r.kodeitem, r.tahun DESC, r.bulan DESC
      ),
      -- Transaksi antara base_date dan startDate
      in_before_start AS (
        SELECT 
          d.kodeitem,
          SUM(d.jumlah)::numeric as qty_pre_in
        FROM tbl_imdt d
        JOIN tbl_imhd h ON d.notransaksi = h.notransaksi
        LEFT JOIN latest_rekap lr ON d.kodeitem = lr.kodeitem
        WHERE h.kodekantor = ${office}
          AND (lr.base_date IS NULL OR h.tanggal >= lr.base_date)
          AND h.tanggal < ${startIso}
          AND d.kodeitem IN (SELECT kodeitem FROM item_page)
        GROUP BY d.kodeitem
      ),
      out_before_start AS (
        SELECT 
          d.kodeitem,
          SUM(d.jumlah)::numeric as qty_pre_out
        FROM tbl_ikdt d
        JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
        LEFT JOIN latest_rekap lr ON d.kodeitem = lr.kodeitem
        WHERE h.kodekantor = ${office}
          AND (lr.base_date IS NULL OR h.tanggal >= lr.base_date)
          AND h.tanggal < ${startIso}
          AND d.kodeitem IN (SELECT kodeitem FROM item_page)
        GROUP BY d.kodeitem
      )
      SELECT 
        p.kodeitem,
        p.namaitem,
        p.satuan,
        p.rak,
        p.hargapokok,
        -- Saldo Awal: base_qty + in_pre - out_pre
        (COALESCE(lr.base_qty, 0) + COALESCE(ibs.qty_pre_in, 0) - COALESCE(obs.qty_pre_out, 0))::numeric as saldo_awal,
        COALESCE(mm.qty_masuk, 0)::numeric as qty_masuk,
        COALESCE(mm.val_masuk, 0)::numeric as val_masuk,
        COALESCE(mk.qty_keluar, 0)::numeric as qty_keluar,
        COALESCE(mk.val_keluar, 0)::numeric as val_keluar,
        (COALESCE(mm.tx_masuk, 0) + COALESCE(mk.tx_keluar, 0))::int as total_tx
      FROM item_page p
      LEFT JOIN latest_rekap lr ON p.kodeitem = lr.kodeitem
      LEFT JOIN in_before_start ibs ON p.kodeitem = ibs.kodeitem
      LEFT JOIN out_before_start obs ON p.kodeitem = obs.kodeitem
      LEFT JOIN mut_masuk mm ON p.kodeitem = mm.kodeitem
      LEFT JOIN mut_keluar mk ON p.kodeitem = mk.kodeitem
      ORDER BY p.kodeitem ASC;
    `;

    // 3. Ringkasan Global KPI Periode
    const globalKPIRes = await client`
      WITH in_period AS (
        SELECT 
          COUNT(DISTINCT d.kodeitem) as items_in,
          COALESCE(SUM(d.jumlah), 0) as total_qty_in,
          COALESCE(SUM(d.total), 0) as total_val_in
        FROM tbl_imdt d
        JOIN tbl_imhd h ON d.notransaksi = h.notransaksi
        WHERE h.kodekantor = ${office}
          AND h.tanggal >= ${startIso}
          AND h.tanggal <= ${endIso}
      ),
      out_period AS (
        SELECT 
          COUNT(DISTINCT d.kodeitem) as items_out,
          COALESCE(SUM(d.jumlah), 0) as total_qty_out,
          COALESCE(SUM(d.total), 0) as total_val_out
        FROM tbl_ikdt d
        JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
        WHERE h.kodekantor = ${office}
          AND h.tanggal >= ${startIso}
          AND h.tanggal <= ${endIso}
      )
      SELECT 
        (SELECT total_qty_in FROM in_period) as total_masuk,
        (SELECT total_val_in FROM in_period) as total_nilai_masuk,
        (SELECT total_qty_out FROM out_period) as total_keluar,
        (SELECT total_val_out FROM out_period) as total_nilai_keluar
    `;

    const kpiRow = globalKPIRes[0];
    const totalQtyIn = Number(kpiRow?.total_masuk || 0);
    const totalQtyOut = Number(kpiRow?.total_keluar || 0);

    const items = rows.map((r: any) => {
      const sAwal = Number(r.saldo_awal || 0);
      const qMasuk = Number(r.qty_masuk || 0);
      const qKeluar = Number(r.qty_keluar || 0);
      const sAkhir = sAwal + qMasuk - qKeluar;
      const hp = Number(r.hargapokok || 0);

      return {
        kodeitem: String(r.kodeitem).trim(),
        namaitem: String(r.namaitem || r.kodeitem).trim(),
        satuan: String(r.satuan || "PCS").trim(),
        rak: String(r.rak || "-").trim(),
        hargapokok: hp,
        saldoAwal: sAwal,
        nilaiAwal: sAwal * hp,
        qtyMasuk: qMasuk,
        nilaiMasuk: Number(r.val_masuk || 0) || (qMasuk * hp),
        qtyKeluar: qKeluar,
        nilaiKeluar: Number(r.val_keluar || 0) || (qKeluar * hp),
        saldoAkhir: sAkhir,
        nilaiAkhir: sAkhir * hp,
        txCount: Number(r.total_tx || 0),
      };
    });

    return {
      items,
      pagination: {
        page: isPaginated ? page : 1,
        limit: isPaginated ? limit : totalItems,
        total: totalItems,
        totalPages: isPaginated ? (Math.ceil(totalItems / limit) || 1) : 1,
      },
      summary: {
        period: { startDate, endDate },
        office,
        totalQtyMasuk: totalQtyIn,
        totalQtyKeluar: totalQtyOut,
        netMovementQty: totalQtyIn - totalQtyOut,
        totalNilaiMasuk: Number(kpiRow?.total_nilai_masuk || 0),
        totalNilaiKeluar: Number(kpiRow?.total_nilai_keluar || 0),
      },
    };
  }

  /**
   * 2. KARTU STOK DETAIL KRONOLOGIS (PER ITEM)
   */
  static async getItemStockCard(params: StockCardQuery) {
    const { kodeitem, startDate, endDate, office = "UTM" } = params;

    const startIso = `${startDate} 00:00:00`;
    const endIso = `${endDate} 23:59:59`;

    // 1. Ambil info Master Item
    const itemInfo = await client`
      SELECT 
        i.kodeitem,
        i.namaitem,
        i.satuan,
        COALESCE(i.rak, '-') as rak,
        COALESCE(i.hargapokok, 0)::numeric as hargapokok,
        COALESCE(s.stok, 0)::numeric as stok_saat_ini
      FROM tbl_item i
      LEFT JOIN tbl_itemstok s ON i.kodeitem = s.kodeitem AND s.kantor = ${office}
      WHERE i.kodeitem = ${kodeitem}
      LIMIT 1
    `;

    if (itemInfo.length === 0) {
      throw new Error(`Item '${kodeitem}' tidak ditemukan`);
    }

    const item = itemInfo[0]!;
    const hargapokok = Number(item.hargapokok || 0);

    // 2. Hitung Saldo Awal sebelum startDate
    const startYear = parseInt(startDate.slice(0, 4), 10);
    const startMonth = parseInt(startDate.slice(5, 7), 10);

    const latestRekapRes = await client`
      SELECT 
        r.tahun,
        r.bulan,
        CASE 
          WHEN r.tahun = ${startYear} AND r.bulan = ${startMonth} THEN COALESCE(r.awal, 0)::numeric
          ELSE COALESCE(r.akhir, 0)::numeric
        END as base_qty,
        CASE 
          WHEN r.tahun = ${startYear} AND r.bulan = ${startMonth} 
            THEN (r.tahun || '-' || LPAD(r.bulan::text, 2, '0') || '-01 00:00:00')::timestamp
          WHEN r.bulan = 12
            THEN ((r.tahun + 1) || '-01-01 00:00:00')::timestamp
          ELSE 
            (r.tahun || '-' || LPAD((r.bulan + 1)::text, 2, '0') || '-01 00:00:00')::timestamp
        END as base_date
      FROM tbl_item_rekap r
      WHERE r.kodeitem = ${kodeitem}
        AND r.kodekantor = ${office}
        AND (r.tahun < ${startYear} OR (r.tahun = ${startYear} AND r.bulan <= ${startMonth}))
      ORDER BY r.tahun DESC, r.bulan DESC
      LIMIT 1
    `;

    const baseQty = Number(latestRekapRes[0]?.base_qty || 0);
    const baseDate = latestRekapRes[0]?.base_date ? String(latestRekapRes[0].base_date) : null;

    const baseDateCondition = baseDate 
      ? client`AND h.tanggal >= ${baseDate}` 
      : client``;

    // Ambil mutasi antara baseDate s/d startDate
    const preInRes = await client`
      SELECT COALESCE(SUM(d.jumlah), 0)::numeric as qty_pre_in
      FROM tbl_imdt d
      JOIN tbl_imhd h ON d.notransaksi = h.notransaksi
      WHERE d.kodeitem = ${kodeitem}
        AND h.kodekantor = ${office}
        ${baseDateCondition}
        AND h.tanggal < ${startIso}
    `;
    const preOutRes = await client`
      SELECT COALESCE(SUM(d.jumlah), 0)::numeric as qty_pre_out
      FROM tbl_ikdt d
      JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
      WHERE d.kodeitem = ${kodeitem}
        AND h.kodekantor = ${office}
        ${baseDateCondition}
        AND h.tanggal < ${startIso}
    `;

    const saldoAwal = baseQty + Number(preInRes[0]?.qty_pre_in || 0) - Number(preOutRes[0]?.qty_pre_out || 0);

    // 3. Ambil seluruh transaksi MASUK dalam periode
    const inTxs = await client`
      SELECT 
        h.notransaksi,
        h.tanggal::text as tanggal,
        h.tipe,
        COALESCE(s.nama, h.kodesupel, '-') as pihak,
        COALESCE(h.keterangan, '-') as keterangan,
        d.jumlah::numeric as masuk,
        0::numeric as keluar,
        d.harga::numeric as harga,
        d.total::numeric as total
      FROM tbl_imdt d
      JOIN tbl_imhd h ON d.notransaksi = h.notransaksi
      LEFT JOIN tbl_supel s ON h.kodesupel = s.kode
      WHERE d.kodeitem = ${kodeitem}
        AND h.kodekantor = ${office}
        AND h.tanggal >= ${startIso}
        AND h.tanggal <= ${endIso}
    `;

    // 4. Ambil seluruh transaksi KELUAR dalam periode
    const outTxs = await client`
      SELECT 
        h.notransaksi,
        h.tanggal::text as tanggal,
        h.tipe,
        COALESCE(s.nama, h.kodesupel, '-') as pihak,
        COALESCE(h.keterangan, '-') as keterangan,
        0::numeric as masuk,
        d.jumlah::numeric as keluar,
        d.harga::numeric as harga,
        d.total::numeric as total
      FROM tbl_ikdt d
      JOIN tbl_ikhd h ON d.notransaksi = h.notransaksi
      LEFT JOIN tbl_supel s ON h.kodesupel = s.kode
      WHERE d.kodeitem = ${kodeitem}
        AND h.kodekantor = ${office}
        AND h.tanggal >= ${startIso}
        AND h.tanggal <= ${endIso}
    `;

    // 5. Gabungkan dan urutkan kronologis
    const combined = [...inTxs, ...outTxs].sort((a, b) => {
      const timeDiff = new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.notransaksi.localeCompare(b.notransaksi);
    });

    // 6. Hitung Running Balance line-by-line
    let runningBalance = saldoAwal;
    let totalMasuk = 0;
    let totalKeluar = 0;

    const transactions = combined.map((tx: any) => {
      const m = Number(tx.masuk || 0);
      const k = Number(tx.keluar || 0);
      totalMasuk += m;
      totalKeluar += k;
      runningBalance = runningBalance + m - k;

      const arah = m > 0 ? "IN" : "OUT";
      let tipeLabel = tx.tipe;
      if (tx.tipe === "BL") tipeLabel = "Pembelian (BL)";
      else if (tx.tipe === "JL") tipeLabel = "Penjualan (JL)";
      else if (tx.tipe === "RJ") tipeLabel = "Retur Jual (RJ)";
      else if (tx.tipe === "RB") tipeLabel = "Retur Beli (RB)";
      else if (tx.tipe === "SA") tipeLabel = "Saldo Awal (SA)";
      else if (tx.tipe === "OP") tipeLabel = "Stok Opname (OP)";
      else if (tx.tipe === "TM") tipeLabel = "Transfer Masuk (TM)";
      else if (tx.tipe === "TK") tipeLabel = "Transfer Keluar (TK)";

      return {
        notransaksi: String(tx.notransaksi).trim(),
        tanggal: String(tx.tanggal).slice(0, 19),
        tipe: String(tx.tipe).trim(),
        tipeLabel,
        arah,
        pihak: String(tx.pihak).trim(),
        keterangan: String(tx.keterangan || "-").trim(),
        masuk: m,
        keluar: k,
        saldo: runningBalance,
        harga: Number(tx.harga || 0),
        totalNilai: Number(tx.total || 0),
        nilaiSaldo: runningBalance * hargapokok,
      };
    });

    const saldoAkhir = runningBalance;

    return {
      item: {
        kodeitem: String(item.kodeitem).trim(),
        namaitem: String(item.namaitem || item.kodeitem).trim(),
        satuan: String(item.satuan || "PCS").trim(),
        rak: String(item.rak || "-").trim(),
        hargapokok,
        stokSaatIni: Number(item.stok_saat_ini || 0),
      },
      period: { startDate, endDate, office },
      saldoAwal,
      nilaiAwal: saldoAwal * hargapokok,
      totalMasuk,
      totalKeluar,
      saldoAkhir,
      nilaiAkhir: saldoAkhir * hargapokok,
      transactions,
    };
  }
}
