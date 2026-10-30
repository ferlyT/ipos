"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  disabled = false,
  className = "",
}: PaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const safeTotalPages = Math.max(1, totalPages || Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (safeTotalPages <= maxVisiblePages + 2) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let start = Math.max(2, safeCurrentPage - 1);
      let end = Math.min(safeTotalPages - 1, safeCurrentPage + 1);

      if (safeCurrentPage <= 3) {
        start = 2;
        end = 4;
      } else if (safeCurrentPage >= safeTotalPages - 2) {
        start = safeTotalPages - 3;
        end = safeTotalPages - 1;
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < safeTotalPages - 1) {
        pages.push("...");
      }

      pages.push(safeTotalPages);
    }

    return pages;
  };

  const handlePageClick = (page: number) => {
    if (disabled || page === safeCurrentPage || page < 1 || page > safeTotalPages) {
      return;
    }
    onPageChange(page);
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-muted/30 border border-border rounded-xl text-sm ${className}`}
    >
      {/* Keterangan Rentang & Total Data */}
      <div className="flex items-center gap-3 text-muted-foreground text-xs sm:text-sm">
        <span>
          Menampilkan{" "}
          <strong className="text-foreground font-semibold">
            {startItem.toLocaleString("id-ID")}
          </strong>{" "}
          -{" "}
          <strong className="text-foreground font-semibold">
            {endItem.toLocaleString("id-ID")}
          </strong>{" "}
          dari{" "}
          <strong className="text-foreground font-semibold">
            {totalItems.toLocaleString("id-ID")}
          </strong>{" "}
          data
        </span>

        {/* Pilihan Rows Per Page */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-border pl-3">
            <span className="hidden md:inline text-xs">Baris per hal:</span>
            <select
              aria-label="Baris per halaman"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
              }}
              disabled={disabled}
              className="px-2 py-1 bg-background border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigasi Halaman */}
      <div className="flex items-center space-x-1">
        {/* Tombol Halaman Pertama */}
        <button
          type="button"
          onClick={() => handlePageClick(1)}
          disabled={disabled || safeCurrentPage <= 1}
          title="Halaman Pertama"
          className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Tombol Halaman Sebelumnya */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage - 1)}
          disabled={disabled || safeCurrentPage <= 1}
          title="Halaman Sebelumnya"
          className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Tombol Angka Halaman */}
        <div className="flex items-center space-x-1 px-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-xs text-muted-foreground select-none"
                >
                  ...
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === safeCurrentPage;

            return (
              <button
                key={`page-${pageNum}`}
                type="button"
                onClick={() => handlePageClick(pageNum)}
                disabled={disabled}
                className={`min-w-8 h-8 px-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                    : "border border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
                } disabled:opacity-50`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Tombol Halaman Selanjutnya */}
        <button
          type="button"
          onClick={() => handlePageClick(safeCurrentPage + 1)}
          disabled={disabled || safeCurrentPage >= safeTotalPages}
          title="Halaman Selanjutnya"
          className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Tombol Halaman Terakhir */}
        <button
          type="button"
          onClick={() => handlePageClick(safeTotalPages)}
          disabled={disabled || safeCurrentPage >= safeTotalPages}
          title="Halaman Terakhir"
          className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
