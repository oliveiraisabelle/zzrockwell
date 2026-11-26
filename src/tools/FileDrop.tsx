import { useState } from 'react'

interface Props {
  accept: string
  title: string
  hint: string
  onFile: (file: File | undefined) => void
  /** Versão menor, para dois quadros lado a lado. */
  compact?: boolean
  icon?: 'file' | 'image'
}

/** Área de arrastar e soltar (ou clicar) para escolher um arquivo. */
export function FileDrop({ accept, title, hint, onFile, compact, icon = 'file' }: Props) {
  const [dragging, setDragging] = useState(false)
  return (
    <label
      className={`drop${compact ? ' drop-compact' : ''}${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        onFile(e.dataTransfer.files[0])
      }}
    >
      <input type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0])} />
      {icon === 'image' ? (
        <svg className="drop-icon" viewBox="0 0 48 48" aria-hidden="true">
          <rect x="6" y="10" width="36" height="28" rx="3" />
          <circle cx="17" cy="20" r="3.5" />
          <path d="M6 33l11-10 9 8 6-5 10 9" />
        </svg>
      ) : (
        <svg className="drop-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M28 6H13a3 3 0 0 0-3 3v30a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V16z" />
          <path d="M28 6v10h10" />
          <path d="M24 34V22M19 27l5-5 5 5" />
        </svg>
      )}
      <span className="drop-title">{title}</span>
      <span className="drop-sub">
        ou <u>clique para escolher</u> · {hint}
      </span>
    </label>
  )
}
