// 全局轻提示(单例)。任意模块 import { showToast } 即可调用,无需逐层传 props。
// 用法:showToast('积分已记录 +50')、showToast('上报失败', 'error')。
import { useEffect, useState } from 'react'

let _id = 0
const listeners = new Set()

// type: 'info' | 'success' | 'error'
export function showToast(message, type = 'info', duration = 2200) {
  if (!message) return
  const toast = { id: ++_id, message, type, duration }
  listeners.forEach((fn) => fn(toast))
}

const STYLE = {
  info: 'bg-gray-900/90',
  success: 'bg-school/95',
  error: 'bg-schoolred-dark/95',
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onToast = (t) => {
      setToasts((list) => [...list, t])
      setTimeout(() => {
        setToasts((list) => list.filter((x) => x.id !== t.id))
      }, t.duration)
    }
    listeners.add(onToast)
    return () => listeners.delete(onToast)
  }, [])

  if (toasts.length === 0) return null
  return (
    <div className="fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${STYLE[t.type] || STYLE.info} text-white text-sm px-4 py-2 rounded-full shadow-card max-w-[90%] text-center animate-pageIn`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
