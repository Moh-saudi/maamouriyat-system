'use client'

import { Printer } from 'lucide-react'
import styles from './print.module.css'

export function PrintButton() {
  return (
    <button className={styles.printButton} onClick={() => window.print()} type="button">
      <Printer size={18} />
      طباعة النموذج
    </button>
  )
}
