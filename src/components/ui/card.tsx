
import * as React from 'react'
export function Card({ className='', ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={['rounded-2xl border bg-white', className].join(' ')} />
}
export function CardContent({ className='', ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={['p-4', className].join(' ')} />
}
