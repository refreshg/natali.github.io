
import * as React from 'react'
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' }
export const Button = React.forwardRef<HTMLButtonElement, Props>(({ className='', variant, ...p }, ref) => (
  <button ref={ref} {...p}
    className={[
      'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition',
      variant==='outline'
        ? 'border border-rose-200 text-rose-700 bg-white hover:bg-rose-50'
        : 'bg-rose-600 text-white hover:bg-rose-700',
      className
    ].join(' ')}
  />
))
export default Button
