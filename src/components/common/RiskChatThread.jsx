import { CornerUpLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useI18n } from '../../app/context/I18nContext'
const localeByLanguage = {
  ru: 'ru-RU',
  en: 'en-GB',
  uz: 'uz-UZ',
}

function getInitials(name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!words.length) {
    return 'SY'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

function getMessagePreview(item) {
  if (!item) {
    return ''
  }
  return item.notes || item.title || ''
}

function getCollapsedPreview(item, maxLength = 88) {
  const preview = getMessagePreview(item)
    .replace(/\s+/g, ' ')
    .trim()

  if (!preview) {
    return ''
  }

  if (preview.length <= maxLength) {
    return preview
  }

  return `${preview.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function isCommentEntry(item) {
  return item?.type === 'comment'
}

function getMessageLocale() {
  if (typeof window === 'undefined') {
    return 'ru-RU'
  }

  const language = window.localStorage.getItem('erm_language_v1') ?? 'ru'
  return localeByLanguage[language] ?? 'en-GB'
}

function formatMessageStamp(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const locale = getMessageLocale()
  const now = new Date()
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  return new Intl.DateTimeFormat(
    locale,
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' },
  ).format(date)
}

export default function RiskChatThread({
  items = [],
  currentUser,
  users = [],
  onSend,
  sending = false,
  focusToken = 0,
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const [replyTargetId, setReplyTargetId] = useState(null)
  const textareaRef = useRef(null)
  const viewportRef = useRef(null)

  const messages = useMemo(
    () =>
      [...items].sort(
        (left, right) => new Date(left.at || 0).getTime() - new Date(right.at || 0).getTime(),
      ),
    [items],
  )

  const messagesById = useMemo(
    () => new Map(messages.map((item) => [String(item.id), item])),
    [messages],
  )

  const replyTarget = replyTargetId ? messagesById.get(String(replyTargetId)) : null

  useEffect(() => {
    if (focusToken && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [focusToken])

  useEffect(() => {
    if (!textareaRef.current) {
      return
    }

    textareaRef.current.style.height = '0px'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
  }, [draft])

  useEffect(() => {
    if (!viewportRef.current) {
      return
    }

    viewportRef.current.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length])

  const handleSend = async () => {
    const trimmed = draft.trim()
    if (!trimmed || sending) {
      return
    }

    try {
      await onSend(trimmed, replyTarget ?? null)
      setDraft('')
      setReplyTargetId(null)
    } catch {
      return
    }
  }

  const handleKeyDown = async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      await handleSend()
    }
  }

  const handleReplySelect = (messageId) => {
    setReplyTargetId(messageId)
    textareaRef.current?.focus()
  }

  return (
    <div className="audit-chat-shell">
      <div className="audit-chat-header">
        <div className="audit-chat-header__title">{t('details.auditTimeline')}</div>
        {!messages.length ? <p className="audit-chat-header__hint">{t('details.chatHint')}</p> : null}
      </div>

      <div ref={viewportRef} className="audit-chat-stage scroll-panel">
        {messages.length ? (
          messages.map((item) => {
            const isComment = isCommentEntry(item)
            const isMine = isComment && currentUser?.name && item.by === currentUser.name
            const replySource = item?.diff?.replyTo ? messagesById.get(String(item.diff.replyTo)) : null
            const isReply = Boolean(replySource)
            const linkedUser = users.find((user) => user.name === item.by)
            const initials = linkedUser?.initials ?? getInitials(item.by)
            const preview = getMessagePreview(replySource)
            const collapsedPreview = getCollapsedPreview(replySource)

            if (!isComment) {
              return (
                <article key={item.id} className="audit-system-row">
                  <div className="audit-system-line">
                    <span className="audit-system-line__badge">{t('details.chatSystemLabel')}</span>
                    <p className="audit-system-line__text">{item.title || t('details.chatSystemLabel')}</p>
                    <span className="audit-system-line__meta">{item.by || t('details.chatSystemLabel')}</span>
                    <span className="audit-system-line__meta">{formatMessageStamp(item.at)}</span>
                    <button
                      type="button"
                      className="audit-system-line__action"
                      onClick={() => handleReplySelect(item.id)}
                    >
                      {t('details.chatReply')}
                    </button>
                  </div>
                </article>
              )
            }

            return (
              <article
                key={item.id}
                className={clsx(
                  'audit-message-row',
                  isMine ? 'audit-message-row--mine' : 'audit-message-row--peer',
                  isReply ? 'audit-message-row--thread' : null,
                )}
              >
                {!isMine ? <div className="audit-avatar">{initials}</div> : null}

                <div
                  className={clsx(
                    'audit-message-body',
                    isMine ? 'audit-message-body--mine' : 'audit-message-body--peer',
                  )}
                >
                  <div
                    className={clsx(
                      'audit-bubble',
                      isMine ? 'audit-bubble--mine' : 'audit-bubble--peer',
                      isReply ? 'audit-bubble--thread' : null,
                    )}
                  >
                    <div className="audit-bubble__header">
                      <div className="audit-bubble__author-group">
                        <p className="audit-bubble__author">{item.by}</p>
                        {isReply ? <span className="audit-thread-pill">{t('details.chatThreadLabel')}</span> : null}
                      </div>
                      <p className="audit-bubble__stamp">{formatMessageStamp(item.at)}</p>
                    </div>

                    {replySource ? (
                      <div
                        className={clsx(
                          'audit-bubble__quote',
                          isMine ? 'audit-bubble__quote--mine' : 'audit-bubble__quote--peer',
                        )}
                      >
                        <p className="audit-bubble__quote-label">
                          {t('details.chatReplyingTo', {
                            name: replySource.by || t('details.chatSystemLabel'),
                          })}
                        </p>
                        {collapsedPreview ? <p className="audit-bubble__quote-text">{collapsedPreview}</p> : null}
                      </div>
                    ) : null}

                    <p className="audit-bubble__text">{item.notes || item.title}</p>
                  </div>

                  <button
                    type="button"
                    className="audit-reply-fab"
                    aria-label={t('details.chatReply')}
                    title={t('details.chatReply')}
                    onClick={() => handleReplySelect(item.id)}
                  >
                    <CornerUpLeft className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isMine ? <div className="audit-avatar audit-avatar--mine">{initials}</div> : null}
              </article>
            )
          })
        ) : (
          <div className="audit-chat-empty">{t('details.chatEmpty')}</div>
        )}
      </div>

      <div className="audit-composer">
        {replyTarget ? (
          <div className="audit-composer__reply">
            <div className="audit-composer__reply-copy">
              <div className="min-w-0">
                <p className="audit-composer__reply-label">
                  {t('details.chatReplyingTo', { name: replyTarget.by || t('details.chatSystemLabel') })}
                </p>
                <p className="audit-composer__reply-text">{getMessagePreview(replyTarget)}</p>
              </div>
            </div>
            <button
              type="button"
              className="audit-composer__reply-cancel"
              onClick={() => setReplyTargetId(null)}
            >
              {t('details.chatCancelReply')}
            </button>
          </div>
        ) : null}

        <div className="audit-composer__row">
          <textarea
            ref={textareaRef}
            rows={1}
            className="audit-composer__input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => void handleKeyDown(event)}
            placeholder={t('details.chatPlaceholder')}
          />
          <button
            type="button"
            className="audit-composer__send"
            disabled={!draft.trim() || sending}
            onClick={() => void handleSend()}
          >
            {sending ? t('details.chatSending') : t('details.chatSend')}
          </button>
        </div>

      </div>
    </div>
  )
}
