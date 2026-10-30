const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function normalizePaginated<T>(
  res: any,
  defaultPage: number = 1,
  defaultLimit: number = 25
): PaginatedResult<T> {
  if (res && Array.isArray(res.items) && res.pagination) {
    return res as PaginatedResult<T>;
  }
  if (Array.isArray(res)) {
    return {
      items: res,
      pagination: {
        page: defaultPage,
        limit: defaultLimit,
        total: res.length,
        totalPages: Math.max(1, Math.ceil(res.length / defaultLimit)),
      },
    };
  }
  return {
    items: [],
    pagination: {
      page: 1,
      limit: defaultLimit,
      total: 0,
      totalPages: 1,
    },
  };
}

export const TOKEN_STORAGE_KEY = "ipos4_auth_token";

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const json: ApiResponse<T> = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}: Failed to fetch from ${endpoint}`);
    }
    return json.data;
  } catch (err: any) {
    if (endpoint !== "/api/auth/login") {
      console.error(`[API Client Error] ${endpoint}:`, err);
    }
    throw err;
  }
}

export const api = {
  auth: {
    login: async (userid: string, password: string) => {
      const data = await request<{
        token: string;
        user: { userid: string; nama: string; role: string; kantor: string; loginshift: boolean };
        permissions: Record<string, any>;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ userid, password }),
      });
      if (data?.token) {
        setAuthToken(data.token);
      }
      return data;
    },
    me: () => request<{ user: any; permissions: any }>("/api/auth/me"),
    changePassword: (oldPassword: string, newPassword: string) =>
      request<any>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
      }),
    logout: () => {
      clearAuthToken();
    },
  },
  system: {
    getHealth: () => request<any>("/api/system/health"),
    getConfig: () => request<any>("/api/system/config"),
    getUsers: (search: string = "", limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        ...(search ? { search } : {}),
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/system/users?${q.toString()}`);
    },
    getAuditTrail: (params?: { module?: string; search?: string; limit?: number; page?: number }) => {
      const q = new URLSearchParams({
        ...(params?.module ? { module: params.module } : {}),
        ...(params?.search ? { search: params.search } : {}),
        limit: (params?.limit || 100).toString(),
        ...(params?.page !== undefined ? { page: params.page.toString() } : {}),
      });
      return request<any>(`/api/system/audit-trail?${q.toString()}`);
    },
    getDatabaseStats: () => request<any>("/api/system/database/stats"),
    vacuumDatabase: (table?: string) =>
      request<any>("/api/system/database/vacuum", {
        method: "POST",
        body: JSON.stringify({ table }),
      }),
    getBackups: () => request<any[]>("/api/system/database/backups"),
    createBackup: () =>
      request<any>("/api/system/database/backup", {
        method: "POST",
      }),
    getSettings: () => request<any>("/api/system/settings"),
    updateSettings: (payload: any) =>
      request<any>("/api/system/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    getRoles: () => request<any[]>("/api/system/roles"),
    getPermissions: (role: string = "ADMINISTRATOR") =>
      request<any[]>(`/api/system/roles/permissions?role=${encodeURIComponent(role)}`),
    updatePermission: (payload: { role: string; modulid: string; field: string; value: boolean }) =>
      request<any>("/api/system/roles/permissions", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  },
  analytics: {
    getDashboard: (year: number = 2026) =>
      request<any>(`/api/analytics/dashboard?year=${year}`),
    getItemProfitability: (year: number = 2026, limit: number = 20) =>
      request<any[]>(`/api/analytics/profitability/items?year=${year}&limit=${limit}`),
    getCategoryProfitability: (year: number = 2026) =>
      request<any[]>(`/api/analytics/profitability/categories?year=${year}`),
    getABC: (year: number = 2026) =>
      request<any>(`/api/analytics/inventory/abc?year=${year}`),
    getCustomerRetention: (churnDays: number = 90) =>
      request<any>(`/api/analytics/customers/retention?churnDays=${churnDays}`),
  },
  master: {
    getItems: (search: string = "", limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        search,
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/master/items?${q.toString()}`);
    },
    getBarcodeCatalog: (search: string = "", limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        search,
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/master/barcode-catalog?${q.toString()}`);
    },
    createItem: (payload: {
      kodeitem: string;
      namaitem: string;
      jenis?: string;
      merek?: string;
      satuan?: string;
      hargapokok?: number;
      hargajual?: number;
      rak?: string;
      tipe?: string;
    }) =>
      request<any>("/api/master/items", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getItemByBarcode: (barcode: string) =>
      request<any>(`/api/master/barcode?barcode=${encodeURIComponent(barcode)}`),
    getItemUnits: (itemCode: string) =>
      request<any[]>(`/api/master/units?itemCode=${encodeURIComponent(itemCode)}`),
    resolvePrice: (params: { itemCode: string; unit: string; qty: number; customerCode?: string }) => {
      const q = new URLSearchParams({
        itemCode: params.itemCode,
        unit: params.unit,
        qty: params.qty.toString(),
        ...(params.customerCode ? { customerCode: params.customerCode } : {}),
      });
      return request<any>(`/api/master/resolve-price?${q.toString()}`);
    },
    getCustomerGroups: () => request<any[]>("/api/master/customer-groups"),
    getBOM: (itemCode: string) => request<any>(`/api/master/bom?itemCode=${encodeURIComponent(itemCode)}`),
    getBOMRecipes: () => request<any[]>("/api/master/bom-recipes"),
    saveBOM: (payload: { parentItemCode: string; components: Array<{ kodeitemrakitan: string; jumlah: number; satuan: string; harga?: number }> }) =>
      request<any>("/api/master/bom", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    simulateAssembly: (parentItemCode: string, qtyToBuild: number = 1, officeCode: string = "UTM") =>
      request<any>("/api/master/bom/simulate", {
        method: "POST",
        body: JSON.stringify({ parentItemCode, qtyToBuild, officeCode }),
      }),
    assemble: (parentItemCode: string, qtyToBuild: number, officeCode: string = "UTM", user: string = "ADMIN") =>
      request<any>("/api/master/bom/assemble", {
        method: "POST",
        body: JSON.stringify({ parentItemCode, qtyToBuild, officeCode, user }),
      }),
    getContacts: (type?: "PL" | "SU", search: string = "", limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        ...(type ? { type } : {}),
        ...(search ? { search } : {}),
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/master/contacts?${q.toString()}`);
    },
    createContact: (payload: {
      kode: string;
      tipe: "PL" | "SU";
      nama: string;
      alamat?: string;
      kota?: string;
      telepon?: string;
      kontak?: string;
      email?: string;
      limitpiutang?: number;
      termin?: number;
      grup?: string;
    }) =>
      request<any>("/api/master/contacts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  inventory: {
    getWarehouses: () => request<any[]>("/api/inventory/warehouses"),
    getTransfers: (search: string = "", limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        search,
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/inventory/transfers?${q.toString()}`);
    },
    getTransferDetail: (notransaksi: string) =>
      request<{ header: any; items: any[] }>(`/api/inventory/transfers/detail?notransaksi=${encodeURIComponent(notransaksi)}`),
    getStock: (office: string = "UTM", search: string = "", limit: number = 50, page?: number, negativeOnly?: boolean) => {
      const q = new URLSearchParams({
        office,
        ...(search ? { search } : {}),
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
        ...(negativeOnly ? { negativeOnly: "true" } : {}),
      });
      return request<any>(`/api/inventory/stock?${q.toString()}`);
    },
    getCard: (itemCode: string, office: string = "UTM") =>
      request<any[]>(`/api/inventory/card?itemCode=${encodeURIComponent(itemCode)}&office=${office}`),
    transferStock: (payload: {
      kantordari: string;
      kantortujuan: string;
      tanggal?: string;
      keterangan?: string;
      user: string;
      items: Array<{
        kodeitem: string;
        jumlah: number;
        satuan?: string;
        keterangan?: string;
      }>;
    }) =>
      request<any>("/api/inventory/transfer", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    executeOpname: (payload: {
      kodekantor: string;
      tanggal?: string;
      user: string;
      items: Array<{
        kodeitem: string;
        jmlfisik: number;
        satuan?: string;
        kodeacc?: string;
      }>;
    }) =>
      request<any>("/api/inventory/opname", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  cashBank: {
    getAccounts: () => request<any[]>("/api/cash-bank/accounts"),
    getDrawers: (limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/cash-bank/drawers?${q.toString()}`);
    },
    openDrawer: (input: { user: string; modalAwal: number; shift?: number; kodekantor?: string }) =>
      request<any>("/api/cash-bank/drawer/open", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    closeDrawer: (input: { idkasir: number; user: string; uangFisik: number; keterangan?: string }) =>
      request<any>("/api/cash-bank/drawer/close", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    recordCashIn: (payload: {
      kodekantor: string;
      kodeaccKasBank: string;
      kodeaccLawan: string;
      jumlah: number;
      keterangan: string;
      user: string;
      tanggal?: string;
      notransaksi?: string;
    }) =>
      request<any>("/api/cash-bank/in", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    recordCashOut: (payload: {
      kodekantor: string;
      kodeaccKasBank: string;
      kodeaccBiaya: string;
      jumlah: number;
      keterangan: string;
      user: string;
      tanggal?: string;
      notransaksi?: string;
    }) =>
      request<any>("/api/cash-bank/out", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    transfer: (payload: {
      kodekantor: string;
      kodeaccAsal: string;
      kodeaccTujuan: string;
      jumlah: number;
      keterangan?: string;
      user: string;
      tanggal?: string;
      notransaksi?: string;
    }) =>
      request<any>("/api/cash-bank/transfer", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  sales: {
    getInvoices: (search: string = "", limit: number = 50, type?: string, page?: number) => {
      const q = new URLSearchParams({
        search,
        limit: limit.toString(),
        ...(type ? { type } : {}),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/sales/invoices?${q.toString()}`);
    },
    getInvoiceDetail: (notransaksi: string) =>
      request<{ header: any; items: any[] }>(`/api/sales/invoices/detail?notransaksi=${encodeURIComponent(notransaksi)}`),
    createReturn: (payload: {
      refInvoice: string;
      kodesupel?: string;
      kodekantor?: string;
      user?: string;
      items: Array<{
        kodeitem: string;
        jumlah: number;
        satuan?: string;
        harga: number;
      }>;
    }) =>
      request<any>("/api/sales/returns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    createInvoice: (payload: {
      notransaksi?: string;
      kodekantor?: string;
      tanggal?: string;
      kodesupel?: string;
      carabayar?: string;
      subtotal: number;
      potonganNota?: number;
      pajak?: number;
      biayalain?: number;
      totalakhir: number;
      user?: string;
      items: Array<{
        kodeitem: string;
        jumlah: number;
        satuan: string;
        harga: number;
        potongan?: number;
      }>;
    }) =>
      request<any>("/api/sales/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getAging: (customerCode?: string, office: string = "UTM") =>
      request<any[]>(
        `/api/sales/receivables/aging?office=${office}${customerCode ? `&customerCode=${customerCode}` : ""}`
      ),
    getOutstanding: (customerCode?: string, office: string = "UTM") =>
      request<any[]>(
        `/api/sales/receivables/outstanding?office=${office}${customerCode ? `&customerCode=${customerCode}` : ""}`
      ),
    payCustomerReceivable: (payload: {
      notransaksi: string;
      kodekantor: string;
      tanggal?: string;
      kodesupel: string;
      carabayar: string;
      accBayar: string;
      user: string;
      alokasi: Array<{
        notrsmasuk: string;
        bayarNominal: number;
        potonganNominal: number;
      }>;
    }) =>
      request<any>("/api/sales/receivables/pay", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getLoyalty: (customerCode: string) =>
      request<any>(`/api/sales/loyalty?customerCode=${encodeURIComponent(customerCode)}`),
    getLoyaltyMembers: (search: string = "", limit: number = 50) =>
      request<any[]>(`/api/sales/loyalty/members?search=${encodeURIComponent(search)}&limit=${limit}`),
    redeemLoyaltyPoints: (payload: {
      notransaksi?: string;
      kodekantor?: string;
      tanggal?: string;
      kodesupel: string;
      jmlambil: number;
      keterangan?: string;
      user?: string;
    }) =>
      request<any>("/api/sales/loyalty/redeem", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  purchasing: {
    getInvoices: (search: string = "", limit: number = 50, type?: string, page?: number) => {
      const q = new URLSearchParams({
        search,
        limit: limit.toString(),
        ...(type ? { type } : {}),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/purchasing/invoices?${q.toString()}`);
    },
    getInvoiceDetail: (notransaksi: string) =>
      request<{ header: any; items: any[] }>(`/api/purchasing/invoices/detail?notransaksi=${encodeURIComponent(notransaksi)}`),
    createReturn: (payload: {
      refInvoice: string;
      kodesupel?: string;
      kodekantor?: string;
      user?: string;
      items: Array<{
        kodeitem: string;
        jumlah: number;
        satuan?: string;
        harga: number;
      }>;
    }) =>
      request<any>("/api/purchasing/returns", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getAging: (supplierCode?: string, office: string = "UTM") =>
      request<any[]>(
        `/api/purchasing/payables/aging?office=${office}${supplierCode ? `&supplierCode=${supplierCode}` : ""}`
      ),
    getOutstanding: (supplierCode?: string, office: string = "UTM") =>
      request<any[]>(
        `/api/purchasing/payables/outstanding?office=${office}${supplierCode ? `&supplierCode=${supplierCode}` : ""}`
      ),
    paySupplierDebt: (payload: {
      notransaksi: string;
      kodekantor: string;
      tanggal?: string;
      kodesupel: string;
      carabayar: string;
      accBayar: string;
      user: string;
      alokasi: Array<{
        notrsmasuk: string;
        bayarNominal: number;
        potonganNominal: number;
      }>;
    }) =>
      request<any>("/api/purchasing/payables/pay", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  orders: {
    getOutstanding: (type?: "PO" | "SO", limit: number = 50, page?: number) => {
      const q = new URLSearchParams({
        ...(type ? { type } : {}),
        limit: limit.toString(),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/orders/outstanding?${q.toString()}`);
    },
    createOrder: (payload: any) =>
      request<any>("/api/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    fulfillOrder: (notransaksi: string, items: Array<{ nobaris: number; kodeitem: string; qtyReceived: number }>) =>
      request<any>("/api/orders/fulfill", {
        method: "POST",
        body: JSON.stringify({ notransaksi, items }),
      }),
    resolvePromotionPrice: (itemCode: string, qty: number, group?: string) => {
      const q = new URLSearchParams({
        itemCode,
        qty: qty.toString(),
        ...(group ? { group } : {}),
      });
      return request<any>(`/api/orders/promotions/resolve?${q.toString()}`);
    },
  },
  accounting: {
    getProfitLoss: (startDate?: string, endDate?: string) => {
      const q = new URLSearchParams({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });
      return request<any[]>(`/api/accounting/profit-loss?${q.toString()}`);
    },
    getBalanceSheet: (startDate?: string, endDate?: string) => {
      const q = new URLSearchParams({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });
      return request<any[]>(`/api/accounting/balance-sheet?${q.toString()}`);
    },
    getLedger: (accountCode: string, startDate?: string, endDate?: string, limit?: number, page?: number) => {
      const q = new URLSearchParams({
        accountCode,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(limit ? { limit: limit.toString() } : {}),
        ...(page !== undefined ? { page: page.toString() } : {}),
      });
      return request<any>(`/api/accounting/ledger?${q.toString()}`);
    },
  },
  wms: {
    getZones: (office?: string) =>
      request<any[]>(`/api/wms/zones${office ? `?office=${office}` : ""}`),
    createZone: (payload: { kodezone: string; kodekantor: string; namazone: string; deskripsi?: string }) =>
      request<any>("/api/wms/zones", { method: "POST", body: JSON.stringify(payload) }),
    getBins: (office?: string, aisle?: string) => {
      const q = new URLSearchParams({
        ...(office ? { office } : {}),
        ...(aisle ? { aisle } : {}),
      });
      return request<any[]>(`/api/wms/bins?${q.toString()}`);
    },
    getBinDetail: (kodebin: string) =>
      request<any>(`/api/wms/bins/detail?kodebin=${encodeURIComponent(kodebin)}`),
    generateBins: (payload: any) =>
      request<any>("/api/wms/bins/generate", { method: "POST", body: JSON.stringify(payload) }),
    getVisualMap: (office?: string) =>
      request<any>(`/api/wms/visual-map${office ? `?office=${office}` : ""}`),
    getInboundTasks: (office?: string, status?: string) => {
      const q = new URLSearchParams({
        ...(office ? { office } : {}),
        ...(status ? { status } : {}),
      });
      return request<any[]>(`/api/wms/inbound/tasks?${q.toString()}`);
    },
    getInboundTaskDetail: (notask: string) =>
      request<any>(`/api/wms/inbound/tasks/detail?notask=${encodeURIComponent(notask)}`),
    createInboundFromPurchase: (notransaksi: string, operator?: string) =>
      request<any>("/api/wms/inbound/create-from-purchase", {
        method: "POST",
        body: JSON.stringify({ notransaksi, operator }),
      }),
    putaway: (payload: {
      notask?: string;
      kodekantor: string;
      kodebin: string;
      kodeitem: string;
      jumlah: number;
      batch_no?: string;
      expired_date?: string;
      operator?: string;
    }) =>
      request<any>("/api/wms/inbound/putaway", { method: "POST", body: JSON.stringify(payload) }),
    getOutboundTasks: (office?: string, status?: string) => {
      const q = new URLSearchParams({
        ...(office ? { office } : {}),
        ...(status ? { status } : {}),
      });
      return request<any[]>(`/api/wms/outbound/tasks?${q.toString()}`);
    },
    getOutboundTaskDetail: (notask: string) =>
      request<any>(`/api/wms/outbound/tasks/detail?notask=${encodeURIComponent(notask)}`),
    createOutboundFromSales: (notransaksi: string, operator?: string) =>
      request<any>("/api/wms/outbound/create-from-sales", {
        method: "POST",
        body: JSON.stringify({ notransaksi, operator }),
      }),
    pick: (payload: {
      notask: string;
      kodeitem: string;
      source_bin: string;
      jumlah: number;
      operator?: string;
    }) =>
      request<any>("/api/wms/outbound/pick", { method: "POST", body: JSON.stringify(payload) }),
    relocate: (payload: {
      kodekantor: string;
      from_bin: string;
      to_bin: string;
      kodeitem: string;
      jumlah: number;
      operator?: string;
      keterangan?: string;
    }) =>
      request<any>("/api/wms/relocate", { method: "POST", body: JSON.stringify(payload) }),
  },
  period: {
    getStatus: () =>
      request<{
        currentMonth: number;
        currentYear: number;
        startMonth: number;
        startYear: number;
        monthName: string;
        isYearEnd: boolean;
        totalRekapRows: number;
      }>("/api/system/period/status"),
    getSummary: (month: number, year: number) =>
      request<{
        month: number;
        year: number;
        salesCount: number;
        salesTotal: number;
        purchaseCount: number;
        purchaseTotal: number;
        transferCount: number;
        cashTransactionsCount: number;
        netProfitEstimate: number;
      }>(`/api/system/period/summary?month=${month}&year=${year}`),
    closeMonth: (payload: { month: number; year: number; desdigit?: number; user?: string }) =>
      request<{
        success: boolean;
        message: string;
        details: {
          closedMonth: number;
          closedYear: number;
          newCurrentMonth: number;
          newCurrentYear: number;
          rekapRows: number;
          fifoOpeningBatches: number;
        };
      }>("/api/system/period/close-month", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    closeYear: (payload: { year: number; backupBeforeClosing?: boolean; user?: string }) =>
      request<{
        success: boolean;
        message: string;
        details: {
          closedYear: number;
          newCurrentYear: number;
          backupPath?: string;
          netProfit: number;
          closingJournalTrs?: string;
          rolledOverAccounts: number;
        };
      }>("/api/system/period/close-year", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getHistory: () =>
      request<
        Array<{
          tahun: number;
          bulan: number;
          bulanNama: string;
          totalSku: number;
          totalNilaiAwal: number;
          totalNilaiMasuk: number;
          totalNilaiKeluar: number;
          totalNilaiAkhir: number;
        }>
      >("/api/system/period/history"),
  },
};
