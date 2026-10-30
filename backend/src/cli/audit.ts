import { AnomalyScanner } from "../diagnostics/scanner";
import { AuditReporter } from "../diagnostics/reporter";
import { HtmlAuditReporter } from "../diagnostics/html-reporter";
import { client } from "../db";
import { join } from "path";
import { copyFileSync, existsSync } from "fs";

async function main() {
  try {
    console.log("🚀 Memulai proses audit diagnostik database...");
    const startTime = Date.now();

    const summary = await AnomalyScanner.runFullAudit();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    AuditReporter.printConsole(summary);

    const reportsDir = join(import.meta.dir, "../../reports");
    const dateStr = summary.timestamp.split("T")[0];

    // 1. Generate Markdown Report
    const reportMdPath = AuditReporter.generateMarkdownReport(summary, reportsDir);

    // 2. Generate HTML Report (Generative UI Dashboard)
    const reportHtmlPath = join(reportsDir, `audit_report_${dateStr}.html`);
    HtmlAuditReporter.generateHtmlReport(summary, reportHtmlPath);

    // 3. Salin juga ke direktori Artefak Antigravity jika ada
    const artifactDir = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\ea0b5eb9-05e6-4081-be44-51ed78d6b3b4";
    if (existsSync(artifactDir)) {
      const artifactHtmlPath = join(artifactDir, "audit_report.html");
      copyFileSync(reportHtmlPath, artifactHtmlPath);
      console.log(`🌐 Laporan HTML (Generative UI) : ${artifactHtmlPath}`);
    }

    console.log(`⏱️  Waktu Eksekusi Scan : ${duration} detik.`);
    console.log(`📄 Laporan Markdown     : ${reportMdPath}`);
    console.log(`🌐 Laporan HTML Lokal   : ${reportHtmlPath}`);
    console.log("================================================================================\n");
  } catch (error) {
    console.error("❌ Terjadi kesalahan saat menjalankan audit:", error);
  } finally {
    await client.end();
  }
}

main();
