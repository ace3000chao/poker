import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function GameGuard({ gameId, children }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // checking | pass | blocked
  const [reason, setReason] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('poker_access_token')
    if (!token) {
      setStatus('blocked')
      setReason('请先登录')
      return
    }
    api.gameCheck(gameId)
      .then(() => setStatus('pass'))
      .catch(err => {
        setStatus('blocked')
        setReason(err.message || '暂时无法进行游戏')
      })
  }, [gameId])

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center text-school/60 text-sm">检查中...</div>
      </div>
    )
  }

  if (status === 'pass') {
    return children
  }

  // blocked
  const isLoginRequired = reason === '请先登录'
  return (
    <div className="flex flex-col min-h-[70vh]">
      {/* 顶栏 - 只有返回按钮 */}
      <header className="bg-school text-white px-4 py-2.5 sticky top-0 z-10 shadow-card flex items-center justify-between">
        <button onClick={() => navigate('/games')} className="flex items-center gap-1 text-sm hover:opacity-80">
          <span className="text-base leading-none">&#8249;</span>
          <span>返回</span>
        </button>
        <span className="text-xs text-white/60">游戏</span>
        <span className="opacity-0 px-3">占位</span>
      </header>

      {/* 准入提示页 */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
          <div className="text-5xl mb-3">{isLoginRequired ? '🔒' : '⚠️'}</div>
          <h2 className="text-xl font-bold text-school mb-2">
            {isLoginRequired ? '未登录' : '无法开始游戏'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">{reason}</p>
          <div className="flex gap-3 justify-center">
            {isLoginRequired && (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-6 py-2 bg-school text-white rounded-lg text-sm font-semibold hover:bg-school-dark"
                >
                  去登录
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="px-6 py-2 bg-gold/20 text-gold-dark rounded-lg text-sm font-semibold"
                >
                  去注册
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/games')}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
