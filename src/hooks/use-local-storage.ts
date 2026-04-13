import { useEffect, useState } from 'react'

function getInitialValue<T>(initialValue: T | (() => T)): T {
	return initialValue instanceof Function ? initialValue() : initialValue
}

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
	const [storedValue, setStoredValue] = useState<T>(() => {
		if (typeof window === 'undefined') {
			return getInitialValue(initialValue)
		}

		try {
			const item = window.localStorage.getItem(key)
			if (item === null) {
				return getInitialValue(initialValue)
			}

			return JSON.parse(item) as T
		} catch {
			return getInitialValue(initialValue)
		}
	})

	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}

		try {
			window.localStorage.setItem(key, JSON.stringify(storedValue))
		} catch {
			// Ignore storage write failures and keep the in-memory state usable.
		}
	}, [key, storedValue])

	return [storedValue, setStoredValue] as const
}
