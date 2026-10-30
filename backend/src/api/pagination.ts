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

export interface ParsedPagination {
  page: number;
  limit: number;
  offset: number;
  isPaginated: boolean;
}

export function parsePagination(
  query: Record<string, string>,
  defaultLimit: number = 25,
  maxLimit: number = 100
): ParsedPagination {
  const isPaginated = query.page !== undefined || query.p !== undefined;
  const pageRaw = parseInt(query.page || query.p || "1", 10);
  const page = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  let limitRaw = parseInt(query.limit || `${defaultLimit}`, 10);
  if (isNaN(limitRaw) || limitRaw <= 0) limitRaw = defaultLimit;
  if (limitRaw > maxLimit) limitRaw = maxLimit;

  const offset = (page - 1) * limitRaw;

  return {
    page,
    limit: limitRaw,
    offset,
    isPaginated,
  };
}

export function formatPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  forcePaginated: boolean = false
): T[] | PaginatedResult<T> {
  if (!forcePaginated) {
    return items;
  }
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
