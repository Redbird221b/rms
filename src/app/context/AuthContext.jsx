import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { demoAccounts, users } from '../../data/seed'
import { canAccessPath, getPermissions, getRoleConfig, hasPermission as hasPermissionForUser } from '../../lib/access'
import { loadFromStorage, saveToStorage } from '../../lib/storage'

const STORAGE_KEY = 'erm_session_user_v1'
const AuthContext = createContext(null)

function findUserById(userId) {
  return users.find((user) => user.id === userId) ?? null
}

export function AuthProvider({ children }) {
  const [currentUserId, setCurrentUserId] = useState(() => loadFromStorage(STORAGE_KEY, null))

  useEffect(() => {
    saveToStorage(STORAGE_KEY, currentUserId)
  }, [currentUserId])

  const currentUser = useMemo(() => {
    const user = findUserById(currentUserId)
    if (!user) {
      return null
    }
    return {
      ...user,
      permissions: getPermissions(user.accessRole),
      roleConfig: getRoleConfig(user.accessRole),
    }
  }, [currentUserId])

  const value = useMemo(
    () => ({
      currentUser,
      accounts: demoAccounts,
      isAuthenticated: Boolean(currentUser),
      login: ({ username, password }) => {
        const user = users.find(
          (entry) =>
            (entry.username === username || entry.email === username) &&
            entry.password === password,
        )
        if (!user) {
          return { ok: false }
        }
        setCurrentUserId(user.id)
        return { ok: true, user }
      },
      loginAsUserId: (userId) => {
        const user = findUserById(userId)
        if (!user) {
          return { ok: false }
        }
        setCurrentUserId(user.id)
        return { ok: true, user }
      },
      logout: () => setCurrentUserId(null),
      hasPermission: (permission) => hasPermissionForUser(currentUser, permission),
      canAccessPath: (pathname) => canAccessPath(currentUser, pathname),
    }),
    [currentUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
