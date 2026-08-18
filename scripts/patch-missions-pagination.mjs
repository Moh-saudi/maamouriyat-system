import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, '../src/app/dashboard/missions/missions-portal.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add pagination states and computation right after filteredMissions useMemo
const paginationStateCode = `
  // --- Pagination State (Default 30 rows per page) ---
  const [pageSize, setPageSize] = useState<number>(30)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, priorityFilter, destinationFilter, pageSize])

  const totalItems = filteredMissions.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const paginatedMissions = useMemo(() => {
    return filteredMissions.slice(startIndex, endIndex)
  }, [filteredMissions, startIndex, endIndex])
`

if (!content.includes('const paginatedMissions')) {
  content = content.replace(
    '  function getPriorityBadgeClass(priority: string) {',
    `${paginationStateCode}\n  function getPriorityBadgeClass(priority: string) {`
  )
  console.log('✓ Injected pagination state and paginatedMissions calculation')
}

// 2. Replace filteredMissions.map with paginatedMissions.map in both views
content = content.replace('{filteredMissions.map((mission) => {', '{paginatedMissions.map((mission) => {')
content = content.replace('{filteredMissions.map((mission) => {', '{paginatedMissions.map((mission) => {')
console.log('✓ Replaced filteredMissions.map with paginatedMissions.map')

// 3. Add Pagination Bar component after table section
const paginationBarHtml = `
      {/* 4. MODERN PAGINATION BAR */}
      {filteredMissions.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'white',
          border: '1px solid #cfdcde',
          borderRadius: '12px',
          padding: '12px 18px',
          marginTop: '16px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* A. Page Size Selector & Count info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', color: '#546e7a' }}>عدد الصفوف بالصفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  minHeight: '34px',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  background: '#f8fbfb',
                  color: '#0f172a',
                  padding: '0 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={15}>15 سطر</option>
                <option value={30}>30 سطر</option>
                <option value={50}>50 سطر</option>
                <option value={100}>100 سطر</option>
              </select>
            </div>

            <span style={{ fontSize: '12.5px', color: '#78909c' }}>|</span>

            <span style={{ fontSize: '12.5px', color: '#546e7a', fontWeight: 'bold' }}>
              عرض <span style={{ color: 'var(--brand)' }}>{startIndex + 1}</span> - <span style={{ color: 'var(--brand)' }}>{endIndex}</span> من أصل <span style={{ color: '#0f172a' }}>{totalItems}</span> مأمورية
            </span>
          </div>

          {/* B. Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* First Page */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              style={{
                minHeight: '34px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                background: currentPage === 1 ? '#f8fbfb' : 'white',
                color: currentPage === 1 ? '#b0bec5' : '#37474f',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
              title="الصفحة الأولى"
            >
              « الأولى
            </button>

            {/* Prev Page */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                minHeight: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                background: currentPage === 1 ? '#f8fbfb' : 'white',
                color: currentPage === 1 ? '#b0bec5' : '#37474f',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
            >
              ‹ السابق
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1]
                const showEllipsis = prev && p - prev > 1

                return (
                  <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {showEllipsis && <span style={{ color: '#90a4ae', fontSize: '12px' }}>...</span>}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      style={{
                        minWidth: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        border: p === currentPage ? '1px solid var(--brand)' : '1px solid #cfdcde',
                        background: p === currentPage ? 'var(--brand)' : 'white',
                        color: p === currentPage ? 'white' : '#37474f',
                        fontSize: '12.5px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: p === currentPage ? '0 2px 6px rgba(0,109,119,0.2)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {p}
                    </button>
                  </div>
                )
              })}

            {/* Next Page */}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                minHeight: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                background: currentPage === totalPages ? '#f8fbfb' : 'white',
                color: currentPage === totalPages ? '#b0bec5' : '#37474f',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
            >
              التالي ›
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              style={{
                minHeight: '34px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                background: currentPage === totalPages ? '#f8fbfb' : 'white',
                color: currentPage === totalPages ? '#b0bec5' : '#37474f',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
              title="الصفحة الأخيرة"
            >
              الأخيرة »
            </button>
          </div>
        </div>
      )}
`

if (!content.includes('4. MODERN PAGINATION BAR')) {
  content = content.replace(
    '        </section>\n      )}\n\n      {/* 4. EXTEND MISSION MODAL POPUP */',
    `        </section>\n      )}\n${paginationBarHtml}\n\n      {/* 4. EXTEND MISSION MODAL POPUP */`
  )
  console.log('✓ Added Pagination Bar HTML')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully patched missions pagination in missions-portal.tsx!')
