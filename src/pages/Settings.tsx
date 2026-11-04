import { useState } from 'react'
import { Settings, Save, FolderOpen } from 'lucide-react'
import { Modal } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'
import type { AppSettings } from '../types'

export default function SettingsPage() {
  const { settings, setSetting } = useSettings()
  const [form, setForm]   = useState<AppSettings>({ ...settings })
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [clearSections, setClearSections] = useState<string[]>([])
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearPassword, setClearPassword] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const set = (k: keyof AppSettings, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    for (const [key, value] of Object.entries(form)) {
      await setSetting(key as keyof AppSettings, value)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function selectBackupFolder() {
    const folder = await window.api.backup.selectFolder()
    if (folder) set('autoBackupPath', folder)
  }

  async function createBackup() {
    const ok = await window.api.backup.create()
    if (ok) alert('تم إنشاء النسخة الاحتياطية بنجاح')
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Settings size={22} className="text-emerald-600" />
        الإعدادات
      </h1>

      <div className="space-y-6">
        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">إعدادات المتجر</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">اسم المتجر</label>
              <input value={form.storeName} onChange={e => set('storeName', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">العملة</label>
                <select value={form.currency} onChange={e => set('currency', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="ج.م">ج.م (جنيه مصري)</option>
                  <option value="EGP">EGP</option>
                  <option value="$">$ (دولار)</option>
                  <option value="€">€ (يورو)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">ضريبة القيمة المضافة (%)</label>
                <input type="number" value={form.taxRate} onChange={e => set('taxRate', e.target.value)}
                  min={0} max={100} step={0.1}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="text-xs text-slate-400 mt-1">ض.ق.م المصرية 14% — يطبق على فواتير البيع حسب الإعداد</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4">النسخ الاحتياطي</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.autoBackupEnabled === 'true'}
                onChange={e => set('autoBackupEnabled', e.target.checked ? 'true' : 'false')}
                className="w-4 h-4 rounded text-emerald-600" />
              <span className="text-sm text-slate-700">تفعيل النسخ الاحتياطي التلقائي</span>
            </label>

            {form.autoBackupEnabled === 'true' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">مجلد النسخ الاحتياطي</label>
                  <div className="flex gap-2">
                    <input value={form.autoBackupPath} readOnly
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50" />
                    <button onClick={selectBackupFolder}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                      <FolderOpen size={14} /> تصفح
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">تكرار النسخ</label>
                  <select value={form.autoBackupInterval} onChange={e => set('autoBackupInterval', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="daily">يومياً</option>
                    <option value="weekly">أسبوعياً</option>
                  </select>
                </div>
              </>
            )}

            <button onClick={createBackup}
              className="w-full border border-emerald-200 text-emerald-700 py-2 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors">
              إنشاء نسخة احتياطية الآن
            </button>

            <button onClick={() => setShowClearModal(true)}
              className="w-full border border-red-200 text-red-700 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
              مسح البيانات
            </button>
          </div>
        </section>

        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors">
          <Save size={16} />
          {saving ? 'جاري الحفظ...' : saved ? 'تم الحفظ ✓' : 'حفظ الإعدادات'}
        </button>
      </div>

      {showClearModal && (
        <Modal title="مسح البيانات" onClose={() => {
          if (clearing) return
          setShowClearModal(false)
          setClearPassword('')
          setClearError('')
        }}>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={clearSections.length === 12}
                onChange={e => setClearSections(e.target.checked ? ['sales','returns','purchases','stock','transfers','inventory','products','customers','suppliers','expenses','accounting','banks'] : [])} />
              مسح الجميع
            </label>
            <div className="space-y-1 border-t pt-2">
              {['sales','returns','purchases','stock','transfers','inventory','products','customers','suppliers','expenses','accounting','banks'].map(sec => (
                <label key={sec} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={clearSections.includes(sec)}
                    onChange={e => setClearSections(prev => e.target.checked ? [...prev, sec] : prev.filter(x => x !== sec))} />
                  {sec}
                </label>
              ))}
            </div>
            <div className="border-t pt-3 space-y-2">
              <label className="block text-sm font-medium text-slate-700">كلمة مرور المدير مطلوبة لتأكيد الحذف</label>
              <input
                type="password"
                value={clearPassword}
                onChange={e => { setClearPassword(e.target.value); setClearError('') }}
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور"
                disabled={clearing}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {clearError && <p role="alert" className="text-sm text-red-600">{clearError}</p>}
            </div>
            <button
              disabled={clearing || clearSections.length === 0 || !clearPassword.trim()}
              onClick={async () => {
                if (clearSections.length === 0) {
                  setClearError('اختر قسمًا واحدًا على الأقل')
                  return
                }
                if (!clearPassword.trim()) {
                  setClearError('أدخل كلمة مرور المدير')
                  return
                }
                if (!confirm('تحذير: سيتم حذف البيانات المحددة نهائيًا ولا يمكن التراجع. هل تريد المتابعة؟')) return
                setClearing(true)
                setClearError('')
                try {
                  const sections = clearSections.length === 12 ? undefined : clearSections
                  const result = await window.api.system.clearAllData(sections, clearPassword)
                  if (result?.ok !== true) throw new Error('لم يؤكد النظام إتمام عملية الحذف')
                  alert('تم مسح البيانات بنجاح')
                  setShowClearModal(false)
                  window.location.reload()
                } catch (e: any) {
                  setClearError(e?.message || 'فشل مسح البيانات')
                } finally {
                  setClearing(false)
                }
              }}
              className="w-full border border-red-200 text-red-700 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {clearing ? 'جارٍ مسح البيانات...' : 'تأكيد المسح'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
