'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth-store'

export default function RegisterPage() {
  const router = useRouter()
  const register = useAuthStore((s) => s.register)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }

    setLoading(true)
    const result = await register(email, name, password)
    setLoading(false)
    if (result.ok) {
      router.push('/')
    } else {
      setError(result.error ?? '회원가입에 실패했습니다')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-primary text-center mb-1">ThinkToRealization</h1>
        <p className="text-caption text-text-secondary text-center mb-8">새 계정을 만드세요</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-3 py-2 rounded-button bg-red-50 border border-red-200 text-caption text-red-600">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-caption text-text-secondary">이름</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="px-3 py-2 rounded-button border border-border bg-surface text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="홍길동"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-caption text-text-secondary">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-3 py-2 rounded-button border border-border bg-surface text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="email@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-caption text-text-secondary">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="px-3 py-2 rounded-button border border-border bg-surface text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              placeholder="6자 이상"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="passwordConfirm" className="text-caption text-text-secondary">비밀번호 확인</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              className={`px-3 py-2 rounded-button border bg-surface text-body text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent ${
                passwordConfirm && password !== passwordConfirm
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200/20'
                  : 'border-border'
              }`}
              placeholder="비밀번호를 다시 입력하세요"
            />
            {passwordConfirm && password !== passwordConfirm && (
              <span className="text-[11px] text-red-500 mt-0.5">비밀번호가 일치하지 않습니다</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || (!!passwordConfirm && password !== passwordConfirm)}
            className="px-4 py-2.5 rounded-button bg-accent text-white font-medium text-body hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <p className="text-caption text-text-tertiary text-center mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-accent hover:underline">로그인</Link>
        </p>
      </div>
    </div>
  )
}
