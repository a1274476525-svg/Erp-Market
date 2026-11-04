import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'

interface SimpleUser { id: number; name: string; role: string }

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-lg'
  return (
    <div className={`${sz} bg-emerald-600 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {name[0]}
    </div>
  )
}

function FirstSetup({ onCreated }: { onCreated: () => void }) {
  const [name, setName]       = useState('')
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  async function create() {
    if (!name.trim())           return setError('الاسم مطلوب')
    if (!/^\d{4}$/.test(pin))   return setError('رقم الدخول يجب أن يكون 4 أرقام')
    if (pin !== confirm)        return setError('رقما الدخول غير متطابقين')
    setSaving(true)
    try {
      await window.api.auth.create({ name: name.trim(), pin, role: 'مدير النظام' })
      onCreated()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm">
      <h2 className="text-white font-bold text-xl mb-1">إعداد المدير الأول</h2>
      <p className="text-slate-400 text-sm mb-6">أنشئ حساب مدير النظام للبدء</p>
      {error && <p className="text-red-400 bg-red-900/30 rounded-lg px-3 py-2 text-sm mb-4">{error}</p>}
      <div className="space-y-4">
        <div>
          <label className="text-slate-400 text-sm block mb-1">الاسم</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المدير"
            className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-slate-400 text-sm block mb-1">رقم الدخول (4 أرقام)</label>
          <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
            type="password" maxLength={4} placeholder="• • • •"
            className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 tracking-widest text-center text-xl" />
        </div>
        <div>
          <label className="text-slate-400 text-sm block mb-1">تأكيد رقم الدخول</label>
          <input value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,'').slice(0,4))}
            type="password" maxLength={4} placeholder="• • • •"
            className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 tracking-widest text-center text-xl" />
        </div>
        <button onClick={create} disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-semibold transition-colors disabled:opacity-50">
          {saving ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
        </button>
      </div>
    </div>
  )
}

function PinPad({ user, onBack }: { user: SimpleUser; onBack: () => void }) {
  const { login } = useAuth()
  const [pin, setPin]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function press(d: string) {
    if (pin.length >= 4 || loading) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) submit(next)
  }

  function backspace() { setPin(p => p.slice(0, -1)); setError('') }

  async function submit(p = pin) {
    if (p.length < 4) return
    setLoading(true)
    const ok = await login(user.id, p)
    setLoading(false)
    if (!ok) { setError('رقم الدخول غير صحيح'); setPin('') }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') backspace()
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pin, loading])

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm">
      <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-2">
        ← تغيير المستخدم
      </button>
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={user.name} size="lg" />
        <div>
          <div className="text-white font-semibold text-lg">{user.name}</div>
          {user.role && <div className="text-slate-400 text-sm">{user.role}</div>}
        </div>
      </div>
      <div className="flex justify-center gap-4 mb-4">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < pin.length ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-slate-500'
          }`} />
        ))}
      </div>
      {error && <p className="text-red-400 text-center text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {keys.map((k, i) => (
          <button key={i}
            onClick={() => k === '⌫' ? backspace() : k ? press(k) : undefined}
            disabled={!k || loading}
            className={`h-14 rounded-xl text-xl font-semibold transition-all active:scale-95 ${
              !k ? 'opacity-0 pointer-events-none' :
              k === '⌫' ? 'bg-slate-600 text-slate-300 hover:bg-slate-500' :
              'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-500'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Login() {
  const { settings } = useSettings()
  const [users, setUsers]       = useState<SimpleUser[]>([])
  const [selected, setSelected] = useState<SimpleUser | null>(null)
  const [loading, setLoading]   = useState(true)
  const [setup, setSetup]       = useState(false)

  async function loadUsers() {
    setLoading(true)
    const list = await window.api.auth.listUsers()
    setUsers(list)
    setLoading(false)
    if (list.length === 0) setSetup(true)
  }

  useEffect(() => { loadUsers() }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-black text-white">U</div>
        <h1 className="text-3xl font-bold text-white">{settings.storeName || 'يو ماركت'}</h1>
        <p className="text-slate-400 mt-2 text-sm">
          {setup ? 'مرحباً! قم بإعداد النظام أولاً' : 'اختر اسمك وأدخل رقم الدخول'}
        </p>
      </div>
      {setup ? (
        <FirstSetup onCreated={() => { setSetup(false); loadUsers() }} />
      ) : selected ? (
        <PinPad user={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="w-full max-w-sm space-y-3">
          {users.map(u => (
            <button key={u.id} onClick={() => setSelected(u)}
              className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-xl p-4 flex items-center gap-4 transition-all">
              <Avatar name={u.name} />
              <div className="text-right">
                <div className="font-semibold">{u.name}</div>
                {u.role && <div className="text-slate-400 text-sm">{u.role}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
