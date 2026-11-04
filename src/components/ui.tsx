import { X } from 'lucide-react'

export const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

export function Modal({
  title, children, onClose, maxWidth = 'max-w-md',
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl w-full ${maxWidth} p-6 shadow-xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function DeleteConfirm({
  onConfirm, onCancel, message = 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
}: {
  onConfirm: () => void
  onCancel: () => void
  message?: string
}) {
  return (
    <Modal title="تأكيد الحذف" onClose={onCancel}>
      <p className="text-slate-500 text-sm mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onConfirm}
          className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-medium">
          حذف
        </button>
        <button onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
          إلغاء
        </button>
      </div>
    </Modal>
  )
}

export function SaveCancelButtons({
  saving, onCancel, saveLabel = 'حفظ',
}: { saving: boolean; onCancel: () => void; saveLabel?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="submit" disabled={saving}
        className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
        {saving ? 'جاري الحفظ...' : saveLabel}
      </button>
      <button type="button" onClick={onCancel}
        className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
        إلغاء
      </button>
    </div>
  )
}

export function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    amber:  'bg-amber-100 text-amber-700',
    blue:   'bg-blue-100 text-blue-700',
    slate:  'bg-slate-100 text-slate-700',
    emerald:'bg-emerald-100 text-emerald-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] ?? colors.slate}`}>
      {label}
    </span>
  )
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      {action}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-slate-400 text-sm">{message}</div>
  )
}
