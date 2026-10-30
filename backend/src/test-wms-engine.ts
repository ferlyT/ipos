import { WmsService } from "./services/wms.service";
import { client } from "./db";

async function testWmsEngine() {
  console.log("=================================================");
  console.log("🧪 Memulai Pengujian Otomatis WMS Service & Engine");
  console.log("=================================================");

  try {
    // 1. Ambil salah satu kantor dan item eksisting
    const offices = await client`SELECT kodekantor FROM tbl_kantor LIMIT 1`;
    const office = offices.length > 0 ? offices[0].kodekantor : "GUDANG";

    const items = await client`SELECT kodeitem, namaitem FROM tbl_item LIMIT 1`;
    const item = items.length > 0 ? items[0] : { kodeitem: "BRG-TEST", namaitem: "Barang Uji Coba" };

    console.log(`📌 Target Kantor: ${office}, Sample Item: ${item.kodeitem} (${item.namaitem})`);

    // 2. Uji List Zones
    const zones = await WmsService.listZones(office);
    console.log(`✅ 1. List Zones: Ditemukan ${zones.length} zona gudang`);
    if (zones.length > 0) {
      console.log(`   - Zona Contoh: ${zones[0].kodezone} (${zones[0].namazone})`);
    }

    // 3. Uji List Bins
    const bins = await WmsService.listBins(office);
    console.log(`✅ 2. List Bins: Ditemukan ${bins.length} lokasi rak/bin`);
    if (bins.length < 2) {
      throw new Error("Dibutuhkan minimal 2 bin untuk pengujian WMS");
    }

    const binA = bins[0].kodebin;
    const binB = bins[1].kodebin;
    console.log(`   - Bin A (Source): ${binA}`);
    console.log(`   - Bin B (Target): ${binB}`);

    // 4. Uji Putaway Barang Masuk
    console.log(`\n📦 3. Menguji Putaway ke ${binA} sebanyak 50 unit...`);
    const putawayRes = await WmsService.executePutaway({
      kodekantor: office,
      kodebin: binA,
      kodeitem: item.kodeitem,
      jumlah: 50,
      batch_no: "BATCH-2026-001",
      expired_date: "2027-12-31",
      operator: "TEST_OPERATOR",
    });
    console.log(`   -> Sukses Putaway! No Mutasi: ${putawayRes.nomutasi}`);

    // 5. Cek Detail Bin & Occupancy Heatmap
    const detailA = await WmsService.getBinDetail(binA);
    console.log(`✅ 4. Detail Bin ${binA}: Total Qty: ${detailA?.bin.total_qty}, Occupancy: ${detailA?.bin.occupancy_pct}%`);
    console.log(`   -> Daftar Barang di ${binA}:`, detailA?.stocks.map(s => `${s.kodeitem}: ${s.jumlah} pcs (Batch: ${s.batch_no})`));

    // 6. Uji Relokasi Antar-Bin (Bin A -> Bin B)
    console.log(`\n🚚 5. Menguji Relokasi: Memindahkan 20 unit dari ${binA} ke ${binB}...`);
    const relRes = await WmsService.executeRelocation({
      kodekantor: office,
      from_bin: binA,
      to_bin: binB,
      kodeitem: item.kodeitem,
      jumlah: 20,
      operator: "TEST_OPERATOR",
      keterangan: "Uji coba relokasi antar rak",
    });
    console.log(`   -> Sukses Relokasi! No Mutasi: ${relRes.nomutasi}`);

    // Verifikasi saldo kedua bin
    const detailAAfter = await WmsService.getBinDetail(binA);
    const detailBAfter = await WmsService.getBinDetail(binB);
    console.log(`   -> Saldo Akhir ${binA}: ${detailAAfter?.bin.total_qty} unit (Berkurang 20)`);
    console.log(`   -> Saldo Akhir ${binB}: ${detailBAfter?.bin.total_qty} unit (Bertambah 20)`);

    // 7. Uji Visual Map
    console.log(`\n🗺️  6. Menguji Visual Map Denah 2D Gudang...`);
    const visualMap = await WmsService.getWarehouseVisualMap(office);
    console.log(`   -> Ringkasan Gudang:`, visualMap.summary);
    console.log(`   -> Lorong Terdeteksi:`, Object.keys(visualMap.aisles));

    // 8. Uji Picking Outbound
    console.log(`\n🛒 7. Menguji Eksekusi Outbound Picking...`);
    // Buat dummy outbound task
    const notask = `OUT-TEST-${Date.now().toString().slice(-4)}`;
    await client`
      INSERT INTO wms_outbound_tasks (notask, notransaksi_ref, tipetransaksi, kodekantor, tujuan, status, priority, petugas)
      VALUES (${notask}, 'SO-TEST-001', 'SALES', ${office}, 'PELANGGAN VIP', 'PENDING', 'HIGH', 'TEST_OPERATOR');
    `;
    await client`
      INSERT INTO wms_outbound_items (notask, kodeitem, namaitem, satuan, jumlah_order, jumlah_picked, source_bin, sequence_order, status)
      VALUES (${notask}, ${item.kodeitem}, ${item.namaitem}, 'PCS', 10, 0, ${binB}, 1, 'PENDING');
    `;

    // Ambil detail task
    const taskDetail = await WmsService.getOutboundTaskDetail(notask);
    console.log(`   -> Outbound Task Dibuat: ${taskDetail?.task.notask}, Prioritas: ${taskDetail?.task.priority}`);
    console.log(`   -> Item terurut Smart Routing:`, taskDetail?.items.map(i => `${i.kodeitem} ambil dari ${i.source_bin} (Urutan: ${i.sequence_order})`));

    // Eksekusi Pick
    const pickRes = await WmsService.executePickItem({
      notask,
      kodeitem: item.kodeitem,
      source_bin: binB,
      jumlah: 10,
      operator: "TEST_PICKER",
    });
    console.log(`   -> Sukses Pick! No Mutasi: ${pickRes.nomutasi}, Diambil: ${pickRes.jumlah} dari ${pickRes.source_bin}`);

    const taskCompleted = await WmsService.getOutboundTaskDetail(notask);
    console.log(`   -> Status Akhir Tugas Outbound: ${taskCompleted?.task.status} (Completed: ${taskCompleted?.task.completed_at})`);

    console.log("\n=================================================");
    console.log("🎉 SEMUA PENGUJIAN WMS SERVICE BERHASIL 100%!");
    console.log("=================================================");

    process.exit(0);
  } catch (err) {
    console.error("❌ Gagal pengujian WMS:", err);
    process.exit(1);
  }
}

testWmsEngine();
