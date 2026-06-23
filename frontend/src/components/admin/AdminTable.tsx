import type { ReactNode } from 'react';

export interface AdminColumn<T = any> {
  key: string;
  title: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, record: T, index: number) => ReactNode;
  sortable?: boolean;
}

export default function AdminTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyText = '暂无数据',
  rowKey = 'id',
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
}: {
  columns: AdminColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  rowKey?: string;
  onRowClick?: (record: T) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    onSort(key);
  };

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`admin-th ${col.sortable ? 'sortable' : ''} ${sortBy === col.key ? 'sorted' : ''}`}
                style={{ width: col.width, textAlign: col.align || 'left' }}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="admin-th-inner">
                  {col.title}
                  {col.sortable && (
                    <span className="admin-sort-icon">
                      {sortBy === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skel-${i}`} className="admin-row">
                {columns.map((col) => (
                  <td key={col.key} className="admin-td">
                    <div className="admin-skeleton" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="admin-td-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((record, idx) => (
              <tr
                key={record[rowKey] ?? idx}
                className={`admin-row ${onRowClick ? 'clickable' : ''}`}
                onClick={onRowClick ? () => onRowClick(record) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="admin-td"
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render
                      ? col.render(record[col.key], record, idx)
                      : record[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
