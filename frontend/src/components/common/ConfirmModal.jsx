import React from "react";

export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // 'danger' | 'primary' | 'success'
  onConfirm,
  onClose
}) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      confirmBtn: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20",
      iconBg: "bg-rose-100 text-rose-600",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )
    },
    success: {
      confirmBtn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
      iconBg: "bg-emerald-100 text-emerald-600",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    primary: {
      confirmBtn: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20",
      iconBg: "bg-indigo-100 text-indigo-600",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  };

  const currentType = typeConfig[type] || typeConfig.danger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 transform transition-all animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${currentType.iconBg}`}>
            {currentType.icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-slate-900 leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed break-words">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${currentType.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
