'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, total, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (total <= pageSize) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-sm text-gray-500">
        Page <span className="font-medium">{page}</span> sur <span className="font-medium">{totalPages}</span>
        <span className="ml-2 text-gray-400">· {total} résultat{total > 1 ? 's' : ''}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 disabled:cursor-not-allowed transition-colors"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
